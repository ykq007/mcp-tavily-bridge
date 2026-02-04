import type { D1Database, DurableObjectNamespace, Fetcher } from '@cloudflare/workers-types';

/**
 * Cloudflare Workers environment bindings
 */
export interface Env {
  // D1 Database
  DB: D1Database;

  // Durable Objects
  MCP_SESSION: DurableObjectNamespace;
  RATE_LIMITER: DurableObjectNamespace;

  // Static Assets (auto-bound when using wrangler assets)
  ASSETS?: Fetcher;

  // Secrets (set via `wrangler secret put`)
  ADMIN_API_TOKEN: string;
  KEY_ENCRYPTION_SECRET: string;
  TAVILY_USAGE_HASH_SECRET?: string;
  BRAVE_USAGE_HASH_SECRET?: string;

  // Environment variables
  MCP_RATE_LIMIT_PER_MINUTE: string;
  MCP_GLOBAL_RATE_LIMIT_PER_MINUTE: string;
  TAVILY_KEY_SELECTION_STRATEGY: string;
  SEARCH_SOURCE_MODE?: string;
  TAVILY_USAGE_LOG_MODE: string;
  BRAVE_USAGE_LOG_MODE: string;
  ENVIRONMENT?: string;
  ADMIN_UI_URL?: string; // URL to Pages-hosted Admin UI
}

declare module 'hono' {
  interface ContextVariableMap {
    // Add custom context variables here
    clientTokenId?: string;
    clientTokenPrefix?: string;
  }
}
