import type { Express } from 'express';
import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@mcp-nexus/db';
import type { TavilyKeySelectionStrategy, SearchSourceMode } from '@mcp-nexus/core';
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
    const errorMsg = parsedKey.error;
    app.use(basePath, requireAdmin, (_req, res) => {
      res.status(500).json({ error: `Server misconfigured: ${errorMsg}` });
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
    const searchSourceMode = await opts.serverSettings.getSearchSourceMode();
    const braveKeyCount = await prisma.braveKey.count({ where: { status: 'active' } });
    res.json({
      tavilyKeySelectionStrategy,
      searchSourceMode,
      braveSearchEnabled: braveKeyCount > 0
    });
  }));

  app.patch(p('/server-info'), requireAdmin, asyncHandler(async (req, res) => {
    const { tavilyKeySelectionStrategy, searchSourceMode } = req.body ?? {};

    // Validate tavilyKeySelectionStrategy if provided
    if (tavilyKeySelectionStrategy !== undefined) {
      if (tavilyKeySelectionStrategy !== 'round_robin' && tavilyKeySelectionStrategy !== 'random') {
        res.status(400).json({ error: 'tavilyKeySelectionStrategy must be "round_robin" or "random"' });
        return;
      }
      await opts.serverSettings.setTavilyKeySelectionStrategy(tavilyKeySelectionStrategy as TavilyKeySelectionStrategy);
    }

    // Validate searchSourceMode if provided
    if (searchSourceMode !== undefined) {
      const validModes: SearchSourceMode[] = ['tavily_only', 'brave_only', 'combined', 'brave_prefer_tavily_fallback'];
      if (!validModes.includes(searchSourceMode)) {
        res.status(400).json({ error: 'searchSourceMode must be one of: tavily_only, brave_only, combined, brave_prefer_tavily_fallback' });
        return;
      }
      await opts.serverSettings.setSearchSourceMode(searchSourceMode as SearchSourceMode);
    }

    // Return updated values
    const updatedStrategy = await opts.serverSettings.getTavilyKeySelectionStrategy();
    const updatedMode = await opts.serverSettings.getSearchSourceMode();
    const braveKeyCount = await prisma.braveKey.count({ where: { status: 'active' } });

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      tavilyKeySelectionStrategy: updatedStrategy,
      searchSourceMode: updatedMode,
      braveSearchEnabled: braveKeyCount > 0
    });
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
      const retryAfter = check.retryAfterMs;
      res.setHeader('Cache-Control', 'no-store');
      res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs: retryAfter });
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
      const snapshot = await fetchTavilyCredits(apiKey, {
        timeoutMs,
        maxRetries: 3,
        retryDelayMs: 1000
      });

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
          const snapshot = await fetchTavilyCredits(apiKey, {
            timeoutMs,
            maxRetries: 3,
            retryDelayMs: 1000
          });

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
      const retryAfter = check.retryAfterMs;
      res.setHeader('Cache-Control', 'no-store');
      res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs: retryAfter });
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
    const { description, expiresInSeconds, allowedTools, rateLimit } = req.body ?? {};
    const prefix = `mcp_${randomBytes(6).toString('hex')}`;
    const secret = randomBytes(24).toString('hex');
    const token = `${prefix}.${secret}`;

    const expiresAt =
      typeof expiresInSeconds === 'number' && Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
        ? new Date(Date.now() + expiresInSeconds * 1000)
        : null;

    // Phase 3.4: Validate allowedTools if provided
    const allowedToolsValue = Array.isArray(allowedTools) && allowedTools.length > 0
      ? allowedTools
      : undefined;

    // Phase 3.5: Validate rateLimit if provided
    const rateLimitValue = typeof rateLimit === 'number' && Number.isFinite(rateLimit) && rateLimit > 0
      ? Math.floor(rateLimit)
      : undefined;

    const created = await prisma.clientToken.create({
      data: {
        description: typeof description === 'string' ? description : null,
        tokenPrefix: prefix,
        tokenHash: Uint8Array.from(sha256Bytes(secret)),
        expiresAt,
        allowedTools: allowedToolsValue,
        rateLimit: rateLimitValue
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
    const pageRaw = Number.parseInt(req.query.page as string, 10);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limitRaw = Number.parseInt(req.query.limit as string, 10);
    const limit = Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50, 200);
    const toolName = req.query.toolName as string | undefined;
    const outcome = req.query.outcome as string | undefined;
    const clientTokenPrefix = req.query.clientTokenPrefix as string | undefined;
    const queryHash = req.query.queryHash as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const orderQuery = req.query.order as string | undefined;
    const order: 'asc' | 'desc' = orderQuery === 'asc' ? 'asc' : 'desc';

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
    const fetchSize = skip + limit;
    const [tavilyLogs, braveLogs, tavilyTotalItems, braveTotalItems] = await prisma.$transaction([
      prisma.tavilyToolUsage.findMany({
        where,
        orderBy: { timestamp: order },
        take: fetchSize
      }),
      prisma.braveToolUsage.findMany({
        where,
        orderBy: { timestamp: order },
        take: fetchSize
      }),
      prisma.tavilyToolUsage.count({ where }),
      prisma.braveToolUsage.count({ where })
    ]);

    const combinedLogs = [...tavilyLogs, ...braveLogs].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return order === 'desc' ? timeB - timeA : timeA - timeB;
    });

    const logs = combinedLogs.slice(skip, skip + limit);
    const totalItems = tavilyTotalItems + braveTotalItems;
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

    const [tavilyTotal, braveTotal, tavilyByTool, braveByTool, tavilyTopQueries, braveTopQueries] = await prisma.$transaction([
      prisma.tavilyToolUsage.count({ where }),
      prisma.braveToolUsage.count({ where }),
      prisma.tavilyToolUsage.groupBy({
        by: ['toolName'],
        where,
        _count: { toolName: true },
        orderBy: { _count: { toolName: 'desc' } }
      }),
      prisma.braveToolUsage.groupBy({
        by: ['toolName'],
        where,
        _count: { toolName: true },
        orderBy: { _count: { toolName: 'desc' } }
      }),
      prisma.tavilyToolUsage.groupBy({
        by: ['queryHash'],
        where: { ...where, queryHash: { not: null } },
        _max: { queryPreview: true },
        _count: { queryHash: true },
        orderBy: { _count: { queryHash: 'desc' } },
      }),
      prisma.braveToolUsage.groupBy({
        by: ['queryHash'],
        where: { ...where, queryHash: { not: null } },
        _max: { queryPreview: true },
        _count: { queryHash: true },
        orderBy: { _count: { queryHash: 'desc' } },
      })
    ]);

    const byToolMap = new Map<string, number>();
    for (const row of [...tavilyByTool, ...braveByTool]) {
      const count = (row as any)?._count?.toolName ?? 0;
      byToolMap.set(row.toolName, (byToolMap.get(row.toolName) ?? 0) + count);
    }

    const byTool = Array.from(byToolMap.entries())
      .map(([toolName, count]) => ({ toolName, count }))
      .sort((a, b) => b.count - a.count);

    const topQueriesMap = new Map<string, { queryHash: string; queryPreview: string | null; count: number }>();
    for (const row of [...tavilyTopQueries, ...braveTopQueries]) {
      const queryHash = row.queryHash;
      if (!queryHash) continue;

      const count = (row as any)?._count?.queryHash ?? 0;
      const queryPreview = (row as any)?._max?.queryPreview ?? null;
      const existing = topQueriesMap.get(queryHash);

      if (existing) {
        existing.count += count;
        if (!existing.queryPreview && queryPreview) {
          existing.queryPreview = queryPreview;
        }
      } else {
        topQueriesMap.set(queryHash, {
          queryHash,
          queryPreview,
          count
        });
      }
    }

    const topQueries = Array.from(topQueriesMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    res.json({
      total: tavilyTotal + braveTotal,
      byTool,
      topQueries
    });
  }));

  // ==================== Keys Import/Export ====================

  const exportLimiter = new FixedWindowRateLimiter({
    maxPerWindow: Number(process.env.ADMIN_KEYS_EXPORT_RATE_LIMIT_PER_MINUTE ?? '2'),
    windowMs: 60_000
  });

  const importLimiter = new FixedWindowRateLimiter({
    maxPerWindow: Number(process.env.ADMIN_KEYS_IMPORT_RATE_LIMIT_PER_MINUTE ?? '2'),
    windowMs: 60_000
  });

  function toIsoOrNull(d: Date | null | undefined): string | null {
    return d ? d.toISOString() : null;
  }

  function isPrismaUniqueLabelError(err: any): boolean {
    return err?.code === 'P2002' && Array.isArray(err?.meta?.target) && err.meta.target.includes('label');
  }

  async function createTavilyKeyWithAutoRename(input: {
    label: string;
    keyEncrypted: Uint8Array;
    keyMasked: string;
    status?: string;
    cooldownUntil?: Date | null;
  }): Promise<{ id: string; labelUsed: string; renamedFrom?: string }> {
    const maxRetries = 100;
    let attempt = 0;
    let currentLabel = input.label;

    while (attempt < maxRetries) {
      try {
        const created = await prisma.tavilyKey.create({
          data: {
            label: currentLabel,
            keyEncrypted: Buffer.from(input.keyEncrypted),
            keyMasked: input.keyMasked,
            status: (input.status as any) ?? 'active',
            cooldownUntil: input.cooldownUntil ?? null
          }
        });
        return {
          id: created.id,
          labelUsed: currentLabel,
          renamedFrom: currentLabel !== input.label ? input.label : undefined
        };
      } catch (err: any) {
        if (isPrismaUniqueLabelError(err)) {
          attempt++;
          currentLabel = `${input.label} (import ${attempt + 1})`;
        } else {
          throw err;
        }
      }
    }
    throw new Error(`Failed to create key after ${maxRetries} rename attempts`);
  }

  async function createBraveKeyWithAutoRename(input: {
    label: string;
    keyEncrypted: Uint8Array;
    keyMasked: string;
    status?: string;
  }): Promise<{ id: string; labelUsed: string; renamedFrom?: string }> {
    const maxRetries = 100;
    let attempt = 0;
    let currentLabel = input.label;

    while (attempt < maxRetries) {
      try {
        const created = await prisma.braveKey.create({
          data: {
            label: currentLabel,
            keyEncrypted: Buffer.from(input.keyEncrypted),
            keyMasked: input.keyMasked,
            status: (input.status as any) ?? 'active'
          }
        });
        return {
          id: created.id,
          labelUsed: currentLabel,
          renamedFrom: currentLabel !== input.label ? input.label : undefined
        };
      } catch (err: any) {
        if (isPrismaUniqueLabelError(err)) {
          attempt++;
          currentLabel = `${input.label} (import ${attempt + 1})`;
        } else {
          throw err;
        }
      }
    }
    throw new Error(`Failed to create key after ${maxRetries} rename attempts`);
  }

  app.get(p('/keys/export'), requireAdmin, asyncHandler(async (req, res) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? null;
    const userAgent = req.headers['user-agent'] ?? null;

    // Rate limiting
    if (!exportLimiter.tryAcquire(ip ?? 'unknown')) {
      res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs: 60_000 });
      return;
    }

    try {
      const [tavilyKeys, braveKeys] = await Promise.all([
        prisma.tavilyKey.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.braveKey.findMany({ orderBy: { createdAt: 'desc' } })
      ]);

      const tavily = tavilyKeys.map((k) => {
        const apiKey = decryptAes256Gcm(k.keyEncrypted as Buffer, encryptionKey);
        return {
          id: k.id,
          label: k.label,
          apiKey,
          maskedKey: k.keyMasked,
          status: k.status,
          cooldownUntil: toIsoOrNull(k.cooldownUntil),
          lastUsedAt: toIsoOrNull(k.lastUsedAt),
          failureScore: k.failureScore,
          creditsCheckedAt: toIsoOrNull(k.creditsCheckedAt),
          creditsExpiresAt: toIsoOrNull(k.creditsExpiresAt),
          creditsKeyUsage: k.creditsKeyUsage,
          creditsKeyLimit: k.creditsKeyLimit,
          creditsKeyRemaining: k.creditsKeyRemaining,
          creditsAccountPlanUsage: k.creditsAccountPlanUsage,
          creditsAccountPlanLimit: k.creditsAccountPlanLimit,
          creditsAccountPaygoUsage: k.creditsAccountPaygoUsage,
          creditsAccountPaygoLimit: k.creditsAccountPaygoLimit,
          creditsAccountRemaining: k.creditsAccountRemaining,
          creditsRemaining: k.creditsRemaining,
          createdAt: k.createdAt.toISOString(),
          updatedAt: k.updatedAt.toISOString()
        };
      });

      const brave = braveKeys.map((k) => {
        const apiKey = decryptAes256Gcm(k.keyEncrypted as Buffer, encryptionKey);
        return {
          id: k.id,
          label: k.label,
          apiKey,
          maskedKey: k.keyMasked,
          status: k.status,
          lastUsedAt: toIsoOrNull(k.lastUsedAt),
          failureScore: k.failureScore,
          createdAt: k.createdAt.toISOString(),
          updatedAt: k.updatedAt.toISOString()
        };
      });

      const exportData = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        tavily,
        brave
      };

      await prisma.auditLog.create({
        data: {
          eventType: 'keys.export',
          outcome: 'success',
          ip,
          userAgent,
          detailsJson: { tavilyCount: tavily.length, braveCount: brave.length }
        }
      }).catch(() => {});

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      res.setHeader('Content-Disposition', `attachment; filename="mcp-nexus-keys-${timestamp}.json"`);
      res.json(exportData);
    } catch (err: any) {
      await prisma.auditLog.create({
        data: {
          eventType: 'keys.export',
          outcome: 'error',
          ip,
          userAgent,
          detailsJson: { error: err instanceof Error ? err.message : String(err) }
        }
      }).catch(() => {});
      res.status(500).json({ error: 'Failed to export keys' });
    }
  }));

  app.post(p('/keys/import'), requireAdmin, asyncHandler(async (req, res) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? null;
    const userAgent = req.headers['user-agent'] ?? null;

    // Rate limiting
    if (!importLimiter.tryAcquire(ip ?? 'unknown')) {
      res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs: 60_000 });
      return;
    }

    const body = req.body ?? {};

    // Validate payload
    if (body.schemaVersion !== 1) {
      res.status(400).json({ error: 'Invalid import file', details: 'schemaVersion must be 1' });
      return;
    }

    if (!Array.isArray(body.tavily) || !Array.isArray(body.brave)) {
      res.status(400).json({ error: 'Invalid import file', details: 'tavily and brave must be arrays' });
      return;
    }

    const tavilyItems = body.tavily;
    const braveItems = body.brave;

    const summary = {
      tavily: { total: tavilyItems.length, imported: 0, failed: 0, renamed: 0 },
      brave: { total: braveItems.length, imported: 0, failed: 0, renamed: 0 },
      total: 0,
      imported: 0,
      failed: 0,
      renamed: 0
    };

    const renamed: Array<{ provider: 'tavily' | 'brave'; from: string; to: string }> = [];
    const errors: Array<{ provider: 'tavily' | 'brave'; index: number; label: string; error: string }> = [];

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

      try {
        const keyEncrypted = encryptAes256Gcm(item.apiKey, encryptionKey);
        const keyMasked = maskTavilyApiKey(item.apiKey);
        const status = ['active', 'disabled', 'cooldown', 'invalid'].includes(item.status) ? item.status : 'active';
        const cooldownUntil = item.status === 'cooldown' && item.cooldownUntil ? new Date(item.cooldownUntil) : null;

        const result = await createTavilyKeyWithAutoRename({
          label: item.label.trim(),
          keyEncrypted: Uint8Array.from(keyEncrypted),
          keyMasked,
          status,
          cooldownUntil
        });

        summary.tavily.imported++;
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

      try {
        const keyEncrypted = encryptAes256Gcm(item.apiKey, encryptionKey);
        const keyMasked = maskBraveApiKey(item.apiKey);
        const status = ['active', 'disabled', 'invalid'].includes(item.status) ? item.status : 'active';

        const result = await createBraveKeyWithAutoRename({
          label: item.label.trim(),
          keyEncrypted: Uint8Array.from(keyEncrypted),
          keyMasked,
          status
        });

        summary.brave.imported++;
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

    const outcome = summary.failed > 0 ? 'partial' : 'success';
    await prisma.auditLog.create({
      data: {
        eventType: 'keys.import',
        outcome,
        ip,
        userAgent,
        detailsJson: { summary, renamedCount: renamed.length, errorCount: errors.length }
      }
    }).catch(() => {});

    res.json({
      ok: true,
      summary,
      renamed,
      errors
    });
  }));

  // Real-time metrics endpoint for dashboard
  app.get(p('/metrics'), requireAdmin, asyncHandler(async (_req, res) => {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60_000);
    const oneHourAgo = new Date(now.getTime() - 3600_000);

    const [
      tavilyKeys,
      braveKeys,
      clientTokens,
      tavilyRecentCount,
      braveRecentCount,
      tavilyHourlyCount,
      braveHourlyCount,
      recentErrors
    ] = await prisma.$transaction([
      prisma.tavilyKey.findMany({ select: { id: true, status: true } }),
      prisma.braveKey.findMany({ select: { id: true, status: true } }),
      prisma.clientToken.findMany({ select: { id: true, revokedAt: true } }),
      prisma.tavilyToolUsage.count({ where: { timestamp: { gte: oneMinuteAgo } } }),
      prisma.braveToolUsage.count({ where: { timestamp: { gte: oneMinuteAgo } } }),
      prisma.tavilyToolUsage.count({ where: { timestamp: { gte: oneHourAgo } } }),
      prisma.braveToolUsage.count({ where: { timestamp: { gte: oneHourAgo } } }),
      prisma.tavilyToolUsage.findMany({
        where: {
          outcome: 'error',
          timestamp: { gte: oneHourAgo }
        },
        orderBy: { timestamp: 'desc' },
        take: 5,
        select: { id: true, toolName: true, errorMessage: true, timestamp: true }
      })
    ]);

    const activeKeys = tavilyKeys.filter(k => k.status === 'active').length +
                       braveKeys.filter(k => k.status === 'active').length;
    const unhealthyKeys = tavilyKeys.filter(k => k.status === 'invalid' || k.status === 'cooldown').length +
                          braveKeys.filter(k => k.status === 'invalid').length;
    const activeTokens = clientTokens.filter(t => !t.revokedAt).length;

    res.json({
      requestsPerMinute: tavilyRecentCount + braveRecentCount,
      requestsPerHour: tavilyHourlyCount + braveHourlyCount,
      activeTokens,
      keyPool: {
        total: tavilyKeys.length + braveKeys.length,
        active: activeKeys,
        unhealthy: unhealthyKeys,
        tavily: {
          total: tavilyKeys.length,
          active: tavilyKeys.filter(k => k.status === 'active').length,
          cooldown: tavilyKeys.filter(k => k.status === 'cooldown').length,
          invalid: tavilyKeys.filter(k => k.status === 'invalid').length
        },
        brave: {
          total: braveKeys.length,
          active: braveKeys.filter(k => k.status === 'active').length,
          invalid: braveKeys.filter(k => k.status === 'invalid').length
        }
      },
      recentErrors: recentErrors.map(e => ({
        id: e.id,
        toolName: e.toolName,
        errorMessage: e.errorMessage,
        timestamp: e.timestamp.toISOString()
      })),
      timestamp: now.toISOString()
    });
  }));

  // Cost estimation endpoint
  // Tavily credit costs: search=1, extract=1, crawl=2, map=1, research=5
  // Brave: free tier limited, paid tier varies
  app.get(p('/cost-estimate'), requireAdmin, asyncHandler(async (req, res) => {
    const dateFromRaw = req.query.dateFrom as string | undefined;
    const dateToRaw = req.query.dateTo as string | undefined;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dateFrom = dateFromRaw ? new Date(dateFromRaw) : thirtyDaysAgo;
    const dateTo = dateToRaw ? new Date(dateToRaw) : now;

    const where: any = {
      timestamp: {
        gte: dateFrom,
        lte: dateTo
      },
      outcome: 'success'
    };

    const [tavilyUsage, braveUsage] = await prisma.$transaction([
      prisma.tavilyToolUsage.groupBy({
        by: ['toolName'],
        where,
        orderBy: { toolName: 'asc' },
        _count: { _all: true }
      }),
      prisma.braveToolUsage.groupBy({
        by: ['toolName'],
        where,
        orderBy: { toolName: 'asc' },
        _count: { _all: true }
      })
    ]);

    // Tavily credit costs per tool
    const tavilyCostMap: Record<string, number> = {
      tavily_search: 1,
      tavily_extract: 1,
      tavily_crawl: 2,
      tavily_map: 1,
      tavily_research: 5
    };

    let tavilyTotalCredits = 0;
    const tavilyBreakdown = tavilyUsage.map(item => {
      const cost = tavilyCostMap[item.toolName] ?? 1;
      const count = (item._count as { _all: number })._all;
      const credits = count * cost;
      tavilyTotalCredits += credits;
      return {
        toolName: item.toolName,
        count,
        creditCost: cost,
        totalCredits: credits
      };
    });

    // Brave is usage-based, estimate $0.003/request for Pro tier
    let braveTotalRequests = 0;
    const braveBreakdown = braveUsage.map(item => {
      const count = (item._count as { _all: number })._all;
      braveTotalRequests += count;
      return {
        toolName: item.toolName,
        count
      };
    });
    const braveEstimatedCostUsd = braveTotalRequests * 0.003;

    res.json({
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
  }));
}
