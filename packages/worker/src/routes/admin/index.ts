import { Hono } from 'hono';

import type { Env } from '../../env.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { D1Client, generateId } from '../../db/d1.js';
import { encrypt, maskApiKey, generateToken } from '../../crypto/crypto.js';

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
    searchSourceMode: settingsMap.searchSourceMode || 'tavily_only',
    braveSearchEnabled: activeBraveKeys > 0,
    runtime: 'cloudflare-workers',
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

  return c.json({ success: true });
});

// ============ Keys (alias for Tavily Keys - for Admin UI compatibility) ============

adminRouter.get('/keys', async (c) => {
  const db = new D1Client(c.env.DB);
  const keys = await db.getTavilyKeys();

  return c.json(keys.map(k => ({
    id: k.id,
    label: k.label,
    keyMasked: k.keyMasked,
    status: k.status,
    cooldownUntil: k.cooldownUntil,
    lastUsedAt: k.lastUsedAt,
    failureScore: k.failureScore,
    creditsRemaining: k.creditsRemaining,
    creditsCheckedAt: k.creditsCheckedAt,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  })));
});

adminRouter.post('/keys', async (c) => {
  const body = await c.req.json<{ label: string; apiKey: string }>();
  const { label, apiKey } = body;

  if (!label || !apiKey) {
    return c.json({ error: 'label and apiKey are required' }, 400);
  }

  const db = new D1Client(c.env.DB);

  const keyEncrypted = await encrypt(apiKey, c.env.KEY_ENCRYPTION_SECRET);
  const keyMasked = maskApiKey(apiKey);
  const id = generateId();

  await db.createTavilyKey({
    id,
    label,
    keyEncrypted: keyEncrypted.buffer as ArrayBuffer,
    keyMasked,
  });

  return c.json({ id, label, keyMasked, status: 'active' }, 201);
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

// Key reveal is not supported in worker (keys are encrypted, no decryption exposed)
adminRouter.get('/keys/:id/reveal', async (c) => {
  return c.json({ error: 'Key reveal not supported in Cloudflare Workers deployment' }, 501);
});

// Credit refresh stubs (not implemented in worker)
adminRouter.post('/keys/:id/refresh-credits', async (c) => {
  return c.json({ success: true, message: 'Credit refresh not implemented in worker' });
});

adminRouter.post('/keys/sync-credits', async (c) => {
  return c.json({ success: true, message: 'Credit sync not implemented in worker' });
});

// ============ Tavily Keys ============

adminRouter.get('/tavily-keys', async (c) => {
  const db = new D1Client(c.env.DB);
  const keys = await db.getTavilyKeys();

  return c.json(keys.map(k => ({
    id: k.id,
    label: k.label,
    keyMasked: k.keyMasked,
    status: k.status,
    cooldownUntil: k.cooldownUntil,
    lastUsedAt: k.lastUsedAt,
    failureScore: k.failureScore,
    creditsRemaining: k.creditsRemaining,
    creditsCheckedAt: k.creditsCheckedAt,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  })));
});

adminRouter.post('/tavily-keys', async (c) => {
  const body = await c.req.json<{ label: string; key: string }>();
  const { label, key } = body;

  if (!label || !key) {
    return c.json({ error: 'label and key are required' }, 400);
  }

  const db = new D1Client(c.env.DB);

  // Encrypt the key
  const keyEncrypted = await encrypt(key, c.env.KEY_ENCRYPTION_SECRET);
  const keyMasked = maskApiKey(key);
  const id = generateId();

  await db.createTavilyKey({
    id,
    label,
    keyEncrypted: keyEncrypted.buffer as ArrayBuffer,
    keyMasked,
  });

  return c.json({
    id,
    label,
    keyMasked,
    status: 'active',
  }, 201);
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
    keyMasked: k.keyMasked,
    status: k.status,
    lastUsedAt: k.lastUsedAt,
    failureScore: k.failureScore,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  })));
});

adminRouter.post('/brave-keys', async (c) => {
  const body = await c.req.json<{ label: string; key: string }>();
  const { label, key } = body;

  if (!label || !key) {
    return c.json({ error: 'label and key are required' }, 400);
  }

  const db = new D1Client(c.env.DB);

  const keyEncrypted = await encrypt(key, c.env.KEY_ENCRYPTION_SECRET);
  const keyMasked = maskApiKey(key);
  const id = generateId();

  await db.createBraveKey({
    id,
    label,
    keyEncrypted: keyEncrypted.buffer as ArrayBuffer,
    keyMasked,
  });

  return c.json({
    id,
    label,
    keyMasked,
    status: 'active',
  }, 201);
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
  return c.json({ error: 'Key reveal not supported in Cloudflare Workers deployment' }, 501);
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
  const body = await c.req.json<{ description?: string; expiresAt?: string }>();

  const db = new D1Client(c.env.DB);

  // Generate a new token
  const token = generateToken(32);
  const tokenPrefix = token.substring(0, 8);
  const id = generateId();

  // Hash the token
  const encoder = new TextEncoder();
  const tokenData = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', tokenData);

  await db.createClientToken({
    id,
    description: body.description,
    tokenPrefix,
    tokenHash: hashBuffer,
    expiresAt: body.expiresAt,
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
  const limit = parseInt(c.req.query('limit') || '100', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const source = c.req.query('source') || 'all'; // tavily, brave, all

  const db = new D1Client(c.env.DB);

  const results: Array<{
    id: string;
    timestamp: string;
    toolName: string;
    outcome: string;
    latencyMs: number | null;
    source: string;
  }> = [];

  if (source === 'all' || source === 'tavily') {
    const tavilyLogs = await db.getTavilyUsageLogs(limit, offset);
    results.push(...tavilyLogs.map(log => ({ ...log, source: 'tavily' })));
  }

  if (source === 'all' || source === 'brave') {
    const braveLogs = await db.getBraveUsageLogs(limit, offset);
    results.push(...braveLogs.map(log => ({ ...log, source: 'brave' })));
  }

  // Sort combined results by timestamp
  results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return c.json(results.slice(0, limit));
});

adminRouter.get('/usage/summary', async (c) => {
  const db = new D1Client(c.env.DB);

  // Get all logs and compute summary
  const tavilyLogs = await db.getTavilyUsageLogs(1000, 0);
  const braveLogs = await db.getBraveUsageLogs(1000, 0);

  const allLogs = [...tavilyLogs, ...braveLogs];

  // Compute summary stats
  const totalRequests = allLogs.length;
  const successCount = allLogs.filter(l => l.outcome === 'success').length;
  const errorCount = allLogs.filter(l => l.outcome === 'error').length;

  // Tool breakdown
  const toolCounts: Record<string, number> = {};
  for (const log of allLogs) {
    toolCounts[log.toolName] = (toolCounts[log.toolName] || 0) + 1;
  }

  return c.json({
    totalRequests,
    successCount,
    errorCount,
    successRate: totalRequests > 0 ? (successCount / totalRequests * 100).toFixed(1) : '0',
    toolBreakdown: toolCounts,
  });
});

export { adminRouter };
