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
             lastUsedAt, failureScore, creditsRemaining, creditsCheckedAt,
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
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(`
      INSERT INTO TavilyKey (id, label, keyEncrypted, keyMasked, status, failureScore, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 'active', 0, ?, ?)
    `).bind(data.id, data.label, data.keyEncrypted, data.keyMasked, now, now).run();
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

    updates.push('updatedAt = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await this.db.prepare(`
      UPDATE TavilyKey SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();
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
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(`
      INSERT INTO BraveKey (id, label, keyEncrypted, keyMasked, status, failureScore, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 'active', 0, ?, ?)
    `).bind(data.id, data.label, data.keyEncrypted, data.keyMasked, now, now).run();
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
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(`
      INSERT INTO ClientToken (id, description, tokenPrefix, tokenHash, scopesJson, expiresAt, createdAt)
      VALUES (?, ?, ?, ?, '[]', ?, ?)
    `).bind(data.id, data.description || null, data.tokenPrefix, data.tokenHash, data.expiresAt || null, now).run();
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
}
