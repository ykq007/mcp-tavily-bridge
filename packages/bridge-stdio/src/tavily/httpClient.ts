import { TavilyHttpError } from '@mcp-tavily-bridge/core';

const baseUrls = {
  search: 'https://api.tavily.com/search',
  extract: 'https://api.tavily.com/extract',
  crawl: 'https://api.tavily.com/crawl',
  map: 'https://api.tavily.com/map',
  research: 'https://api.tavily.com/research'
} as const;

export function createTavilyHttpClient(apiKey: string) {
  return {
    search: (payload: Record<string, unknown>) => postJson(baseUrls.search, payload, apiKey),
    extract: (payload: Record<string, unknown>) => postJson(baseUrls.extract, payload, apiKey),
    crawl: (payload: Record<string, unknown>) => postJson(baseUrls.crawl, payload, apiKey),
    map: (payload: Record<string, unknown>) => postJson(baseUrls.map, payload, apiKey),
    researchStart: (payload: Record<string, unknown>) => postJson(baseUrls.research, payload, apiKey),
    researchPoll: (requestId: string) => getJson(`${baseUrls.research}/${encodeURIComponent(requestId)}`, apiKey)
  };
}

async function postJson(url: string, body: Record<string, unknown>, apiKey: string) {
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

async function getJson(url: string, apiKey: string) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });
  return parseOrThrow(res);
}

async function parseOrThrow(res: Response) {
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

