import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { TavilyClient, TavilyDefaultParametersProvider } from '../tavily/types.js';
import { tavilyToolsV0216 } from '../tavily/tools-v0216.js';
import {
  formatCrawlResultsV0216,
  formatMapResultsV0216,
  formatResearchResultsV0216,
  formatResultsV0216
} from '../tavily/format-v0216.js';
import { TavilyHttpError, isTavilyHttpError } from '../tavily/errors.js';

import type { BraveClient } from '../brave/types.js';
import { braveToolsV0100 } from '../brave/tools-v0100.js';
import { formatBraveLocalResultsV0100, formatBraveWebResultsFromTavilyV0100, formatBraveWebResultsV0100 } from '../brave/format-v0100.js';
import { BraveHttpError, isBraveHttpError, isBraveRateGateTimeoutError } from '../brave/errors.js';

export type BraveOverflowMode = 'queue' | 'error' | 'fallback_to_tavily';

type CreateCombinedProxyServerOptions = {
  serverName: string;
  serverVersion: string;
  tavilyClient: TavilyClient;
  braveClient?: BraveClient;
  braveOverflow?: BraveOverflowMode;
  braveMaxQueueMs?: number;
  getDefaultParameters?: TavilyDefaultParametersProvider;
  getAuthToken?: (ctx: unknown) => string | undefined;
};

export function createCombinedProxyServer({
  serverName,
  serverVersion,
  tavilyClient,
  braveClient,
  braveOverflow = 'fallback_to_tavily',
  braveMaxQueueMs = 30_000,
  getDefaultParameters,
  getAuthToken
}: CreateCombinedProxyServerOptions): Server {
  const server = new Server(
    { name: serverName, version: serverVersion },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: [...tavilyToolsV0216, ...braveToolsV0100] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const token = getAuthToken?.(extra) ?? (extra as any)?.authInfo?.token;
    if (!token) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Client token is required. Provide Authorization: Bearer <token> (HTTP) or set TAVILY_BRIDGE_MCP_TOKEN (stdio).'
      );
    }

    const args = request.params.arguments ?? {};
    const toolName = request.params.name;

    try {
      switch (toolName) {
        case 'tavily_search': {
          const defaults = getDefaultParameters?.(extra) ?? {};
          const country = (args as any).country;
          const normalizedArgs = {
            ...args,
            ...(country ? { topic: 'general' } : null)
          } as any;

          const response = await tavilyClient.search(normalizedArgs, { defaults });
          return textResult(formatResultsV0216(response));
        }
        case 'tavily_extract': {
          const response = await tavilyClient.extract(args as any);
          return textResult(formatResultsV0216(response));
        }
        case 'tavily_crawl': {
          const response = await tavilyClient.crawl(args as any);
          return textResult(formatCrawlResultsV0216(response));
        }
        case 'tavily_map': {
          const response = await tavilyClient.map(args as any);
          return textResult(formatMapResultsV0216(response));
        }
        case 'tavily_research': {
          const response = await tavilyClient.research(args as any);
          return textResult(formatResearchResultsV0216(response));
        }
        case 'brave_web_search': {
          return await handleBraveWebSearch({
            args,
            extra,
            tavilyClient,
            braveClient,
            braveOverflow,
            braveMaxQueueMs,
            getDefaultParameters
          });
        }
        case 'brave_local_search': {
          return await handleBraveLocalSearch({
            args,
            extra,
            tavilyClient,
            braveClient,
            braveOverflow,
            braveMaxQueueMs,
            getDefaultParameters
          });
        }
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
      }
    } catch (error) {
      if (isTavilyHttpError(error)) {
        return toolError(`Tavily API error: ${(error as TavilyHttpError).tavilyMessage ?? error.message}`);
      }
      if (isBraveHttpError(error)) {
        const details = (error as BraveHttpError).braveMessage ?? error.message;
        return toolError(`Brave API error: ${details}`);
      }
      throw error;
    }
  });

  return server;
}

async function handleBraveWebSearch(opts: {
  args: Record<string, unknown>;
  extra: unknown;
  tavilyClient: TavilyClient;
  braveClient: BraveClient | undefined;
  braveOverflow: BraveOverflowMode;
  braveMaxQueueMs: number;
  getDefaultParameters: TavilyDefaultParametersProvider | undefined;
}): Promise<CallToolResult> {
  const defaults = opts.getDefaultParameters?.(opts.extra) ?? {};
  const query = typeof (opts.args as any).query === 'string' ? String((opts.args as any).query) : '';
  const maxResults = typeof (opts.args as any).count === 'number' ? (opts.args as any).count : undefined;

  if (!opts.braveClient) {
    const response = await opts.tavilyClient.search({ query, max_results: maxResults }, { defaults });
    return textResult(formatBraveWebResultsFromTavilyV0100(response));
  }

  const maxWaitMs = resolveBraveMaxWaitMs(opts.braveOverflow, opts.braveMaxQueueMs);

  try {
    const response = await opts.braveClient.webSearch(opts.args as any, { defaults, maxWaitMs });
    return textResult(formatBraveWebResultsV0100(response));
  } catch (err: unknown) {
    if (opts.braveOverflow === 'fallback_to_tavily' && (isBraveRateGateTimeoutError(err) || isBraveHttpError(err))) {
      const response = await opts.tavilyClient.search({ query, max_results: maxResults }, { defaults });
      return textResult(formatBraveWebResultsFromTavilyV0100(response));
    }
    if (isBraveRateGateTimeoutError(err)) {
      return toolError(`Brave API error: request queued too long (maxWaitMs=${opts.braveMaxQueueMs})`);
    }
    throw err;
  }
}

async function handleBraveLocalSearch(opts: {
  args: Record<string, unknown>;
  extra: unknown;
  tavilyClient: TavilyClient;
  braveClient: BraveClient | undefined;
  braveOverflow: BraveOverflowMode;
  braveMaxQueueMs: number;
  getDefaultParameters: TavilyDefaultParametersProvider | undefined;
}): Promise<CallToolResult> {
  const defaults = opts.getDefaultParameters?.(opts.extra) ?? {};
  const query = typeof (opts.args as any).query === 'string' ? String((opts.args as any).query) : '';
  const maxResults = typeof (opts.args as any).count === 'number' ? (opts.args as any).count : undefined;

  if (!opts.braveClient) {
    const response = await opts.tavilyClient.search({ query, max_results: maxResults }, { defaults });
    return textResult(formatBraveWebResultsFromTavilyV0100(response));
  }

  const maxWaitMs = resolveBraveMaxWaitMs(opts.braveOverflow, opts.braveMaxQueueMs);

  try {
    const response = await opts.braveClient.localSearch(opts.args as any, { defaults, maxWaitMs });
    return textResult(formatBraveLocalResultsV0100(response));
  } catch (err: unknown) {
    if (opts.braveOverflow === 'fallback_to_tavily' && (isBraveRateGateTimeoutError(err) || isBraveHttpError(err))) {
      const response = await opts.tavilyClient.search({ query, max_results: maxResults }, { defaults });
      return textResult(formatBraveWebResultsFromTavilyV0100(response));
    }
    if (isBraveRateGateTimeoutError(err)) {
      return toolError(`Brave API error: request queued too long (maxWaitMs=${opts.braveMaxQueueMs})`);
    }
    throw err;
  }
}

function resolveBraveMaxWaitMs(mode: BraveOverflowMode, maxQueueMs: number): number | undefined {
  if (mode === 'queue') return maxQueueMs;
  if (mode === 'fallback_to_tavily') return maxQueueMs;
  if (mode === 'error') return 1;
  return maxQueueMs;
}

function textResult(text: string): CallToolResult {
  return {
    content: [{ type: 'text', text }]
  };
}

function toolError(text: string): CallToolResult {
  return {
    content: [{ type: 'text', text }],
    isError: true
  };
}
