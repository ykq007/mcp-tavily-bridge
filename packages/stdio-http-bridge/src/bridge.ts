import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Readable, Writable } from 'node:stream';

export type StartBridgeOptions = {
  mcpUrl: string;
  token: string;
  defaultParametersJson?: string | undefined;
  stdin?: Readable;
  stdout?: Writable;
};

const SESSION_INVALID_ERROR_PATTERNS = [
  'No valid session ID',
  'Invalid or missing session ID',
  'session ID provided'
];

function isSessionInvalidError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return SESSION_INVALID_ERROR_PATTERNS.some((pattern) => msg.includes(pattern));
}

export async function startStdioHttpBridge({
  mcpUrl,
  token,
  defaultParametersJson,
  stdin,
  stdout
}: StartBridgeOptions): Promise<{ close: () => Promise<void> }> {
  const requestHeaders = {
    Authorization: `Bearer ${token}`,
    ...(defaultParametersJson ? { default_parameters: defaultParametersJson } : null)
  };

  let remoteTransport: StreamableHTTPClientTransport;
  let remoteClient: Client;
  let closed = false;

  async function createRemoteConnection(): Promise<void> {
    remoteTransport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
      requestInit: { headers: requestHeaders }
    });

    remoteClient = new Client(
      { name: 'mcp-tavily-bridge-stdio-http-bridge', version: '0.0.0' },
      { capabilities: {} }
    );

    await remoteClient.connect(remoteTransport);
    console.error('[stdio-http-bridge] Connected to remote MCP server');
  }

  async function reconnect(): Promise<void> {
    if (closed) return;
    console.error('[stdio-http-bridge] Session invalid, reconnecting...');
    try {
      await remoteTransport.close().catch(() => {});
    } catch {
      // Ignore close errors
    }
    await createRemoteConnection();
    console.error('[stdio-http-bridge] Reconnected successfully');
  }

  async function withReconnect<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (isSessionInvalidError(error)) {
        await reconnect();
        return await fn();
      }
      throw error;
    }
  }

  await createRemoteConnection();

  const server = new Server(
    { name: 'tavily-mcp', version: '0.2.16' },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    return await withReconnect(() => remoteClient.listTools(request.params));
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return await withReconnect(() =>
      remoteClient.callTool({ name: request.params.name, arguments: request.params.arguments })
    );
  });

  const localTransport = new StdioServerTransport(stdin, stdout);
  await server.connect(localTransport);

  async function close(): Promise<void> {
    closed = true;
    await Promise.allSettled([localTransport.close(), remoteTransport.close()]);
  }

  return { close };
}
