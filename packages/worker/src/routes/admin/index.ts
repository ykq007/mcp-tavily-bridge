import { Hono } from 'hono';

import type { Env } from '../../env.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import { D1Client, generateId } from '../../db/d1.js';
import { encrypt, decrypt, maskApiKey, generateToken } from '../../crypto/crypto.js';

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
    return c.json({ error: 'Failed to decrypt key' }, 500);
  }
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
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
  const toolName = c.req.query('toolName');
  const outcome = c.req.query('outcome');
  const clientTokenPrefix = c.req.query('clientTokenPrefix');
  const queryHash = c.req.query('queryHash');
  const dateFrom = c.req.query('dateFrom');
  const dateTo = c.req.query('dateTo');
  const order = (c.req.query('order') || 'desc') as 'asc' | 'desc';

  const db = new D1Client(c.env.DB);

  // Calculate offset from page
  const offset = (page - 1) * limit;

  // Fetch logs with filters
  const tavilyLogs = await db.getTavilyUsageLogs(limit, offset);
  const braveLogs = await db.getBraveUsageLogs(limit, offset);

  // Combine and filter results
  let results = [
    ...tavilyLogs.map(log => ({ ...log, source: 'tavily' })),
    ...braveLogs.map(log => ({ ...log, source: 'brave' }))
  ];

  // Apply filters
  if (toolName) {
    results = results.filter(log => log.toolName === toolName);
  }
  if (outcome) {
    results = results.filter(log => log.outcome === outcome);
  }
  if (clientTokenPrefix) {
    results = results.filter(log =>
      log.clientTokenPrefix && log.clientTokenPrefix.includes(clientTokenPrefix)
    );
  }
  if (queryHash) {
    results = results.filter(log => log.queryHash === queryHash);
  }
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    results = results.filter(log => new Date(log.timestamp) >= fromDate);
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    results = results.filter(log => new Date(log.timestamp) <= toDate);
  }

  // Sort by timestamp
  results.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return order === 'desc' ? timeB - timeA : timeA - timeB;
  });

  // Get total count for pagination
  const totalItems = results.length;
  const totalPages = Math.ceil(totalItems / limit);

  // Paginate results
  const logs = results.slice(0, limit);

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

  // Get all logs and compute summary
  const tavilyLogs = await db.getTavilyUsageLogs(1000, 0);
  const braveLogs = await db.getBraveUsageLogs(1000, 0);

  let allLogs = [...tavilyLogs, ...braveLogs];

  // Apply date filters
  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    allLogs = allLogs.filter(log => new Date(log.timestamp) >= fromDate);
  }
  if (dateTo) {
    const toDate = new Date(dateTo);
    allLogs = allLogs.filter(log => new Date(log.timestamp) <= toDate);
  }

  // Compute summary stats
  const total = allLogs.length;

  // Tool breakdown
  const toolCounts: Record<string, number> = {};
  for (const log of allLogs) {
    toolCounts[log.toolName] = (toolCounts[log.toolName] || 0) + 1;
  }

  const byTool = Object.entries(toolCounts)
    .map(([toolName, count]) => ({ toolName, count }))
    .sort((a, b) => b.count - a.count);

  // Top queries (group by queryHash)
  const queryCounts: Record<string, { queryHash: string | null; queryPreview: string | null; count: number }> = {};
  for (const log of allLogs) {
    if (log.queryHash) {
      const key = log.queryHash;
      if (!queryCounts[key]) {
        queryCounts[key] = {
          queryHash: log.queryHash,
          queryPreview: log.queryPreview || null,
          count: 0
        };
      }
      queryCounts[key].count++;
    }
  }

  const topQueries = Object.values(queryCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return c.json({
    total,
    byTool,
    topQueries
  });
});

export { adminRouter };
