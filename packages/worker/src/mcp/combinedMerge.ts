export interface SearchResult {
  title: string;
  url: string;
  description?: string;
}

export function mergeAndDedupe(opts: {
  tavily: SearchResult[];
  brave: SearchResult[];
  count?: number;
}): SearchResult[] {
  const { tavily, brave, count } = opts;
  const seenUrls = new Set<string>();
  const merged: SearchResult[] = [];

  const maxLen = Math.max(tavily.length, brave.length);
  for (let i = 0; i < maxLen; i++) {
    // Interleave: Tavily first
    if (i < tavily.length) {
      const r = tavily[i];
      if (r.url && !seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        merged.push(r);
      }
    }

    // Then Brave
    if (i < brave.length) {
      const r = brave[i];
      if (r.url && !seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        merged.push(r);
      }
    }
  }

  return count ? merged.slice(0, count) : merged;
}
