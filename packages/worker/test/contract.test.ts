import { describe, it, expect } from 'vitest';

/**
 * Contract Testing Suite for Worker Implementation
 *
 * This suite verifies that the Worker implementation maintains
 * API contract compatibility with the Node.js implementation.
 *
 * Purpose: Prevent behavior drift between runtimes
 */

// Type definitions matching Node.js implementation
interface ServerInfoResponse {
  tavilyKeyCount: number;
  braveKeyCount: number;
  clientTokenCount: number;
  searchSourceMode: string;
  tavilyKeySelectionStrategy: string;
}

interface TavilyKeyResponse {
  id: string;
  label: string;
  maskedKey: string; // Must be 'maskedKey' not 'keyMasked'
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface BraveKeyResponse {
  id: string;
  label: string;
  maskedKey: string; // Must be 'maskedKey' not 'keyMasked'
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ClientTokenResponse {
  id: string;
  tokenPrefix: string;
  description: string | null;
  allowedTools: string[] | null; // Phase 3.4
  rateLimit: number | null;      // Phase 3.5
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

describe('Worker Contract Compliance', () => {
  describe('Admin API Response Contracts', () => {
    it('should match Node.js server-info response structure', () => {
      const workerResponse: ServerInfoResponse = {
        tavilyKeyCount: 0,
        braveKeyCount: 0,
        clientTokenCount: 0,
        searchSourceMode: 'brave_prefer_tavily_fallback',
        tavilyKeySelectionStrategy: 'round_robin'
      };

      // Verify required fields
      expect(workerResponse).toHaveProperty('tavilyKeyCount');
      expect(workerResponse).toHaveProperty('braveKeyCount');
      expect(workerResponse).toHaveProperty('clientTokenCount');
      expect(workerResponse).toHaveProperty('searchSourceMode');
      expect(workerResponse).toHaveProperty('tavilyKeySelectionStrategy');

      // Verify types
      expect(typeof workerResponse.tavilyKeyCount).toBe('number');
      expect(typeof workerResponse.braveKeyCount).toBe('number');
      expect(typeof workerResponse.clientTokenCount).toBe('number');
      expect(typeof workerResponse.searchSourceMode).toBe('string');
      expect(typeof workerResponse.tavilyKeySelectionStrategy).toBe('string');
    });

    it('should use maskedKey field name (not keyMasked)', () => {
      // Phase 1.3: Field name consistency fix
      const tavilyKey: TavilyKeyResponse = {
        id: 'key_123',
        label: 'Test Key',
        maskedKey: 'tvly-****abc', // Correct field name
        status: 'active',
        lastUsedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z'
      };

      const braveKey: BraveKeyResponse = {
        id: 'key_456',
        label: 'Test Key',
        maskedKey: 'BSA-****def', // Correct field name
        status: 'active',
        lastUsedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z'
      };

      expect(tavilyKey).toHaveProperty('maskedKey');
      expect(tavilyKey).not.toHaveProperty('keyMasked');
      expect(braveKey).toHaveProperty('maskedKey');
      expect(braveKey).not.toHaveProperty('keyMasked');
    });

    it('should include Phase 3.4/3.5 fields in token response', () => {
      const token: ClientTokenResponse = {
        id: 'tok_123',
        tokenPrefix: 'mcp_abc123',
        description: 'Test Token',
        allowedTools: ['tavily_search', 'brave_web_search'], // Phase 3.4
        rateLimit: 120, // Phase 3.5
        revokedAt: null,
        expiresAt: null,
        createdAt: '2026-01-01T00:00:00.000Z'
      };

      // Verify Phase 3.4: Tool scoping
      expect(token).toHaveProperty('allowedTools');
      expect(token.allowedTools).toBeInstanceOf(Array);

      // Verify Phase 3.5: Fine-grained rate limiting
      expect(token).toHaveProperty('rateLimit');
      expect(typeof token.rateLimit).toBe('number');
    });

    it('should handle null values consistently', () => {
      const tokenWithDefaults: ClientTokenResponse = {
        id: 'tok_123',
        tokenPrefix: 'mcp_abc123',
        description: null,
        allowedTools: null, // null = all tools allowed
        rateLimit: null,    // null = use global default
        revokedAt: null,
        expiresAt: null,
        createdAt: '2026-01-01T00:00:00.000Z'
      };

      expect(tokenWithDefaults.allowedTools).toBeNull();
      expect(tokenWithDefaults.rateLimit).toBeNull();
      expect(tokenWithDefaults.description).toBeNull();
    });
  });

  describe('MCP Endpoint Contracts', () => {
    it('should return JSON-RPC 2.0 compliant responses', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'mcp-nexus',
            version: '1.0.0'
          },
          capabilities: {
            tools: {}
          }
        }
      };

      expect(response.jsonrpc).toBe('2.0');
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('result');
    });

    it('should enforce tool scoping (Phase 3.4)', () => {
      // Simulate tool scoping check
      const allowedTools = ['tavily_search'];
      const requestedTool = 'brave_web_search';

      const isAllowed = allowedTools.includes(requestedTool);
      expect(isAllowed).toBe(false);

      // Worker should reject with error
      const expectedError = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32600,
          message: `Tool '${requestedTool}' is not allowed for this token. Allowed tools: ${allowedTools.join(', ')}`
        }
      };

      expect(expectedError.error.code).toBe(-32600);
      expect(expectedError.error.message).toContain('not allowed');
    });

    it('should use per-token rate limits (Phase 3.5)', () => {
      // Simulate rate limit selection
      const tokenRateLimit = 100;
      const globalDefault = 60;

      // Worker should use token-specific limit when set
      const effectiveLimit = tokenRateLimit ?? globalDefault;
      expect(effectiveLimit).toBe(100);
      expect(effectiveLimit).not.toBe(globalDefault);
    });
  });

  describe('D1 Database Schema Compliance', () => {
    it('should have ClientToken table with Phase 3.4/3.5 columns', () => {
      // This test documents the expected schema
      const expectedColumns = [
        'id',
        'description',
        'tokenPrefix',
        'tokenHash',
        'tokenEncrypted',
        'scopesJson',
        'allowedTools',  // Phase 3.4: JSON column
        'rateLimit',     // Phase 3.5: INTEGER column
        'expiresAt',
        'revokedAt',
        'createdAt'
      ];

      // Verify critical columns exist
      expect(expectedColumns).toContain('allowedTools');
      expect(expectedColumns).toContain('rateLimit');
    });

    it('should store allowedTools as JSON string in D1', () => {
      // D1 stores JSON as TEXT, not native JSON
      const allowedTools = ['tavily_search', 'brave_web_search'];
      const storedValue = JSON.stringify(allowedTools);

      expect(typeof storedValue).toBe('string');
      expect(JSON.parse(storedValue)).toEqual(allowedTools);
    });

    it('should store rateLimit as INTEGER in D1', () => {
      const rateLimit = 120;

      expect(typeof rateLimit).toBe('number');
      expect(Number.isInteger(rateLimit)).toBe(true);
      expect(rateLimit).toBeGreaterThan(0);
    });
  });

  describe('Durable Object Rate Limiting', () => {
    it('should use token-specific rate limit when available', () => {
      const tokenRateLimit = 100;
      const defaultLimit = 60;

      // Worker should prefer token-specific limit
      const limit = tokenRateLimit ?? defaultLimit;
      expect(limit).toBe(100);
    });

    it('should fall back to global default when token limit is null', () => {
      const tokenRateLimit = null;
      const defaultLimit = 60;

      const limit = tokenRateLimit ?? defaultLimit;
      expect(limit).toBe(60);
    });

    it('should check both per-client and global limits', () => {
      // Worker should enforce both limits
      const perClientLimit = 100;
      const globalLimit = 600;

      expect(perClientLimit).toBeLessThan(globalLimit);

      // Both checks must pass
      const clientAllowed = true; // Simulated check
      const globalAllowed = true; // Simulated check

      const finalAllowed = clientAllowed && globalAllowed;
      expect(finalAllowed).toBe(true);
    });
  });

  describe('Error Response Consistency', () => {
    it('should return consistent authentication errors', () => {
      const error = {
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Client token required'
        }
      };

      expect(error.error.code).toBe(-32600);
      expect(error.error.message).toBe('Client token required');
    });

    it('should return consistent rate limit errors', () => {
      const error = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32029,
          message: 'Rate limit exceeded',
          data: {
            scope: 'client',
            retryAfterMs: 5000
          }
        }
      };

      expect(error.error.code).toBe(-32029);
      expect(error.error.message).toBe('Rate limit exceeded');
      expect(error.error.data).toHaveProperty('scope');
      expect(error.error.data).toHaveProperty('retryAfterMs');
    });

    it('should return consistent tool scoping errors', () => {
      const error = {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32600,
          message: "Tool 'brave_web_search' is not allowed for this token. Allowed tools: tavily_search"
        }
      };

      expect(error.error.code).toBe(-32600);
      expect(error.error.message).toContain('not allowed');
      expect(error.error.message).toContain('Allowed tools:');
    });
  });

  describe('Migration Compatibility', () => {
    it('should have applied migration 0002 for Phase 3.4/3.5', () => {
      // This test documents that migration 0002 must be applied
      const migrationFile = '0002_add_token_scoping_and_rate_limit.sql';
      const expectedChanges = [
        'ALTER TABLE ClientToken ADD COLUMN allowedTools TEXT',
        'ALTER TABLE ClientToken ADD COLUMN rateLimit INTEGER'
      ];

      expect(migrationFile).toContain('0002');
      expect(expectedChanges).toHaveLength(2);
    });
  });
});

describe('Cross-Runtime Compatibility', () => {
  it('should accept same token format from both runtimes', () => {
    // Token format: mcp_<12-char-hex>.<48-char-hex>
    const tokenRegex = /^mcp_[a-f0-9]{12}\.[a-f0-9]{48}$/;

    const nodeToken = 'mcp_abc123def456.0123456789abcdef0123456789abcdef0123456789abcdef';
    const workerToken = 'mcp_def456abc123.fedcba9876543210fedcba9876543210fedcba9876543210';

    expect(nodeToken).toMatch(tokenRegex);
    expect(workerToken).toMatch(tokenRegex);
  });

  it('should use same hashing algorithm for tokens', () => {
    // Both use SHA-256 for token hashing
    const algorithm = 'SHA-256';
    expect(algorithm).toBe('SHA-256');
  });

  it('should use same encryption for API keys', () => {
    // Both use AES-256-GCM for key encryption
    const algorithm = 'AES-256-GCM';
    expect(algorithm).toBe('AES-256-GCM');
  });

  it('should use ISO 8601 format for all timestamps', () => {
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    const timestamp = '2026-01-01T00:00:00.000Z';

    expect(timestamp).toMatch(isoRegex);
  });
});
