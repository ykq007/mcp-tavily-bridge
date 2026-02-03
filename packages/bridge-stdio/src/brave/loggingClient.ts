import type { BraveClient } from '@mcp-nexus/core';
import type { PrismaClient } from '@mcp-nexus/db';
import { logBraveToolUsage } from './usageLog.js';

export type LoggingBraveClientOptions = {
  client: BraveClient;
  prisma: PrismaClient;
  upstreamKeyId?: string;
};

export function createLoggingBraveClient(opts: LoggingBraveClientOptions): BraveClient {
  const { client, prisma, upstreamKeyId } = opts;

  const webSearch: BraveClient['webSearch'] = async (params, callOpts) => {
    const query = typeof params.query === 'string' ? params.query : undefined;
    const argsSummary = {
      count: params.count,
      offset: params.offset
    };
    const startedAt = Date.now();

    try {
      const result = await client.webSearch(params, callOpts);
      void logBraveToolUsage(prisma, {
        toolName: 'brave_web_search',
        upstreamKeyId,
        outcome: 'success',
        latencyMs: Date.now() - startedAt,
        query,
        argsSummary
      }).catch(() => {});
      return result;
    } catch (err) {
      void logBraveToolUsage(prisma, {
        toolName: 'brave_web_search',
        upstreamKeyId,
        outcome: 'error',
        latencyMs: Date.now() - startedAt,
        query,
        argsSummary,
        errorMessage: err instanceof Error ? err.message : String(err)
      }).catch(() => {});
      throw err;
    }
  };

  const localSearch: BraveClient['localSearch'] = async (params, callOpts) => {
    const query = typeof params.query === 'string' ? params.query : undefined;
    const argsSummary = {
      count: params.count
    };
    const startedAt = Date.now();

    try {
      const result = await client.localSearch(params, callOpts);
      void logBraveToolUsage(prisma, {
        toolName: 'brave_local_search',
        upstreamKeyId,
        outcome: 'success',
        latencyMs: Date.now() - startedAt,
        query,
        argsSummary
      }).catch(() => {});
      return result;
    } catch (err) {
      void logBraveToolUsage(prisma, {
        toolName: 'brave_local_search',
        upstreamKeyId,
        outcome: 'error',
        latencyMs: Date.now() - startedAt,
        query,
        argsSummary,
        errorMessage: err instanceof Error ? err.message : String(err)
      }).catch(() => {});
      throw err;
    }
  };

  return { webSearch, localSearch };
}
