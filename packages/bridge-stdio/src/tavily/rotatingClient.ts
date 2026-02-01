import type { PrismaClient } from '@mcp-tavily-bridge/db';
import type { TavilyClient } from '@mcp-tavily-bridge/core';
import { requestContext } from '../context.js';
import { createTavilyHttpClient } from './httpClient.js';
import { TavilyKeyPool } from './keyPool.js';
import { logTavilyToolUsage } from './usageLog.js';

export class RotatingTavilyClient implements TavilyClient {
  private readonly pool: TavilyKeyPool;
  private readonly prisma: PrismaClient;
  private readonly maxRetries: number;
  private readonly fixedCooldownMs: number;

  constructor(opts: { pool: TavilyKeyPool; prisma: PrismaClient; maxRetries: number; fixedCooldownMs: number }) {
    this.pool = opts.pool;
    this.prisma = opts.prisma;
    this.maxRetries = opts.maxRetries;
    this.fixedCooldownMs = opts.fixedCooldownMs;
  }

  async search(params: Record<string, unknown>, opts: { defaults: Record<string, unknown> }): Promise<any> {
    const merged = applyDefaults({ ...params }, opts.defaults);
    if (((merged as any).start_date || (merged as any).end_date) && (merged as any).time_range) {
      (merged as any).time_range = undefined;
    }
    if (Array.isArray((merged as any).include_domains) === false) (merged as any).include_domains = [];
    if (Array.isArray((merged as any).exclude_domains) === false) (merged as any).exclude_domains = [];
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(merged)) {
      if (v === '' || v === null || v === undefined) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      cleaned[k] = v;
    }
    const query = typeof (cleaned as any).query === 'string' ? String((cleaned as any).query) : undefined;
    const argsSummary = {
      search_depth: (cleaned as any).search_depth,
      topic: (cleaned as any).topic,
      time_range: (cleaned as any).time_range,
      start_date: (cleaned as any).start_date,
      end_date: (cleaned as any).end_date,
      max_results: (cleaned as any).max_results,
      include_domains_count: Array.isArray((cleaned as any).include_domains) ? (cleaned as any).include_domains.length : 0,
      exclude_domains_count: Array.isArray((cleaned as any).exclude_domains) ? (cleaned as any).exclude_domains.length : 0,
      country: (cleaned as any).country
    } as Record<string, unknown>;
    return await this.withRotation('tavily_search', { query, argsSummary }, (client) => client.search(cleaned));
  }

  async extract(params: Record<string, unknown>): Promise<any> {
    const urls = Array.isArray((params as any).urls) ? (params as any).urls : [];
    const argsSummary = { urls_count: Array.isArray(urls) ? urls.length : 0, extract_depth: (params as any).extract_depth, format: (params as any).format };
    return await this.withRotation('tavily_extract', { argsSummary }, (client) => client.extract(params));
  }
  async crawl(params: Record<string, unknown>): Promise<any> {
    const url = typeof (params as any).url === 'string' ? String((params as any).url) : undefined;
    const argsSummary = { url, max_depth: (params as any).max_depth, limit: (params as any).limit };
    return await this.withRotation('tavily_crawl', { argsSummary }, (client) => client.crawl(params));
  }
  async map(params: Record<string, unknown>): Promise<any> {
    const url = typeof (params as any).url === 'string' ? String((params as any).url) : undefined;
    const argsSummary = { url, max_depth: (params as any).max_depth, limit: (params as any).limit };
    return await this.withRotation('tavily_map', { argsSummary }, (client) => client.map(params));
  }

  async research(params: { input: string; model?: 'mini' | 'pro' | 'auto' } & Record<string, unknown>): Promise<any> {
    const INITIAL_POLL_INTERVAL = 2000;
    const MAX_POLL_INTERVAL = 10000;
    const POLL_BACKOFF_FACTOR = 1.5;
    const MAX_PRO_MODEL_POLL_DURATION = 900000;
    const MAX_MINI_MODEL_POLL_DURATION = 300000;
    const maxPollDuration = params.model === 'mini' ? MAX_MINI_MODEL_POLL_DURATION : MAX_PRO_MODEL_POLL_DURATION;

    let attempt = 0;
    while (attempt <= this.maxRetries) {
      attempt += 1;
      const key = await this.pool.selectEligibleKey();
      if (!key) return { error: 'No request_id returned from research endpoint' };

      const client = createTavilyHttpClient(key.apiKey);
      try {
        const start = await client.researchStart({ input: params.input, model: params.model || 'auto' });
        const requestId = start?.request_id;
        if (!requestId) return { error: 'No request_id returned from research endpoint' };

        const startedAt = Date.now();
        const ctx = requestContext.getStore();
        if (ctx) {
          await this.prisma.researchJob.create({
            data: { clientTokenId: ctx.clientTokenId, upstreamKeyId: key.id, upstreamJobId: String(requestId), status: 'running' }
          });
        }

        let pollInterval = INITIAL_POLL_INTERVAL;
        let totalElapsed = 0;
        while (totalElapsed < maxPollDuration) {
          await sleep(pollInterval);
          totalElapsed += pollInterval;
          const poll = await client.researchPoll(String(requestId));
          const status = poll?.status;
          if (status === 'completed') {
            await this.prisma.researchJob.update({ where: { upstreamJobId: String(requestId) }, data: { status: 'completed' } });
            void logTavilyToolUsage(this.prisma, {
              toolName: 'tavily_research',
              upstreamKeyId: key.id,
              outcome: 'success',
              latencyMs: Date.now() - startedAt,
              query: params.input,
              argsSummary: { model: params.model || 'auto' }
            }).catch(() => {});
            return { content: poll?.content || '' };
          }
          if (status === 'failed') {
            await this.prisma.researchJob.update({ where: { upstreamJobId: String(requestId) }, data: { status: 'failed' } });
            void logTavilyToolUsage(this.prisma, {
              toolName: 'tavily_research',
              upstreamKeyId: key.id,
              outcome: 'error',
              latencyMs: Date.now() - startedAt,
              query: params.input,
              argsSummary: { model: params.model || 'auto' },
              errorMessage: 'Research task failed'
            }).catch(() => {});
            return { error: 'Research task failed' };
          }
          pollInterval = Math.min(pollInterval * POLL_BACKOFF_FACTOR, MAX_POLL_INTERVAL);
        }

        await this.prisma.researchJob.update({ where: { upstreamJobId: String(requestId) }, data: { status: 'timed_out' } });
        void logTavilyToolUsage(this.prisma, {
          toolName: 'tavily_research',
          upstreamKeyId: key.id,
          outcome: 'error',
          latencyMs: Date.now() - startedAt,
          query: params.input,
          argsSummary: { model: params.model || 'auto' },
          errorMessage: 'Research task timed out'
        }).catch(() => {});
        return { error: 'Research task timed out' };
      } catch (err: any) {
        if (err?.message === 'Invalid API key') {
          await this.pool.markInvalid(key.id);
          continue;
        }
        if (err?.message === 'Usage limit exceeded') {
          await this.pool.markCooldown(key.id, new Date(Date.now() + this.fixedCooldownMs));
          continue;
        }
        void logTavilyToolUsage(this.prisma, {
          toolName: 'tavily_research',
          upstreamKeyId: key.id,
          outcome: 'error',
          query: params.input,
          argsSummary: { model: params.model || 'auto' },
          errorMessage: err instanceof Error ? err.message : String(err)
        }).catch(() => {});
        throw err;
      }
    }
    return { error: 'No request_id returned from research endpoint' };
  }

  private async withRotation<T>(
    toolName: string,
    meta: { query?: string; argsSummary?: Record<string, unknown> },
    fn: (client: ReturnType<typeof createTavilyHttpClient>) => Promise<T>
  ): Promise<T> {
    let attempt = 0;
    while (attempt <= this.maxRetries) {
      attempt += 1;
      const key = await this.pool.selectEligibleKey();
      if (!key) {
        void logTavilyToolUsage(this.prisma, {
          toolName,
          upstreamKeyId: null,
          outcome: 'error',
          query: meta.query,
          argsSummary: { ...(meta.argsSummary ?? {}), attempts: attempt },
          errorMessage: 'Usage limit exceeded'
        }).catch(() => {});
        throw new Error('Usage limit exceeded');
      }
      const client = createTavilyHttpClient(key.apiKey);
      try {
        const startedAt = Date.now();
        const result = await fn(client);
        void logTavilyToolUsage(this.prisma, {
          toolName,
          upstreamKeyId: key.id,
          outcome: 'success',
          latencyMs: Date.now() - startedAt,
          query: meta.query,
          argsSummary: { ...(meta.argsSummary ?? {}), attempts: attempt }
        }).catch(() => {});
        return result;
      } catch (err: any) {
        if (err?.message === 'Invalid API key') {
          await this.pool.markInvalid(key.id);
          continue;
        }
        if (err?.message === 'Usage limit exceeded') {
          await this.pool.markCooldown(key.id, new Date(Date.now() + this.fixedCooldownMs));
          continue;
        }
        void logTavilyToolUsage(this.prisma, {
          toolName,
          upstreamKeyId: key.id,
          outcome: 'error',
          query: meta.query,
          argsSummary: { ...(meta.argsSummary ?? {}), attempts: attempt },
          errorMessage: err instanceof Error ? err.message : String(err)
        }).catch(() => {});
        throw err;
      }
    }
    throw new Error('Usage limit exceeded');
  }
}

function applyDefaults(target: Record<string, unknown>, defaults: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(target)) {
    if (key in defaults) target[key] = defaults[key] as any;
  }
  return target;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
