import type { D1Database } from '@cloudflare/workers-types';

/**
 * D1 Database helper for MCP Nexus
 * Direct SQL queries instead of Prisma for simpler deployment
 */

// Type definitions matching the database schema
export interface TavilyKey {
  id: string;
  label: string;
  keyEncrypted: ArrayBuffer;
  keyMasked: string | null;
  status: string;
  cooldownUntil: string | null;
  lastUsedAt: string | null;
  failureScore: number;
  creditsRemaining: number | null;
  creditsCheckedAt: string | null;
  creditsExpiresAt: string | null;
  creditsKeyUsage: number | null;
  creditsKeyLimit: number | null;
  creditsKeyRemaining: number | null;
  creditsAccountPlanUsage: number | null;
  creditsAccountPlanLimit: number | null;
  creditsAccountPaygoUsage: number | null;
  creditsAccountPaygoLimit: number | null;
  creditsAccountRemaining: number | null;
  creditsRefreshLockUntil: string | null;
  creditsRefreshLockId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BraveKey {
  id: string;
  label: string;
  keyEncrypted: ArrayBuffer;
  keyMasked: string | null;
  status: string;
  lastUsedAt: string | null;
  failureScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientToken {
  id: string;
  description: string | null;
  tokenPrefix: string;
  tokenHash: ArrayBuffer;
  scopesJson: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ServerSetting {
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface TavilyToolUsage {
  id: string;
  timestamp: string;
  toolName: string;
  outcome: string;
  latencyMs: number | null;
  clientTokenId: string;
  clientTokenPrefix: string | null;
  upstreamKeyId: string | null;
  queryHash: string | null;
  queryPreview: string | null;
  argsJson: string;
  errorMessage: string | null;
}

export interface BraveToolUsage {
  id: string;
  timestamp: string;
  toolName: string;
  outcome: string;
  latencyMs: number | null;
  clientTokenId: string;
  clientTokenPrefix: string | null;
  upstreamKeyId: string | null;
  queryHash: string | null;
  queryPreview: string | null;
  argsJson: string;
  errorMessage: string | null;
}

export type CombinedUsageLog = TavilyToolUsage | BraveToolUsage;

export interface UsageQueryFilters {
  toolName?: string;
  outcome?: string;
  clientTokenPrefix?: string;
  queryHash?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CombinedUsageResult {
  logs: CombinedUsageLog[];
  totalItems: number;
}

export interface UsageSummaryResult {
  total: number;
  byTool: { toolName: string; count: number }[];
  topQueries: { queryHash: string | null; queryPreview: string | null; count: number }[];
}

/**
 * Generate CUID-like IDs
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `c${timestamp}${randomPart}`;
}

/**
 * D1 Database wrapper with typed queries
 */
export class D1Client {
  constructor(private db: D1Database) {}

  // ============ Tavily Keys ============

  async getTavilyKeys(): Promise<TavilyKey[]> {
    const result = await this.db.prepare(`
      SELECT id, label, keyEncrypted, keyMasked, status, cooldownUntil,
             lastUsedAt, failureScore, creditsRemaining, creditsCheckedAt, creditsExpiresAt,
             creditsKeyUsage, creditsKeyLimit, creditsKeyRemaining,
             creditsAccountPlanUsage, creditsAccountPlanLimit,
             creditsAccountPaygoUsage, creditsAccountPaygoLimit, creditsAccountRemaining,
             creditsRefreshLockUntil, creditsRefreshLockId,
             createdAt, updatedAt
      FROM TavilyKey
      ORDER BY createdAt DESC
    `).all<TavilyKey>();
    return result.results;
  }

  async getTavilyKeyById(id: string): Promise<TavilyKey | null> {
    const result = await this.db.prepare(`
      SELECT * FROM TavilyKey WHERE id = ?
    `).bind(id).first<TavilyKey>();
    return result;
  }

  async getActiveTavilyKey(): Promise<TavilyKey | null> {
    const now = new Date().toISOString();
    const result = await this.db.prepare(`
      SELECT * FROM TavilyKey
      WHERE status = 'active'
        AND (cooldownUntil IS NULL OR cooldownUntil <= ?)
      ORDER BY lastUsedAt ASC NULLS FIRST
      LIMIT 1
    `).bind(now).first<TavilyKey>();
    return result;
  }

  async createTavilyKey(data: {
    id: string;
    label: string;
    keyEncrypted: ArrayBuffer;
    keyMasked: string;
    status?: string;
    cooldownUntil?: string | null;
  }): Promise<void> {
    const now = new Date().toISOString();
    const status = data.status || 'active';
    const cooldownUntil = data.cooldownUntil || null;

    await this.db.prepare(`
      INSERT INTO TavilyKey (id, label, keyEncrypted, keyMasked, status, cooldownUntil, failureScore, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).bind(data.id, data.label, data.keyEncrypted, data.keyMasked, status, cooldownUntil, now, now).run();
  }

  async updateTavilyKey(id: string, data: Partial<TavilyKey>): Promise<void> {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.label !== undefined) {
      updates.push('label = ?');
      values.push(data.label);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.lastUsedAt !== undefined) {
      updates.push('lastUsedAt = ?');
      values.push(data.lastUsedAt);
    }
    if (data.cooldownUntil !== undefined) {
      updates.push('cooldownUntil = ?');
      values.push(data.cooldownUntil);
    }
    if (data.creditsCheckedAt !== undefined) {
      updates.push('creditsCheckedAt = ?');
      values.push(data.creditsCheckedAt);
    }
    if (data.creditsExpiresAt !== undefined) {
      updates.push('creditsExpiresAt = ?');
      values.push(data.creditsExpiresAt);
    }
    if (data.creditsRemaining !== undefined) {
      updates.push('creditsRemaining = ?');
      values.push(data.creditsRemaining);
    }
    if (data.creditsKeyUsage !== undefined) {
      updates.push('creditsKeyUsage = ?');
      values.push(data.creditsKeyUsage);
    }
    if (data.creditsKeyLimit !== undefined) {
      updates.push('creditsKeyLimit = ?');
      values.push(data.creditsKeyLimit);
    }
    if (data.creditsKeyRemaining !== undefined) {
      updates.push('creditsKeyRemaining = ?');
      values.push(data.creditsKeyRemaining);
    }
    if (data.creditsAccountPlanUsage !== undefined) {
      updates.push('creditsAccountPlanUsage = ?');
      values.push(data.creditsAccountPlanUsage);
    }
    if (data.creditsAccountPlanLimit !== undefined) {
      updates.push('creditsAccountPlanLimit = ?');
      values.push(data.creditsAccountPlanLimit);
    }
    if (data.creditsAccountPaygoUsage !== undefined) {
      updates.push('creditsAccountPaygoUsage = ?');
      values.push(data.creditsAccountPaygoUsage);
    }
    if (data.creditsAccountPaygoLimit !== undefined) {
      updates.push('creditsAccountPaygoLimit = ?');
      values.push(data.creditsAccountPaygoLimit);
    }
    if (data.creditsAccountRemaining !== undefined) {
      updates.push('creditsAccountRemaining = ?');
      values.push(data.creditsAccountRemaining);
    }
    if (data.creditsRefreshLockUntil !== undefined) {
      updates.push('creditsRefreshLockUntil = ?');
      values.push(data.creditsRefreshLockUntil);
    }
    if (data.creditsRefreshLockId !== undefined) {
      updates.push('creditsRefreshLockId = ?');
      values.push(data.creditsRefreshLockId);
    }

    updates.push('updatedAt = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.db.prepare(`
      UPDATE TavilyKey SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();
  }

  async tryAcquireTavilyCreditsRefreshLock(id: string, lockMs: number): Promise<string | null> {
    const now = new Date();
    const nowIso = now.toISOString();
    const lockUntilIso = new Date(now.getTime() + Math.max(1, lockMs)).toISOString();
    const lockId = generateId();

    await this.db.prepare(`
      UPDATE TavilyKey
      SET creditsRefreshLockUntil = ?, creditsRefreshLockId = ?, updatedAt = ?
      WHERE id = ?
        AND (creditsRefreshLockUntil IS NULL OR creditsRefreshLockUntil < ?)
    `).bind(lockUntilIso, lockId, nowIso, id, nowIso).run();

    const current = await this.db.prepare(`
      SELECT creditsRefreshLockId FROM TavilyKey WHERE id = ?
    `).bind(id).first<{ creditsRefreshLockId: string | null }>();

    return current?.creditsRefreshLockId === lockId ? lockId : null;
  }

  async releaseTavilyCreditsRefreshLock(id: string, lockId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE TavilyKey
      SET creditsRefreshLockUntil = NULL, creditsRefreshLockId = NULL, updatedAt = ?
      WHERE id = ? AND creditsRefreshLockId = ?
    `).bind(new Date().toISOString(), id, lockId).run();
  }


  async deleteTavilyKey(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM TavilyKey WHERE id = ?`).bind(id).run();
  }

  // ============ Brave Keys ============

  async getBraveKeys(): Promise<BraveKey[]> {
    const result = await this.db.prepare(`
      SELECT id, label, keyEncrypted, keyMasked, status, lastUsedAt,
             failureScore, createdAt, updatedAt
      FROM BraveKey
      ORDER BY createdAt DESC
    `).all<BraveKey>();
    return result.results;
  }

  async getActiveBraveKey(): Promise<BraveKey | null> {
    const result = await this.db.prepare(`
      SELECT * FROM BraveKey
      WHERE status = 'active'
      ORDER BY lastUsedAt ASC NULLS FIRST
      LIMIT 1
    `).first<BraveKey>();
    return result;
  }

  async getBraveKeyById(id: string): Promise<BraveKey | null> {
    const result = await this.db.prepare(`
      SELECT * FROM BraveKey WHERE id = ?
    `).bind(id).first<BraveKey>();
    return result;
  }

  async createBraveKey(data: {
    id: string;
    label: string;
    keyEncrypted: ArrayBuffer;
    keyMasked: string;
    status?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const status = data.status || 'active';

    await this.db.prepare(`
      INSERT INTO BraveKey (id, label, keyEncrypted, keyMasked, status, failureScore, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).bind(data.id, data.label, data.keyEncrypted, data.keyMasked, status, now, now).run();
  }

  async updateBraveKey(id: string, data: Partial<BraveKey>): Promise<void> {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.lastUsedAt !== undefined) {
      updates.push('lastUsedAt = ?');
      values.push(data.lastUsedAt);
    }

    updates.push('updatedAt = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.db.prepare(`
      UPDATE BraveKey SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();
  }

  async deleteBraveKey(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM BraveKey WHERE id = ?`).bind(id).run();
  }

  // ============ Client Tokens ============

  async getClientTokens(): Promise<ClientToken[]> {
    const result = await this.db.prepare(`
      SELECT id, description, tokenPrefix, tokenHash, scopesJson,
             expiresAt, revokedAt, createdAt
      FROM ClientToken
      ORDER BY createdAt DESC
    `).all<ClientToken>();
    return result.results;
  }

  async getClientTokenByPrefix(prefix: string): Promise<ClientToken | null> {
    const result = await this.db.prepare(`
      SELECT * FROM ClientToken WHERE tokenPrefix = ?
    `).bind(prefix).first<ClientToken>();
    return result;
  }

  async createClientToken(data: {
    id: string;
    description?: string;
    tokenPrefix: string;
    tokenHash: ArrayBuffer;
    expiresAt?: string;
    allowedTools?: string | null;  // Phase 3.4: JSON string or null
    rateLimit?: number | null;     // Phase 3.5: requests per minute or null
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(`
      INSERT INTO ClientToken (id, description, tokenPrefix, tokenHash, scopesJson, allowedTools, rateLimit, expiresAt, createdAt)
      VALUES (?, ?, ?, ?, '[]', ?, ?, ?, ?)
    `).bind(
      data.id,
      data.description || null,
      data.tokenPrefix,
      data.tokenHash,
      data.allowedTools || null,
      data.rateLimit || null,
      data.expiresAt || null,
      now
    ).run();
  }

  async revokeClientToken(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(`
      UPDATE ClientToken SET revokedAt = ? WHERE id = ?
    `).bind(now, id).run();
  }

  // ============ Server Settings ============

  async getServerSettings(): Promise<ServerSetting[]> {
    const result = await this.db.prepare(`
      SELECT * FROM ServerSetting
    `).all<ServerSetting>();
    return result.results;
  }

  async upsertServerSetting(key: string, value: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(`
      INSERT INTO ServerSetting (key, value, createdAt, updatedAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updatedAt = ?
    `).bind(key, value, now, now, value, now).run();
  }

  // ============ Usage Logs ============

  async getTavilyUsageLogs(limit = 100, offset = 0): Promise<TavilyToolUsage[]> {
    const result = await this.db.prepare(`
      SELECT id, timestamp, toolName, outcome, latencyMs,
             clientTokenId, clientTokenPrefix, upstreamKeyId,
             queryHash, queryPreview, argsJson, errorMessage
      FROM TavilyToolUsage
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all<TavilyToolUsage>();
    return result.results;
  }

  async getBraveUsageLogs(limit = 100, offset = 0): Promise<BraveToolUsage[]> {
    const result = await this.db.prepare(`
      SELECT id, timestamp, toolName, outcome, latencyMs,
             clientTokenId, clientTokenPrefix, upstreamKeyId,
             queryHash, queryPreview, argsJson, errorMessage
      FROM BraveToolUsage
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all<BraveToolUsage>();
    return result.results;
  }

  private buildUsageWhere(filters: UsageQueryFilters): { clause: string; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.toolName) {
      conditions.push('toolName = ?');
      params.push(filters.toolName);
    }
    if (filters.outcome) {
      conditions.push('outcome = ?');
      params.push(filters.outcome);
    }
    if (filters.clientTokenPrefix) {
      conditions.push('instr(clientTokenPrefix, ?) > 0');
      params.push(filters.clientTokenPrefix);
    }
    if (filters.queryHash) {
      conditions.push('queryHash = ?');
      params.push(filters.queryHash);
    }
    if (filters.dateFrom) {
      conditions.push('datetime(timestamp) >= datetime(?)');
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      conditions.push('datetime(timestamp) <= datetime(?)');
      params.push(filters.dateTo);
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params
    };
  }

  async getCombinedUsageLogs(
    filters: UsageQueryFilters & { limit?: number; offset?: number; order?: 'asc' | 'desc' } = {}
  ): Promise<CombinedUsageResult> {
    const { limit = 100, offset = 0, order = 'desc', ...whereFilters } = filters;
    const { clause, params } = this.buildUsageWhere(whereFilters);
    const orderDirection = order === 'asc' ? 'ASC' : 'DESC';

    const logsResult = await this.db.prepare(`
      SELECT id, timestamp, toolName, outcome, latencyMs,
             clientTokenId, clientTokenPrefix, upstreamKeyId,
             queryHash, queryPreview, argsJson, errorMessage
      FROM (
        SELECT id, timestamp, toolName, outcome, latencyMs,
               clientTokenId, clientTokenPrefix, upstreamKeyId,
               queryHash, queryPreview, argsJson, errorMessage
        FROM TavilyToolUsage
        ${clause}
        UNION ALL
        SELECT id, timestamp, toolName, outcome, latencyMs,
               clientTokenId, clientTokenPrefix, upstreamKeyId,
               queryHash, queryPreview, argsJson, errorMessage
        FROM BraveToolUsage
        ${clause}
      ) AS merged
      ORDER BY timestamp ${orderDirection}
      LIMIT ? OFFSET ?
    `).bind(...params, ...params, limit, offset).all<CombinedUsageLog>();

    const totalResult = await this.db.prepare(`
      SELECT
        (
          (SELECT COUNT(*) FROM TavilyToolUsage ${clause})
          +
          (SELECT COUNT(*) FROM BraveToolUsage ${clause})
        ) AS totalItems
    `).bind(...params, ...params).first<{ totalItems: number | string | null }>();

    return {
      logs: logsResult.results,
      totalItems: Number(totalResult?.totalItems ?? 0)
    };
  }

  async getCombinedUsageSummary(filters: UsageQueryFilters = {}): Promise<UsageSummaryResult> {
    const { clause, params } = this.buildUsageWhere(filters);

    const totalResult = await this.db.prepare(`
      SELECT
        (
          (SELECT COUNT(*) FROM TavilyToolUsage ${clause})
          +
          (SELECT COUNT(*) FROM BraveToolUsage ${clause})
        ) AS totalItems
    `).bind(...params, ...params).first<{ totalItems: number | string | null }>();

    const byToolResult = await this.db.prepare(`
      SELECT toolName, COUNT(*) AS count
      FROM (
        SELECT toolName FROM TavilyToolUsage ${clause}
        UNION ALL
        SELECT toolName FROM BraveToolUsage ${clause}
      ) AS merged
      GROUP BY toolName
      ORDER BY count DESC
    `).bind(...params, ...params).all<{ toolName: string; count: number | string }>();

    const topQueriesResult = await this.db.prepare(`
      SELECT queryHash, MAX(queryPreview) AS queryPreview, COUNT(*) AS count
      FROM (
        SELECT queryHash, queryPreview FROM TavilyToolUsage ${clause}
        UNION ALL
        SELECT queryHash, queryPreview FROM BraveToolUsage ${clause}
      ) AS merged
      WHERE queryHash IS NOT NULL
      GROUP BY queryHash
      ORDER BY count DESC
      LIMIT 20
    `).bind(...params, ...params).all<{ queryHash: string | null; queryPreview: string | null; count: number | string }>();

    return {
      total: Number(totalResult?.totalItems ?? 0),
      byTool: byToolResult.results.map((row) => ({ toolName: row.toolName, count: Number(row.count) })),
      topQueries: topQueriesResult.results.map((row) => ({ queryHash: row.queryHash, queryPreview: row.queryPreview, count: Number(row.count) }))
    };
  }

  // ============ Audit Logs ============

  async createAuditLog(input: {
    actorAdminId?: string | null;
    eventType: string;
    outcome: string;
    resourceType?: string | null;
    resourceId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    detailsJson: string;
  }): Promise<void> {
    const id = generateId();
    const timestamp = new Date().toISOString();
    await this.db.prepare(`
      INSERT INTO AuditLog (id, timestamp, actorAdminId, eventType, resourceType, resourceId, outcome, ip, userAgent, detailsJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      timestamp,
      input.actorAdminId ?? null,
      input.eventType,
      input.resourceType ?? null,
      input.resourceId ?? null,
      input.outcome,
      input.ip ?? null,
      input.userAgent ?? null,
      input.detailsJson
    ).run();
  }
}
