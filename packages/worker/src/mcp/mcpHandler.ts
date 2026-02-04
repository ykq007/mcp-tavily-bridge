import type { Context } from 'hono';
import type { Env } from '../env.js';
import { D1Client } from '../db/d1.js';
import { selectTavilyKey, selectBraveKey, markTavilyKeyCooldown, markTavilyKeyInvalid, markBraveKeyInvalid } from '../services/keyPool.js';
import { tavilySearch, tavilyExtract, tavilyCrawl, tavilyMap, tavilyResearch, TavilyError } from '../services/tavilyClient.js';
import { braveWebSearch, braveLocalSearch, BraveError } from '../services/braveClient.js';
import { parseSearchSourceMode } from './searchSource.js';
import { extractBraveWebResults, extractBraveLocalResults } from './braveFormat.js';
import { mergeAndDedupe } from './combinedMerge.js';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
  id?: string | number;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * Handle MCP JSON-RPC requests
 */
export async function handleMcpRequest(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    const body = await c.req.json<JsonRpcRequest>();
    const { method, params, id } = body;

    let response: JsonRpcResponse;

    switch (method) {
      case 'initialize':
        response = {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: {
              name: 'mcp-nexus',
              version: '1.0.0',
            },
            capabilities: {
              tools: {},
            },
          },
        };
        break;

      case 'tools/list':
        response = {
          jsonrpc: '2.0',
          id,
          result: { tools: getToolsList() },
        };
        break;

      case 'tools/call':
        response = await handleToolCall(c, params, id);
        break;

      default:
        response = {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }

    return c.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      jsonrpc: '2.0',
      error: { code: -32603, message },
    }, 500);
  }
}

async function handleToolCall(
  c: Context<{ Bindings: Env }>,
  params: Record<string, unknown> | undefined,
  id: string | number | undefined
): Promise<JsonRpcResponse> {
  const toolName = params?.name as string;
  const toolArgs = (params?.arguments || {}) as Record<string, unknown>;

  try {
    let result: { content: Array<{ type: 'text'; text: string }> };

    // Route to appropriate handler
    if (toolName.startsWith('tavily_')) {
      result = await handleTavilyTool(c, toolName, toolArgs);
    } else if (toolName.startsWith('brave_')) {
      result = await handleBraveTool(c, toolName, toolArgs);
    } else {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unknown tool: ${toolName}` },
      };
    }

    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      },
    };
  }
}

async function handleTavilyTool(
  c: Context<{ Bindings: Env }>,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const db = new D1Client(c.env.DB);
  const keyInfo = await selectTavilyKey(db, c.env.KEY_ENCRYPTION_SECRET);

  if (!keyInfo) {
    return {
      content: [{ type: 'text', text: 'Error: No Tavily API keys configured. Please add keys in the Admin UI.' }],
    };
  }

  try {
    let result: unknown;

    switch (toolName) {
      case 'tavily_search':
        result = await tavilySearch(keyInfo.apiKey, args as any);
        break;
      case 'tavily_extract':
        result = await tavilyExtract(keyInfo.apiKey, args as any);
        break;
      case 'tavily_crawl':
        result = await tavilyCrawl(keyInfo.apiKey, args as any);
        break;
      case 'tavily_map':
        result = await tavilyMap(keyInfo.apiKey, args as any);
        break;
      case 'tavily_research':
        result = await tavilyResearch(keyInfo.apiKey, args as any);
        break;
      default:
        throw new Error(`Unknown Tavily tool: ${toolName}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    if (error instanceof TavilyError) {
      if (error.status === 401) {
        await markTavilyKeyInvalid(db, keyInfo.keyId);
      } else if (error.status === 429) {
        await markTavilyKeyCooldown(db, keyInfo.keyId);
      }
    }
    throw error;
  }
}

async function handleBraveTool(
  c: Context<{ Bindings: Env }>,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  const db = new D1Client(c.env.DB);

  // Get search source mode
  const settings = await db.getServerSettings();
  const dbMode = settings.find(s => s.key === 'searchSourceMode')?.value;
  const searchSourceMode = parseSearchSourceMode(dbMode || c.env.SEARCH_SOURCE_MODE, 'brave_prefer_tavily_fallback');

  const query = String(args.query ?? '');
  const count = typeof args.count === 'number' ? args.count : 10;
  const offset = typeof args.offset === 'number' ? args.offset : 0;

  // Handle tavily_only mode
  if (searchSourceMode === 'tavily_only') {
    const tavilyKeyInfo = await selectTavilyKey(db, c.env.KEY_ENCRYPTION_SECRET);
    if (!tavilyKeyInfo) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'No Tavily API keys configured' }) }],
        isError: true
      };
    }

    try {
      const result = await tavilySearch(tavilyKeyInfo.apiKey, { query, max_results: count });
      const formatted = (result.results || []).map((r: any) => ({
        title: String(r?.title ?? ''),
        url: String(r?.url ?? ''),
        description: String(r?.content ?? '') || undefined
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }]
      };
    } catch (error) {
      if (error instanceof TavilyError) {
        if (error.status === 401 || error.status === 403) {
          await markTavilyKeyInvalid(db, tavilyKeyInfo.keyId);
        } else if (error.status === 429) {
          await markTavilyKeyCooldown(db, tavilyKeyInfo.keyId, 60000);
        }
      }
      throw error;
    }
  }

  // Handle brave_only mode
  if (searchSourceMode === 'brave_only') {
    const braveKeyInfo = await selectBraveKey(db, c.env.KEY_ENCRYPTION_SECRET);
    if (!braveKeyInfo) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Brave Search is not configured. Please add a Brave API key.' }) }],
        isError: true
      };
    }

    try {
      const result = toolName === 'brave_web_search'
        ? await braveWebSearch(braveKeyInfo.apiKey, args as any)
        : await braveLocalSearch(braveKeyInfo.apiKey, args as any);

      const formatted = toolName === 'brave_web_search'
        ? extractBraveWebResults(result)
        : extractBraveLocalResults(result);

      return {
        content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }]
      };
    } catch (error) {
      if (error instanceof BraveError) {
        if (error.status === 401 || error.status === 403) {
          await markBraveKeyInvalid(db, braveKeyInfo.keyId);
        }
      }
      throw error;
    }
  }

  // Handle combined mode
  if (searchSourceMode === 'combined') {
    // If offset > 0, only use Brave (Tavily doesn't support offset)
    if (offset > 0) {
      const braveKeyInfo = await selectBraveKey(db, c.env.KEY_ENCRYPTION_SECRET);
      if (!braveKeyInfo) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Brave Search is not configured for pagination.' }) }],
          isError: true
        };
      }

      try {
        const result = toolName === 'brave_web_search'
          ? await braveWebSearch(braveKeyInfo.apiKey, args as any)
          : await braveLocalSearch(braveKeyInfo.apiKey, args as any);

        const formatted = toolName === 'brave_web_search'
          ? extractBraveWebResults(result)
          : extractBraveLocalResults(result);

        return {
          content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }]
        };
      } catch (error) {
        if (error instanceof BraveError && (error.status === 401 || error.status === 403)) {
          await markBraveKeyInvalid(db, braveKeyInfo.keyId);
        }
        throw error;
      }
    }

    // Combined mode: call both in parallel
    const promises: Promise<{ source: 'tavily' | 'brave'; results: any[]; error?: any }>[] = [];

    // Tavily
    const tavilyKeyInfo = await selectTavilyKey(db, c.env.KEY_ENCRYPTION_SECRET);
    if (tavilyKeyInfo) {
      promises.push(
        tavilySearch(tavilyKeyInfo.apiKey, { query, max_results: count })
          .then(res => ({
            source: 'tavily' as const,
            results: (res.results || []).map((r: any) => ({
              title: String(r?.title ?? ''),
              url: String(r?.url ?? ''),
              description: String(r?.content ?? '') || undefined
            }))
          }))
          .catch(err => ({ source: 'tavily' as const, results: [], error: err }))
      );
    }

    // Brave
    const braveKeyInfo = await selectBraveKey(db, c.env.KEY_ENCRYPTION_SECRET);
    if (braveKeyInfo) {
      promises.push(
        (toolName === 'brave_web_search'
          ? braveWebSearch(braveKeyInfo.apiKey, args as any)
          : braveLocalSearch(braveKeyInfo.apiKey, args as any)
        )
          .then(res => ({
            source: 'brave' as const,
            results: toolName === 'brave_web_search'
              ? extractBraveWebResults(res)
              : extractBraveLocalResults(res)
          }))
          .catch(err => ({ source: 'brave' as const, results: [], error: err }))
      );
    }

    const settled = await Promise.allSettled(promises);

    // Extract results
    const tavilyResult = settled[0]?.status === 'fulfilled' ? settled[0].value : { source: 'tavily' as const, results: [], error: settled[0]?.reason };
    const braveResult = settled[1]?.status === 'fulfilled' ? settled[1].value : (settled[1] ? { source: 'brave' as const, results: [], error: settled[1].reason } : null);

    const tavilyFailed = tavilyResult?.error !== undefined;
    const braveFailed = braveResult?.error !== undefined;

    // If both failed, return error
    if (tavilyFailed && braveFailed) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Both Tavily and Brave search failed.' }) }],
        isError: true
      };
    }

    // Merge and deduplicate
    const merged = mergeAndDedupe({
      tavily: tavilyResult?.results ?? [],
      brave: braveResult?.results ?? [],
      count
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(merged, null, 2) }]
    };
  }

  // Default: brave_prefer_tavily_fallback
  const braveKeyInfo = await selectBraveKey(db, c.env.KEY_ENCRYPTION_SECRET);

  // If no Brave key, use Tavily
  if (!braveKeyInfo) {
    const tavilyKeyInfo = await selectTavilyKey(db, c.env.KEY_ENCRYPTION_SECRET);
    if (!tavilyKeyInfo) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'No API keys configured' }) }],
        isError: true
      };
    }

    try {
      const result = await tavilySearch(tavilyKeyInfo.apiKey, { query, max_results: count });
      const formatted = (result.results || []).map((r: any) => ({
        title: String(r?.title ?? ''),
        url: String(r?.url ?? ''),
        description: String(r?.content ?? '') || undefined
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }]
      };
    } catch (error) {
      if (error instanceof TavilyError) {
        if (error.status === 401 || error.status === 403) {
          await markTavilyKeyInvalid(db, tavilyKeyInfo.keyId);
        } else if (error.status === 429) {
          await markTavilyKeyCooldown(db, tavilyKeyInfo.keyId, 60000);
        }
      }
      throw error;
    }
  }

  // Try Brave first
  try {
    const result = toolName === 'brave_web_search'
      ? await braveWebSearch(braveKeyInfo.apiKey, args as any)
      : await braveLocalSearch(braveKeyInfo.apiKey, args as any);

    const formatted = toolName === 'brave_web_search'
      ? extractBraveWebResults(result)
      : extractBraveLocalResults(result);

    return {
      content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }]
    };
  } catch (error) {
    if (error instanceof BraveError) {
      if (error.status === 401 || error.status === 403) {
        await markBraveKeyInvalid(db, braveKeyInfo.keyId);
      }

      // Fallback to Tavily on error
      const tavilyKeyInfo = await selectTavilyKey(db, c.env.KEY_ENCRYPTION_SECRET);
      if (tavilyKeyInfo) {
        try {
          const result = await tavilySearch(tavilyKeyInfo.apiKey, { query, max_results: count });
          const formatted = (result.results || []).map((r: any) => ({
            title: String(r?.title ?? ''),
            url: String(r?.url ?? ''),
            description: String(r?.content ?? '') || undefined
          }));
          return {
            content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }]
          };
        } catch (tavilyError) {
          if (tavilyError instanceof TavilyError) {
            if (tavilyError.status === 401 || tavilyError.status === 403) {
              await markTavilyKeyInvalid(db, tavilyKeyInfo.keyId);
            } else if (tavilyError.status === 429) {
              await markTavilyKeyCooldown(db, tavilyKeyInfo.keyId, 60000);
            }
          }
          // If Tavily also fails, throw original Brave error
        }
      }
    }
    throw error;
  }
}

function getToolsList() {
  return [
    {
      name: 'tavily_search',
      description: 'Search the web for current information on any topic. Use for news, facts, or data beyond your knowledge cutoff. Returns snippets and source URLs.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          search_depth: { type: 'string', enum: ['basic', 'advanced', 'fast', 'ultra-fast'], default: 'basic', description: "The depth of the search. 'basic' for generic results, 'advanced' for more thorough search, 'fast' for optimized low latency with high relevance, 'ultra-fast' for prioritizing latency above all else" },
          max_results: { type: 'number', default: 10, minimum: 5, maximum: 20, description: 'The maximum number of search results to return' },
          include_images: { type: 'boolean', default: false, description: 'Include a list of query-related images in the response' },
          include_raw_content: { type: 'boolean', default: false, description: 'Include the cleaned and parsed HTML content of each search result' },
          topic: { type: 'string', enum: ['general'], default: 'general', description: 'The category of the search' },
          include_domains: { type: 'array', items: { type: 'string' }, description: 'A list of domains to specifically include in the search results' },
          exclude_domains: { type: 'array', items: { type: 'string' }, description: 'List of domains to specifically exclude' },
          time_range: { type: 'string', enum: ['day', 'week', 'month', 'year'], description: 'The time range back from the current date to include in the search results' },
          country: { type: 'string', description: 'Boost search results from a specific country' },
          include_image_descriptions: { type: 'boolean', default: false, description: 'Include a list of query-related images and their descriptions in the response' },
          include_favicon: { type: 'boolean', default: false, description: 'Whether to include the favicon URL for each result' },
        },
        required: ['query'],
      },
    },
    {
      name: 'tavily_extract',
      description: 'Extract content from URLs. Returns raw page content in markdown or text format.',
      inputSchema: {
        type: 'object',
        properties: {
          urls: { type: 'array', items: { type: 'string' }, description: 'List of URLs to extract content from' },
          extract_depth: { type: 'string', enum: ['basic', 'advanced'], default: 'basic', description: "Use 'advanced' for LinkedIn, protected sites, or tables/embedded content" },
          format: { type: 'string', enum: ['markdown', 'text'], default: 'markdown', description: 'Output format' },
          query: { type: 'string', description: 'Query to rerank content chunks by relevance' },
          include_images: { type: 'boolean', default: false, description: 'Include images from pages' },
          include_favicon: { type: 'boolean', default: false, description: 'Include favicon URLs' },
        },
        required: ['urls'],
      },
    },
    {
      name: 'tavily_crawl',
      description: 'Crawl a website starting from a URL. Extracts content from pages with configurable depth and breadth.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The root URL to begin the crawl' },
          max_depth: { type: 'integer', default: 1, minimum: 1, description: 'Max depth of the crawl' },
          max_breadth: { type: 'integer', default: 20, minimum: 1, description: 'Max number of links to follow per level' },
          limit: { type: 'integer', default: 50, minimum: 1, description: 'Total number of links the crawler will process' },
          format: { type: 'string', enum: ['markdown', 'text'], default: 'markdown', description: 'The format of the extracted content' },
          extract_depth: { type: 'string', enum: ['basic', 'advanced'], default: 'basic', description: 'Advanced extraction retrieves more data' },
          instructions: { type: 'string', description: 'Natural language instructions for the crawler' },
          allow_external: { type: 'boolean', default: true, description: 'Whether to return external links' },
          include_favicon: { type: 'boolean', default: false, description: 'Whether to include the favicon URL' },
        },
        required: ['url'],
      },
    },
    {
      name: 'tavily_map',
      description: "Map a website's structure. Returns a list of URLs found starting from the base URL.",
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The root URL to begin the mapping' },
          max_depth: { type: 'integer', default: 1, minimum: 1, description: 'Max depth of the mapping' },
          max_breadth: { type: 'integer', default: 20, minimum: 1, description: 'Max number of links to follow per level' },
          limit: { type: 'integer', default: 50, minimum: 1, description: 'Total number of links the crawler will process' },
          instructions: { type: 'string', description: 'Natural language instructions for the crawler' },
          allow_external: { type: 'boolean', default: true, description: 'Whether to return external links' },
        },
        required: ['url'],
      },
    },
    {
      name: 'tavily_research',
      description: 'Perform comprehensive research on a given topic or question. Use this tool when you need to gather information from multiple sources to answer a question or complete a task. Returns a detailed response based on the research findings.',
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'A comprehensive description of the research task' },
          model: { type: 'string', enum: ['mini', 'pro', 'auto'], default: 'auto', description: "Defines the degree of depth of the research. 'mini' is good for narrow tasks with few subtopics. 'pro' is good for broad tasks with many subtopics. 'auto' automatically selects the best model." },
        },
        required: ['input'],
      },
    },
    {
      name: 'brave_web_search',
      description: 'Performs a web search using the Brave Search API. Use for general web searches for information, facts, and current topics. Returns a JSON array of results.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          count: { type: 'number', default: 10, minimum: 1, maximum: 20, description: 'Number of results (1-20)' },
          offset: { type: 'number', default: 0, minimum: 0, maximum: 9, description: 'Pagination offset (0-9)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'brave_local_search',
      description: 'Search for local businesses and places using the Brave Search API. Implementations commonly fall back to web search if local results are unavailable. Returns a JSON array of results.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Local search terms' },
          count: { type: 'number', default: 10, minimum: 1, maximum: 20, description: 'Number of results (1-20)' },
        },
        required: ['query'],
      },
    },
  ];
}
