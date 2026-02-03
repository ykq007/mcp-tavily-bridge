import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import type { Env } from './env.js';
import { adminRouter } from './routes/admin/index.js';
import { handleMcpRequest } from './mcp/mcpHandler.js';

// Create the main Hono app
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());

// CORS for Admin UI (adjust origin in production)
app.use('/admin/api/*', cors({
  origin: (origin) => {
    // Allow localhost in dev, specific Pages domain in production
    if (!origin) return '*';
    if (origin.includes('localhost')) return origin;
    if (origin.includes('.pages.dev')) return origin;
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '1.0.0',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
  });
});

// MCP endpoint - handle JSON-RPC requests directly
app.post('/mcp', async (c) => {
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

// MCP SSE endpoint - forwards to Durable Object for session management
app.get('/mcp/sse', async (c) => {
  const authHeader = c.req.header('Authorization');
  const sessionId = authHeader
    ? authHeader.replace('Bearer ', '').substring(0, 16)
    : 'anonymous';

  const id = c.env.MCP_SESSION.idFromName(sessionId);
  const stub = c.env.MCP_SESSION.get(id);

  const url = new URL(c.req.url);
  url.pathname = '/sse';

  return stub.fetch(new Request(url.toString(), {
    method: 'GET',
    headers: c.req.raw.headers,
  }));
});

// Landing page
app.get('/', (c) => {
  const baseUrl = new URL(c.req.url).origin;
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Nexus - Tavily Bridge</title>
  <style>
    :root { --bg: #0f172a; --fg: #e2e8f0; --accent: #3b82f6; }
    @media (prefers-color-scheme: light) { :root { --bg: #f8fafc; --fg: #1e293b; } }
    body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--fg); max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { color: var(--accent); }
    a { color: var(--accent); }
    pre { background: #1e293b; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
    code { font-family: 'Fira Code', monospace; }
  </style>
</head>
<body>
  <h1>MCP Nexus</h1>
  <p>A unified MCP bridge server for Tavily and Brave Search APIs.</p>

  <h2>Endpoints</h2>
  <ul>
    <li><strong>MCP:</strong> <code>/mcp</code> (SSE transport)</li>
    <li><strong>Admin UI:</strong> <a href="/admin">/admin</a></li>
    <li><strong>Health:</strong> <a href="/health">/health</a></li>
  </ul>

  <h2>Connect with MCP Client</h2>
  <pre><code>{
  "mcpServers": {
    "mcp-nexus": {
      "url": "${baseUrl}/mcp",
      "headers": {
        "Authorization": "Bearer &lt;client_token&gt;"
      }
    }
  }
}</code></pre>

  <p>Running on Cloudflare Workers</p>
</body>
</html>`;

  return c.html(html);
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
