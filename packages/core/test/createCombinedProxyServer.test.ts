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

  it('falls back to Tavily when Brave has no available keys (web search)', async () => {
    const tavily = stubTavilyClient();
    const brave = stubBraveClient();

    tavily.search = async () => ({
      results: [{ title: 'From Tavily', url: 'https://tavily.com', content: 'fallback' }]
    });
    brave.webSearch = async () => {
      throw new Error('No Brave API keys available');
    };

    const server = createCombinedProxyServer({
      serverName: 'x',
      serverVersion: '0',
      tavilyClient: tavily,
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

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content?.[0]?.text);
    expect(parsed[0]?.title).toBe('From Tavily');
  });

  it('falls back to Tavily when Brave key decryption fails (web search)', async () => {
    const tavily = stubTavilyClient();
    const brave = stubBraveClient();

    tavily.search = async () => ({
      results: [{ title: 'From Tavily', url: 'https://tavily.com', content: 'fallback' }]
    });
    brave.webSearch = async () => {
      throw new Error('Unsupported state or unable to authenticate data');
    };

    const server = createCombinedProxyServer({
      serverName: 'x',
      serverVersion: '0',
      tavilyClient: tavily,
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

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content?.[0]?.text);
    expect(parsed[0]?.title).toBe('From Tavily');
  });

  it('falls back to Tavily when Brave key decryption fails (local search)', async () => {
    const tavily = stubTavilyClient();
    const brave = stubBraveClient();

    tavily.search = async () => ({
      results: [{ title: 'From Tavily', url: 'https://tavily.com', content: 'fallback' }]
    });
    brave.localSearch = async () => {
      throw new Error('Unsupported state or unable to authenticate data');
    };

    const server = createCombinedProxyServer({
      serverName: 'x',
      serverVersion: '0',
      tavilyClient: tavily,
      braveClient: brave,
      getAuthToken: () => 'tok'
    });

    const callHandler = (server as any)._requestHandlers.get('tools/call');
    const result = await callHandler(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'brave_local_search', arguments: { query: 'coffee near me', count: 1 } }
      },
      {}
    );

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content?.[0]?.text);
    expect(parsed[0]?.title).toBe('From Tavily');
  });

  it('returns a tool error in brave_only mode when Brave has no available keys', async () => {
    const brave = stubBraveClient();
    brave.webSearch = async () => {
      throw new Error('No Brave API keys available');
    };

    const server = createCombinedProxyServer({
      serverName: 'x',
      serverVersion: '0',
      tavilyClient: stubTavilyClient(),
      braveClient: brave,
      getAuthToken: () => 'tok',
      getSearchSourceMode: async () => 'brave_only'
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

    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toContain('Brave API error: No Brave API keys available');
  });

  it('executes combined search when searchSourceMode is combined', async () => {
    const tavily = stubTavilyClient();
    const brave = stubBraveClient();

    // Mock Tavily result
    tavily.search = async () => ({
      results: [{ title: 'Tavily Result', url: 'https://tavily.com', content: 'Tavily content' }]
    });

    // Mock Brave result
    brave.webSearch = async () => ({
      web: { results: [{ title: 'Brave Result', url: 'https://brave.com', description: 'Brave content' }] }
    });

    const server = createCombinedProxyServer({
      serverName: 'x',
      serverVersion: '0',
      tavilyClient: tavily,
      braveClient: brave,
      getAuthToken: () => 'tok',
      getSearchSourceMode: async () => 'combined'
    });

    const callHandler = (server as any)._requestHandlers.get('tools/call');
    const result = await callHandler(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'brave_web_search', arguments: { query: 'test' } }
      },
      {}
    );

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content?.[0]?.text);

    // Should contain both results
    expect(parsed).toHaveLength(2);
    expect(parsed.find((r: any) => r.title === 'Tavily Result')).toBeDefined();
    expect(parsed.find((r: any) => r.title === 'Brave Result')).toBeDefined();
  });

  it('deduplicates URLs in combined mode', async () => {
    const tavily = stubTavilyClient();
    const brave = stubBraveClient();

    tavily.search = async () => ({
      results: [{ title: 'Tavily', url: 'https://same.com', content: 'From Tavily' }]
    });

    brave.webSearch = async () => ({
      web: { results: [{ title: 'Brave', url: 'https://same.com', description: 'From Brave' }] }
    });

    const server = createCombinedProxyServer({
      serverName: 'x',
      serverVersion: '0',
      tavilyClient: tavily,
      braveClient: brave,
      getAuthToken: () => 'tok',
      getSearchSourceMode: async () => 'combined'
    });

    const callHandler = (server as any)._requestHandlers.get('tools/call');
    const result = await callHandler(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'brave_web_search', arguments: { query: 'test' } } },
      {}
    );

    const parsed = JSON.parse(result.content?.[0]?.text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Tavily'); // Tavily wins (appears first in interleave)
  });

  it('enforces count limit in combined mode', async () => {
    const tavily = stubTavilyClient();
    const brave = stubBraveClient();

    tavily.search = async () => ({
      results: [
        { title: 'T1', url: 'https://t1.com', content: '' },
        { title: 'T2', url: 'https://t2.com', content: '' },
        { title: 'T3', url: 'https://t3.com', content: '' }
      ]
    });

    brave.webSearch = async () => ({
      web: { results: [
        { title: 'B1', url: 'https://b1.com', description: '' },
        { title: 'B2', url: 'https://b2.com', description: '' }
      ] }
    });

    const server = createCombinedProxyServer({
      serverName: 'x',
      serverVersion: '0',
      tavilyClient: tavily,
      braveClient: brave,
      getAuthToken: () => 'tok',
      getSearchSourceMode: async () => 'combined'
    });

    const callHandler = (server as any)._requestHandlers.get('tools/call');
    const result = await callHandler(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'brave_web_search', arguments: { query: 'test', count: 3 } } },
      {}
    );

    const parsed = JSON.parse(result.content?.[0]?.text);
    expect(parsed).toHaveLength(3); // Should be limited to count
  });

  it('returns error when both sources fail in combined mode', async () => {
    const tavily = stubTavilyClient();
    const brave = stubBraveClient();

    tavily.search = async () => { throw new Error('Tavily failed'); };
    brave.webSearch = async () => { throw new Error('Brave failed'); };

    const server = createCombinedProxyServer({
      serverName: 'x',
      serverVersion: '0',
      tavilyClient: tavily,
      braveClient: brave,
      getAuthToken: () => 'tok',
      getSearchSourceMode: async () => 'combined'
    });

    const callHandler = (server as any)._requestHandlers.get('tools/call');
    const result = await callHandler(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'brave_web_search', arguments: { query: 'test' } } },
      {}
    );

    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text).toContain('Both Tavily and Brave search failed');
  });

  it('returns partial results when one source fails in combined mode', async () => {
    const tavily = stubTavilyClient();
    const brave = stubBraveClient();

    tavily.search = async () => ({ results: [{ title: 'Tavily', url: 'https://tavily.com', content: '' }] });
    brave.webSearch = async () => { throw new Error('Brave failed'); };

    const server = createCombinedProxyServer({
      serverName: 'x',
      serverVersion: '0',
      tavilyClient: tavily,
      braveClient: brave,
      getAuthToken: () => 'tok',
      getSearchSourceMode: async () => 'combined'
    });

    const callHandler = (server as any)._requestHandlers.get('tools/call');
    const result = await callHandler(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'brave_web_search', arguments: { query: 'test' } } },
      {}
    );

    expect(result.isError).toBeUndefined(); // Should not be error
    const parsed = JSON.parse(result.content?.[0]?.text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('Tavily');
  });

  it('uses only Brave when offset > 0 in combined mode', async () => {
    const tavily = stubTavilyClient();
    const brave = stubBraveClient();

    let tavilyCalled = false;
    let braveCalled = false;

    tavily.search = async () => {
      tavilyCalled = true;
      return { results: [{ title: 'Tavily', url: 'https://tavily.com', content: '' }] };
    };

    brave.webSearch = async () => {
      braveCalled = true;
      return { web: { results: [{ title: 'Brave', url: 'https://brave.com', description: '' }] } };
    };

    const server = createCombinedProxyServer({
      serverName: 'x',
      serverVersion: '0',
      tavilyClient: tavily,
      braveClient: brave,
      getAuthToken: () => 'tok',
      getSearchSourceMode: async () => 'combined'
    });

    const callHandler = (server as any)._requestHandlers.get('tools/call');
    const result = await callHandler(
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'brave_web_search', arguments: { query: 'test', offset: 10 } } },
      {}
    );

    expect(tavilyCalled).toBe(false); // Tavily should NOT be called
    expect(braveCalled).toBe(true); // Brave should be called
    expect(result.isError).toBeUndefined();
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
