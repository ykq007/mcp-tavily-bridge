import { Hono } from 'hono';

import type { Env } from '../../env.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { D1Client, generateId, type TavilyKey, type BraveKey, type ClientToken } from '../../db/d1.js';
import { encrypt, decrypt, maskApiKey, generateToken } from '../../crypto/crypto.js';
import { parseSearchSourceMode } from '../../mcp/searchSource.js';

// Tavily credits types and helpers
type TavilyCreditsSnapshot = {
  creditsRemaining: number | null;
  creditsKeyUsage: number | null;
  creditsKeyLimit: number | null;
  creditsKeyRemaining: number | null;
  creditsAccountPlanUsage: number | null;
  creditsAccountPlanLimit: number | null;
  creditsAccountPaygoUsage: number | null;
  creditsAccountPaygoLimit: number | null;
  creditsAccountRemaining: number | null;
};

class TavilyCreditsHttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TavilyCreditsHttpError';
    this.status = status;
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function diffOrNull(limit: number | null, usage: number | null): number | null {
  if (limit === null || usage === null) return null;
  return limit - usage;
}

function sumNonNegative(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  const av = a === null ? 0 : Math.max(0, a);
  const bv = b === null ? 0 : Math.max(0, b);
  return av + bv;
}

function minDefined(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function fetchTavilyCredits(apiKey: string): Promise<TavilyCreditsSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch('https://api.tavily.com/credits', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal
    });

    const text = await response.text();
    const body = safeJson(text);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new TavilyCreditsHttpError('Invalid API key', response.status);
      }
      const message = typeof body?.message === 'string' ? body.message : response.statusText || 'Failed to fetch credits';
      throw new TavilyCreditsHttpError(message, response.status);
    }

    const creditsKeyUsage = numberOrNull(body?.credits_key_usage ?? body?.key?.usage);
    const creditsKeyLimit = numberOrNull(body?.credits_key_limit ?? body?.key?.limit);
    const creditsKeyRemaining =
      numberOrNull(body?.credits_key_remaining) ?? diffOrNull(creditsKeyLimit, creditsKeyUsage);

    const creditsAccountPlanUsage = numberOrNull(body?.credits_account_plan_usage ?? body?.account?.plan_usage);
    const creditsAccountPlanLimit = numberOrNull(body?.credits_account_plan_limit ?? body?.account?.plan_limit);
    const creditsAccountPaygoUsage = numberOrNull(body?.credits_account_paygo_usage ?? body?.account?.paygo_usage);
    const creditsAccountPaygoLimit = numberOrNull(body?.credits_account_paygo_limit ?? body?.account?.paygo_limit);

    const planRemaining = diffOrNull(creditsAccountPlanLimit, creditsAccountPlanUsage);
    const paygoRemaining = diffOrNull(creditsAccountPaygoLimit, creditsAccountPaygoUsage);
    const creditsAccountRemaining = numberOrNull(body?.credits_account_remaining) ?? sumNonNegative(planRemaining, paygoRemaining);
    const creditsRemaining = numberOrNull(body?.credits_remaining) ?? minDefined(creditsKeyRemaining, creditsAccountRemaining);

    return {
      creditsRemaining,
      creditsKeyUsage,
      creditsKeyLimit,
      creditsKeyRemaining,
      creditsAccountPlanUsage,
      creditsAccountPlanLimit,
      creditsAccountPaygoUsage,
      creditsAccountPaygoLimit,
      creditsAccountRemaining
    };
  } catch (error: unknown) {
    if (error instanceof TavilyCreditsHttpError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TavilyCreditsHttpError('Tavily credits request timed out', 504);
    }
    throw new TavilyCreditsHttpError(error instanceof Error ? error.message : 'Failed to fetch credits', 502);
  } finally {
    clearTimeout(timeout);
  }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

// Create admin router
const adminRouter = new Hono<{ Bindings: Env }>();

// Apply admin auth to all routes
adminRouter.use('*', adminAuth);

// ============ Server Info ============

adminRouter.get('/server-info', async (c) => {
  const db = new D1Client(c.env.DB);
  const settings = await db.getServerSettings();

  // Get active key counts
  const tavilyKeys = await db.getTavilyKeys();
  const braveKeys = await db.getBraveKeys();
  const activeTavilyKeys = tavilyKeys.filter(k => k.status === 'active').length;
  const activeBraveKeys = braveKeys.filter(k => k.status === 'active').length;

  // Build settings map
  const settingsMap: Record<string, string> = {};
  for (const setting of settings) {
    settingsMap[setting.key] = setting.value;
  }

  return c.json({
    tavilyKeySelectionStrategy: settingsMap.tavilyKeySelectionStrategy || c.env.TAVILY_KEY_SELECTION_STRATEGY || 'round_robin',
    searchSourceMode: parseSearchSourceMode(settingsMap.searchSourceMode || c.env.SEARCH_SOURCE_MODE, 'brave_prefer_tavily_fallback'),
    braveSearchEnabled: activeBraveKeys > 0
  });
});

adminRouter.patch('/server-info', async (c) => {
  const body = await c.req.json<{ tavilyKeySelectionStrategy?: string; searchSourceMode?: string }>();
  const db = new D1Client(c.env.DB);

  if (body.tavilyKeySelectionStrategy) {
    if (body.tavilyKeySelectionStrategy !== 'round_robin' && body.tavilyKeySelectionStrategy !== 'random') {
      return c.json({ error: 'Invalid tavilyKeySelectionStrategy' }, 400);
    }
    await db.upsertServerSetting('tavilyKeySelectionStrategy', body.tavilyKeySelectionStrategy);
  }

  if (body.searchSourceMode) {
    const validModes = ['tavily_only', 'brave_only', 'combined', 'brave_prefer_tavily_fallback'];
    if (!validModes.includes(body.searchSourceMode)) {
      return c.json({ error: 'Invalid searchSourceMode' }, 400);
    }
    await db.upsertServerSetting('searchSourceMode', body.searchSourceMode);
  }

  // Return updated values with ok: true
  const settings = await db.getServerSettings();
  const settingsMap: Record<string, string> = {};
  for (const setting of settings) {
    settingsMap[setting.key] = setting.value;
  }

  const tavilyKeys = await db.getTavilyKeys();
  const braveKeys = await db.getBraveKeys();
  const activeBraveKeys = braveKeys.filter(k => k.status === 'active').length;

  return c.json({
    ok: true,
    tavilyKeySelectionStrategy: settingsMap.tavilyKeySelectionStrategy || c.env.TAVILY_KEY_SELECTION_STRATEGY || 'round_robin',
    searchSourceMode: parseSearchSourceMode(settingsMap.searchSourceMode || c.env.SEARCH_SOURCE_MODE, 'brave_prefer_tavily_fallback'),
    braveSearchEnabled: activeBraveKeys > 0,
  });
});

// ============ Keys (alias for Tavily Keys - for Admin UI compatibility) ============

adminRouter.get('/keys', async (c) => {
  const db = new D1Client(c.env.DB);
  const keys = await db.getTavilyKeys();

  return c.json(keys.map(k => ({
    id: k.id,
    label: k.label,
    maskedKey: k.keyMasked ?? null,
    status: k.status,
    cooldownUntil: k.cooldownUntil,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
    remainingCredits: k.creditsRemaining,
    totalCredits: null,
    lastCheckedAt: k.creditsCheckedAt,
  })));
});

adminRouter.post('/keys', async (c) => {
  try {
    const body = await c.req.json<{ label: string; apiKey: string }>();
    const { label, apiKey } = body;

    if (!label || !apiKey) {
      return c.json({ error: 'label and apiKey are required' }, 400);
    }

    const db = new D1Client(c.env.DB);

    // Encrypt the key
    let keyEncrypted: Uint8Array;
    try {
      keyEncrypted = await encrypt(apiKey, c.env.KEY_ENCRYPTION_SECRET);
    } catch (encryptError) {
      console.error('Encryption failed for /keys:', encryptError);
      return c.json({ 
        error: 'Failed to encrypt API key. Please check KEY_ENCRYPTION_SECRET configuration.' 
      }, 500);
    }

    const keyMasked = maskApiKey(apiKey);
    const id = generateId();

    try {
      await db.createTavilyKey({
        id,
        label,
        keyEncrypted: keyEncrypted.buffer as ArrayBuffer,
        keyMasked,
      });
    } catch (dbError: any) {
      console.error('Database error for /keys:', dbError);
      if (dbError.message && dbError.message.includes('UNIQUE constraint failed')) {
        return c.json({ error: 'A key with this label already exists' }, 409);
      }
      return c.json({ error: 'Failed to save key to database' }, 500);
    }

    return c.json({ id, label, keyMasked, status: 'active' }, 201);
  } catch (error) {
    console.error('Unexpected error in POST /keys:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

adminRouter.patch('/keys/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ status?: string }>();
  const db = new D1Client(c.env.DB);

  await db.updateTavilyKey(id, { status: body.status });
  return c.json({ id, status: body.status });
});

adminRouter.delete('/keys/:id', async (c) => {
  const id = c.req.param('id');
  const db = new D1Client(c.env.DB);

  await db.deleteTavilyKey(id);
  return c.json({ success: true });
});

// Key reveal - decrypt and return the API key
adminRouter.get('/keys/:id/reveal', async (c) => {
  const id = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const key = await db.getTavilyKeyById(id);
  if (!key) {
    return c.json({ error: 'Key not found' }, 404);
  }

  try {
    const keyEncrypted = new Uint8Array(key.keyEncrypted);
    const apiKey = await decrypt(keyEncrypted, c.env.KEY_ENCRYPTION_SECRET);
    return c.json({ apiKey });
  } catch (error) {
    console.error(`Failed to decrypt Tavily key ${id}:`, error);
    return c.json({ error: 'Failed to decrypt key' }, 500);
  }
});

adminRouter.post('/keys/:id/refresh-credits', async (c) => {
  const id = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const key = await db.getTavilyKeyById(id);
  if (!key) {
    return c.json({ error: 'Key not found' }, 404);
  }

  const lockMs = parsePositiveInt(c.env.TAVILY_CREDITS_REFRESH_LOCK_MS, 15_000);
  const lockId = await db.tryAcquireTavilyCreditsRefreshLock(id, lockMs);

  if (!lockId) {
    return c.json({ error: 'Credits refresh already in progress' }, 409);
  }

  try {
    const apiKey = await decrypt(new Uint8Array(key.keyEncrypted), c.env.KEY_ENCRYPTION_SECRET);
    const snapshot = await fetchTavilyCredits(apiKey);
    const now = new Date().toISOString();

    await db.updateTavilyKey(id, {
      creditsCheckedAt: now,
      creditsRemaining: snapshot.creditsRemaining,
      creditsKeyUsage: snapshot.creditsKeyUsage,
      creditsKeyLimit: snapshot.creditsKeyLimit,
      creditsKeyRemaining: snapshot.creditsKeyRemaining,
      creditsAccountPlanUsage: snapshot.creditsAccountPlanUsage,
      creditsAccountPlanLimit: snapshot.creditsAccountPlanLimit,
      creditsAccountPaygoUsage: snapshot.creditsAccountPaygoUsage,
      creditsAccountPaygoLimit: snapshot.creditsAccountPaygoLimit,
      creditsAccountRemaining: snapshot.creditsAccountRemaining
    });

    return c.json({
      remainingCredits: snapshot.creditsRemaining ?? 0,
      totalCredits: snapshot.creditsKeyLimit ?? 0
    });
  } catch (error: unknown) {
    if (error instanceof TavilyCreditsHttpError && (error.status === 401 || error.status === 403)) {
      await db.updateTavilyKey(id, { status: 'invalid' });
      return c.json({ error: 'Invalid API key' }, error.status);
    }

    const message = error instanceof Error ? error.message : 'Failed to refresh credits';
    const status = error instanceof TavilyCreditsHttpError ? error.status : 500;
    const safeStatus = status >= 400 && status <= 599 ? status : 500;
    return new Response(JSON.stringify({ error: message }), {
      status: safeStatus,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } finally {
    await db.releaseTavilyCreditsRefreshLock(id, lockId).catch(() => {});
  }
});

adminRouter.post('/keys/sync-credits', async (c) => {
  const db = new D1Client(c.env.DB);
  const keys = (await db.getTavilyKeys()).filter((key) => key.status === 'active');
  const lockMs = parsePositiveInt(c.env.TAVILY_CREDITS_REFRESH_LOCK_MS, 15_000);

  const results = await Promise.all(
    keys.map(async (key): Promise<boolean> => {
      const lockId = await db.tryAcquireTavilyCreditsRefreshLock(key.id, lockMs);
      if (!lockId) {
        return false;
      }

      try {
        const apiKey = await decrypt(new Uint8Array(key.keyEncrypted), c.env.KEY_ENCRYPTION_SECRET);
        const snapshot = await fetchTavilyCredits(apiKey);
        const now = new Date().toISOString();

        await db.updateTavilyKey(key.id, {
          creditsCheckedAt: now,
          creditsRemaining: snapshot.creditsRemaining,
          creditsKeyUsage: snapshot.creditsKeyUsage,
          creditsKeyLimit: snapshot.creditsKeyLimit,
          creditsKeyRemaining: snapshot.creditsKeyRemaining,
          creditsAccountPlanUsage: snapshot.creditsAccountPlanUsage,
          creditsAccountPlanLimit: snapshot.creditsAccountPlanLimit,
          creditsAccountPaygoUsage: snapshot.creditsAccountPaygoUsage,
          creditsAccountPaygoLimit: snapshot.creditsAccountPaygoLimit,
          creditsAccountRemaining: snapshot.creditsAccountRemaining
        });

        return true;
      } catch (error: unknown) {
        if (error instanceof TavilyCreditsHttpError && (error.status === 401 || error.status === 403)) {
          await db.updateTavilyKey(key.id, { status: 'invalid' });
        }
        return false;
      } finally {
        await db.releaseTavilyCreditsRefreshLock(key.id, lockId).catch(() => {});
      }
    })
  );

  const success = results.filter(Boolean).length;
  const failed = keys.length - success;
  return c.json({ ok: true, total: keys.length, success, failed });
});

// ============ Tavily Keys ============

adminRouter.get('/tavily-keys', async (c) => {
  const db = new D1Client(c.env.DB);
  const keys = await db.getTavilyKeys();

  return c.json(keys.map(k => ({
    id: k.id,
    label: k.label,
    maskedKey: k.keyMasked ?? null,
    status: k.status,
    cooldownUntil: k.cooldownUntil,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
    remainingCredits: k.creditsRemaining,
    totalCredits: null,
    lastCheckedAt: k.creditsCheckedAt,
  })));
});

adminRouter.post('/tavily-keys', async (c) => {
  try {
    const body = await c.req.json<{ label: string; key: string }>();
    const { label, key } = body;

    if (!label || !key) {
      return c.json({ error: 'label and key are required' }, 400);
    }

    const db = new D1Client(c.env.DB);

    // Encrypt the key
    let keyEncrypted: Uint8Array;
    try {
      keyEncrypted = await encrypt(key, c.env.KEY_ENCRYPTION_SECRET);
    } catch (encryptError) {
      console.error('Encryption failed for /tavily-keys:', encryptError);
      return c.json({ 
        error: 'Failed to encrypt API key. Please check KEY_ENCRYPTION_SECRET configuration.' 
      }, 500);
    }

    const keyMasked = maskApiKey(key);
    const id = generateId();

    try {
      await db.createTavilyKey({
        id,
        label,
        keyEncrypted: keyEncrypted.buffer as ArrayBuffer,
        keyMasked,
      });
    } catch (dbError: any) {
      console.error('Database error for /tavily-keys:', dbError);
      if (dbError.message && dbError.message.includes('UNIQUE constraint failed')) {
        return c.json({ error: 'A key with this label already exists' }, 409);
      }
      return c.json({ error: 'Failed to save key to database' }, 500);
    }

    return c.json({
      id,
      label,
      keyMasked,
      status: 'active',
    }, 201);
  } catch (error) {
    console.error('Unexpected error in POST /tavily-keys:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

adminRouter.put('/tavily-keys/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ label?: string; status?: string }>();

  const db = new D1Client(c.env.DB);

  await db.updateTavilyKey(id, {
    label: body.label,
    status: body.status,
  });

  return c.json({
    id,
    label: body.label,
    status: body.status,
  });
});

adminRouter.delete('/tavily-keys/:id', async (c) => {
  const id = c.req.param('id');
  const db = new D1Client(c.env.DB);

  await db.deleteTavilyKey(id);
  return c.json({ success: true });
});

// ============ Brave Keys ============

adminRouter.get('/brave-keys', async (c) => {
  const db = new D1Client(c.env.DB);
  const keys = await db.getBraveKeys();

  return c.json(keys.map(k => ({
    id: k.id,
    label: k.label,
    maskedKey: k.keyMasked ?? null,
    status: k.status,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
  })));
});

adminRouter.post('/brave-keys', async (c) => {
  try {
    const body = await c.req.json<{ label: string; key: string }>();
    const { label, key } = body;

    if (!label || !key) {
      return c.json({ error: 'label and key are required' }, 400);
    }

    const db = new D1Client(c.env.DB);

    // Encrypt the key
    let keyEncrypted: Uint8Array;
    try {
      keyEncrypted = await encrypt(key, c.env.KEY_ENCRYPTION_SECRET);
    } catch (encryptError) {
      console.error('Encryption failed for /brave-keys:', encryptError);
      return c.json({ 
        error: 'Failed to encrypt API key. Please check KEY_ENCRYPTION_SECRET configuration.' 
      }, 500);
    }

    const keyMasked = maskApiKey(key);
    const id = generateId();

    try {
      await db.createBraveKey({
        id,
        label,
        keyEncrypted: keyEncrypted.buffer as ArrayBuffer,
        keyMasked,
      });
    } catch (dbError: any) {
      console.error('Database error for /brave-keys:', dbError);
      if (dbError.message && dbError.message.includes('UNIQUE constraint failed')) {
        return c.json({ error: 'A key with this label already exists' }, 409);
      }
      return c.json({ error: 'Failed to save key to database' }, 500);
    }

    return c.json({
      id,
      label,
      keyMasked,
      status: 'active',
    }, 201);
  } catch (error) {
    console.error('Unexpected error in POST /brave-keys:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

adminRouter.delete('/brave-keys/:id', async (c) => {
  const id = c.req.param('id');
  const db = new D1Client(c.env.DB);

  await db.deleteBraveKey(id);
  return c.json({ success: true });
});

adminRouter.patch('/brave-keys/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ status?: string }>();
  const db = new D1Client(c.env.DB);

  await db.updateBraveKey(id, { status: body.status });
  return c.json({ id, status: body.status });
});

adminRouter.get('/brave-keys/:id/reveal', async (c) => {
  const id = c.req.param('id');
  const db = new D1Client(c.env.DB);

  const key = await db.getBraveKeyById(id);
  if (!key) {
    return c.json({ error: 'Key not found' }, 404);
  }

  try {
    const keyEncrypted = new Uint8Array(key.keyEncrypted);
    const apiKey = await decrypt(keyEncrypted, c.env.KEY_ENCRYPTION_SECRET);
    return c.json({ apiKey });
  } catch (error) {
    console.error(`Failed to decrypt Brave key ${id}:`, error);
    return c.json({ error: 'Failed to decrypt key' }, 500);
  }
});

// ============ Client Tokens ============

adminRouter.get('/tokens', async (c) => {
  const db = new D1Client(c.env.DB);
  const tokens = await db.getClientTokens();

  return c.json(tokens.map(t => ({
    id: t.id,
    description: t.description,
    tokenPrefix: t.tokenPrefix,
    scopesJson: t.scopesJson,
    expiresAt: t.expiresAt,
    revokedAt: t.revokedAt,
    createdAt: t.createdAt,
  })));
});

adminRouter.post('/tokens', async (c) => {
  const body = await c.req.json<{ description?: string; expiresAt?: string; allowedTools?: string[]; rateLimit?: number }>();

  const db = new D1Client(c.env.DB);

  // Generate a new token
  const token = generateToken(32);
  const tokenPrefix = token.substring(0, 8);
  const id = generateId();

  // Hash the token
  const encoder = new TextEncoder();
  const tokenData = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', tokenData);

  // Phase 3.4: Validate allowedTools if provided
  const allowedToolsValue = Array.isArray(body.allowedTools) && body.allowedTools.length > 0
    ? JSON.stringify(body.allowedTools)
    : null;

  // Phase 3.5: Validate rateLimit if provided
  const rateLimitValue = typeof body.rateLimit === 'number' && Number.isFinite(body.rateLimit) && body.rateLimit > 0
    ? Math.floor(body.rateLimit)
    : null;

  await db.createClientToken({
    id,
    description: body.description,
    tokenPrefix,
    tokenHash: hashBuffer,
    expiresAt: body.expiresAt,
    allowedTools: allowedToolsValue,
    rateLimit: rateLimitValue,
  });

  // Return the full token only once (it can't be retrieved later)
  return c.json({
    id,
    token, // Only returned on creation
    tokenPrefix,
    description: body.description,
    expiresAt: body.expiresAt,
  }, 201);
});

adminRouter.delete('/tokens/:id', async (c) => {
  const id = c.req.param('id');
  const db = new D1Client(c.env.DB);

  // Soft delete by setting revokedAt
  await db.revokeClientToken(id);

  return c.json({ success: true });
});

adminRouter.post('/tokens/:id/revoke', async (c) => {
  const id = c.req.param('id');
  const db = new D1Client(c.env.DB);

  await db.revokeClientToken(id);
  return c.json({ success: true });
});

// ============ Settings ============

adminRouter.get('/settings', async (c) => {
  const db = new D1Client(c.env.DB);
  const settings = await db.getServerSettings();

  const result: Record<string, string> = {};
  for (const setting of settings) {
    result[setting.key] = setting.value;
  }

  return c.json(result);
});

adminRouter.put('/settings', async (c) => {
  const body = await c.req.json<Record<string, string>>();
  const db = new D1Client(c.env.DB);

  for (const [key, value] of Object.entries(body)) {
    await db.upsertServerSetting(key, value);
  }

  return c.json({ success: true });
});

// ============ Usage Logs ============

adminRouter.get('/usage', async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
  const toolName = c.req.query('toolName');
  const outcome = c.req.query('outcome');
  const clientTokenPrefix = c.req.query('clientTokenPrefix');
  const queryHash = c.req.query('queryHash');
  const dateFrom = c.req.query('dateFrom');
  const dateTo = c.req.query('dateTo');
  const order = c.req.query('order') === 'asc' ? 'asc' : 'desc';

  const db = new D1Client(c.env.DB);
  const offset = (page - 1) * limit;

  const { logs, totalItems } = await db.getCombinedUsageLogs({
    toolName: toolName || undefined,
    outcome: outcome || undefined,
    clientTokenPrefix: clientTokenPrefix || undefined,
    queryHash: queryHash || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    order,
    limit,
    offset
  });

  const totalPages = Math.ceil(totalItems / limit);

  return c.json({
    logs,
    pagination: {
      totalItems,
      totalPages,
      currentPage: page,
      limit
    }
  });
});

adminRouter.get('/usage/summary', async (c) => {
  const dateFrom = c.req.query('dateFrom');
  const dateTo = c.req.query('dateTo');

  const db = new D1Client(c.env.DB);

  const summary = await db.getCombinedUsageSummary({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  });

  return c.json({
    total: summary.total,
    byTool: summary.byTool,
    topQueries: summary.topQueries
  });
});

// ============ Keys Import/Export ============

function toIsoOrNull(d: string | null | undefined): string | null {
  return d ?? null;
}

function isUniqueConstraintError(err: any): boolean {
  const msg = err?.message ?? String(err);
  return msg.includes('UNIQUE constraint failed') && msg.includes('label');
}

async function createTavilyKeyWithAutoRename(
  db: D1Client,
  env: Env,
  input: {
    label: string;
    apiKey: string;
    status?: string;
    cooldownUntil?: string | null;
  }
): Promise<{ id: string; labelUsed: string; renamedFrom?: string }> {
  const maxRetries = 100;
  let attempt = 0;
  let currentLabel = input.label;

  while (attempt < maxRetries) {
    try {
      const keyEncrypted = await encrypt(input.apiKey, env.KEY_ENCRYPTION_SECRET);
      const keyMasked = maskApiKey(input.apiKey);
      const id = generateId();

      await db.createTavilyKey({
        id,
        label: currentLabel,
        keyEncrypted: keyEncrypted.buffer as ArrayBuffer,
        keyMasked,
        status: input.status ?? 'active',
        cooldownUntil: input.cooldownUntil ?? null
      });

      return {
        id,
        labelUsed: currentLabel,
        renamedFrom: currentLabel !== input.label ? input.label : undefined
      };
    } catch (err: any) {
      if (isUniqueConstraintError(err)) {
        attempt++;
        currentLabel = `${input.label} (import ${attempt + 1})`;
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Failed to create key after ${maxRetries} rename attempts`);
}

async function createBraveKeyWithAutoRename(
  db: D1Client,
  env: Env,
  input: {
    label: string;
    apiKey: string;
    status?: string;
  }
): Promise<{ id: string; labelUsed: string; renamedFrom?: string }> {
  const maxRetries = 100;
  let attempt = 0;
  let currentLabel = input.label;

  while (attempt < maxRetries) {
    try {
      const keyEncrypted = await encrypt(input.apiKey, env.KEY_ENCRYPTION_SECRET);
      const keyMasked = maskApiKey(input.apiKey);
      const id = generateId();

      await db.createBraveKey({
        id,
        label: currentLabel,
        keyEncrypted: keyEncrypted.buffer as ArrayBuffer,
        keyMasked,
        status: input.status ?? 'active'
      });

      return {
        id,
        labelUsed: currentLabel,
        renamedFrom: currentLabel !== input.label ? input.label : undefined
      };
    } catch (err: any) {
      if (isUniqueConstraintError(err)) {
        attempt++;
        currentLabel = `${input.label} (import ${attempt + 1})`;
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Failed to create key after ${maxRetries} rename attempts`);
}

adminRouter.get('/keys/export', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null;
  const userAgent = c.req.header('User-Agent') ?? null;
  const db = new D1Client(c.env.DB);

  try {
    const [tavilyKeys, braveKeys] = await Promise.all([
      db.getTavilyKeys(),
      db.getBraveKeys()
    ]);

    const tavily = await Promise.all(tavilyKeys.map(async (k) => {
      const apiKey = await decrypt(new Uint8Array(k.keyEncrypted), c.env.KEY_ENCRYPTION_SECRET);
      return {
        id: k.id,
        label: k.label,
        apiKey,
        maskedKey: k.keyMasked,
        status: k.status,
        cooldownUntil: toIsoOrNull(k.cooldownUntil),
        lastUsedAt: toIsoOrNull(k.lastUsedAt),
        failureScore: k.failureScore,
        creditsRemaining: k.creditsRemaining,
        creditsCheckedAt: toIsoOrNull(k.creditsCheckedAt),
        createdAt: k.createdAt,
        updatedAt: k.updatedAt
      };
    }));

    const brave = await Promise.all(braveKeys.map(async (k) => {
      const apiKey = await decrypt(new Uint8Array(k.keyEncrypted), c.env.KEY_ENCRYPTION_SECRET);
      return {
        id: k.id,
        label: k.label,
        apiKey,
        maskedKey: k.keyMasked,
        status: k.status,
        lastUsedAt: toIsoOrNull(k.lastUsedAt),
        failureScore: k.failureScore,
        createdAt: k.createdAt,
        updatedAt: k.updatedAt
      };
    }));

    const exportData = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      tavily,
      brave
    };

    await db.createAuditLog({
      eventType: 'keys.export',
      outcome: 'success',
      ip,
      userAgent,
      detailsJson: JSON.stringify({ tavilyCount: tavily.length, braveCount: brave.length })
    }).catch(() => {});

    return c.json(exportData, 200, {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8'
    });
  } catch (err: any) {
    await db.createAuditLog({
      eventType: 'keys.export',
      outcome: 'error',
      ip,
      userAgent,
      detailsJson: JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
    }).catch(() => {});
    return c.json({ error: 'Failed to export keys' }, 500);
  }
});

adminRouter.post('/keys/import', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? null;
  const userAgent = c.req.header('User-Agent') ?? null;
  const db = new D1Client(c.env.DB);

  const body = await c.req.json();

  // Validate payload
  if (body.schemaVersion !== 1) {
    return c.json({ error: 'Invalid import file', details: 'schemaVersion must be 1' }, 400);
  }

  if (!Array.isArray(body.tavily) || !Array.isArray(body.brave)) {
    return c.json({ error: 'Invalid import file', details: 'tavily and brave must be arrays' }, 400);
  }

  const tavilyItems = body.tavily;
  const braveItems = body.brave;

  const summary = {
    tavily: { total: tavilyItems.length, imported: 0, failed: 0, renamed: 0, skipped: 0 },
    brave: { total: braveItems.length, imported: 0, failed: 0, renamed: 0, skipped: 0 },
    total: 0,
    imported: 0,
    failed: 0,
    renamed: 0,
    skipped: 0
  };

  const renamed: Array<{ provider: 'tavily' | 'brave'; from: string; to: string }> = [];
  const errors: Array<{ provider: 'tavily' | 'brave'; index: number; label: string; error: string }> = [];
  const skipped: Array<{ provider: 'tavily' | 'brave'; label: string; reason: string }> = [];

  // 艹，先把现有的所有 API keys 解密出来，检查重复用
  const [existingTavilyKeys, existingBraveKeys] = await Promise.all([
    db.getTavilyKeys(),
    db.getBraveKeys()
  ]);

  const existingTavilyApiKeys = new Set<string>();
  for (const k of existingTavilyKeys) {
    try {
      const apiKey = await decrypt(new Uint8Array(k.keyEncrypted), c.env.KEY_ENCRYPTION_SECRET);
      existingTavilyApiKeys.add(apiKey);
    } catch (err) {
      // 解密失败就跳过，不影响导入流程
      console.error(`Failed to decrypt existing Tavily key ${k.id}:`, err);
    }
  }

  const existingBraveApiKeys = new Set<string>();
  for (const k of existingBraveKeys) {
    try {
      const apiKey = await decrypt(new Uint8Array(k.keyEncrypted), c.env.KEY_ENCRYPTION_SECRET);
      existingBraveApiKeys.add(apiKey);
    } catch (err) {
      console.error(`Failed to decrypt existing Brave key ${k.id}:`, err);
    }
  }

  // Import Tavily keys
  for (let i = 0; i < tavilyItems.length; i++) {
    const item = tavilyItems[i];
    if (typeof item.label !== 'string' || !item.label.trim()) {
      errors.push({ provider: 'tavily', index: i, label: item.label ?? '', error: 'label is required' });
      summary.tavily.failed++;
      continue;
    }
    if (typeof item.apiKey !== 'string' || !item.apiKey.trim()) {
      errors.push({ provider: 'tavily', index: i, label: item.label, error: 'apiKey is required' });
      summary.tavily.failed++;
      continue;
    }

    // 艹，检查这个 API key 是不是已经存在了
    if (existingTavilyApiKeys.has(item.apiKey)) {
      summary.tavily.skipped++;
      skipped.push({ provider: 'tavily', label: item.label, reason: 'API key already exists' });
      continue;
    }

    try {
      const status = ['active', 'disabled', 'cooldown', 'invalid'].includes(item.status) ? item.status : 'active';
      const cooldownUntil = item.status === 'cooldown' && item.cooldownUntil ? item.cooldownUntil : null;

      const result = await createTavilyKeyWithAutoRename(db, c.env, {
        label: item.label.trim(),
        apiKey: item.apiKey,
        status,
        cooldownUntil
      });

      summary.tavily.imported++;
      // 导入成功后，把这个 key 加到已存在集合里，避免同一批次内重复导入
      existingTavilyApiKeys.add(item.apiKey);

      if (result.renamedFrom) {
        summary.tavily.renamed++;
        renamed.push({ provider: 'tavily', from: result.renamedFrom, to: result.labelUsed });
      }
    } catch (err: any) {
      summary.tavily.failed++;
      errors.push({ provider: 'tavily', index: i, label: item.label, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Import Brave keys
  for (let i = 0; i < braveItems.length; i++) {
    const item = braveItems[i];
    if (typeof item.label !== 'string' || !item.label.trim()) {
      errors.push({ provider: 'brave', index: i, label: item.label ?? '', error: 'label is required' });
      summary.brave.failed++;
      continue;
    }
    if (typeof item.apiKey !== 'string' || !item.apiKey.trim()) {
      errors.push({ provider: 'brave', index: i, label: item.label, error: 'apiKey is required' });
      summary.brave.failed++;
      continue;
    }

    // 艹，检查这个 API key 是不是已经存在了
    if (existingBraveApiKeys.has(item.apiKey)) {
      summary.brave.skipped++;
      skipped.push({ provider: 'brave', label: item.label, reason: 'API key already exists' });
      continue;
    }

    try {
      const status = ['active', 'disabled', 'invalid'].includes(item.status) ? item.status : 'active';

      const result = await createBraveKeyWithAutoRename(db, c.env, {
        label: item.label.trim(),
        apiKey: item.apiKey,
        status
      });

      summary.brave.imported++;
      // 导入成功后，把这个 key 加到已存在集合里，避免同一批次内重复导入
      existingBraveApiKeys.add(item.apiKey);

      if (result.renamedFrom) {
        summary.brave.renamed++;
        renamed.push({ provider: 'brave', from: result.renamedFrom, to: result.labelUsed });
      }
    } catch (err: any) {
      summary.brave.failed++;
      errors.push({ provider: 'brave', index: i, label: item.label, error: err instanceof Error ? err.message : String(err) });
    }
  }

  summary.total = summary.tavily.total + summary.brave.total;
  summary.imported = summary.tavily.imported + summary.brave.imported;
  summary.failed = summary.tavily.failed + summary.brave.failed;
  summary.renamed = summary.tavily.renamed + summary.brave.renamed;
  summary.skipped = summary.tavily.skipped + summary.brave.skipped;

  const outcome = summary.failed > 0 ? 'partial' : 'success';
  await db.createAuditLog({
    eventType: 'keys.import',
    outcome,
    ip,
    userAgent,
    detailsJson: JSON.stringify({ summary, renamedCount: renamed.length, skippedCount: skipped.length, errorCount: errors.length })
  }).catch(() => {});

  return c.json({
    ok: true,
    summary,
    renamed,
    skipped,
    errors
  });
});

// Real-time metrics endpoint for dashboard
adminRouter.get('/metrics', async (c) => {
  const db = new D1Client(c.env.DB);
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60_000).toISOString();
  const oneHourAgo = new Date(now.getTime() - 3600_000).toISOString();

  const [
    tavilyKeys,
    braveKeys,
    clientTokens,
    tavilyRecentResult,
    braveRecentResult,
    tavilyHourlyResult,
    braveHourlyResult,
    recentErrors
  ] = await Promise.all([
    db.getTavilyKeys(),
    db.getBraveKeys(),
    db.getClientTokens(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM TavilyToolUsage WHERE timestamp >= ?').bind(oneMinuteAgo).first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM BraveToolUsage WHERE timestamp >= ?').bind(oneMinuteAgo).first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM TavilyToolUsage WHERE timestamp >= ?').bind(oneHourAgo).first<{ count: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM BraveToolUsage WHERE timestamp >= ?').bind(oneHourAgo).first<{ count: number }>(),
    c.env.DB.prepare(`
      SELECT id, toolName, errorMessage, timestamp
      FROM TavilyToolUsage
      WHERE outcome = 'error' AND timestamp >= ?
      ORDER BY timestamp DESC
      LIMIT 5
    `).bind(oneHourAgo).all<{ id: string; toolName: string; errorMessage: string | null; timestamp: string }>()
  ]);

  const activeKeys = tavilyKeys.filter((k: TavilyKey) => k.status === 'active').length +
                     braveKeys.filter((k: BraveKey) => k.status === 'active').length;
  const unhealthyKeys = tavilyKeys.filter((k: TavilyKey) => k.status === 'invalid' || k.status === 'cooldown').length +
                        braveKeys.filter((k: BraveKey) => k.status === 'invalid').length;
  const activeTokens = clientTokens.filter((t: ClientToken) => !t.revokedAt).length;

  return c.json({
    requestsPerMinute: (tavilyRecentResult?.count ?? 0) + (braveRecentResult?.count ?? 0),
    requestsPerHour: (tavilyHourlyResult?.count ?? 0) + (braveHourlyResult?.count ?? 0),
    activeTokens,
    keyPool: {
      total: tavilyKeys.length + braveKeys.length,
      active: activeKeys,
      unhealthy: unhealthyKeys,
      tavily: {
        total: tavilyKeys.length,
        active: tavilyKeys.filter((k: TavilyKey) => k.status === 'active').length,
        cooldown: tavilyKeys.filter((k: TavilyKey) => k.status === 'cooldown').length,
        invalid: tavilyKeys.filter((k: TavilyKey) => k.status === 'invalid').length
      },
      brave: {
        total: braveKeys.length,
        active: braveKeys.filter((k: BraveKey) => k.status === 'active').length,
        invalid: braveKeys.filter((k: BraveKey) => k.status === 'invalid').length
      }
    },
    recentErrors: (recentErrors.results ?? []).map((e: { id: string; toolName: string; errorMessage: string | null; timestamp: string }) => ({
      id: e.id,
      toolName: e.toolName,
      errorMessage: e.errorMessage,
      timestamp: e.timestamp
    })),
    timestamp: now.toISOString()
  });
});

// Cost estimation endpoint
// Tavily credit costs: search=1, extract=1, crawl=2, map=1, research=5
adminRouter.get('/cost-estimate', async (c) => {
  const dateFromRaw = c.req.query('dateFrom');
  const dateToRaw = c.req.query('dateTo');

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const dateFrom = dateFromRaw ? new Date(dateFromRaw) : thirtyDaysAgo;
  const dateTo = dateToRaw ? new Date(dateToRaw) : now;

  const dateFromIso = dateFrom.toISOString();
  const dateToIso = dateTo.toISOString();

  // Get usage counts grouped by tool
  const tavilyUsageResult = await c.env.DB.prepare(`
    SELECT toolName, COUNT(*) as count
    FROM TavilyToolUsage
    WHERE timestamp >= ? AND timestamp <= ? AND outcome = 'success'
    GROUP BY toolName
  `).bind(dateFromIso, dateToIso).all<{ toolName: string; count: number }>();

  const braveUsageResult = await c.env.DB.prepare(`
    SELECT toolName, COUNT(*) as count
    FROM BraveToolUsage
    WHERE timestamp >= ? AND timestamp <= ? AND outcome = 'success'
    GROUP BY toolName
  `).bind(dateFromIso, dateToIso).all<{ toolName: string; count: number }>();

  // Tavily credit costs per tool
  const tavilyCostMap: Record<string, number> = {
    tavily_search: 1,
    tavily_extract: 1,
    tavily_crawl: 2,
    tavily_map: 1,
    tavily_research: 5
  };

  let tavilyTotalCredits = 0;
  const tavilyBreakdown = (tavilyUsageResult.results ?? []).map(item => {
    const cost = tavilyCostMap[item.toolName] ?? 1;
    const credits = item.count * cost;
    tavilyTotalCredits += credits;
    return {
      toolName: item.toolName,
      count: item.count,
      creditCost: cost,
      totalCredits: credits
    };
  });

  // Brave is usage-based, estimate $0.003/request for Pro tier
  let braveTotalRequests = 0;
  const braveBreakdown = (braveUsageResult.results ?? []).map(item => {
    braveTotalRequests += item.count;
    return {
      toolName: item.toolName,
      count: item.count
    };
  });
  const braveEstimatedCostUsd = braveTotalRequests * 0.003;

  return c.json({
    period: {
      from: dateFrom.toISOString(),
      to: dateTo.toISOString()
    },
    tavily: {
      totalCredits: tavilyTotalCredits,
      breakdown: tavilyBreakdown
    },
    brave: {
      totalRequests: braveTotalRequests,
      estimatedCostUsd: Math.round(braveEstimatedCostUsd * 100) / 100,
      breakdown: braveBreakdown
    },
    summary: {
      tavilyCreditsUsed: tavilyTotalCredits,
      braveRequestsMade: braveTotalRequests,
      braveEstimatedCostUsd: Math.round(braveEstimatedCostUsd * 100) / 100
    }
  });
});

export { adminRouter };
