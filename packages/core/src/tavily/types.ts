export type TavilySearchParams = Record<string, unknown>;
export type TavilyExtractParams = Record<string, unknown>;
export type TavilyCrawlParams = Record<string, unknown>;
export type TavilyMapParams = Record<string, unknown>;
export type TavilyResearchParams = { input: string; model?: 'mini' | 'pro' | 'auto' } & Record<string, unknown>;

export type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
  favicon?: string;
};

export type TavilySearchResponse = {
  answer?: string;
  results: TavilySearchResult[];
  images?: Array<string | { url: string; description?: string }>;
};

export type TavilyExtractResponse = TavilySearchResponse;

export type TavilyCrawlResponse = {
  base_url: string;
  results: Array<{ url: string; raw_content?: string; favicon?: string }>;
};

export type TavilyMapResponse = {
  base_url: string;
  results: string[];
};

export type TavilyResearchResponse = { content?: string; error?: string };

export type TavilyDefaultParametersProvider = (ctx: unknown) => Record<string, unknown>;

export type TavilyClient = {
  search(params: TavilySearchParams, opts: { defaults: Record<string, unknown> }): Promise<TavilySearchResponse>;
  extract(params: TavilyExtractParams): Promise<TavilyExtractResponse>;
  crawl(params: TavilyCrawlParams): Promise<TavilyCrawlResponse>;
  map(params: TavilyMapParams): Promise<TavilyMapResponse>;
  research(params: TavilyResearchParams): Promise<TavilyResearchResponse>;
};
