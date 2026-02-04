export type SearchSourceMode =
  | 'tavily_only'
  | 'brave_only'
  | 'combined'
  | 'brave_prefer_tavily_fallback';

const VALID_MODES: SearchSourceMode[] = [
  'tavily_only',
  'brave_only',
  'combined',
  'brave_prefer_tavily_fallback'
];

export function parseSearchSourceMode(
  raw: unknown,
  fallback: SearchSourceMode = 'brave_prefer_tavily_fallback'
): SearchSourceMode {
  if (typeof raw !== 'string') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (VALID_MODES.includes(normalized as SearchSourceMode)) {
    return normalized as SearchSourceMode;
  }
  return fallback;
}
