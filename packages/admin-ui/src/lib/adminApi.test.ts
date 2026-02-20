import { describe, expect, it, vi } from 'vitest';
import { AdminApiError, buildAdminUrl, createAdminApi, normalizeBaseUrl } from './adminApi';

function jsonResponse(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function htmlResponse(status: number, body: string) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html' }
  });
}

describe('adminApi', () => {
  it('normalizes baseUrl', () => {
    expect(normalizeBaseUrl('')).toBe('');
    expect(normalizeBaseUrl('  http://x/  ')).toBe('http://x');
    expect(normalizeBaseUrl('http://x////')).toBe('http://x');
  });

  it('builds URLs', () => {
    expect(buildAdminUrl('', '/admin/api/keys')).toBe('/admin/api/keys');
    expect(buildAdminUrl('http://127.0.0.1:8787', '/admin/api/keys')).toBe('http://127.0.0.1:8787/admin/api/keys');
    expect(() => buildAdminUrl('', 'admin/keys')).toThrow(/must start/);
  });

  it('adds Bearer auth header on GET', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, []));
    const api = createAdminApi({ baseUrl: '', adminToken: 't0k' }, { fetchImpl: fetchImpl as any });

    await api.listKeys();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as any[];
    expect(init.method).toBe('GET');
    expect(init.headers.authorization).toBe('Bearer t0k');
  });

  it('fetches server-info', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { tavilyKeySelectionStrategy: 'round_robin' }));
    const api = createAdminApi({ baseUrl: '', adminToken: 't0k' }, { fetchImpl: fetchImpl as any });

    const info = await api.getServerInfo();
    expect(info).toEqual({ tavilyKeySelectionStrategy: 'round_robin' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as any[];
    expect(url).toBe('/admin/api/server-info');
    expect(init.method).toBe('GET');
    expect(init.headers.authorization).toBe('Bearer t0k');
  });

  it('updates server-info', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { ok: true, tavilyKeySelectionStrategy: 'random' }));
    const api = createAdminApi({ baseUrl: '', adminToken: 't0k' }, { fetchImpl: fetchImpl as any });

    const updated = await api.updateServerInfo({ tavilyKeySelectionStrategy: 'random' });
    expect(updated).toEqual({ ok: true, tavilyKeySelectionStrategy: 'random' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as any[];
    expect(url).toBe('/admin/api/server-info');
    expect(init.method).toBe('PATCH');
    expect(init.headers.authorization).toBe('Bearer t0k');
  });

  it('throws AdminApiError with body.error when non-2xx', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(400, { error: 'bad request' }));
    const api = createAdminApi({ baseUrl: '', adminToken: 't0k' }, { fetchImpl: fetchImpl as any });

    await expect(api.createKey({ label: '', apiKey: '' })).rejects.toMatchObject({
      name: 'AdminApiError',
      message: 'bad request',
      status: 400
    } as Partial<AdminApiError>);
  });

  it('maps 401 to a clearer message', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, { error: 'Unauthorized' }));
    const onAuthFailure = vi.fn();
    const api = createAdminApi({ baseUrl: '', adminToken: 'wrong' }, { fetchImpl: fetchImpl as any, onAuthFailure });

    await expect(api.listTokens()).rejects.toMatchObject({
      name: 'AdminApiError',
      message: 'Unauthorized (401): token must match server ADMIN_API_TOKEN',
      status: 401
    } as Partial<AdminApiError>);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it('maps 404 to actionable guidance', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(404, { error: 'Not found' }));
    const api = createAdminApi({ baseUrl: '', adminToken: 't0k' }, { fetchImpl: fetchImpl as any });

    await expect(api.listUsage()).rejects.toMatchObject({
      name: 'AdminApiError',
      message: 'Not found (404): check Admin API base URL and that /admin/api routes exist',
      status: 404
    } as Partial<AdminApiError>);
  });

  it('summarizes HTML error pages instead of surfacing raw HTML', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse(500, '<!DOCTYPE html><title>Internal Server Error</title>'));
    const api = createAdminApi({ baseUrl: '', adminToken: 't0k' }, { fetchImpl: fetchImpl as any });

    await expect(api.listKeys()).rejects.toMatchObject({
      name: 'AdminApiError',
      status: 500
    } as Partial<AdminApiError>);
    await expect(api.listKeys()).rejects.toThrow(/HTML error page/i);
  });

  it('normalizes fetch failures into AdminApiError with status 0', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('TypeError: Failed to fetch');
    });
    const api = createAdminApi({ baseUrl: '', adminToken: 't0k' }, { fetchImpl: fetchImpl as any });

    await expect(api.listKeys()).rejects.toMatchObject({
      name: 'AdminApiError',
      status: 0
    } as Partial<AdminApiError>);
  });

  it('syncAllKeyCredits posts and returns totals', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { ok: true, total: 3, success: 2, failed: 1 }));
    const api = createAdminApi({ baseUrl: '', adminToken: 't0k' }, { fetchImpl: fetchImpl as any });

    const res = await api.syncAllKeyCredits();
    expect(res).toEqual({ ok: true, total: 3, success: 2, failed: 1 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as any[];
    expect(url).toBe('/admin/api/keys/sync-credits');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer t0k');
  });
});
