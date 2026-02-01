import process from 'node:process';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PrismaClient } from '@mcp-tavily-bridge/db';
import { createTavilyProxyServer, getDefaultParametersFromEnv } from '@mcp-tavily-bridge/core';

import { requestContext } from './context.js';
import { validateClientToken } from './auth/clientToken.js';
import { parseAes256GcmKeyFromEnv } from './crypto/crypto.js';
import { TavilyKeyPool } from './tavily/keyPool.js';
import { RotatingTavilyClient } from './tavily/rotatingClient.js';
import { parseStdioCliArgs, usage } from './args.js';

async function main(): Promise<void> {
  const parsed = parseStdioCliArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exitCode = parsed.exitCode;
    return;
  }

  const rawToken = parsed.value.token;

  const prisma = new PrismaClient();
  const validated = await validateClientToken(prisma, rawToken);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const encryptionKey = parseAes256GcmKeyFromEnv('KEY_ENCRYPTION_SECRET');
  const pool = new TavilyKeyPool({ prisma, encryptionKey });
  const tavilyClient = new RotatingTavilyClient({
    pool,
    prisma,
    maxRetries: Number(process.env.MCP_MAX_RETRIES ?? '2'),
    fixedCooldownMs: Number(process.env.MCP_COOLDOWN_MS ?? String(60_000))
  });

  const server = createTavilyProxyServer({
    serverName: 'tavily-mcp',
    serverVersion: '0.2.16',
    tavilyClient,
    getAuthToken: () => rawToken,
    getDefaultParameters: () => getDefaultParametersFromEnv()
  });

  const transport = new StdioServerTransport();

  await requestContext.run(
    { clientTokenId: validated.clientTokenId, clientTokenPrefix: validated.prefix, rawClientToken: rawToken },
    async () => {
      await server.connect(transport);
    }
  );

  console.error('Tavily bridge stdio server running on stdio');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  console.error('');
  console.error(usage());
  process.exitCode = 1;
});
