export type McpSetupContext = {
  apiBaseUrl: string;
  origin: string;
  clientToken: string;
};

export type McpSetupTarget = {
  id: string;
  title: string;
  kind: 'http' | 'stdio';
  description: string;
  render: (ctx: McpSetupContext) => string;
};

export function resolveMcpUrl(ctx: Pick<McpSetupContext, 'apiBaseUrl' | 'origin'>): string {
  const base = ctx.apiBaseUrl.trim() ? ctx.apiBaseUrl.trim().replace(/\/+$/, '') : ctx.origin.trim().replace(/\/+$/, '');
  return base ? `${base}/mcp` : '/mcp';
}

export function resolveMcpBaseUrl(ctx: Pick<McpSetupContext, 'apiBaseUrl' | 'origin'>): string {
  const base = ctx.apiBaseUrl.trim() ? ctx.apiBaseUrl.trim().replace(/\/+$/, '') : ctx.origin.trim().replace(/\/+$/, '');
  return base || '';
}

function tokenOrPlaceholder(token: string): string {
  return token.trim() ? token.trim() : '<YOUR_CLIENT_TOKEN>';
}

function baseUrlOrPlaceholder(baseUrl: string): string {
  return baseUrl.trim() ? baseUrl.trim() : '<YOUR_BRIDGE_BASE_URL>';
}

export const MCP_SETUP_TARGETS: McpSetupTarget[] = [
  {
    id: 'http-curl',
    title: 'HTTP (cURL test)',
    kind: 'http',
    description: 'Quick sanity check that your client token can authenticate to the MCP endpoint.',
    render: (ctx) => {
      const url = resolveMcpUrl(ctx);
      const token = tokenOrPlaceholder(ctx.clientToken);
      return [
        `TOKEN="${token}"`,
        `URL="${url}"`,
        '',
        'curl -sS "$URL" \\',
        '  -H "Authorization: Bearer $TOKEN" \\',
        '  -H "Content-Type: application/json" \\',
        `  -d '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'`
      ].join('\n');
    }
  },
  {
    id: 'http-generic',
    title: 'HTTP (any MCP HTTP client)',
    kind: 'http',
    description: 'Use these values in any client that supports MCP over HTTP and custom headers.',
    render: (ctx) => {
      const url = resolveMcpUrl(ctx);
      const token = tokenOrPlaceholder(ctx.clientToken);
      return [
        'MCP endpoint URL:',
        url,
        '',
        'HTTP header:',
        `Authorization: Bearer ${token}`
      ].join('\n');
    }
  },
  {
    id: 'stdio-generic',
    title: 'stdio (generic)',
    kind: 'stdio',
    description: 'Recommended: run a lightweight stdio wrapper via npx that connects to the bridge-server over HTTP.',
    render: (ctx) => {
      const token = tokenOrPlaceholder(ctx.clientToken);
      const baseUrl = baseUrlOrPlaceholder(resolveMcpBaseUrl(ctx));
      return [
        `export TAVILY_BRIDGE_MCP_TOKEN="${token}"`,
        `export TAVILY_BRIDGE_BASE_URL="${baseUrl}"`,
        '',
        'npx -y @mcp-tavily-bridge/stdio-http-bridge'
      ].join('\n');
    }
  },
  {
    id: 'claude-desktop-npx',
    title: 'Claude Desktop (npx → HTTP)',
    kind: 'stdio',
    description: 'Recommended: no repo checkout; token is passed via env (not command-line args).',
    render: (ctx) => {
      const token = tokenOrPlaceholder(ctx.clientToken);
      const baseUrl = baseUrlOrPlaceholder(resolveMcpBaseUrl(ctx));
      return [
        '{',
        '  "mcpServers": {',
        '    "tavily-bridge": {',
        '      "command": "npx",',
        '      "args": ["-y", "@mcp-tavily-bridge/stdio-http-bridge"],',
        '      "env": {',
        `        "TAVILY_BRIDGE_BASE_URL": "${baseUrl}",`,
        `        "TAVILY_BRIDGE_MCP_TOKEN": "${token}"`,
        '      }',
        '    }',
        '  }',
        '}'
      ].join('\n');
    }
  }
];
