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

type CreateTavilyProxyServerOptions = {
  serverName: string;
  serverVersion: string;
  tavilyClient: TavilyClient;
  getDefaultParameters?: TavilyDefaultParametersProvider;
  getAuthToken?: (ctx: unknown) => string | undefined;
};

export function createTavilyProxyServer({
  serverName,
  serverVersion,
  tavilyClient,
  getDefaultParameters,
  getAuthToken
}: CreateTavilyProxyServerOptions): Server {
  const server = new Server(
    { name: serverName, version: serverVersion },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: tavilyToolsV0216 };
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
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
      }
    } catch (error) {
      if (isTavilyHttpError(error)) {
        return toolError(`Tavily API error: ${(error as TavilyHttpError).tavilyMessage ?? error.message}`);
      }
      throw error;
    }
  });

  return server;
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
