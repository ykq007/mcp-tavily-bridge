import { BraveHttpError } from './errors.js';
import type { BraveClient, BraveLocalSearchParams, BraveWebSearchParams } from './types.js';
import type { QueuedRateGate } from './rateGate.js';

const baseUrls = {
  webSearch: 'https://api.search.brave.com/res/v1/web/search'
} as const;

export function createBraveHttpClient(opts: {
  apiKey: string;
  gate: QueuedRateGate;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): BraveClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs =
    typeof opts.timeoutMs === 'number' && Number.isFinite(opts.timeoutMs) ? Math.max(1, Math.floor(opts.timeoutMs)) : 20_000;

  const webSearch: BraveClient['webSearch'] = async (params, callOpts) => {
    const merged = applyDefaults({ ...params }, callOpts?.defaults ?? {});
    const url = buildWebSearchUrl(merged);
    return await opts.gate.run(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetchImpl(url, {
            method: 'GET',
            headers: {
              accept: 'application/json',
              'X-Subscription-Token': opts.apiKey
            },
            signal: controller.signal
          });
          return await parseOrThrow(res);
        } finally {
          clearTimeout(timeout);
        }
      },
      { maxWaitMs: callOpts?.maxWaitMs }
    );
  };

  const localSearch: BraveClient['localSearch'] = async (params, callOpts) => {
    // Many Brave MCP servers fall back to web search for local queries when the plan doesn't support local endpoints.
    return await webSearch(params as any, callOpts);
  };

  return { webSearch, localSearch };
}

function buildWebSearchUrl(params: Record<string, unknown>): string {
  const url = new URL(baseUrls.webSearch);

  const q = typeof (params as any).query === 'string' ? (params as any).query : '';
  url.searchParams.set('q', q);

  const count = clampInt((params as any).count, 10, 1, 20);
  const offset = clampInt((params as any).offset, 0, 0, 9);
  url.searchParams.set('count', String(count));
  url.searchParams.set('offset', String(offset));

  for (const [key, value] of Object.entries(params)) {
    if (key === 'query' || key === 'count' || key === 'offset') continue;
    appendSearchParam(url.searchParams, key, value);
  }

  return url.toString();
}

function appendSearchParam(params: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (typeof value === 'string' && value.trim() === '') return;

  if (Array.isArray(value)) {
    const parts = value.map((v) => String(v)).filter((s) => s.trim() !== '');
    if (parts.length === 0) return;
    params.set(key, parts.join(','));
    return;
  }

  if (typeof value === 'boolean') {
    params.set(key, value ? 'true' : 'false');
    return;
  }

  params.set(key, String(value));
}

async function parseOrThrow(res: Response): Promise<any> {
  const text = await res.text();
  const body = safeJson(text);
  if (res.ok) return body;

  if (res.status === 401 || res.status === 403) throw new Error('Invalid API key');

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get('Retry-After');
    const retryAfterMs = parseRetryAfterMs(retryAfterHeader);
    throw new BraveHttpError('Rate limit exceeded', { status: res.status, retryAfterMs, braveMessage: typeof body?.message === 'string' ? body.message : undefined });
  }

  const message = typeof body?.message === 'string' ? body.message : res.statusText;
  throw new BraveHttpError(`HTTP ${res.status}`, { status: res.status, braveMessage: message });
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.floor(seconds * 1000);
  return undefined;
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function applyDefaults(target: Record<string, unknown>, defaults: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(target)) {
    if (key in defaults) {
      target[key] = defaults[key] as any;
    }
  }
  return target;
}
