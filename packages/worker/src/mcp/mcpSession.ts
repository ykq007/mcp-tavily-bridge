import { DurableObject } from 'cloudflare:workers';

import type { Env } from '../env.js';
import { D1Client } from '../db/d1.js';
import { selectTavilyKey, selectBraveKey } from '../services/keyPool.js';
import { tavilySearch, tavilyExtract, tavilyCrawl, tavilyMap, tavilyResearch } from '../services/tavilyClient.js';
import { braveWebSearch, braveLocalSearch } from '../services/braveClient.js';

/**
 * McpSession Durable Object
 *
 * Handles MCP protocol sessions with per-client state persistence.
 * Uses HTTP-based MCP protocol (not SDK, for simpler Workers compatibility).
 */
export class McpSession extends DurableObject<Env> {
  private initialized = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  /**
   * Initialize session state
   */
  private async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }

  /**
   * Get the list of available tools
   */
  private getToolsList() {
    return [
      {
        name: 'tavily_search',
        description: 'Search the web for current information on any topic. Use for news, facts, or data beyond your knowledge cutoff. Returns snippets and source URLs.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            search_depth: { type: 'string', enum: ['basic', 'advanced', 'fast', 'ultra-fast'], default: 'basic' },
            max_results: { type: 'number', default: 10, minimum: 5, maximum: 20 },
            include_images: { type: 'boolean', default: false },
            include_raw_content: { type: 'boolean', default: false },
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
            extract_depth: { type: 'string', enum: ['basic', 'advanced'], default: 'basic' },
            format: { type: 'string', enum: ['markdown', 'text'], default: 'markdown' },
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
            max_depth: { type: 'integer', default: 1, minimum: 1 },
            max_breadth: { type: 'integer', default: 20, minimum: 1 },
            limit: { type: 'integer', default: 50, minimum: 1 },
            format: { type: 'string', enum: ['markdown', 'text'], default: 'markdown' },
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
            max_depth: { type: 'integer', default: 1, minimum: 1 },
            limit: { type: 'integer', default: 50, minimum: 1 },
          },
          required: ['url'],
        },
      },
      {
        name: 'tavily_research',
        description: 'Perform comprehensive research on a given topic or question. Returns a detailed response based on research findings.',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'A comprehensive description of the research task' },
            model: { type: 'string', enum: ['mini', 'pro', 'auto'], default: 'auto' },
          },
          required: ['input'],
        },
      },
      {
        name: 'brave_web_search',
        description: 'Performs a web search using the Brave Search API. Returns a JSON array of results.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            count: { type: 'number', default: 10, minimum: 1, maximum: 20 },
            offset: { type: 'number', default: 0, minimum: 0, maximum: 9 },
          },
          required: ['query'],
        },
      },
      {
        name: 'brave_local_search',
        description: 'Search for local businesses and places using the Brave Search API. Returns a JSON array of results.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Local search terms' },
            count: { type: 'number', default: 10, minimum: 1, maximum: 20 },
          },
          required: ['query'],
        },
      },
    ];
  }

  /**
   * Call Tavily API with the given endpoint and arguments
   */
  private async callTavilyApi(endpoint: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      const db = new D1Client(this.env.DB);
      const encryptionSecret = this.env.KEY_ENCRYPTION_SECRET;

      if (!encryptionSecret) {
        return {
          content: [{ type: 'text', text: 'Error: ENCRYPTION_SECRET not configured' }],
        };
      }

      const keyData = await selectTavilyKey(db, encryptionSecret);
      if (!keyData) {
        return {
          content: [{ type: 'text', text: 'Error: No active Tavily API keys available. Please configure keys in Admin UI.' }],
        };
      }

      let result;
      if (endpoint === '/search') {
        result = await tavilySearch(keyData.apiKey, args as any);
      } else if (endpoint === '/extract') {
        result = await tavilyExtract(keyData.apiKey, args as any);
      } else if (endpoint === '/crawl') {
        result = await tavilyCrawl(keyData.apiKey, args as any);
      } else if (endpoint === '/map') {
        result = await tavilyMap(keyData.apiKey, args as any);
      } else if (endpoint === '/research') {
        result = await tavilyResearch(keyData.apiKey, args as any);
      } else {
        return {
          content: [{ type: 'text', text: `Error: Unknown Tavily endpoint: ${endpoint}` }],
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
      };
    }
  }

  /**
   * Call Brave API with the given endpoint and arguments
   */
  private async callBraveApi(endpoint: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      const db = new D1Client(this.env.DB);
      const encryptionSecret = this.env.KEY_ENCRYPTION_SECRET;

      if (!encryptionSecret) {
        return {
          content: [{ type: 'text', text: 'Error: ENCRYPTION_SECRET not configured' }],
        };
      }

      const keyData = await selectBraveKey(db, encryptionSecret);
      if (!keyData) {
        return {
          content: [{ type: 'text', text: 'Error: No active Brave API keys available. Please configure keys in Admin UI.' }],
        };
      }

      let result;
      if (endpoint === '/web/search') {
        result = await braveWebSearch(keyData.apiKey, args as any);
      } else if (endpoint === '/local/search') {
        result = await braveLocalSearch(keyData.apiKey, args as any);
      } else {
        return {
          content: [{ type: 'text', text: `Error: Unknown Brave endpoint: ${endpoint}` }],
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text', text: `Error: ${message}` }],
      };
    }
  }

  /**
   * Handle incoming fetch requests
   */
  async fetch(request: Request): Promise<Response> {
    await this.init();

    const url = new URL(request.url);

    // Handle SSE endpoint
    if (request.method === 'GET' && url.pathname.endsWith('/sse')) {
      return this.handleSSE();
    }

    // Handle GET for server info
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        name: 'mcp-nexus',
        version: '1.0.0',
        transport: ['http', 'sse'],
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle POST for JSON-RPC
    if (request.method === 'POST') {
      return this.handlePost(request);
    }

    return new Response('Method not allowed', { status: 405 });
  }

  /**
   * Handle SSE connection
   */
  private handleSSE(): Response {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Send initial connection message
    writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'connection', status: 'connected' })}\n\n`));

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  /**
   * Handle POST requests (JSON-RPC)
   */
  private async handlePost(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { method: string; params?: Record<string, unknown>; id?: string | number };
      const { method, params, id } = body;

      // Handle tools/list
      if (method === 'tools/list') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: { tools: this.getToolsList() },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle tools/call
      if (method === 'tools/call') {
        const toolName = params?.name as string;
        const toolArgs = (params?.arguments || {}) as Record<string, unknown>;

        let result;
        if (toolName === 'tavily_search') {
          result = await this.callTavilyApi('/search', toolArgs);
        } else if (toolName === 'tavily_extract') {
          result = await this.callTavilyApi('/extract', toolArgs);
        } else if (toolName === 'tavily_crawl') {
          result = await this.callTavilyApi('/crawl', toolArgs);
        } else if (toolName === 'tavily_map') {
          result = await this.callTavilyApi('/map', toolArgs);
        } else if (toolName === 'tavily_research') {
          result = await this.callTavilyApi('/research', toolArgs);
        } else if (toolName === 'brave_web_search') {
          result = await this.callBraveApi('/web/search', toolArgs);
        } else if (toolName === 'brave_local_search') {
          result = await this.callBraveApi('/local/search', toolArgs);
        } else {
          return new Response(JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Unknown tool: ${toolName}` },
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result,
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle initialize
      if (method === 'initialize') {
        return new Response(JSON.stringify({
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
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message },
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}
