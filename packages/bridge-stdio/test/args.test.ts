import { describe, expect, it } from 'vitest';

import { parseStdioCliArgs } from '../src/args.js';

describe('bridge-stdio args', () => {
  const ENV_TOKEN = 'TAVILY_BRIDGE_MCP_TOKEN';

  it('errors when token is missing', () => {
    const prev = process.env[ENV_TOKEN];
    try {
      delete process.env[ENV_TOKEN];
      const res = parseStdioCliArgs([]);
      expect(res.ok).toBe(false);
    } finally {
      if (prev === undefined) delete process.env[ENV_TOKEN];
      else process.env[ENV_TOKEN] = prev;
    }
  });

  it('accepts --token', () => {
    const res = parseStdioCliArgs(['--token', 'mcp_test']);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.token).toBe('mcp_test');
  });

  it('falls back to env token', () => {
    const prev = process.env[ENV_TOKEN];
    try {
      process.env[ENV_TOKEN] = 'mcp_env';
      const res = parseStdioCliArgs([]);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value.token).toBe('mcp_env');
    } finally {
      if (prev === undefined) delete process.env[ENV_TOKEN];
      else process.env[ENV_TOKEN] = prev;
    }
  });
});

