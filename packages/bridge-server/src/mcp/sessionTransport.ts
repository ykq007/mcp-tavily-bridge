import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export type SessionEntry = { transport: StreamableHTTPServerTransport };

export type SessionTransportStore = Record<string, SessionEntry>;

export function createSessionTransport(opts: {
  transports: SessionTransportStore;
  sessionIdGenerator: () => string;
  onSessionInitialized?: (sessionId: string) => void;
}): StreamableHTTPServerTransport {
  const { transports, sessionIdGenerator, onSessionInitialized } = opts;

  // Note: In the MCP SDK, the session ID is generated during handleRequest() when the
  // initialize request is processed (not at construction time). We must attach to
  // onsessioninitialized to register the transport under the actual session ID.
  let transport!: StreamableHTTPServerTransport;
  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator,
    onsessioninitialized: (sessionId) => {
      transports[sessionId] = { transport };
      transport.onclose = () => {
        delete transports[sessionId];
      };
      onSessionInitialized?.(sessionId);
    }
  });

  return transport;
}

