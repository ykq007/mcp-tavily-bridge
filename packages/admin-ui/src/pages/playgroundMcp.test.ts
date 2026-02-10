import { describe, expect, it } from 'vitest';

import {
  buildMcpHeaders,
  getJsonRpcErrorMessage,
  isSessionInvalidErrorMessage,
  parseMcpResponseMessages,
  parseSseDataMessages,
  pickJsonRpcResponse
} from './playgroundMcp';

describe('playgroundMcp helpers', () => {
  it('parses SSE data messages into JSON-RPC payloads', () => {
    const sse = [
      'event: message',
      'data: {"jsonrpc":"2.0","id":2,"result":{"ok":true}}',
      '',
      'event: message',
      'data: {"jsonrpc":"2.0","id":3,"error":{"code":-32000,"message":"Bad Request: No valid session ID provided"}}',
      ''
    ].join('\n');

    const messages = parseSseDataMessages(sse);

    expect(messages).toHaveLength(2);
    expect(messages[0].id).toBe(2);
    expect(messages[0].result).toEqual({ ok: true });
    expect(messages[1].id).toBe(3);
    expect(messages[1].error?.message).toContain('No valid session ID');
  });

  it('parses JSON response payloads', () => {
    const messages = parseMcpResponseMessages(
      JSON.stringify({ jsonrpc: '2.0', id: 5, result: { tools: [] } }),
      'application/json; charset=utf-8'
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(5);
    expect(messages[0].result).toEqual({ tools: [] });
  });

  it('picks response by request id and falls back', () => {
    const messages = [
      { jsonrpc: '2.0', method: 'notifications/message', params: { ok: true } },
      { jsonrpc: '2.0', id: 99, result: { ok: true } }
    ];

    const picked = pickJsonRpcResponse(messages, 99);
    const fallback = pickJsonRpcResponse(messages, 1);

    expect(picked?.id).toBe(99);
    expect(fallback?.id).toBe(99);
  });

  it('detects session invalid error patterns', () => {
    expect(isSessionInvalidErrorMessage('Bad Request: No valid session ID provided')).toBe(true);
    expect(isSessionInvalidErrorMessage('Invalid or missing session ID')).toBe(true);
    expect(isSessionInvalidErrorMessage('Session not found')).toBe(true);
    expect(isSessionInvalidErrorMessage('Some other error')).toBe(false);
  });

  it('extracts error message and builds MCP headers', () => {
    expect(getJsonRpcErrorMessage({ code: -32000, message: 'x' })).toBe('x');
    expect(getJsonRpcErrorMessage({ code: -32000 })).toBeUndefined();

    const headers = buildMcpHeaders('mcp_token', 'session-1');
    expect(headers.Authorization).toBe('Bearer mcp_token');
    expect(headers.Accept).toContain('text/event-stream');
    expect(headers['mcp-session-id']).toBe('session-1');
  });
});
