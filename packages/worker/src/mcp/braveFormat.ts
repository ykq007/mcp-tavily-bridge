export interface SearchResult {
  title: string;
  url: string;
  description?: string;
}

export function extractBraveWebResults(response: any): SearchResult[] {
  const webResults = response?.web?.results ?? response?.results ?? [];
  return webResults
    .map((r: any) => ({
      title: String(r?.title ?? ''),
      url: String(r?.url ?? ''),
      description: String(r?.description ?? r?.snippet ?? '') || undefined
    }))
    .filter((r: SearchResult) => r.url); // Filter out results without URL
}

export function extractBraveLocalResults(response: any): SearchResult[] {
  const localResults = response?.local?.results ?? response?.results ?? response?.web?.results ?? [];
  return localResults
    .map((r: any) => ({
      title: String(r?.title ?? r?.name ?? ''),
      url: String(r?.url ?? r?.website ?? ''),
      description: String(r?.description ?? r?.snippet ?? '') || undefined
    }))
    .filter((r: SearchResult) => r.url); // Filter out results without URL
}
