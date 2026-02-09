export type TavilyKeyStatus = 'active' | 'disabled' | 'cooldown' | 'invalid';
export type BraveKeyStatus = 'active' | 'disabled' | 'invalid';
export type SearchSourceMode = 'tavily_only' | 'brave_only' | 'combined' | 'brave_prefer_tavily_fallback';

export type TavilyKeyDto = {
  id: string;
  label: string;
  maskedKey: string | null;
  status: TavilyKeyStatus;
  cooldownUntil: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  remainingCredits: number | null;
  totalCredits: number | null;
  lastCheckedAt: string | null;
};

export type ClientTokenDto = {
  id: string;
  tokenPrefix: string;
  description: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type BraveKeyDto = {
  id: string;
  label: string;
  maskedKey: string | null;
  status: BraveKeyStatus;
  lastUsedAt: string | null;
  createdAt: string;
};

export type TavilyToolUsageDto = {
  id: string;
  timestamp: string;
  toolName: string;
  outcome: string;
  latencyMs: number | null;
  clientTokenId: string;
  clientTokenPrefix: string | null;
  upstreamKeyId: string | null;
  queryHash: string | null;
  queryPreview: string | null;
  argsJson: unknown;
  errorMessage: string | null;
};

export type PaginationDto = {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  limit: number;
};

export type TavilyToolUsageResponseDto = {
  logs: TavilyToolUsageDto[];
  pagination: PaginationDto;
};

export type TavilyToolUsageFilters = {
  page?: number;
  limit?: number;
  toolName?: string;
  outcome?: string;
  clientTokenPrefix?: string;
  queryHash?: string;
  dateFrom?: string;
  dateTo?: string;
  order?: 'asc' | 'desc';
};

export type TavilyToolUsageSummaryDto = {
  total: number;
  byTool: { toolName: string; count: number }[];
  topQueries: { queryHash: string | null; queryPreview: string | null; count: number }[];
};

export type MetricsDto = {
  requestsPerMinute: number;
  requestsPerHour: number;
  activeTokens: number;
  keyPool: {
    total: number;
    active: number;
    unhealthy: number;
    tavily: {
      total: number;
      active: number;
      cooldown: number;
      invalid: number;
    };
    brave: {
      total: number;
      active: number;
      invalid: number;
    };
  };
  recentErrors: Array<{
    id: string;
    toolName: string;
    errorMessage: string | null;
    timestamp: string;
  }>;
  timestamp: string;
};

export type ServerInfoDto = {
  tavilyKeySelectionStrategy: 'round_robin' | 'random';
  searchSourceMode: SearchSourceMode;
  braveSearchEnabled: boolean;
};

export type CostEstimateDto = {
  period: {
    from: string;
    to: string;
  };
  tavily: {
    totalCredits: number;
    breakdown: Array<{
      toolName: string;
      count: number;
      creditCost: number;
      totalCredits: number;
    }>;
  };
  brave: {
    totalRequests: number;
    estimatedCostUsd: number;
    breakdown: Array<{
      toolName: string;
      count: number;
    }>;
  };
  summary: {
    tavilyCreditsUsed: number;
    braveRequestsMade: number;
    braveEstimatedCostUsd: number;
  };
};

export type KeyExportDto = {
  schemaVersion: 1;
  exportedAt: string;
  tavily: Array<{
    id: string;
    label: string;
    apiKey: string;
    maskedKey: string | null;
    status: TavilyKeyStatus;
    cooldownUntil: string | null;
    lastUsedAt: string | null;
    createdAt: string;
    [key: string]: any;
  }>;
  brave: Array<{
    id: string;
    label: string;
    apiKey: string;
    maskedKey: string | null;
    status: BraveKeyStatus;
    lastUsedAt: string | null;
    createdAt: string;
    [key: string]: any;
  }>;
};

export type BatchImportResult = {
  ok: boolean;
  summary: {
    tavily: { total: number; imported: number; failed: number; renamed: number };
    brave: { total: number; imported: number; failed: number; renamed: number };
    total: number;
    imported: number;
    failed: number;
    renamed: number;
  };
  renamed: Array<{ provider: 'tavily' | 'brave'; from: string; to: string }>;
  errors: Array<{ provider: 'tavily' | 'brave'; index: number; label: string; error: string }>;
};

export type AdminApiConfig = {
  baseUrl: string;
  adminToken: string;
};

export class AdminApiError extends Error {
  readonly status: number;

  constructor(message: string, opts: { status: number }) {
    super(message);
    this.name = 'AdminApiError';
    this.status = opts.status;
  }
}

export type AdminApi = {
  getServerInfo: () => Promise<ServerInfoDto>;
  updateServerInfo: (input: Partial<Pick<ServerInfoDto, 'tavilyKeySelectionStrategy' | 'searchSourceMode'>>) => Promise<ServerInfoDto & { ok: true }>;

  getMetrics: () => Promise<MetricsDto>;

  listKeys: () => Promise<TavilyKeyDto[]>;
  createKey: (input: { label: string; apiKey: string }) => Promise<{ id: string }>;
  revealKey: (id: string) => Promise<{ apiKey: string }>;
  updateKeyStatus: (id: string, status: TavilyKeyStatus) => Promise<{ ok: true }>;
  deleteKey: (id: string) => Promise<{ ok: true }>;
  refreshKeyCredits: (id: string) => Promise<{ remainingCredits: number; totalCredits: number }>;
  syncAllKeyCredits: () => Promise<{ ok: true; total: number; success: number; failed: number }>;

  listBraveKeys: () => Promise<BraveKeyDto[]>;
  createBraveKey: (input: { label: string; apiKey: string }) => Promise<{ id: string }>;
  revealBraveKey: (id: string) => Promise<{ apiKey: string }>;
  updateBraveKeyStatus: (id: string, status: BraveKeyStatus) => Promise<{ ok: true }>;
  deleteBraveKey: (id: string) => Promise<{ ok: true }>;

  listTokens: () => Promise<ClientTokenDto[]>;
  createToken: (input: { description?: string; expiresInSeconds?: number }) => Promise<{ id: string; token: string }>;
  revokeToken: (id: string) => Promise<{ ok: true }>;
  deleteToken: (id: string) => Promise<{ ok: true }>;

  listUsage: (filters?: TavilyToolUsageFilters) => Promise<TavilyToolUsageResponseDto>;
  getUsageSummary: (filters?: { dateFrom?: string; dateTo?: string }) => Promise<TavilyToolUsageSummaryDto>;
  getCostEstimate: (filters?: { dateFrom?: string; dateTo?: string }) => Promise<CostEstimateDto>;

  exportKeys: () => Promise<KeyExportDto>;
  importKeys: (payload: KeyExportDto) => Promise<BatchImportResult>;
};

export function createAdminApi(
  config: AdminApiConfig,
  opts: {
    fetchImpl?: typeof fetch;
    onAuthFailure?: () => void;
  } = {}
): AdminApi {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(config.baseUrl);

  function isProbablyHtmlResponse(res: Response, text: string): boolean {
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    if (contentType.includes('text/html')) return true;
    const trimmed = text.trimStart().toLowerCase();
    return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html');
  }

  async function parseOrThrow(res: Response): Promise<any> {
    const text = await res.text();
    if (!res.ok && isProbablyHtmlResponse(res, text)) {
      throw new AdminApiError(
        `Server returned an HTML error page (HTTP ${res.status}). This usually means the backend threw an exception or the request was routed to an error page. Check the server logs and verify env vars (DATABASE_URL, ADMIN_API_TOKEN, KEY_ENCRYPTION_SECRET).`,
        { status: res.status }
      );
    }
    const body = safeJson(text);
    if (res.ok) return body;

    if (res.status === 401) {
      try {
        opts.onAuthFailure?.();
      } catch {
        // best-effort; auth failure should still surface
      }
      throw new AdminApiError('Unauthorized (401): token must match server ADMIN_API_TOKEN', { status: 401 });
    }

    if (res.status === 404) {
      throw new AdminApiError('Not found (404): check Admin API base URL and that /admin/api routes exist', { status: 404 });
    }

    const message =
      typeof body?.error === 'string'
        ? body.error
        : typeof body?.message === 'string'
          ? body.message
          : res.statusText || `HTTP ${res.status}`;

    throw new AdminApiError(message, { status: res.status });
  }

  async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(buildAdminUrl(baseUrl, path), {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          authorization: `Bearer ${config.adminToken}`,
          'content-type': 'application/json'
        }
      });
    } catch (err: unknown) {
      const reason = typeof (err as any)?.message === 'string' ? ` (${(err as any).message})` : '';
      throw new AdminApiError(
        `Network error: could not reach Admin API. In local dev, enable the Vite /admin/api proxy or set Settings → Admin API base URL to http://127.0.0.1:8787.${reason}`,
        { status: 0 }
      );
    }
    return parseOrThrow(res);
  }

  async function getJson<T>(path: string): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(buildAdminUrl(baseUrl, path), {
        method: 'GET',
        headers: { authorization: `Bearer ${config.adminToken}` }
      });
    } catch (err: unknown) {
      const reason = typeof (err as any)?.message === 'string' ? ` (${(err as any).message})` : '';
      throw new AdminApiError(
        `Network error: could not reach Admin API. In local dev, enable the Vite /admin/api proxy or set Settings → Admin API base URL to http://127.0.0.1:8787.${reason}`,
        { status: 0 }
      );
    }
    return parseOrThrow(res);
  }

  return {
    getServerInfo: () => getJson('/admin/api/server-info'),
    updateServerInfo: (input) => requestJson('/admin/api/server-info', { method: 'PATCH', body: JSON.stringify(input) }),

    getMetrics: () => getJson('/admin/api/metrics'),

    listKeys: () => getJson('/admin/api/keys'),
    createKey: (input) => requestJson('/admin/api/keys', { method: 'POST', body: JSON.stringify(input) }),
    revealKey: (id) => getJson(`/admin/api/keys/${encodeURIComponent(id)}/reveal`),
    updateKeyStatus: (id, status) =>
      requestJson(`/admin/api/keys/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    deleteKey: (id) => requestJson(`/admin/api/keys/${encodeURIComponent(id)}`, { method: 'DELETE', body: '{}' }),
    refreshKeyCredits: (id) => requestJson(`/admin/api/keys/${encodeURIComponent(id)}/refresh-credits`, { method: 'POST', body: '{}' }),
    syncAllKeyCredits: () => requestJson('/admin/api/keys/sync-credits', { method: 'POST', body: '{}' }),

    listBraveKeys: () => getJson('/admin/api/brave-keys'),
    createBraveKey: (input) => requestJson('/admin/api/brave-keys', { method: 'POST', body: JSON.stringify(input) }),
    revealBraveKey: (id) => getJson(`/admin/api/brave-keys/${encodeURIComponent(id)}/reveal`),
    updateBraveKeyStatus: (id, status) =>
      requestJson(`/admin/api/brave-keys/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    deleteBraveKey: (id) => requestJson(`/admin/api/brave-keys/${encodeURIComponent(id)}`, { method: 'DELETE', body: '{}' }),

    listTokens: () => getJson('/admin/api/tokens'),
    createToken: (input) => requestJson('/admin/api/tokens', { method: 'POST', body: JSON.stringify(input) }),
    revokeToken: (id) => requestJson(`/admin/api/tokens/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: '{}' }),
    deleteToken: (id) => requestJson(`/admin/api/tokens/${encodeURIComponent(id)}`, { method: 'DELETE', body: '{}' }),

    listUsage: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', filters.page.toString());
      if (filters.limit) params.set('limit', filters.limit.toString());
      if (filters.toolName) params.set('toolName', filters.toolName);
      if (filters.outcome) params.set('outcome', filters.outcome);
      if (filters.clientTokenPrefix) params.set('clientTokenPrefix', filters.clientTokenPrefix);
      if (filters.queryHash) params.set('queryHash', filters.queryHash);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.order) params.set('order', filters.order);

      const queryString = params.toString();
      const path = queryString ? `/admin/api/usage?${queryString}` : '/admin/api/usage';
      return getJson(path);
    },

    getUsageSummary: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      const queryString = params.toString();
      const path = queryString ? `/admin/api/usage/summary?${queryString}` : '/admin/api/usage/summary';
      return getJson(path);
    },

    getCostEstimate: (filters = {}) => {
      const params = new URLSearchParams();
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      const queryString = params.toString();
      const path = queryString ? `/admin/api/cost-estimate?${queryString}` : '/admin/api/cost-estimate';
      return getJson(path);
    },

    exportKeys: () => getJson('/admin/api/keys/export'),
    importKeys: (payload) => requestJson('/admin/api/keys/import', { method: 'POST', body: JSON.stringify(payload) })
  };
}

export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
}

export function buildAdminUrl(baseUrl: string, path: string): string {
  if (!path.startsWith('/')) {
    throw new Error(`path must start with '/': ${path}`);
  }
  return baseUrl ? `${baseUrl}${path}` : path;
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
