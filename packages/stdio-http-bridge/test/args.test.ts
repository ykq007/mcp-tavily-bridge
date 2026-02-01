import { describe, expect, it } from 'vitest';

import { normalizeMcpUrl, normalizeMcpUrlFromBaseUrl, parseBridgeCliArgs } from '../src/args.js';

describe('stdio-http-bridge args', () => {
  const ENV_TOKEN = 'TAVILY_BRIDGE_MCP_TOKEN';
  const ENV_BASE_URL = 'TAVILY_BRIDGE_BASE_URL';
  const ENV_MCP_URL = 'TAVILY_BRIDGE_MCP_URL';

  it('normalizes base-url and appends /mcp', () => {
    expect(normalizeMcpUrlFromBaseUrl('http://127.0.0.1:8787/')).toBe('http://127.0.0.1:8787/mcp');
  });

  it('accepts base-url already ending with /mcp', () => {
    expect(normalizeMcpUrlFromBaseUrl('http://127.0.0.1:8787/mcp')).toBe('http://127.0.0.1:8787/mcp');
  });

  it('trims trailing slashes from mcp-url', () => {
    expect(normalizeMcpUrl('http://127.0.0.1:8787/mcp/')).toBe('http://127.0.0.1:8787/mcp');
  });

  it('errors when token is missing', () => {
    const prevToken = process.env[ENV_TOKEN];
    try {
      delete process.env[ENV_TOKEN];
      const res = parseBridgeCliArgs(['--base-url', 'http://127.0.0.1:8787']);
      expect(res.ok).toBe(false);
    } finally {
      if (prevToken === undefined) delete process.env[ENV_TOKEN];
      else process.env[ENV_TOKEN] = prevToken;
    }
  });

  it('prefers --mcp-url over --base-url', () => {
    const res = parseBridgeCliArgs([
      '--base-url',
      'http://127.0.0.1:1111',
      '--mcp-url',
      'http://127.0.0.1:2222/mcp',
      '--token',
      'mcp_test'
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.mcpUrl).toBe('http://127.0.0.1:2222/mcp');
  });

  it('uses env token and base url when flags are omitted', () => {
    const prevToken = process.env[ENV_TOKEN];
    const prevBase = process.env[ENV_BASE_URL];
    try {
      process.env[ENV_TOKEN] = 'mcp_test';
      process.env[ENV_BASE_URL] = 'http://127.0.0.1:9999';
      const res = parseBridgeCliArgs([]);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value.token).toBe('mcp_test');
      expect(res.value.mcpUrl).toBe('http://127.0.0.1:9999/mcp');
    } finally {
      if (prevToken === undefined) delete process.env[ENV_TOKEN];
      else process.env[ENV_TOKEN] = prevToken;
      if (prevBase === undefined) delete process.env[ENV_BASE_URL];
      else process.env[ENV_BASE_URL] = prevBase;
    }
  });

  it('uses env mcp url over env base url', () => {
    const prevToken = process.env[ENV_TOKEN];
    const prevBase = process.env[ENV_BASE_URL];
    const prevMcp = process.env[ENV_MCP_URL];
    try {
      process.env[ENV_TOKEN] = 'mcp_test';
      process.env[ENV_BASE_URL] = 'http://127.0.0.1:1111';
      process.env[ENV_MCP_URL] = 'http://127.0.0.1:2222/mcp/';
      const res = parseBridgeCliArgs([]);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value.mcpUrl).toBe('http://127.0.0.1:2222/mcp');
    } finally {
      if (prevToken === undefined) delete process.env[ENV_TOKEN];
      else process.env[ENV_TOKEN] = prevToken;
      if (prevBase === undefined) delete process.env[ENV_BASE_URL];
      else process.env[ENV_BASE_URL] = prevBase;
      if (prevMcp === undefined) delete process.env[ENV_MCP_URL];
      else process.env[ENV_MCP_URL] = prevMcp;
    }
  });
});
