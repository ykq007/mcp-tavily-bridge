export type BraveWebSearchParams = { query: string; count?: number; offset?: number } & Record<string, unknown>;
export type BraveLocalSearchParams = { query: string; count?: number } & Record<string, unknown>;

export type BraveWebSearchResult = {
  title: string;
  url: string;
  description?: string;
};

export type BraveLocalSearchResult = {
  title: string;
  url: string;
  description?: string;
};

export type BraveClient = {
  webSearch(
    params: BraveWebSearchParams,
    opts?: { defaults?: Record<string, unknown>; maxWaitMs?: number }
  ): Promise<unknown>;
  localSearch(
    params: BraveLocalSearchParams,
    opts?: { defaults?: Record<string, unknown>; maxWaitMs?: number }
  ): Promise<unknown>;
};

