import { parseArgs } from 'node:util';
import type { SearchSourceMode } from '@mcp-nexus/core';

export type StdioCliArgs = {
  token: string;
  searchSourceMode: SearchSourceMode;
};

export type ParseStdioCliArgsResult =
  | { ok: true; value: StdioCliArgs }
  | { ok: false; error: string; exitCode: 1 | 2 };

export function parseStdioCliArgs(argv: string[]): ParseStdioCliArgsResult {
  const parsed = parseArgs({
    args: argv,
    strict: false,
    allowPositionals: true,
    options: {
      help: { type: 'boolean', short: 'h' },
      token: { type: 'string' },
      'search-source-mode': { type: 'string' }
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

  // Parse search source mode (CLI > env > default)
  const searchSourceModeValue = parsed.values['search-source-mode'];
  const searchSourceModeFromFlag = typeof searchSourceModeValue === 'string' ? searchSourceModeValue.trim() : '';
  const searchSourceModeFromEnv = process.env.SEARCH_SOURCE_MODE?.trim() ?? '';
  const searchSourceModeRaw = searchSourceModeFromFlag || searchSourceModeFromEnv || 'brave_prefer_tavily_fallback';

  // Import parseSearchSourceMode dynamically to avoid circular dependency
  const { parseSearchSourceMode } = await import('@mcp-nexus/core');
  const searchSourceMode = parseSearchSourceMode(searchSourceModeRaw, 'brave_prefer_tavily_fallback');

  return { ok: true, value: { token, searchSourceMode } };
}

export function usage(): string {
  return [
    'mcp-nexus local stdio server',
    '',
    'Usage:',
    '  node packages/bridge-stdio/dist/index.js [--token <client_token>] [--search-source-mode <mode>]',
    '',
    'Options:',
    '  --token <client_token>              Client token used to authenticate requests to this server. (Env: TAVILY_BRIDGE_MCP_TOKEN)',
    '  --search-source-mode <mode>         Search source mode: tavily_only, brave_only, combined, or brave_prefer_tavily_fallback. (Env: SEARCH_SOURCE_MODE)',
    '  -h, --help                          Show help.'
  ].join('\n');
}

