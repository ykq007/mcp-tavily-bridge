import { parseArgs } from 'node:util';

export type BridgeCliArgs = {
  mcpUrl: string;
  token: string;
  defaultParametersJson: string | undefined;
};

export type ParseBridgeCliArgsResult =
  | { ok: true; value: BridgeCliArgs }
  | { ok: false; error: string; exitCode: 1 | 2 };

export function parseBridgeCliArgs(argv: string[]): ParseBridgeCliArgsResult {
  const parsed = parseArgs({
    args: argv,
    strict: false,
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      token: { type: 'string' },
      'base-url': { type: 'string' },
      'mcp-url': { type: 'string' },
      'default-parameters': { type: 'string' }
    }
  });

  if (parsed.values.help) {
    return { ok: false, exitCode: 2, error: usage() };
  }

  const tokenValue = parsed.values.token;
  const tokenFromFlag = typeof tokenValue === 'string' ? tokenValue.trim() : '';
  const tokenFromEnv = process.env.TAVILY_BRIDGE_MCP_TOKEN?.trim() ?? '';
  const token = tokenFromFlag || tokenFromEnv;
  if (!token) {
    return {
      ok: false,
      exitCode: 1,
      error: 'Missing client token. Provide --token <client_token> or set TAVILY_BRIDGE_MCP_TOKEN.'
    };
  }

  const mcpUrlFlagValue = parsed.values['mcp-url'];
  const baseUrlFlagValue = parsed.values['base-url'];
  const mcpUrlFlag = typeof mcpUrlFlagValue === 'string' ? mcpUrlFlagValue.trim() : '';
  const baseUrlFlag = typeof baseUrlFlagValue === 'string' ? baseUrlFlagValue.trim() : '';
  const mcpUrlEnv = process.env.TAVILY_BRIDGE_MCP_URL?.trim() ?? '';
  const baseUrlEnv = process.env.TAVILY_BRIDGE_BASE_URL?.trim() ?? '';
  const mcpUrl = mcpUrlFlag
    ? normalizeMcpUrl(mcpUrlFlag)
    : baseUrlFlag
      ? normalizeMcpUrlFromBaseUrl(baseUrlFlag)
      : mcpUrlEnv
        ? normalizeMcpUrl(mcpUrlEnv)
        : normalizeMcpUrlFromBaseUrl(baseUrlEnv);
  if (!mcpUrl) {
    return {
      ok: false,
      exitCode: 1,
      error:
        'Missing MCP endpoint URL. Provide --base-url <origin> or --mcp-url <full_mcp_url> (or set TAVILY_BRIDGE_BASE_URL / TAVILY_BRIDGE_MCP_URL).'
    };
  }

  const defaultParametersValue = parsed.values['default-parameters'];
  const defaultParametersFromFlag = typeof defaultParametersValue === 'string' ? defaultParametersValue.trim() : '';
  const defaultParametersFromEnv = process.env.DEFAULT_PARAMETERS?.trim() ?? '';
  const defaultParametersJson = defaultParametersFromFlag || defaultParametersFromEnv || undefined;

  return { ok: true, value: { mcpUrl, token, defaultParametersJson } };
}

export function normalizeMcpUrlFromBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.endsWith('/mcp')) return trimmed;
  return `${trimmed}/mcp`;
}

export function normalizeMcpUrl(mcpUrl: string): string {
  return mcpUrl.trim().replace(/\/+$/, '');
}

export function usage(): string {
  return [
    'mcp-tavily-bridge stdio→http bridge',
    '',
    'Usage:',
    '  npx -y @mcp-tavily-bridge/stdio-http-bridge [--base-url <origin> | --mcp-url <url>] [--token <client_token>]',
    '',
    'Options:',
    '  --base-url <origin>           Base URL for the bridge-server (we append /mcp).',
    '  --mcp-url <url>               Full MCP endpoint URL (overrides --base-url).',
    '  --token <client_token>        Client token for the bridge-server (Authorization: Bearer). (Env: TAVILY_BRIDGE_MCP_TOKEN)',
    '  --default-parameters <json>   Optional DEFAULT_PARAMETERS JSON; sent as `default_parameters` header.',
    '',
    'Environment:',
    '  TAVILY_BRIDGE_BASE_URL        Base URL for the bridge-server (we append /mcp).',
    '  TAVILY_BRIDGE_MCP_URL         Full MCP endpoint URL (overrides TAVILY_BRIDGE_BASE_URL).',
    '  TAVILY_BRIDGE_MCP_TOKEN       Client token for Authorization: Bearer <token>.',
    '  -h, --help                    Show help.'
  ].join('\n');
}
