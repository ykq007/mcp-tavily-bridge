import { createHash, createHmac } from 'node:crypto';
import type { PrismaClient } from '@mcp-tavily-bridge/db';
import { requestContext } from '../context.js';

export type TavilyUsageLogMode = 'none' | 'hash' | 'preview' | 'full';

export function getTavilyUsageLogMode(): TavilyUsageLogMode {
  const raw = (process.env.TAVILY_USAGE_LOG_MODE ?? 'preview').toLowerCase();
  if (raw === 'none' || raw === 'hash' || raw === 'preview' || raw === 'full') return raw;
  return 'preview';
}

export function getTavilyUsageRetentionDays(): number | null {
  const raw = (process.env.TAVILY_USAGE_RETENTION_DAYS ?? '').trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function getTavilyUsageHashSecret(): string | null {
  const raw = (process.env.TAVILY_USAGE_HASH_SECRET ?? '').trim();
  if (!raw) return null;
  return raw;
}

function queryHashHex(query: string): string {
  const secret = getTavilyUsageHashSecret();
  if (!secret) return sha256Hex(query);
  return createHmac('sha256', secret).update(query, 'utf8').digest('hex');
}

function clampPreview(text: string, maxLen: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLen - 1))}…`;
}

function redactCommonSecrets(text: string): string {
  let s = text;

  // Emails
  s = s.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '<email>');

  // Long hex / token-ish strings
  s = s.replace(/\b[a-f0-9]{32,}\b/gi, '<hex>');
  s = s.replace(/\b[A-Za-z0-9_-]{32,}\b/g, '<token>');

  // Common key prefixes
  s = s.replace(/\btvly-[A-Za-z0-9_-]+\b/g, 'tvly-<redacted>');
  s = s.replace(/\bmcp_[A-Za-z0-9]+\.[A-Za-z0-9]+\b/g, 'mcp_<redacted>');

  // URL query param redaction for common sensitive keys
  s = s.replace(/([?&](?:token|access_token|auth|apikey|api_key|key|password)=)[^&\s]+/gi, '$1<redacted>');
  s = s.replace(/((?:^|[\s?&])(?:token|access_token|auth|apikey|api_key|key|password)=)[^\s&]+/gi, '$1<redacted>');

  return s;
}

export function buildQueryMetadata(query: string | undefined, mode: TavilyUsageLogMode): { queryHash?: string; queryPreview?: string } {
  if (!query) return {};
  if (mode === 'none') return {};

  const queryHash = queryHashHex(query);
  if (mode === 'hash') return { queryHash };

  const redacted = redactCommonSecrets(query);
  if (mode === 'full') return { queryHash, queryPreview: redacted };
  return { queryHash, queryPreview: clampPreview(redacted, 180) };
}

export function shouldLogTavilyUsage(mode: TavilyUsageLogMode): boolean {
  if (mode === 'none') return false;
  const raw = (process.env.TAVILY_USAGE_SAMPLE_RATE ?? '').trim();
  if (!raw) return true;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return false;
  if (n >= 1) return true;
  return Math.random() < n;
}

export async function maybeCleanupOldUsageRows(prisma: PrismaClient): Promise<void> {
  const days = getTavilyUsageRetentionDays();
  if (!days) return;

  // Keep cleanup very low-frequency to avoid hot-path overhead.
  const raw = (process.env.TAVILY_USAGE_CLEANUP_PROBABILITY ?? '0.001').trim();
  const p = Number(raw);
  const probability = Number.isFinite(p) && p > 0 ? Math.min(1, p) : 0.001;
  if (Math.random() >= probability) return;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  await prisma.tavilyToolUsage.deleteMany({ where: { timestamp: { lt: cutoff } } });
}

export async function logTavilyToolUsage(prisma: PrismaClient, input: {
  toolName: string;
  upstreamKeyId?: string | null;
  outcome: 'success' | 'error';
  latencyMs?: number;
  query?: string;
  argsSummary?: Record<string, unknown>;
  errorMessage?: string;
}): Promise<void> {
  const mode = getTavilyUsageLogMode();
  if (!shouldLogTavilyUsage(mode)) return;

  const ctx = requestContext.getStore();
  if (!ctx) return;

  const { queryHash, queryPreview } = buildQueryMetadata(input.query, mode);

  await prisma.tavilyToolUsage.create({
    data: {
      toolName: input.toolName,
      outcome: input.outcome,
      latencyMs: typeof input.latencyMs === 'number' ? Math.max(0, Math.floor(input.latencyMs)) : null,
      clientTokenId: ctx.clientTokenId,
      clientTokenPrefix: ctx.clientTokenPrefix,
      upstreamKeyId: input.upstreamKeyId ?? null,
      queryHash: queryHash ?? null,
      queryPreview: queryPreview ?? null,
      argsJson: (input.argsSummary ?? {}) as any,
      errorMessage: input.errorMessage ?? null
    }
  });

  await maybeCleanupOldUsageRows(prisma);
}
