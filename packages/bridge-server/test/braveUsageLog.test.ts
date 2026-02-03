import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildQueryMetadata,
  getBraveUsageLogMode,
  getBraveUsageRetentionDays,
  logBraveToolUsage,
  maybeCleanupOldBraveUsageRows,
  sha256Hex,
  shouldLogBraveUsage
} from '../src/brave/usageLog.js';
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

describe('braveUsageLog', () => {
  let envSnapshot: NodeJS.ProcessEnv;

  beforeEach(() => {
    envSnapshot = { ...process.env };
  });

  afterEach(() => {
    process.env = envSnapshot;
    vi.restoreAllMocks();
  });

  it('getBraveUsageLogMode defaults to preview and ignores invalid values', () => {
    delete process.env.BRAVE_USAGE_LOG_MODE;
    expect(getBraveUsageLogMode()).toBe('preview');

    process.env.BRAVE_USAGE_LOG_MODE = 'bad';
    expect(getBraveUsageLogMode()).toBe('preview');

    process.env.BRAVE_USAGE_LOG_MODE = 'FULL';
    expect(getBraveUsageLogMode()).toBe('full');
  });

  it('getBraveUsageRetentionDays parses positive numbers only', () => {
    delete process.env.BRAVE_USAGE_RETENTION_DAYS;
    expect(getBraveUsageRetentionDays()).toBeNull();

    process.env.BRAVE_USAGE_RETENTION_DAYS = '7.9';
    expect(getBraveUsageRetentionDays()).toBe(7);

    process.env.BRAVE_USAGE_RETENTION_DAYS = '0';
    expect(getBraveUsageRetentionDays()).toBeNull();

    process.env.BRAVE_USAGE_RETENTION_DAYS = '-3';
    expect(getBraveUsageRetentionDays()).toBeNull();
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

  it('buildQueryMetadata uses HMAC when BRAVE_USAGE_HASH_SECRET is set', async () => {
    const query = 'hello world';
    const secret = 'secret-123';

    const expected = createHmac('sha256', secret).update(query, 'utf8').digest('hex');

    const meta = await withEnv({ BRAVE_USAGE_HASH_SECRET: secret }, () => buildQueryMetadata(query, 'hash'));
    expect(meta.queryHash).toBe(expected);
  });

  it('shouldLogBraveUsage respects sample rate and mode none', () => {
    expect(shouldLogBraveUsage('none')).toBe(false);

    delete process.env.BRAVE_USAGE_SAMPLE_RATE;
    expect(shouldLogBraveUsage('preview')).toBe(true);

    process.env.BRAVE_USAGE_SAMPLE_RATE = '0';
    expect(shouldLogBraveUsage('preview')).toBe(false);

    process.env.BRAVE_USAGE_SAMPLE_RATE = '0.5';
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    expect(shouldLogBraveUsage('preview')).toBe(true);

    vi.spyOn(Math, 'random').mockReturnValue(0.6);
    expect(shouldLogBraveUsage('preview')).toBe(false);
  });

  it('maybeCleanupOldBraveUsageRows deletes old rows when retention is set and probability triggers', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const prisma: any = { braveToolUsage: { deleteMany } };

    await maybeCleanupOldBraveUsageRows(prisma);
    expect(deleteMany).not.toHaveBeenCalled();

    const now = 1700000000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    await withEnv({ BRAVE_USAGE_RETENTION_DAYS: '1', BRAVE_USAGE_CLEANUP_PROBABILITY: '1' }, async () => {
      await maybeCleanupOldBraveUsageRows(prisma);
    });

    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { timestamp: { lt: new Date(now - 24 * 60 * 60 * 1000) } }
    });
  });

  it('logBraveToolUsage writes usage row when request context exists', async () => {
    const create = vi.fn().mockResolvedValue({});
    const prisma: any = { braveToolUsage: { create } };

    await logBraveToolUsage(prisma, { toolName: 'brave_web_search', outcome: 'success', query: 'x' });
    expect(create).not.toHaveBeenCalled();

    await withEnv({ BRAVE_USAGE_LOG_MODE: 'hash', BRAVE_USAGE_SAMPLE_RATE: '1' }, async () => {
      await requestContext.run(
        { clientTokenId: 'ct_1', clientTokenPrefix: 'mcp_abcd', rawClientToken: 'mcp_abcd.secret' },
        async () => {
          await logBraveToolUsage(prisma, {
            toolName: 'brave_web_search',
            upstreamKeyId: 'k_1',
            outcome: 'success',
            latencyMs: 12.9,
            query: 'hello',
            argsSummary: { count: 5 }
          });
        }
      );
    });

    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0]?.[0];
    expect(args?.data?.toolName).toBe('brave_web_search');
    expect(args?.data?.outcome).toBe('success');
    expect(args?.data?.latencyMs).toBe(12);
    expect(args?.data?.clientTokenId).toBe('ct_1');
    expect(args?.data?.clientTokenPrefix).toBe('mcp_abcd');
    expect(args?.data?.upstreamKeyId).toBe('k_1');
    expect(args?.data?.queryHash).toBeTruthy();
    expect(args?.data?.queryPreview).toBeNull();
    expect(args?.data?.argsJson).toEqual({ count: 5 });
  });
});
