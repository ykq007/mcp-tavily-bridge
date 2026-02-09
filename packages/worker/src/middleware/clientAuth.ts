import type { Context, Next } from 'hono';

import type { Env } from '../env.js';
import { D1Client } from '../db/d1.js';

/**
 * Middleware to validate MCP client token
 */
export async function clientAuth(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');

  if (!authHeader) {
    return c.json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Authorization header required' },
    }, 401);
  }

  const token = authHeader.replace('Bearer ', '');

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
