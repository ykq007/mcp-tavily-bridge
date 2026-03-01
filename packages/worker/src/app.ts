import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import type { Env } from './env.js';
import { adminRouter } from './routes/admin/index.js';
import { handleMcpRequest } from './mcp/mcpHandler.js';
import { clientAuth } from './middleware/clientAuth.js';
import { redactSensitiveQueryParams } from './utils/redact.js';

// Create the main Hono app
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger((line) => console.log(redactSensitiveQueryParams(line))));

function originHostname(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}

function isLocalhostOrigin(origin: string): boolean {
  const hostname = originHostname(origin);
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

// CORS for Admin API (only relevant when hosting the Admin UI on a different origin)
app.use('/admin/api/*', (c, next) => {
  const allowedOrigins = new Set<string>();

  if (c.env.ADMIN_UI_URL) {
    try {
      allowedOrigins.add(new URL(c.env.ADMIN_UI_URL).origin);
    } catch {
      // ignore invalid config
    }
  }

  return cors({
    origin: (origin) => {
      // Non-browser clients often omit Origin; allow.
      if (!origin) return '*';

      // Allow local dev UIs.
      if (isLocalhostOrigin(origin)) return origin;

      // Allow explicitly configured Admin UI origin.
      if (allowedOrigins.has(origin)) return origin;

      return null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  })(c, next);
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '1.0.0',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
  });
});

// MCP endpoint - handle JSON-RPC requests directly with authentication
app.post('/mcp', clientAuth, async (c) => {
  return handleMcpRequest(c);
});

// MCP GET endpoint - server info
app.get('/mcp', (c) => {
  return c.json({
    name: 'mcp-nexus',
    version: '1.0.0',
    transport: ['http', 'sse'],
  });
});

// MCP SSE endpoint - forwards to Durable Object for session management with authentication
app.get('/mcp/sse', clientAuth, async (c) => {
  const clientTokenId = c.get('clientTokenId');
  const clientTokenPrefix = c.get('clientTokenPrefix');
  const sessionId = clientTokenId
    ? `client:${clientTokenId}`
    : clientTokenPrefix
      ? `prefix:${clientTokenPrefix}`
      : 'anonymous';

  const id = c.env.MCP_SESSION.idFromName(sessionId);
  const stub = c.env.MCP_SESSION.get(id);

  const url = new URL(c.req.url);
  url.pathname = '/sse';
  url.search = '';

  const headers = new Headers(c.req.raw.headers);
  headers.delete('Authorization');

  return stub.fetch(new Request(url.toString(), {
    method: 'GET',
    headers,
  }));
});

// Landing page - serve static files from public directory
// Note: Static assets are served automatically by Cloudflare Workers
// This route is kept as fallback but should rarely be hit
app.get('/', (c) => {
  // In production, static files from public/ are served automatically
  // This is a fallback that shouldn't normally execute
  return c.redirect('/index.html');
});

// Mount admin API routes
app.route('/admin/api', adminRouter);

// Admin UI - serve the SPA for all non-API, non-asset routes
// The index.html is served from public/admin/index.html
app.get('/admin', async (c) => {
  // Fetch the admin index.html from assets
  const assetUrl = new URL('/admin/index.html', c.req.url);
  const response = await c.env.ASSETS?.fetch(assetUrl);
  if (response && response.ok) {
    return new Response(response.body, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  // Fallback if assets not available
  return c.html('<html><body><h1>Admin UI not found</h1><p>Run: npm run build:admin</p></body></html>');
});

app.get('/admin/*', async (c) => {
  const path = c.req.path;
  // Skip API routes - they're handled by adminRouter
  if (path.startsWith('/admin/api/')) {
    return c.notFound();
  }
  // Skip asset routes - they're handled by Cloudflare assets
  if (path.startsWith('/admin/assets/')) {
    return c.notFound();
  }
  // SPA fallback - serve index.html for all other admin routes
  const assetUrl = new URL('/admin/index.html', c.req.url);
  const response = await c.env.ASSETS?.fetch(assetUrl);
  if (response && response.ok) {
    return new Response(response.body, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  return c.redirect('/admin');
});

// Export the app for the worker entry point
export { app };
