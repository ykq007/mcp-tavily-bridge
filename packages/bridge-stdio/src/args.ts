import { parseArgs } from 'node:util';

export type StdioCliArgs = {
  token: string;
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
      token: { type: 'string' }
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

  return { ok: true, value: { token } };
}

export function usage(): string {
  return [
    'mcp-tavily-bridge local stdio server',
    '',
    'Usage:',
    '  node packages/bridge-stdio/dist/index.js [--token <client_token>]',
    '',
    'Options:',
    '  --token <client_token>        Client token used to authenticate requests to this server. (Env: TAVILY_BRIDGE_MCP_TOKEN)',
    '  -h, --help                    Show help.'
  ].join('\n');
}

