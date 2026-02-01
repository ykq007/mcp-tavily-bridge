import { describe, expect, it } from 'vitest';
import { MCP_SETUP_TARGETS, resolveMcpBaseUrl, resolveMcpUrl } from './mcpSetupTemplates';

describe('mcpSetupTemplates', () => {
  it('resolves /mcp from origin when apiBaseUrl is empty', () => {
    expect(resolveMcpUrl({ apiBaseUrl: '', origin: 'http://localhost:8787' })).toBe('http://localhost:8787/mcp');
  });

  it('normalizes apiBaseUrl and appends /mcp', () => {
    expect(resolveMcpUrl({ apiBaseUrl: 'http://127.0.0.1:8787/', origin: 'http://ignored' })).toBe('http://127.0.0.1:8787/mcp');
  });

  it('falls back to /mcp when origin is unavailable', () => {
    expect(resolveMcpUrl({ apiBaseUrl: '', origin: '' })).toBe('/mcp');
  });

  it('resolves base URL without appending /mcp', () => {
    expect(resolveMcpBaseUrl({ apiBaseUrl: 'http://127.0.0.1:8787/', origin: '' })).toBe('http://127.0.0.1:8787');
  });

  it('renders placeholder token when client token is empty', () => {
    const target = MCP_SETUP_TARGETS.find((t) => t.id === 'http-generic')!;
    const snippet = target.render({ apiBaseUrl: 'http://localhost:8787', origin: '', clientToken: '' });
    expect(snippet).toContain('<YOUR_CLIENT_TOKEN>');
    expect(snippet).toContain('/mcp');
  });

  it('includes TAVILY_BRIDGE_MCP_TOKEN in stdio snippets', () => {
    const target = MCP_SETUP_TARGETS.find((t) => t.id === 'stdio-generic')!;
    const snippet = target.render({ apiBaseUrl: '', origin: '', clientToken: 'mcp_x.y' });
    expect(snippet).toContain('TAVILY_BRIDGE_MCP_TOKEN');
    expect(snippet).toContain('mcp_x.y');
  });

  it('renders an npx-based stdio wrapper snippet', () => {
    const target = MCP_SETUP_TARGETS.find((t) => t.id === 'claude-desktop-npx')!;
    const snippet = target.render({ apiBaseUrl: 'http://localhost:8787/', origin: '', clientToken: 'mcp_x.y' });
    expect(snippet).toContain('"command": "npx"');
    expect(snippet).toContain('@mcp-tavily-bridge/stdio-http-bridge');
    expect(snippet).toContain('http://localhost:8787');
    expect(snippet).toContain('mcp_x.y');
    expect(snippet).toContain('TAVILY_BRIDGE_BASE_URL');
    expect(snippet).toContain('TAVILY_BRIDGE_MCP_TOKEN');
  });
});
