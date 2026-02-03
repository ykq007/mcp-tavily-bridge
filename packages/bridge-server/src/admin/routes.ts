import type { Express } from 'express';
import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@mcp-tavily-bridge/db';
import type { TavilyKeySelectionStrategy } from '@mcp-tavily-bridge/core';
import { decryptAes256Gcm, encryptAes256Gcm, sha256Bytes, tryParseAes256GcmKeyFromEnv } from '../crypto/crypto.js';
import { FixedWindowRateLimiter } from '../auth/rateLimit.js';
import { requireAdminToken } from './adminAuth.js';
import { fetchTavilyCredits, releaseCreditsRefreshLock, tryAcquireCreditsRefreshLock } from '../tavily/credits.js';
import { ServerSettings } from '../settings/serverSettings.js';

function asyncHandler(fn: (req: any, res: any, next: any) => Promise<void>) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function maskTavilyApiKey(apiKey: string): string {
  const raw = apiKey.trim();
  if (!raw) return '';
  const hasPrefix = raw.startsWith('tvly-');
  const prefix = hasPrefix ? 'tvly-' : '';
  const rest = hasPrefix ? raw.slice(5) : raw;
  if (rest.length <= 8) {
    const start = rest.slice(0, Math.min(2, rest.length));
    const end = rest.slice(Math.max(0, rest.length - 2));
    return `${prefix}${start}...${end}`;
  }
  return `${prefix}${rest.slice(0, 4)}...${rest.slice(-4)}`;
}

function maskBraveApiKey(apiKey: string): string {
  const raw = apiKey.trim();
  if (!raw) return '';
  const hasPrefix = raw.startsWith('BSA');
  const prefix = hasPrefix ? 'BSA' : '';
  const rest = hasPrefix ? raw.slice(3) : raw;
  if (rest.length <= 8) {
    const start = rest.slice(0, Math.min(2, rest.length));
    const end = rest.slice(Math.max(0, rest.length - 2));
    return `${prefix}${start}...${end}`;
  }
  return `${prefix}${rest.slice(0, 4)}...${rest.slice(-4)}`;
}

function normalizeBasePath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '/admin';
  if (!trimmed.startsWith('/')) return `/${trimmed}`;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function registerAdminRoutes(
  app: Express,
  prisma: PrismaClient,
  opts: {
    serverSettings: ServerSettings;
    basePath?: string;
  }
) {
  const basePath = normalizeBasePath(opts.basePath ?? '/admin');
  const p = (subpath: string) => `${basePath}${subpath}`;
  const requireAdmin = requireAdminToken();
  const parsedKey = tryParseAes256GcmKeyFromEnv('KEY_ENCRYPTION_SECRET');
  if (!parsedKey.ok) {
    app.use(basePath, requireAdmin, (_req, res) => {
      res.status(500).json({ error: `Server misconfigured: ${parsedKey.error}` });
    });
    return;
  }
  const encryptionKey = parsedKey.key;
  const revealLimiter = new FixedWindowRateLimiter({
    maxPerWindow: Number(process.env.ADMIN_KEY_REVEAL_RATE_LIMIT_PER_MINUTE ?? '20'),
    windowMs: 60_000
  });

  app.get(p('/server-info'), requireAdmin, asyncHandler(async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const tavilyKeySelectionStrategy = await opts.serverSettings.getTavilyKeySelectionStrategy();
    res.json({
      tavilyKeySelectionStrategy
    });
  }));

  app.patch(p('/server-info'), requireAdmin, asyncHandler(async (req, res) => {
    const raw = req.body?.tavilyKeySelectionStrategy;
    if (raw !== 'round_robin' && raw !== 'random') {
      res.status(400).json({ error: 'tavilyKeySelectionStrategy must be \"round_robin\" or \"random\"' });
      return;
    }
    const next = raw as TavilyKeySelectionStrategy;
    const updated = await opts.serverSettings.setTavilyKeySelectionStrategy(next);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, tavilyKeySelectionStrategy: updated });
  }));

  app.get(p('/keys'), requireAdmin, asyncHandler(async (req, res) => {
    const keys = await prisma.tavilyKey.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(
      keys.map((k) => ({
        id: k.id,
        label: k.label,
        maskedKey: k.keyMasked ?? null,
        status: k.status,
        cooldownUntil: k.cooldownUntil,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
        remainingCredits: k.creditsRemaining,
        totalCredits: k.creditsKeyLimit,
        lastCheckedAt: k.creditsCheckedAt
      }))
    );
  }));

  app.get(p('/keys/:id/reveal'), requireAdmin, asyncHandler(async (req, res) => {
    const ip = typeof req.ip === 'string' ? req.ip : null;
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    const limitKey = `key.reveal:${ip ?? 'unknown'}`;
    const check = revealLimiter.check(limitKey);
    if (!check.ok) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs: check.retryAfterMs });
      return;
    }

    try {
      const key = await prisma.tavilyKey.findUnique({ where: { id: req.params.id } });
      if (!key) {
        await prisma.auditLog.create({
          data: {
            eventType: 'key.reveal',
            outcome: 'not_found',
            resourceType: 'tavily_key',
            resourceId: req.params.id,
            ip,
            userAgent,
            detailsJson: {}
          }
        });
        res.setHeader('Cache-Control', 'no-store');
        res.status(404).json({ error: 'Key not found' });
        return;
      }

      const apiKey = decryptAes256Gcm(Buffer.from(key.keyEncrypted), encryptionKey);

      await prisma.auditLog.create({
        data: {
          eventType: 'key.reveal',
          outcome: 'success',
          resourceType: 'tavily_key',
          resourceId: key.id,
          ip,
          userAgent,
          detailsJson: { label: key.label }
        }
      });

      res.setHeader('Cache-Control', 'no-store');
      res.json({ apiKey });
    } catch (err) {
      await prisma.auditLog.create({
        data: {
          eventType: 'key.reveal',
          outcome: 'error',
          resourceType: 'tavily_key',
          resourceId: req.params.id,
          ip,
          userAgent,
          detailsJson: { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      }).catch(() => {});
      res.setHeader('Cache-Control', 'no-store');
      res.status(500).json({ error: 'Failed to reveal key' });
    }
  }));

  app.post(p('/keys'), requireAdmin, asyncHandler(async (req, res) => {
    const { label, apiKey } = req.body ?? {};
    if (typeof label !== 'string' || typeof apiKey !== 'string' || !label || !apiKey) {
      res.status(400).json({ error: 'label and apiKey are required' });
      return;
    }
    const keyEncrypted = encryptAes256Gcm(apiKey, encryptionKey);
    const keyMasked = maskTavilyApiKey(apiKey);
    const created = await prisma.tavilyKey.create({ data: { label, keyEncrypted: Uint8Array.from(keyEncrypted), keyMasked } });
    await prisma.auditLog.create({ data: { eventType: 'key.create', outcome: 'success', detailsJson: { label } } });
    res.json({ id: created.id });
  }));

  app.patch(p('/keys/:id'), requireAdmin, asyncHandler(async (req, res) => {
    const { status } = req.body ?? {};
    if (status && !['active', 'disabled', 'cooldown', 'invalid'].includes(status)) {
      res.status(400).json({ error: 'invalid status' });
      return;
    }
    const updated = await prisma.tavilyKey.update({
      where: { id: req.params.id },
      data: { status }
    });
    await prisma.auditLog.create({
      data: { eventType: 'key.update', outcome: 'success', resourceType: 'tavily_key', resourceId: updated.id }
    });
    res.json({ ok: true });
  }));

  app.post(p('/keys/:id/refresh-credits'), requireAdmin, asyncHandler(async (req, res) => {
    const ip = typeof req.ip === 'string' ? req.ip : null;
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    const now = new Date();
    const lockMs = Number(process.env.TAVILY_CREDITS_REFRESH_LOCK_MS ?? String(15_000));
    const timeoutMs = Number(process.env.TAVILY_CREDITS_REFRESH_TIMEOUT_MS ?? String(5_000));
    const ttlMs = Number(process.env.TAVILY_CREDITS_CACHE_TTL_MS ?? String(60_000));
    const minRemaining = Number(process.env.TAVILY_CREDITS_MIN_REMAINING ?? '1');
    const cooldownMs = Number(process.env.TAVILY_CREDITS_COOLDOWN_MS ?? String(5 * 60_000));

    const lockId = await tryAcquireCreditsRefreshLock(prisma, req.params.id, lockMs);
    if (!lockId) {
      res.status(409).json({ error: 'Credits refresh already in progress' });
      return;
    }

    try {
      const key = await prisma.tavilyKey.findUnique({ where: { id: req.params.id } });
      if (!key) {
        await prisma.auditLog.create({
          data: {
            eventType: 'key.refresh_credits',
            outcome: 'not_found',
            resourceType: 'tavily_key',
            resourceId: req.params.id,
            ip,
            userAgent,
            detailsJson: {}
          }
        });
        res.status(404).json({ error: 'Key not found' });
        return;
      }

      const apiKey = decryptAes256Gcm(Buffer.from(key.keyEncrypted), encryptionKey);
      const snapshot = await fetchTavilyCredits(apiKey, { timeoutMs });

      const expiresAt = new Date(now.getTime() + ttlMs);
      const remaining = snapshot.remaining;
      const shouldCooldown = typeof remaining === 'number' && remaining <= minRemaining;

      const updated = await prisma.tavilyKey.update({
        where: { id: key.id },
        data: {
          creditsCheckedAt: now,
          creditsExpiresAt: expiresAt,
          creditsKeyUsage: snapshot.keyUsage,
          creditsKeyLimit: snapshot.keyLimit,
          creditsKeyRemaining: snapshot.keyRemaining,
          creditsAccountPlanUsage: snapshot.accountPlanUsage,
          creditsAccountPlanLimit: snapshot.accountPlanLimit,
          creditsAccountPaygoUsage: snapshot.accountPaygoUsage,
          creditsAccountPaygoLimit: snapshot.accountPaygoLimit,
          creditsAccountRemaining: snapshot.accountRemaining,
          creditsRemaining: snapshot.remaining,
          ...(shouldCooldown ? { status: 'cooldown', cooldownUntil: new Date(now.getTime() + cooldownMs) } : {})
        }
      });

      await prisma.auditLog.create({
        data: {
          eventType: 'key.refresh_credits',
          outcome: 'success',
          resourceType: 'tavily_key',
          resourceId: updated.id,
          ip,
          userAgent,
          detailsJson: { remaining: updated.creditsRemaining, expiresAt: updated.creditsExpiresAt }
        }
      });

      res.json({ ok: true, credits: { remaining: updated.creditsRemaining, expiresAt: updated.creditsExpiresAt } });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'Invalid API key') {
        await prisma.tavilyKey.update({ where: { id: req.params.id }, data: { status: 'invalid' } }).catch(() => {});
      }
      await prisma.auditLog.create({
        data: {
          eventType: 'key.refresh_credits',
          outcome: 'error',
          resourceType: 'tavily_key',
          resourceId: req.params.id,
          ip,
          userAgent,
          detailsJson: { error: msg }
        }
      }).catch(() => {});
      res.status(500).json({ error: 'Failed to refresh credits', details: msg });
    } finally {
      await releaseCreditsRefreshLock(prisma, req.params.id, lockId).catch(() => {});
    }
  }));

  app.post(p('/keys/sync-credits'), requireAdmin, asyncHandler(async (req, res) => {
    const ip = typeof req.ip === 'string' ? req.ip : null;
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    const now = new Date();
    const lockMs = Number(process.env.TAVILY_CREDITS_REFRESH_LOCK_MS ?? String(15_000));
    const timeoutMs = Number(process.env.TAVILY_CREDITS_REFRESH_TIMEOUT_MS ?? String(5_000));
    const ttlMs = Number(process.env.TAVILY_CREDITS_CACHE_TTL_MS ?? String(60_000));
    const minRemaining = Number(process.env.TAVILY_CREDITS_MIN_REMAINING ?? '1');
    const cooldownMs = Number(process.env.TAVILY_CREDITS_COOLDOWN_MS ?? String(5 * 60_000));

    try {
      const keys = await prisma.tavilyKey.findMany({
        where: { status: { in: ['active', 'cooldown', 'disabled'] } }
      });

      let successCount = 0;
      let failCount = 0;

      for (const key of keys) {
        const lockId = await tryAcquireCreditsRefreshLock(prisma, key.id, lockMs);
        if (!lockId) {
          continue; // Skip if locked by another process
        }

        try {
          const apiKey = decryptAes256Gcm(Buffer.from(key.keyEncrypted), encryptionKey);
          const snapshot = await fetchTavilyCredits(apiKey, { timeoutMs });

          const expiresAt = new Date(now.getTime() + ttlMs);
          const remaining = snapshot.remaining;
          const shouldCooldown = typeof remaining === 'number' && remaining <= minRemaining;

          await prisma.tavilyKey.update({
            where: { id: key.id },
            data: {
              creditsCheckedAt: now,
              creditsExpiresAt: expiresAt,
              creditsKeyUsage: snapshot.keyUsage,
              creditsKeyLimit: snapshot.keyLimit,
              creditsKeyRemaining: snapshot.keyRemaining,
              creditsAccountPlanUsage: snapshot.accountPlanUsage,
              creditsAccountPlanLimit: snapshot.accountPlanLimit,
              creditsAccountPaygoUsage: snapshot.accountPaygoUsage,
              creditsAccountPaygoLimit: snapshot.accountPaygoLimit,
              creditsAccountRemaining: snapshot.accountRemaining,
              creditsRemaining: snapshot.remaining,
              ...(shouldCooldown ? { status: 'cooldown', cooldownUntil: new Date(now.getTime() + cooldownMs) } : {})
            }
          });
          successCount++;
        } catch (err: any) {
          failCount++;
          const msg = err instanceof Error ? err.message : String(err);
          if (msg === 'Invalid API key') {
            await prisma.tavilyKey.update({ where: { id: key.id }, data: { status: 'invalid' } }).catch(() => {});
          }
        } finally {
          await releaseCreditsRefreshLock(prisma, key.id, lockId).catch(() => {});
        }
      }

      await prisma.auditLog.create({
        data: {
          eventType: 'keys.sync_credits',
          outcome: 'success',
          ip,
          userAgent,
          detailsJson: { total: keys.length, success: successCount, failed: failCount }
        }
      });

      res.json({ ok: true, total: keys.length, success: successCount, failed: failCount });
    } catch (err: any) {
      await prisma.auditLog.create({
        data: {
          eventType: 'keys.sync_credits',
          outcome: 'error',
          ip,
          userAgent,
          detailsJson: { error: err instanceof Error ? err.message : String(err) }
        }
      }).catch(() => {});
      res.status(500).json({ error: 'Failed to sync credits', details: err instanceof Error ? err.message : String(err) });
    }
  }));

  app.delete(p('/keys/:id'), requireAdmin, asyncHandler(async (req, res) => {
    try {
      // Delete related ResearchJob records first to avoid FK constraint
      await prisma.researchJob.deleteMany({ where: { upstreamKeyId: req.params.id } });
      const deleted = await prisma.tavilyKey.delete({ where: { id: req.params.id } });
      await prisma.auditLog.create({
        data: { eventType: 'key.delete', outcome: 'success', resourceType: 'tavily_key', resourceId: deleted.id, detailsJson: { label: deleted.label } }
      });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        res.status(404).json({ error: 'Key not found' });
        return;
      }
      throw err;
    }
  }));

  // ==================== Brave Keys ====================

  app.get(p('/brave-keys'), requireAdmin, asyncHandler(async (req, res) => {
    const keys = await prisma.braveKey.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(
      keys.map((k) => ({
        id: k.id,
        label: k.label,
        maskedKey: k.keyMasked ?? null,
        status: k.status,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt
      }))
    );
  }));

  app.get(p('/brave-keys/:id/reveal'), requireAdmin, asyncHandler(async (req, res) => {
    const ip = typeof req.ip === 'string' ? req.ip : null;
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    const limitKey = `brave-key.reveal:${ip ?? 'unknown'}`;
    const check = revealLimiter.check(limitKey);
    if (!check.ok) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs: check.retryAfterMs });
      return;
    }

    try {
      const key = await prisma.braveKey.findUnique({ where: { id: req.params.id } });
      if (!key) {
        await prisma.auditLog.create({
          data: {
            eventType: 'brave_key.reveal',
            outcome: 'not_found',
            resourceType: 'brave_key',
            resourceId: req.params.id,
            ip,
            userAgent,
            detailsJson: {}
          }
        });
        res.setHeader('Cache-Control', 'no-store');
        res.status(404).json({ error: 'Key not found' });
        return;
      }

      const apiKey = decryptAes256Gcm(Buffer.from(key.keyEncrypted), encryptionKey);

      await prisma.auditLog.create({
        data: {
          eventType: 'brave_key.reveal',
          outcome: 'success',
          resourceType: 'brave_key',
          resourceId: key.id,
          ip,
          userAgent,
          detailsJson: { label: key.label }
        }
      });

      res.setHeader('Cache-Control', 'no-store');
      res.json({ apiKey });
    } catch (err) {
      await prisma.auditLog.create({
        data: {
          eventType: 'brave_key.reveal',
          outcome: 'error',
          resourceType: 'brave_key',
          resourceId: req.params.id,
          ip,
          userAgent,
          detailsJson: { error: err instanceof Error ? err.message : 'Unknown error' }
        }
      }).catch(() => {});
      res.setHeader('Cache-Control', 'no-store');
      res.status(500).json({ error: 'Failed to reveal key' });
    }
  }));

  app.post(p('/brave-keys'), requireAdmin, asyncHandler(async (req, res) => {
    const { label, apiKey } = req.body ?? {};
    if (typeof label !== 'string' || typeof apiKey !== 'string' || !label || !apiKey) {
      res.status(400).json({ error: 'label and apiKey are required' });
      return;
    }
    const keyEncrypted = encryptAes256Gcm(apiKey, encryptionKey);
    const keyMasked = maskBraveApiKey(apiKey);
    const created = await prisma.braveKey.create({ data: { label, keyEncrypted: Uint8Array.from(keyEncrypted), keyMasked } });
    await prisma.auditLog.create({ data: { eventType: 'brave_key.create', outcome: 'success', detailsJson: { label } } });
    res.json({ id: created.id });
  }));

  app.patch(p('/brave-keys/:id'), requireAdmin, asyncHandler(async (req, res) => {
    const { status } = req.body ?? {};
    if (status && !['active', 'disabled', 'invalid'].includes(status)) {
      res.status(400).json({ error: 'invalid status' });
      return;
    }
    const updated = await prisma.braveKey.update({
      where: { id: req.params.id },
      data: { status }
    });
    await prisma.auditLog.create({
      data: { eventType: 'brave_key.update', outcome: 'success', resourceType: 'brave_key', resourceId: updated.id }
    });
    res.json({ ok: true });
  }));

  app.delete(p('/brave-keys/:id'), requireAdmin, asyncHandler(async (req, res) => {
    try {
      const deleted = await prisma.braveKey.delete({ where: { id: req.params.id } });
      await prisma.auditLog.create({
        data: { eventType: 'brave_key.delete', outcome: 'success', resourceType: 'brave_key', resourceId: deleted.id, detailsJson: { label: deleted.label } }
      });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        res.status(404).json({ error: 'Key not found' });
        return;
      }
      throw err;
    }
  }));

  app.get(p('/tokens'), requireAdmin, asyncHandler(async (req, res) => {
    const tokens = await prisma.clientToken.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(
      tokens.map((t) => ({
        id: t.id,
        tokenPrefix: t.tokenPrefix,
        description: t.description,
        revokedAt: t.revokedAt,
        expiresAt: t.expiresAt,
        createdAt: t.createdAt
      }))
    );
  }));

  app.post(p('/tokens'), requireAdmin, asyncHandler(async (req, res) => {
    const { description, expiresInSeconds } = req.body ?? {};
    const prefix = `mcp_${randomBytes(6).toString('hex')}`;
    const secret = randomBytes(24).toString('hex');
    const token = `${prefix}.${secret}`;

    const expiresAt =
      typeof expiresInSeconds === 'number' && Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
        ? new Date(Date.now() + expiresInSeconds * 1000)
        : null;

    const created = await prisma.clientToken.create({
      data: {
        description: typeof description === 'string' ? description : null,
        tokenPrefix: prefix,
        tokenHash: Uint8Array.from(sha256Bytes(secret)),
        expiresAt
      }
    });

    await prisma.auditLog.create({
      data: { eventType: 'token.create', outcome: 'success', resourceType: 'client_token', resourceId: created.id }
    });

    res.json({ id: created.id, token });
  }));

  app.post(p('/tokens/:id/revoke'), requireAdmin, asyncHandler(async (req, res) => {
    const updated = await prisma.clientToken.update({
      where: { id: req.params.id },
      data: { revokedAt: new Date() }
    });
    await prisma.auditLog.create({
      data: { eventType: 'token.revoke', outcome: 'success', resourceType: 'client_token', resourceId: updated.id }
    });
    res.json({ ok: true });
  }));

  app.delete(p('/tokens/:id'), requireAdmin, asyncHandler(async (req, res) => {
    try {
      // Delete related ResearchJob records first to avoid FK constraint
      await prisma.researchJob.deleteMany({ where: { clientTokenId: req.params.id } });
      const deleted = await prisma.clientToken.delete({ where: { id: req.params.id } });
      await prisma.auditLog.create({
        data: { eventType: 'token.delete', outcome: 'success', resourceType: 'client_token', resourceId: deleted.id, detailsJson: { tokenPrefix: deleted.tokenPrefix } }
      });
      res.json({ ok: true });
    } catch (err: any) {
      if (err?.code === 'P2025') {
        res.status(404).json({ error: 'Token not found' });
        return;
      }
      throw err;
    }
  }));

  app.get(p('/audit-logs'), requireAdmin, asyncHandler(async (req, res) => {
    // Parse query parameters with defaults
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200); // Max 200
    const eventType = req.query.eventType as string | undefined;
    const outcome = req.query.outcome as string | undefined;
    const resourceType = req.query.resourceType as string | undefined;
    const resourceId = req.query.resourceId as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const sort = (req.query.sort as string) || 'timestamp';
    const order = (req.query.order as 'asc' | 'desc') || 'desc';

    // Build where clause
    const where: any = {};
    if (eventType) where.eventType = eventType;
    if (outcome) where.outcome = outcome;
    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = { contains: resourceId };

    // Date range filtering
    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = new Date(dateFrom);
      if (dateTo) where.timestamp.lte = new Date(dateTo);
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Execute queries in parallel
    const [logs, totalItems] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { [sort]: order },
        skip,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
      logs,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        limit
      }
    });
  }));

  app.get(p('/usage'), requireAdmin, asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const toolName = req.query.toolName as string | undefined;
    const outcome = req.query.outcome as string | undefined;
    const clientTokenPrefix = req.query.clientTokenPrefix as string | undefined;
    const queryHash = req.query.queryHash as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const order = (req.query.order as 'asc' | 'desc') || 'desc';

    const where: any = {};
    if (toolName) where.toolName = toolName;
    if (outcome) where.outcome = outcome;
    if (clientTokenPrefix) where.clientTokenPrefix = { contains: clientTokenPrefix };
    if (queryHash) where.queryHash = queryHash;

    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = new Date(dateFrom);
      if (dateTo) where.timestamp.lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;
    const [logs, totalItems] = await prisma.$transaction([
      prisma.tavilyToolUsage.findMany({
        where,
        orderBy: { timestamp: order },
        skip,
        take: limit
      }),
      prisma.tavilyToolUsage.count({ where })
    ]);

    const totalPages = Math.ceil(totalItems / limit);
    res.json({
      logs,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        limit
      }
    });
  }));

  app.get(p('/usage/summary'), requireAdmin, asyncHandler(async (req, res) => {
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    const where: any = {};
    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = new Date(dateFrom);
      if (dateTo) where.timestamp.lte = new Date(dateTo);
    }

    const [total, byTool, topQueries] = await prisma.$transaction([
      prisma.tavilyToolUsage.count({ where }),
      prisma.tavilyToolUsage.groupBy({
        by: ['toolName'],
        where,
        _count: { toolName: true },
        orderBy: { _count: { toolName: 'desc' } }
      }),
      prisma.tavilyToolUsage.groupBy({
        by: ['queryHash', 'queryPreview'],
        where: { ...where, queryHash: { not: null } },
        _count: { queryHash: true },
        orderBy: { _count: { queryHash: 'desc' } },
        take: 20
      })
    ]);

    res.json({
      total,
      byTool: byTool.map((row) => ({ toolName: row.toolName, count: (row as any)?._count?.toolName ?? 0 })),
      topQueries: topQueries.map((row) => ({
        queryHash: row.queryHash,
        queryPreview: row.queryPreview,
        count: (row as any)?._count?.queryHash ?? 0
      }))
    });
  }));
}
