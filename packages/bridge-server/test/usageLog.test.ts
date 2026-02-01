import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildQueryMetadata,
  getTavilyUsageLogMode,
  getTavilyUsageRetentionDays,
  logTavilyToolUsage,
  maybeCleanupOldUsageRows,
  sha256Hex,
  shouldLogTavilyUsage
} from '../src/tavily/usageLog.js';
import { requestContext } from '../src/context.js';

async function withEnv<T>(next: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(next)) {
    prev[k] = process.env[k];
    if (typeof v === 'undefined') delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (typeof v === 'undefined') delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe('usageLog', () => {
  let envSnapshot: NodeJS.ProcessEnv;

  beforeEach(() => {
    envSnapshot = { ...process.env };
  });

  afterEach(() => {
    process.env = envSnapshot;
    vi.restoreAllMocks();
  });

  it('getTavilyUsageLogMode defaults to preview and ignores invalid values', () => {
    delete process.env.TAVILY_USAGE_LOG_MODE;
    expect(getTavilyUsageLogMode()).toBe('preview');

    process.env.TAVILY_USAGE_LOG_MODE = 'bad';
    expect(getTavilyUsageLogMode()).toBe('preview');

    process.env.TAVILY_USAGE_LOG_MODE = 'FULL';
    expect(getTavilyUsageLogMode()).toBe('full');
  });

  it('getTavilyUsageRetentionDays parses positive numbers only', () => {
    delete process.env.TAVILY_USAGE_RETENTION_DAYS;
    expect(getTavilyUsageRetentionDays()).toBeNull();

    process.env.TAVILY_USAGE_RETENTION_DAYS = '7.9';
    expect(getTavilyUsageRetentionDays()).toBe(7);

    process.env.TAVILY_USAGE_RETENTION_DAYS = '0';
    expect(getTavilyUsageRetentionDays()).toBeNull();

    process.env.TAVILY_USAGE_RETENTION_DAYS = '-3';
    expect(getTavilyUsageRetentionDays()).toBeNull();
  });

  it('sha256Hex produces a stable digest', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('buildQueryMetadata redacts secrets and clamps preview', () => {
    const query = 'email me at test@example.com tvly-abc123 and token=supersecretpassword';
    const meta = buildQueryMetadata(query, 'preview');
    expect(meta.queryHash).toBeTruthy();
    expect(meta.queryPreview).toBeTruthy();
    expect(meta.queryPreview).toContain('<email>');
    expect(meta.queryPreview).toContain('tvly-<redacted>');
    expect(meta.queryPreview).not.toContain('test@example.com');
    expect(meta.queryPreview).not.toContain('supersecretpassword');
    expect((meta.queryPreview ?? '').length).toBeLessThanOrEqual(180);
  });

  it('buildQueryMetadata uses HMAC when TAVILY_USAGE_HASH_SECRET is set', async () => {
    const query = 'hello world';
    const secret = 'secret-123';

    const expected = createHmac('sha256', secret).update(query, 'utf8').digest('hex');

    const meta = await withEnv({ TAVILY_USAGE_HASH_SECRET: secret }, () => buildQueryMetadata(query, 'hash'));
    expect(meta.queryHash).toBe(expected);
  });

  it('shouldLogTavilyUsage respects sample rate and mode none', () => {
    expect(shouldLogTavilyUsage('none')).toBe(false);

    delete process.env.TAVILY_USAGE_SAMPLE_RATE;
    expect(shouldLogTavilyUsage('preview')).toBe(true);

    process.env.TAVILY_USAGE_SAMPLE_RATE = '0';
    expect(shouldLogTavilyUsage('preview')).toBe(false);

    process.env.TAVILY_USAGE_SAMPLE_RATE = '0.5';
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    expect(shouldLogTavilyUsage('preview')).toBe(true);

    vi.spyOn(Math, 'random').mockReturnValue(0.6);
    expect(shouldLogTavilyUsage('preview')).toBe(false);
  });

  it('maybeCleanupOldUsageRows deletes old rows when retention is set and probability triggers', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const prisma: any = { tavilyToolUsage: { deleteMany } };

    await maybeCleanupOldUsageRows(prisma);
    expect(deleteMany).not.toHaveBeenCalled();

    const now = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await withEnv({ TAVILY_USAGE_RETENTION_DAYS: '1', TAVILY_USAGE_CLEANUP_PROBABILITY: '1' }, async () => {
      await maybeCleanupOldUsageRows(prisma);
    });

    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { timestamp: { lt: new Date(now - 24 * 60 * 60 * 1000) } }
    });
  });

  it('logTavilyToolUsage writes usage row when request context exists', async () => {
    const create = vi.fn().mockResolvedValue({});
    const prisma: any = { tavilyToolUsage: { create }, tavilyToolUsageSummary: {} };

    await logTavilyToolUsage(prisma, { toolName: 'tavily_search', outcome: 'success', query: 'x' });
    expect(create).not.toHaveBeenCalled();

    await withEnv({ TAVILY_USAGE_LOG_MODE: 'hash', TAVILY_USAGE_SAMPLE_RATE: '1' }, async () => {
      await requestContext.run(
        { clientTokenId: 'ct_1', clientTokenPrefix: 'mcp_abcd', rawClientToken: 'mcp_abcd.secret' },
        async () => {
          await logTavilyToolUsage(prisma, {
            toolName: 'tavily_search',
            upstreamKeyId: 'k_1',
            outcome: 'success',
            latencyMs: 12.9,
            query: 'hello',
            argsSummary: { max_results: 5 }
          });
        }
      );
    });

    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0]?.[0];
    expect(args?.data?.toolName).toBe('tavily_search');
    expect(args?.data?.outcome).toBe('success');
    expect(args?.data?.latencyMs).toBe(12);
    expect(args?.data?.clientTokenId).toBe('ct_1');
    expect(args?.data?.clientTokenPrefix).toBe('mcp_abcd');
    expect(args?.data?.upstreamKeyId).toBe('k_1');
    expect(args?.data?.queryHash).toBeTruthy();
    expect(args?.data?.queryPreview).toBeNull();
    expect(args?.data?.argsJson).toEqual({ max_results: 5 });
  });
});
