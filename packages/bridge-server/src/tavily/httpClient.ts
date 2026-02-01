import { TavilyHttpError } from '@mcp-tavily-bridge/core';

export type TavilyHttpClient = {
  search: (payload: Record<string, unknown>) => Promise<any>;
  extract: (payload: Record<string, unknown>) => Promise<any>;
  crawl: (payload: Record<string, unknown>) => Promise<any>;
  map: (payload: Record<string, unknown>) => Promise<any>;
  researchStart: (payload: Record<string, unknown>) => Promise<any>;
  researchPoll: (requestId: string) => Promise<any>;
};

const baseUrls = {
  search: 'https://api.tavily.com/search',
  extract: 'https://api.tavily.com/extract',
  crawl: 'https://api.tavily.com/crawl',
  map: 'https://api.tavily.com/map',
  research: 'https://api.tavily.com/research'
} as const;

export function createTavilyHttpClient(apiKey: string): TavilyHttpClient {
  return {
    search: (payload) => postJson(baseUrls.search, payload, apiKey),
    extract: (payload) => postJson(baseUrls.extract, payload, apiKey),
    crawl: (payload) => postJson(baseUrls.crawl, payload, apiKey),
    map: (payload) => postJson(baseUrls.map, payload, apiKey),
    researchStart: (payload) => postJson(baseUrls.research, payload, apiKey),
    researchPoll: (requestId) => getJson(`${baseUrls.research}/${encodeURIComponent(requestId)}`, apiKey)
  };
}

async function postJson(url: string, body: Record<string, unknown>, apiKey: string): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  return parseOrThrow(res);
}

async function getJson(url: string, apiKey: string): Promise<any> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });
  return parseOrThrow(res);
}

async function parseOrThrow(res: Response): Promise<any> {
  const text = await res.text();
  const body = safeJson(text);
  if (res.ok) return body;

  if (res.status === 401) throw new Error('Invalid API key');
  if (res.status === 429) throw new Error('Usage limit exceeded');

  const message = typeof body?.message === 'string' ? body.message : res.statusText;
  throw new TavilyHttpError(`HTTP ${res.status}`, { status: res.status, tavilyMessage: message });
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

