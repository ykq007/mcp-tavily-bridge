import { describe, expect, it } from 'vitest';
import { hasTavilyToolsCallRequest } from '../src/app.js';

describe('hasTavilyToolsCallRequest', () => {
  it('returns true for single tavily tools/call request', () => {
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'tavily_search',
        arguments: { query: 'hello' }
      }
    };

    expect(hasTavilyToolsCallRequest(body)).toBe(true);
  });

  it('returns false for single brave tools/call request', () => {
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'brave_web_search',
        arguments: { query: 'hello' }
      }
    };

    expect(hasTavilyToolsCallRequest(body)).toBe(false);
  });

  it('returns false for non-tools/call request', () => {
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    };

    expect(hasTavilyToolsCallRequest(body)).toBe(false);
  });

  it('returns true for batch request that includes a tavily tools/call', () => {
    const body = [
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'brave_web_search',
          arguments: { query: 'hello' }
        }
      },
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'tavily_extract',
          arguments: { urls: ['https://example.com'] }
        }
      }
    ];

    expect(hasTavilyToolsCallRequest(body)).toBe(true);
  });

  it('returns false for batch request with only brave tools/call', () => {
    const body = [
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'brave_web_search',
          arguments: { query: 'hello' }
        }
      },
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'brave_local_search',
          arguments: { query: 'coffee near me' }
        }
      }
    ];

    expect(hasTavilyToolsCallRequest(body)).toBe(false);
  });
});
