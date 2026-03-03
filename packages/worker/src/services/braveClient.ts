/**
 * Brave Search API HTTP client for Cloudflare Workers
 */

const BRAVE_API_BASE = 'https://api.search.brave.com/res/v1';

interface BraveWebSearchResult {
  type: 'search';
  query: {
    original: string;
    show_strict_warning: boolean;
    altered?: string;
  };
  web?: {
    type: 'search';
    results: Array<{
      title: string;
      url: string;
      description: string;
      is_source_local?: boolean;
      is_source_both?: boolean;
      family_friendly?: boolean;
    }>;
    family_friendly?: boolean;
  };
  mixed?: {
    type: 'mixed';
    main: Array<{
      type: string;
      index?: number;
      all?: boolean;
    }>;
  };
}

interface BraveLocalSearchResult {
  type: 'search';
  query: {
    original: string;
  };
  locations?: {
    results: Array<{
      id: string;
      name: string;
      address?: {
        streetAddress?: string;
        addressLocality?: string;
        addressRegion?: string;
        postalCode?: string;
      };
      phone?: string;
      rating?: {
        ratingValue: number;
        ratingCount: number;
      };
    }>;
  };
}

export async function braveWebSearch(
  apiKey: string,
  params: {
    query: string;
    count?: number;
    offset?: number;
    country?: string;
    search_lang?: string;
    ui_lang?: string;
    safesearch?: 'off' | 'moderate' | 'strict';
    freshness?: string;
    text_decorations?: boolean;
    spellcheck?: boolean;
    result_filter?: string;
  }
): Promise<BraveWebSearchResult> {
  const url = new URL(`${BRAVE_API_BASE}/web/search`);

  // Build query params
  url.searchParams.set('q', params.query);
  if (params.count !== undefined) url.searchParams.set('count', String(Math.min(20, Math.max(1, params.count))));
  if (params.offset !== undefined) url.searchParams.set('offset', String(Math.min(9, Math.max(0, params.offset))));
  if (params.country) url.searchParams.set('country', params.country);
  if (params.search_lang) url.searchParams.set('search_lang', params.search_lang);
  if (params.ui_lang) url.searchParams.set('ui_lang', params.ui_lang);
  if (params.safesearch) url.searchParams.set('safesearch', params.safesearch);
  if (params.freshness) url.searchParams.set('freshness', params.freshness);
  if (params.text_decorations !== undefined) url.searchParams.set('text_decorations', String(params.text_decorations));
  if (params.spellcheck !== undefined) url.searchParams.set('spellcheck', String(params.spellcheck));
  if (params.result_filter) url.searchParams.set('result_filter', params.result_filter);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': apiKey
    }
  });

  return handleBraveResponse(response);
}

export async function braveLocalSearch(
  apiKey: string,
  params: {
    query: string;
    count?: number;
  }
): Promise<BraveLocalSearchResult> {
  // Brave local search falls back to web search for most plans
  const url = new URL(`${BRAVE_API_BASE}/web/search`);

  url.searchParams.set('q', params.query);
  if (params.count !== undefined) url.searchParams.set('count', String(Math.min(20, Math.max(1, params.count))));
  url.searchParams.set('result_filter', 'locations');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': apiKey
    }
  });

  return handleBraveResponse(response);
}

async function handleBraveResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new BraveError('Invalid API key', response.status);
    }
    if (response.status === 429) {
      throw new BraveError('Rate limit exceeded', response.status);
    }

    let message = response.statusText;
    try {
      const body = JSON.parse(text);
      if (body.message) message = body.message;
    } catch {}

    throw new BraveError(message, response.status);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new BraveError('Invalid JSON response', response.status);
  }
}

export class BraveError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'BraveError';
  }
}
