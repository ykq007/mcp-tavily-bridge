import type { PrismaClient } from '@mcp-nexus/db';
import { sha256Bytes, timingSafeEqualBytes } from '../crypto/crypto.js';

export type ParsedClientToken =
  | { ok: true; prefix: string; secret: string }
  | { ok: false; error: string };

export function parseClientToken(raw: string): ParsedClientToken {
  // Format: mcp_<prefix>.<secret>
  const dot = raw.indexOf('.');
  if (dot <= 0) return { ok: false, error: 'Invalid token format' };
  const prefix = raw.slice(0, dot);
  const secret = raw.slice(dot + 1);
  if (!prefix || !secret) return { ok: false, error: 'Invalid token format' };
  return { ok: true, prefix, secret };
}

export async function validateClientToken(prisma: PrismaClient, raw: string): Promise<
  | { ok: true; clientTokenId: string; prefix: string; allowedTools: unknown; rateLimit: number | null }
  | { ok: false; error: string }
> {
  const parsed = parseClientToken(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const record = await prisma.clientToken.findUnique({ where: { tokenPrefix: parsed.prefix } });
  if (!record) return { ok: false, error: 'Invalid token' };
  if (record.revokedAt) return { ok: false, error: 'Token revoked' };
  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) return { ok: false, error: 'Token expired' };

  const expected = Buffer.from(record.tokenHash);
  const actual = sha256Bytes(parsed.secret);
  if (!timingSafeEqualBytes(expected, actual)) return { ok: false, error: 'Invalid token' };

  return {
    ok: true,
    clientTokenId: record.id,
    prefix: record.tokenPrefix,
    allowedTools: record.allowedTools,
    rateLimit: record.rateLimit
  };
}

