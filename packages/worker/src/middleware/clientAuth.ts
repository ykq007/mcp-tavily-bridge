import type { Next } from 'hono';

import { D1Client } from '../db/d1.js';
import type { WorkerContext } from '../context.js';

type ExtractClientTokenOptions = {
  authorizationHeader: string | undefined;
  queryTavilyApiKey: string | undefined;
  queryToken: string | undefined;
  enableQueryAuth: boolean;
};

export function extractClientTokenFromRequest({
  authorizationHeader,
  queryTavilyApiKey,
  queryToken,
  enableQueryAuth
}: ExtractClientTokenOptions): string | undefined {
  const header = authorizationHeader?.trim() ?? '';
  if (header) {
    const bearerMatch = header.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) {
      const token = bearerMatch[1]?.trim();
      if (token) return token;
      return undefined;
    }

    // Backwards compatibility: allow raw token in Authorization header
    // (as long as it doesn't look like a structured auth header).
    const lower = header.toLowerCase();
    if (lower === 'bearer' || lower === 'basic' || lower === 'digest') {
      // Ignore auth schemes without credentials.
    } else if (!/\s/.test(header)) {
      return header;
    }
  }

  if (!enableQueryAuth) return undefined;

  const alias = queryToken?.trim();
  if (alias) return alias;

  const tavilyApiKey = queryTavilyApiKey?.trim();
  if (tavilyApiKey) return tavilyApiKey;

  return undefined;
}

/**
 * Middleware to validate MCP client token
 */
export async function clientAuth(c: WorkerContext, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  const enableQueryAuth = c.env.ENABLE_QUERY_AUTH === 'true';

  const token = extractClientTokenFromRequest({
    authorizationHeader: authHeader,
    queryTavilyApiKey: c.req.query('tavilyApiKey'),
    queryToken: c.req.query('token'),
    enableQueryAuth
  });

  if (!token) {
    return c.json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Client token required' },
    }, 401);
  }

  // Extract prefix (first 8 chars) for lookup
  const prefix = token.substring(0, 8);

  try {
    const db = new D1Client(c.env.DB);

    // Find token by prefix
    const clientToken = await db.getClientTokenByPrefix(prefix);

    if (!clientToken) {
      return c.json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid client token' },
      }, 401);
    }

    // Check if token is revoked
    if (clientToken.revokedAt) {
      return c.json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Token has been revoked' },
      }, 401);
    }

    // Check if token is expired
    if (clientToken.expiresAt && new Date(clientToken.expiresAt) < new Date()) {
      return c.json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Token has expired' },
      }, 401);
    }

    // Verify token hash
    const tokenHash = await hashToken(token);
    const storedHash = new Uint8Array(clientToken.tokenHash);

    if (!compareArrays(tokenHash, storedHash)) {
      return c.json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid client token' },
      }, 401);
    }

    // Store client info in context for later use
    c.set('clientTokenId', clientToken.id);
    c.set('clientTokenPrefix', clientToken.tokenPrefix);
    c.set('clientTokenAllowedTools', clientToken.allowedTools);
    c.set('clientTokenRateLimit', clientToken.rateLimit);

    await next();
  } catch (error) {
    console.error('Client auth error:', error);
    return c.json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Authentication error' },
    }, 500);
  }
}

/**
 * Hash a token using SHA-256
 */
async function hashToken(token: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const tokenData = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', tokenData);
  return new Uint8Array(hashBuffer);
}

/**
 * Compare two Uint8Arrays in constant time
 */
function compareArrays(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}
