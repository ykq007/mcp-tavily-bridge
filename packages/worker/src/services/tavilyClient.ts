/**
 * Tavily API HTTP client for Cloudflare Workers
 */

const TAVILY_API_BASE = 'https://api.tavily.com';

export interface TavilySearchResult {
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    raw_content?: string;
  }>;
  query: string;
  answer?: string;
  images?: string[];
}

export interface TavilyExtractResult {
  results: Array<{
    url: string;
    raw_content: string;
  }>;
}

export interface TavilyCrawlResult {
  results: Array<{
    url: string;
    raw_content: string;
  }>;
}

export interface TavilyMapResult {
  urls: string[];
}

export interface TavilyResearchResult {
  content?: string;
  sources?: Array<{
    title: string;
    url: string;
    favicon?: string;
  }>;
  error?: string;
}

export async function tavilySearch(
  apiKey: string,
  params: {
    query: string;
    search_depth?: 'basic' | 'advanced' | 'fast' | 'ultra-fast';
    max_results?: number;
    include_images?: boolean;
    include_raw_content?: boolean;
    topic?: string;
    include_domains?: string[];
    exclude_domains?: string[];
    time_range?: string;
    start_date?: string;
    end_date?: string;
    country?: string;
    include_image_descriptions?: boolean;
    include_favicon?: boolean;
  }
): Promise<TavilySearchResult> {
  const response = await fetch(`${TAVILY_API_BASE}/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(params)
  });

  return handleTavilyResponse(response);
}

export async function tavilyExtract(
  apiKey: string,
  params: {
    urls: string[];
    extract_depth?: 'basic' | 'advanced';
    format?: 'markdown' | 'text';
    query?: string;
    include_images?: boolean;
    include_favicon?: boolean;
  }
): Promise<TavilyExtractResult> {
  const response = await fetch(`${TAVILY_API_BASE}/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(params)
  });

  return handleTavilyResponse(response);
}

export async function tavilyCrawl(
  apiKey: string,
  params: {
    url: string;
    max_depth?: number;
    max_breadth?: number;
    limit?: number;
    format?: 'markdown' | 'text';
    extract_depth?: 'basic' | 'advanced';
    instructions?: string;
    select_paths?: string[];
    select_domains?: string[];
    allow_external?: boolean;
    include_images?: boolean;
    include_favicon?: boolean;
  }
): Promise<TavilyCrawlResult> {
  const response = await fetch(`${TAVILY_API_BASE}/crawl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(params)
  });

  return handleTavilyResponse(response);
}

export async function tavilyMap(
  apiKey: string,
  params: {
    url: string;
    max_depth?: number;
    max_breadth?: number;
    limit?: number;
    instructions?: string;
    select_paths?: string[];
    select_domains?: string[];
    allow_external?: boolean;
  }
): Promise<TavilyMapResult> {
  const response = await fetch(`${TAVILY_API_BASE}/map`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(params)
  });

  return handleTavilyResponse(response);
}

export async function tavilyResearch(
  apiKey: string,
  params: {
    input: string;
    model?: 'mini' | 'pro' | 'auto';
  }
): Promise<TavilyResearchResult> {
  const INITIAL_POLL_INTERVAL = 2000;
  const MAX_POLL_INTERVAL = 10000;
  const POLL_BACKOFF_FACTOR = 1.5;
  const MAX_PRO_POLL_DURATION = 900000;
  const MAX_MINI_POLL_DURATION = 300000;
  const maxPollDuration = params.model === 'mini' ? MAX_MINI_POLL_DURATION : MAX_PRO_POLL_DURATION;

  // Step 1: Create research task
  const startResponse = await fetch(`${TAVILY_API_BASE}/research`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(params)
  });

  const startBody = await handleTavilyResponse<{ request_id?: string; status?: string }>(startResponse);
  const requestId = startBody?.request_id;
  if (!requestId) {
    return { error: 'No request_id returned from research endpoint' };
  }

  // Step 2: Poll for completion
  let pollInterval = INITIAL_POLL_INTERVAL;
  let totalElapsed = 0;
  while (totalElapsed < maxPollDuration) {
    await sleep(pollInterval);
    totalElapsed += pollInterval;

    const pollResponse = await fetch(`${TAVILY_API_BASE}/research/${encodeURIComponent(requestId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    const pollText = await pollResponse.text();
    let pollBody: any;
    try {
      pollBody = JSON.parse(pollText);
    } catch {
      pollBody = {};
    }

    if (!pollResponse.ok && pollResponse.status !== 202) {
      const message = extractErrorMessage(pollBody) || pollResponse.statusText || `HTTP ${pollResponse.status}`;
      throw new TavilyError(message, pollResponse.status);
    }

    const status = pollBody?.status;
    if (status === 'completed') {
      return { content: pollBody?.content || '', sources: pollBody?.sources };
    }
    if (status === 'failed') {
      return { error: 'Research task failed' };
    }

    pollInterval = Math.min(pollInterval * POLL_BACKOFF_FACTOR, MAX_POLL_INTERVAL);
  }

  return { error: 'Research task timed out' };
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function handleTavilyResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      throw new TavilyError('Invalid API key', response.status);
    }
    if (response.status === 429) {
      throw new TavilyError('Rate limit exceeded', response.status);
    }

    let message = response.statusText;
    try {
      const body = JSON.parse(text);
      message = extractErrorMessage(body) || message || `HTTP ${response.status}`;
    } catch {}

    throw new TavilyError(message, response.status);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new TavilyError('Invalid JSON response', response.status);
  }
}

function extractErrorMessage(body: any): string | undefined {
  if (!body) return undefined;
  if (typeof body.detail === 'string' && body.detail) return body.detail;
  if (typeof body.detail?.error === 'string' && body.detail.error) return body.detail.error;
  if (typeof body.message === 'string' && body.message) return body.message;
  if (typeof body.error === 'string' && body.error) return body.error;
  return undefined;
}

export class TavilyError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'TavilyError';
  }
}
