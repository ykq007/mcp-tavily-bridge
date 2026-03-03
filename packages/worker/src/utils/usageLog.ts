/**
 * Worker-compatible usage logging utilities.
 * Uses Web Crypto API (crypto.subtle) instead of Node.js crypto.
 */

type UsageLogMode = 'none' | 'hash' | 'preview' | 'full';

export function parseUsageLogMode(raw: string | undefined): UsageLogMode {
  const normalized = (raw ?? 'preview').toLowerCase();
  if (normalized === 'none' || normalized === 'hash' || normalized === 'preview' || normalized === 'full') {
    return normalized;
  }
  return 'preview';
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function shouldLogUsage(mode: UsageLogMode): boolean {
  return mode !== 'none';
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

export async function buildQueryMetadata(
  query: string | undefined,
  mode: UsageLogMode
): Promise<{ queryHash?: string; queryPreview?: string }> {
  if (!query) return {};
  if (mode === 'none') return {};

  const queryHash = await sha256Hex(query);
  if (mode === 'hash') return { queryHash };

  const redacted = redactCommonSecrets(query);
  if (mode === 'full') return { queryHash, queryPreview: redacted };
  return { queryHash, queryPreview: clampPreview(redacted, 180) };
}
