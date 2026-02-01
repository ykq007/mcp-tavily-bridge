import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js';

import { startStdioHttpBridge } from '../src/bridge.js';

function readNextMessage(buffer: ReadBuffer, stream: PassThrough, timeoutMs = 2000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for message'));
    }, timeoutMs);

    const onData = (chunk: Buffer) => {
      buffer.append(chunk);
      const msg = buffer.readMessage();
      if (msg) {
        cleanup();
        resolve(msg);
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      stream.off('data', onData);
    };

    stream.on('data', onData);
  });
}

describe('stdio-http-bridge', () => {
  it('proxies tools/list and tools/call over HTTP with Authorization header', async () => {
    let sawAuthHeader = 0;
    let sawMissingAuth = 0;

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => 'test-session'
    });

    const server = new Server(
      { name: 'tavily-mcp', version: '0.2.16' },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'tavily_search',
            description: 'stub',
            inputSchema: {
              type: 'object',
              properties: { query: { type: 'string' } },
              required: ['query'],
              additionalProperties: true
            }
          }
        ]
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'tavily_search') {
        return { isError: true, content: [{ type: 'text', text: 'unknown tool' }] };
      }
      return { content: [{ type: 'text', text: String((request.params.arguments as any)?.query ?? '') }] };
    });

    await server.connect(transport);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);

      const url = new URL(request.url);
      if (url.pathname !== '/mcp') return new Response('not found', { status: 404 });

      if (request.method === 'GET') {
        // Optional SSE endpoint; this test runs in non-streaming mode.
        return new Response('', { status: 405 });
      }

      const authHeader = request.headers.get('authorization');
      if (authHeader === 'Bearer test_token') {
        sawAuthHeader += 1;
      } else {
        sawMissingAuth += 1;
        return new Response(JSON.stringify({ error: 'missing auth' }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        });
      }

      const parsedBody = await request.clone().json();
      return await transport.handleRequest(request, { parsedBody });
    };

    const clientToBridge = new PassThrough();
    const bridgeToClient = new PassThrough();

    const { close } = await startStdioHttpBridge({
      mcpUrl: 'http://bridge.test/mcp',
      token: 'test_token',
      stdin: clientToBridge,
      stdout: bridgeToClient
    });

    const rb = new ReadBuffer();

    // initialize
    clientToBridge.write(
      serializeMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } }
      })
    );
    const initResp = await readNextMessage(rb, bridgeToClient);
    expect(initResp.id).toBe(1);
    expect(initResp.result?.serverInfo?.name).toBe('tavily-mcp');
    expect(initResp.result?.serverInfo?.version).toBe('0.2.16');

    // initialized notification (no response expected)
    clientToBridge.write(serializeMessage({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }));

    // tools/list
    clientToBridge.write(serializeMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }));
    const listResp = await readNextMessage(rb, bridgeToClient);
    expect(listResp.id).toBe(2);
    expect(listResp.result?.tools?.[0]?.name).toBe('tavily_search');

    // tools/call
    clientToBridge.write(
      serializeMessage({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'tavily_search', arguments: { query: 'hello' } } })
    );
    const callResp = await readNextMessage(rb, bridgeToClient);
    expect(callResp.id).toBe(3);
    expect(callResp.result?.content?.[0]?.text).toBe('hello');

    expect(sawMissingAuth).toBe(0);
    expect(sawAuthHeader).toBeGreaterThanOrEqual(2);

    try {
      await close();
    } finally {
      globalThis.fetch = originalFetch;
      await transport.close();
    }
  });
});
