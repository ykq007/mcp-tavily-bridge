#!/usr/bin/env node
import process from 'node:process';

import { parseBridgeCliArgs, usage } from './args.js';
import { startStdioHttpBridge } from './bridge.js';

const parsed = parseBridgeCliArgs(process.argv.slice(2));
if (!parsed.ok) {
  // usage() returns a multi-line help string; treat it like stderr output.
  console.error(parsed.error);
  process.exitCode = parsed.exitCode;
} else {
  const { mcpUrl, token, defaultParametersJson } = parsed.value;
  startStdioHttpBridge({ mcpUrl, token, defaultParametersJson })
    .then(({ close }) => {
      const shutdown = async () => {
        try {
          await close();
        } finally {
          process.exit(0);
        }
      };
      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);
      // Keep logs on stderr so stdout remains MCP wire.
      console.error(`Tavily stdio→http bridge running (remote: ${mcpUrl})`);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      console.error('');
      console.error(usage());
      process.exitCode = 1;
    });
}

