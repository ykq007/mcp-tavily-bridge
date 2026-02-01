import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import express from 'express';

import { PrismaClient } from '@mcp-tavily-bridge/db';
import { createTavilyProxyServer, getDefaultParametersFromEnv, parseDefaultParametersJson } from '@mcp-tavily-bridge/core';

import { requestContext } from './context.js';
import { validateClientToken } from './auth/clientToken.js';
import { FixedWindowRateLimiter } from './auth/rateLimit.js';
import { tryParseAes256GcmKeyFromEnv } from './crypto/crypto.js';
import { TavilyKeyPool } from './tavily/keyPool.js';
import { RotatingTavilyClient } from './tavily/rotatingClient.js';
import { registerAdminRoutes } from './admin/routes.js';
import { createSessionTransport } from './mcp/sessionTransport.js';
import { renderLandingPage } from './landing.js';

export type CreateBridgeAppOptions = {
  host?: string;
};

const ENABLE_QUERY_AUTH = process.env.ENABLE_QUERY_AUTH === 'true';
const ENABLE_TAVILY_CREDITS_CHECK = process.env.ENABLE_TAVILY_CREDITS_CHECK !== 'false';

const RATE_LIMIT_PER_MINUTE = Number(process.env.MCP_RATE_LIMIT_PER_MINUTE ?? '60');
const GLOBAL_RATE_LIMIT_PER_MINUTE = Number(process.env.MCP_GLOBAL_RATE_LIMIT_PER_MINUTE ?? '600');

const MAX_RETRIES = Number(process.env.MCP_MAX_RETRIES ?? '2');
const FIXED_COOLDOWN_MS = Number(process.env.MCP_COOLDOWN_MS ?? String(60_000));

function asyncHandler(fn: (req: any, res: any, next: any) => Promise<void>) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __mcpTavilyBridgePrisma: PrismaClient | undefined;
}

function getPrisma(): PrismaClient {
  if (!globalThis.__mcpTavilyBridgePrisma) {
    globalThis.__mcpTavilyBridgePrisma = new PrismaClient();
  }
  return globalThis.__mcpTavilyBridgePrisma;
}

export function createBridgeApp(options: CreateBridgeAppOptions = {}): express.Express {
  const host = options.host ?? process.env.HOST ?? '127.0.0.1';

  const app = createMcpExpressApp({ host });
  app.set('trust proxy', true);

  // Serve the built admin UI (scaffold) at /admin-ui if present.
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const adminUiDist = path.resolve(__dirname, '../../admin-ui/dist');
  if (fs.existsSync(adminUiDist)) {
    app.use('/admin-ui', express.static(adminUiDist));
  }

  app.get('/', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(
      renderLandingPage({
        githubUrl: 'https://github.com/ykq007/mcp-tavily-bridge',
        adminPath: '/admin-ui',
        healthPath: '/health'
      })
    );
  });

  const configErrors: string[] = [];
  if (!process.env.DATABASE_URL) {
    configErrors.push('DATABASE_URL is required.');
  }
  const parsedKey = tryParseAes256GcmKeyFromEnv('KEY_ENCRYPTION_SECRET');
  if (!parsedKey.ok) {
    configErrors.push(parsedKey.error);
  }

  if (configErrors.length > 0) {
    const detail = configErrors.length === 1 ? configErrors[0] : `${configErrors.length} configuration errors`;

    app.get('/health', (_req, res) => {
      res.status(500).json({ ok: false, error: 'Server misconfigured', detail, issues: configErrors });
    });

    app.all('/mcp', (_req, res) => {
      res.status(500).json({ error: 'Server misconfigured', detail, issues: configErrors });
    });

    app.use((_req, res) => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Server misconfigured', detail, issues: configErrors });
      }
    });

    return app;
  }

  if (!parsedKey.ok) {
    app.use((_req, res) => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Server misconfigured' });
      }
    });
    return app;
  }

  let prisma: PrismaClient;
  try {
    prisma = getPrisma();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to initialize database client';
    app.get('/health', (_req, res) => {
      res.status(500).json({ ok: false, error: 'Database initialization failed' });
    });
    app.all('/mcp', (_req, res) => {
      res.status(500).json({ error: 'Database initialization failed' });
    });
    app.use((_req, res) => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Database initialization failed' });
      }
    });
    // eslint-disable-next-line no-console
    console.error('Database initialization failed:', msg);
    return app;
  }

  const encryptionKey = parsedKey.key;
  const pool = new TavilyKeyPool({ prisma, encryptionKey });
  const tavilyClient = new RotatingTavilyClient({
    pool,
    prisma,
    maxRetries: MAX_RETRIES,
    fixedCooldownMs: FIXED_COOLDOWN_MS
  });

  const perTokenLimiter = new FixedWindowRateLimiter({ maxPerWindow: RATE_LIMIT_PER_MINUTE, windowMs: 60_000 });
  const globalLimiter = new FixedWindowRateLimiter({ maxPerWindow: GLOBAL_RATE_LIMIT_PER_MINUTE, windowMs: 60_000 });

  registerAdminRoutes(app, prisma);

  type SessionEntry = { transport: StreamableHTTPServerTransport };
  const transports: Record<string, SessionEntry> = {};

  app.post('/mcp', asyncHandler(async (req: any, res: any) => {
    const authHeader = req.headers?.authorization;
    const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
    const queryToken = ENABLE_QUERY_AUTH ? (req.query?.tavilyApiKey as string | undefined) : undefined;
    const rawToken = bearer ?? queryToken;
    if (!rawToken) {
      res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });
      return;
    }

    const validated = await validateClientToken(prisma, rawToken);
    if (!validated.ok) {
      res.status(401).json({ error: validated.error });
      return;
    }

    const globalCheck = globalLimiter.check('global');
    if (!globalCheck.ok) {
      res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs: globalCheck.retryAfterMs });
      return;
    }

    const tokenCheck = perTokenLimiter.check(validated.clientTokenId);
    if (!tokenCheck.ok) {
      res.status(429).json({ error: 'Rate limit exceeded', retryAfterMs: tokenCheck.retryAfterMs });
      return;
    }

    if (ENABLE_TAVILY_CREDITS_CHECK && isToolsCallRequest(req.body)) {
      const check = await pool.preflightCreditsCheck();
      if (!check.ok) {
        if (typeof check.retryAfterMs === 'number' && Number.isFinite(check.retryAfterMs)) {
          res.setHeader('Retry-After', String(Math.max(1, Math.ceil(check.retryAfterMs / 1000))));
        }
        res.status(check.status).json({
          error: check.error,
          retryAfterMs: check.retryAfterMs
        });
        return;
      }
    }

    const defaultParametersHeader = req.headers?.default_parameters as string | undefined;
    const ip = req.ip ?? req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const authInfo: AuthInfo = {
      token: rawToken,
      clientId: validated.clientTokenId,
      scopes: [],
      expiresAt: undefined,
      extra: { tokenPrefix: validated.prefix }
    };
    req.auth = authInfo;

    await requestContext.run(
      {
        clientTokenId: validated.clientTokenId,
        clientTokenPrefix: validated.prefix,
        rawClientToken: rawToken,
        defaultParametersHeader,
        ip,
        userAgent
      },
      async () => {
        const sessionId = req.headers['mcp-session-id'];
        try {
          if (sessionId && transports[sessionId]) {
            await transports[sessionId].transport.handleRequest(req, res, req.body);
            return;
          }

          if (!sessionId && isInitializeRequest(req.body)) {
            const transport = createSessionTransport({
              transports,
              sessionIdGenerator: () => randomUUID()
            });
            const server = createTavilyProxyServer({
              serverName: 'tavily-mcp',
              serverVersion: '0.2.16',
              tavilyClient,
              getDefaultParameters: () => {
                const envDefaults = getDefaultParametersFromEnv();
                const headerDefaults = parseDefaultParametersJson(defaultParametersHeader);
                return { ...envDefaults, ...headerDefaults };
              }
            });

            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
            return;
          }

          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
            id: null
          });
        } catch (_err) {
          if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
          }
        }
      }
    );
  }));

  app.get('/mcp', asyncHandler(async (req: any, res: any) => {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    const authHeader = req.headers?.authorization;
    const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
    const rawToken = bearer;
    if (!rawToken) {
      res.status(401).send('Missing Authorization: Bearer <token>');
      return;
    }
    const validated = await validateClientToken(prisma, rawToken);
    if (!validated.ok) {
      res.status(401).send(validated.error);
      return;
    }
    const authInfo: AuthInfo = {
      token: rawToken,
      clientId: validated.clientTokenId,
      scopes: [],
      expiresAt: undefined,
      extra: { tokenPrefix: validated.prefix }
    };
    req.auth = authInfo;
    await transports[sessionId].transport.handleRequest(req, res);
  }));

  app.get('/health', asyncHandler(async (_req, res) => {
    const active = await prisma.tavilyKey.count({ where: { status: 'active' } });
    res.json({ ok: true, activeKeys: active });
  }));

  app.use((err: any, _req: any, res: any, _next: any) => {
    if (res.headersSent) return;
    // eslint-disable-next-line no-console
    console.error('Unhandled error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

function isToolsCallRequest(body: any): boolean {
  if (!body) return false;
  if (Array.isArray(body)) return body.some(isToolsCallRequest);
  if (typeof body !== 'object') return false;
  return body.method === 'tools/call';
}
