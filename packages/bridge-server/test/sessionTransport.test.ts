import { PassThrough, Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { createSessionTransport, type SessionTransportStore } from '../src/mcp/sessionTransport.js';

class MockServerResponse extends Writable {
  statusCode: number | undefined;
  headers: Record<string, string | string[]> = {};
  bodyChunks: Buffer[] = [];

  constructor() {
    super();
  }

  writeHead(status: number, headers: Record<string, any>) {
    this.statusCode = status;
    this.headers = headers;
    return this;
  }

  override _write(chunk: any, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    callback();
  }

  get bodyText(): string {
    return Buffer.concat(this.bodyChunks).toString('utf8');
  }
}

function createIncomingRequest(opts: { method: string; url: string; headers: Record<string, string>; bodyText?: string }): PassThrough {
  const incoming = new PassThrough();
  (incoming as any).method = opts.method;
  (incoming as any).url = opts.url;

  const rawHeaders: string[] = [];
  for (const [k, v] of Object.entries(opts.headers)) {
    rawHeaders.push(k, v);
  }
  (incoming as any).rawHeaders = rawHeaders;
  (incoming as any).headers = opts.headers;

  // Ensure the stream fully ends even if nothing reads from it.
  incoming.resume();
  if (opts.bodyText) incoming.write(opts.bodyText);
  incoming.end();
  return incoming;
}

function parseSseDataMessages(bodyText: string): any[] {
  const events = bodyText.split('\n\n').map((s) => s.trim()).filter(Boolean);
  const parsed: any[] = [];
  for (const evt of events) {
    const lines = evt.split('\n');
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trimStart());
      }
    }
    if (dataLines.length === 0) continue;
    const data = dataLines.join('\n').trim();
    if (!data) continue;
    parsed.push(JSON.parse(data));
  }
  return parsed;
}

describe('createSessionTransport', () => {
  it('registers the transport under the generated sessionId during initialize', async () => {
    const transports: SessionTransportStore = {};
    const transport = createSessionTransport({
      transports,
      sessionIdGenerator: () => 'test-session'
    });

    // Session ID is generated when initialize is processed (handleRequest), not at construction time.
    expect(transport.sessionId).toBeUndefined();

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

    await server.connect(transport);

    const initBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '0' } }
    };

    const initReq = createIncomingRequest({
      method: 'POST',
      url: '/mcp',
      headers: {
        host: 'bridge.test',
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json'
      },
      bodyText: JSON.stringify(initBody)
    });
    const initRes = new MockServerResponse();
    await transport.handleRequest(initReq as any, initRes as any, initBody);

    expect(transports['test-session']).toBeDefined();
    expect(transport.sessionId).toBe('test-session');

    const listBody = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} };
    const listReq = createIncomingRequest({
      method: 'POST',
      url: '/mcp',
      headers: {
        host: 'bridge.test',
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        'mcp-session-id': 'test-session'
      },
      bodyText: JSON.stringify(listBody)
    });
    const listRes = new MockServerResponse();
    await transport.handleRequest(listReq as any, listRes as any, listBody);
    expect(listRes.statusCode).toBe(200);
    const messages = parseSseDataMessages(listRes.bodyText);
    const listResponse = messages.find((m) => m?.jsonrpc === '2.0' && m?.id === 2);
    expect(listResponse?.result?.tools?.map((t: any) => t.name)).toContain('tavily_search');
  });
});
