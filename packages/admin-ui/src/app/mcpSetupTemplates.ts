type McpSetupContext = {
  apiBaseUrl: string;
  origin: string;
  clientToken: string;
};

type McpSetupTarget = {
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
    title: 'HTTP (cURL sanity check)',
    kind: 'http',
    description: 'Quick sanity check for direct MCP-over-HTTP access using your client token.',
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
    title: 'HTTP (any MCP-over-HTTP client)',
    kind: 'http',
    description: 'Use these values in any client that speaks MCP over HTTP and lets you set custom headers.',
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
    title: 'stdio (npx wrapper → HTTP)',
    kind: 'stdio',
    description: 'Recommended for stdio clients: install + run the published wrapper via npx (latest). The wrapper talks stdio locally and connects to the bridge over HTTP.',
    render: (ctx) => {
      const token = tokenOrPlaceholder(ctx.clientToken);
      const baseUrl = baseUrlOrPlaceholder(resolveMcpBaseUrl(ctx));
      return [
        '# 1) Set env vars for the stdio wrapper',
        `export TAVILY_BRIDGE_MCP_TOKEN="${token}"`,
        `export TAVILY_BRIDGE_BASE_URL="${baseUrl}"`,
        '',
        '# 2) Install + run (latest)',
        'npx -y @nexus-mcp/stdio-http-bridge'
      ].join('\n');
    }
  },
  {
    id: 'claude-desktop-npx',
    title: 'Claude Desktop (npx wrapper → HTTP)',
    kind: 'stdio',
    description: 'Recommended: no repo checkout. Runs @nexus-mcp/stdio-http-bridge via npx and passes auth via env (not command-line args).',
    render: (ctx) => {
      const token = tokenOrPlaceholder(ctx.clientToken);
      const baseUrl = baseUrlOrPlaceholder(resolveMcpBaseUrl(ctx));
      return [
        '{',
        '  "mcpServers": {',
        '    "tavily-bridge": {',
        '      "command": "npx",',
        '      "args": ["-y", "@nexus-mcp/stdio-http-bridge"],',
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
