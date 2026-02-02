import process from 'node:process';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PrismaClient } from '@mcp-tavily-bridge/db';
import {
  createBraveHttpClient,
  createCombinedProxyServer,
  getDefaultParametersFromEnv,
  parseTavilyKeySelectionStrategy,
  QueuedRateGate,
  type BraveOverflowMode
} from '@mcp-tavily-bridge/core';

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
  const pool = new TavilyKeyPool({
    prisma,
    encryptionKey,
    getSelectionStrategy: async () => parseTavilyKeySelectionStrategy(process.env.TAVILY_KEY_SELECTION_STRATEGY)
  });
  const tavilyClient = new RotatingTavilyClient({
    pool,
    prisma,
    maxRetries: Number(process.env.MCP_MAX_RETRIES ?? '2'),
    fixedCooldownMs: Number(process.env.MCP_COOLDOWN_MS ?? String(60_000))
  });

  const braveApiKey = process.env.BRAVE_API_KEY?.trim() || undefined;
  const braveHttpTimeoutMsRaw = Number(process.env.BRAVE_HTTP_TIMEOUT_MS ?? String(20_000));
  const braveMaxQps = Number(process.env.BRAVE_MAX_QPS ?? '1');
  const braveMinIntervalMsEnv = Number(process.env.BRAVE_MIN_INTERVAL_MS ?? '');
  const braveMaxQueueMsRaw = Number(process.env.BRAVE_MAX_QUEUE_MS ?? String(30_000));
  const braveOverflow = parseBraveOverflowMode(process.env.BRAVE_OVERFLOW);

  const braveHttpTimeoutMs = Number.isFinite(braveHttpTimeoutMsRaw) && braveHttpTimeoutMsRaw > 0 ? braveHttpTimeoutMsRaw : 20_000;
  const braveMaxQueueMs = Number.isFinite(braveMaxQueueMsRaw) && braveMaxQueueMsRaw >= 0 ? braveMaxQueueMsRaw : 30_000;

  const braveMinIntervalMs =
    Number.isFinite(braveMinIntervalMsEnv) && braveMinIntervalMsEnv > 0 ? braveMinIntervalMsEnv : minIntervalMsFromQps(braveMaxQps);
  const braveGate = new QueuedRateGate({ minIntervalMs: braveMinIntervalMs });
  const braveClient = braveApiKey ? createBraveHttpClient({ apiKey: braveApiKey, gate: braveGate, timeoutMs: braveHttpTimeoutMs }) : undefined;

  const server = createCombinedProxyServer({
    serverName: 'tavily-mcp',
    serverVersion: '0.2.16',
    tavilyClient,
    braveClient,
    braveOverflow,
    braveMaxQueueMs,
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

function minIntervalMsFromQps(qps: number): number {
  if (!Number.isFinite(qps) || qps <= 0) return 1000;
  return Math.max(1, Math.ceil(1000 / qps));
}

function parseBraveOverflowMode(raw: unknown, fallback: BraveOverflowMode = 'fallback_to_tavily'): BraveOverflowMode {
  if (typeof raw !== 'string') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'queue') return 'queue';
  if (normalized === 'error') return 'error';
  if (normalized === 'fallback_to_tavily' || normalized === 'fallback-to-tavily' || normalized === 'tavily') return 'fallback_to_tavily';
  return fallback;
}
