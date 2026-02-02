import type { TavilySearchResponse } from '../tavily/types.js';
import type { BraveLocalSearchResult, BraveWebSearchResult } from './types.js';

export function formatBraveWebResultsV0100(response: unknown): string {
  const results = extractWebResults(response);
  return JSON.stringify(results, null, 2);
}

export function formatBraveLocalResultsV0100(response: unknown): string {
  const results = extractLocalResults(response);
  return JSON.stringify(results, null, 2);
}

export function formatBraveWebResultsFromTavilyV0100(response: TavilySearchResponse): string {
  const mapped: BraveWebSearchResult[] = (response.results ?? []).map((r) => ({
    title: safeString((r as any).title),
    url: safeString((r as any).url),
    description: safeString((r as any).content) || undefined
  }));
  return JSON.stringify(mapped, null, 2);
}

function extractWebResults(response: unknown): BraveWebSearchResult[] {
  const candidates =
    (Array.isArray((response as any)?.results) && (response as any).results) ||
    (Array.isArray((response as any)?.web?.results) && (response as any).web.results) ||
    [];

  if (!Array.isArray(candidates)) return [];

  return candidates
    .map((r: any) => ({
      title: safeString(r?.title),
      url: safeString(r?.url),
      description: safeString(r?.description ?? r?.snippet ?? r?.content) || undefined
    }))
    .filter((r) => r.title || r.url);
}

function extractLocalResults(response: unknown): BraveLocalSearchResult[] {
  const candidates =
    (Array.isArray((response as any)?.local?.results) && (response as any).local.results) ||
    (Array.isArray((response as any)?.results) && (response as any).results) ||
    (Array.isArray((response as any)?.web?.results) && (response as any).web.results) ||
    [];

  if (!Array.isArray(candidates)) return [];

  return candidates
    .map((r: any) => ({
      title: safeString(r?.title ?? r?.name),
      url: safeString(r?.url ?? r?.website),
      description: safeString(r?.description ?? r?.snippet ?? r?.content) || undefined
    }))
    .filter((r) => r.title || r.url);
}

function safeString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

