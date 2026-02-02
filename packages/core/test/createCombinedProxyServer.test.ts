import { describe, expect, it } from 'vitest';

import { createCombinedProxyServer } from '../src/mcp/createCombinedProxyServer.js';

describe('createCombinedProxyServer', () => {
  it('lists both Tavily and Brave tools', async () => {
    const server = createCombinedProxyServer({
      serverName: 'x',
      serverVersion: '0',
      tavilyClient: stubTavilyClient(),
      braveClient: stubBraveClient(),
      getAuthToken: () => 'tok'
    });

    const listHandler = (server as any)._requestHandlers.get('tools/list');
    expect(listHandler).toBeTypeOf('function');
    const res = await listHandler({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, {});
    const names = (res.tools ?? []).map((t: any) => t.name);
    expect(names).toContain('tavily_search');
    expect(names).toContain('brave_web_search');
    expect(names).toContain('brave_local_search');
  });

  it('dispatches brave_web_search to Brave client', async () => {
    const brave = stubBraveClient();

    const server = createCombinedProxyServer({
      serverName: 'x',
      serverVersion: '0',
      tavilyClient: stubTavilyClient(),
      braveClient: brave,
      getAuthToken: () => 'tok'
    });

    const callHandler = (server as any)._requestHandlers.get('tools/call');
    const result = await callHandler(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'brave_web_search', arguments: { query: 'hello', count: 1 } }
      },
      {}
    );

    expect(brave.webSearchCalls).toBe(1);
    expect(result.isError).toBeUndefined();
    const text = result.content?.[0]?.text;
    const parsed = JSON.parse(text);
    expect(parsed[0]?.title).toBe('t');
  });
});

function stubTavilyClient(): any {
  return {
    search: async () => ({ results: [] }),
    extract: async () => ({ results: [] }),
    crawl: async () => ({ base_url: '', results: [] }),
    map: async () => ({ base_url: '', results: [] }),
    research: async () => ({ content: '' })
  };
}

function stubBraveClient(): any {
  return {
    webSearchCalls: 0,
    localSearchCalls: 0,
    webSearch: async function () {
      this.webSearchCalls += 1;
      return { web: { results: [{ title: 't', url: 'u', description: 'd' }] } };
    },
    localSearch: async function () {
      this.localSearchCalls += 1;
      return { local: { results: [{ name: 'n', website: 'w', description: 'd' }] } };
    }
  };
}
