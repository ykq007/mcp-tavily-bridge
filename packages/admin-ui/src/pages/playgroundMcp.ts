export type JsonRpcError = {
  code?: number;
  message?: string;
  data?: unknown;
};

export type JsonRpcMessage = {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: JsonRpcError;
};

export const MCP_ACCEPT_HEADER = 'application/json, text/event-stream';

const SESSION_INVALID_ERROR_PATTERNS = [
  'No valid session ID',
  'Invalid or missing session ID',
  'Mcp-Session-Id header is required',
  'Session not found',
  'session ID provided'
];

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseSseDataMessages(bodyText: string): JsonRpcMessage[] {
  const events = bodyText
    .split('\n\n')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const messages: JsonRpcMessage[] = [];
  for (const event of events) {
    const lines = event.split('\n');
    const dataLines: string[] = [];

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      dataLines.push(line.slice('data:'.length).trimStart());
    }

    if (dataLines.length === 0) continue;

    const payload = dataLines.join('\n').trim();
    if (!payload) continue;

    try {
      const parsed = JSON.parse(payload);
      if (isObjectRecord(parsed)) {
        messages.push(parsed as JsonRpcMessage);
      }
    } catch {
      // Ignore malformed SSE event payloads
    }
  }

  return messages;
}

export function parseMcpResponseMessages(bodyText: string, contentType: string | null): JsonRpcMessage[] {
  const text = bodyText.trim();
  if (!text) return [];

  if ((contentType ?? '').toLowerCase().includes('text/event-stream')) {
    return parseSseDataMessages(text);
  }

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter(isObjectRecord) as JsonRpcMessage[];
    }
    if (isObjectRecord(parsed)) {
      return [parsed as JsonRpcMessage];
    }
  } catch {
    // fall through and return empty
  }

  return [];
}

function hasResultOrError(message: JsonRpcMessage): boolean {
  return Object.prototype.hasOwnProperty.call(message, 'result') || Object.prototype.hasOwnProperty.call(message, 'error');
}

export function pickJsonRpcResponse(messages: JsonRpcMessage[], requestId: number | string): JsonRpcMessage | undefined {
  const withMatchingId = messages.find((message) => message.id === requestId && hasResultOrError(message));
  if (withMatchingId) return withMatchingId;
  return messages.find(hasResultOrError);
}

export function getJsonRpcErrorMessage(error: unknown): string | undefined {
  if (typeof error === 'string') return error;
  if (!isObjectRecord(error)) return undefined;
  const message = error.message;
  return typeof message === 'string' ? message : undefined;
}

export function isSessionInvalidErrorMessage(message: unknown): boolean {
  if (typeof message !== 'string') return false;
  return SESSION_INVALID_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export function buildMcpHeaders(token: string, sessionId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: MCP_ACCEPT_HEADER,
    Authorization: `Bearer ${token}`
  };

  if (sessionId && sessionId.trim()) {
    headers['mcp-session-id'] = sessionId;
  }

  return headers;
}
