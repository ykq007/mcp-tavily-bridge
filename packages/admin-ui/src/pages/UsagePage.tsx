import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminApi, TavilyToolUsageDto, PaginationDto, TavilyToolUsageFilters, TavilyToolUsageSummaryDto } from '../lib/adminApi';
import { formatDateTime } from '../lib/format';
import { Dialog } from '../ui/Dialog';
import { IconRefresh, IconSearch } from '../ui/icons';
import { ErrorBanner } from '../ui/ErrorBanner';
import { Pagination } from '../ui/Pagination';
import { useDebounce } from '../lib/useDebounce';
import { EmptyState } from '../ui/EmptyState';
import { DataTable, type DataTableColumn } from '../ui/DataTable';

const PAGE_SIZE = 20;

export function UsagePage({ api }: { api: AdminApi }) {
  const { t } = useTranslation('usage');
  const { t: tc } = useTranslation('common');
  const [logs, setLogs] = useState<TavilyToolUsageDto[]>([]);
  const [summary, setSummary] = useState<TavilyToolUsageSummaryDto | null>(null);
  const [pagination, setPagination] = useState<PaginationDto>({
    totalItems: 0,
    totalPages: 0,
    currentPage: 1,
    limit: PAGE_SIZE
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TavilyToolUsageDto | null>(null);

  // Filters
  const [toolName, setToolName] = useState<string>('');
  const [outcome, setOutcome] = useState<string>('');
  const [clientTokenPrefix, setClientTokenPrefix] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  const debouncedTokenPrefix = useDebounce(clientTokenPrefix, 400);

  const filters = useMemo(() => {
    const f: TavilyToolUsageFilters = { page: currentPage, limit: PAGE_SIZE, order: 'desc' };
    if (toolName) f.toolName = toolName;
    if (outcome) f.outcome = outcome;
    if (debouncedTokenPrefix) f.clientTokenPrefix = debouncedTokenPrefix;
    if (dateFrom) f.dateFrom = new Date(dateFrom).toISOString();
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      f.dateTo = end.toISOString();
    }
    return f;
  }, [currentPage, toolName, outcome, debouncedTokenPrefix, dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, summaryResp] = await Promise.all([
        api.listUsage(filters),
        api.getUsageSummary({ dateFrom: filters.dateFrom, dateTo: filters.dateTo })
      ]);
      setLogs(list.logs);
      setPagination(list.pagination);
      setSummary(summaryResp);
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : tc('errors.unknownError'));
      setLogs([]);
      setPagination({ totalItems: 0, totalPages: 0, currentPage: 1, limit: PAGE_SIZE });
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [api, filters, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCurrentPage(1);
  }, [toolName, outcome, debouncedTokenPrefix, dateFrom, dateTo]);

  const toolOptions = useMemo(() => {
    const fromSummary = summary?.byTool?.map((t) => t.toolName) ?? [];
    const unique = Array.from(new Set(fromSummary));
    return unique.length ? unique : ['tavily_search', 'tavily_extract', 'tavily_crawl', 'tavily_map', 'tavily_research'];
  }, [summary]);

  const columns = useMemo(() => {
    return [
      {
        id: 'time',
        header: t('table.time'),
        headerStyle: { width: 170 },
        dataLabel: t('table.time'),
        cellClassName: 'mono',
        cell: (row: TavilyToolUsageDto) => formatDateTime(row.timestamp)
      },
      {
        id: 'tool',
        header: t('table.tool'),
        headerStyle: { width: 140 },
        dataLabel: t('table.tool'),
        cellClassName: 'mono',
        cell: (row: TavilyToolUsageDto) => row.toolName
      },
      {
        id: 'outcome',
        header: t('table.outcome'),
        headerStyle: { width: 120 },
        dataLabel: t('table.outcome'),
        cell: (row: TavilyToolUsageDto) => <OutcomeBadge outcome={row.outcome} />
      },
      {
        id: 'token',
        header: t('table.client'),
        headerStyle: { width: 160 },
        dataLabel: t('table.client'),
        cellClassName: 'mono',
        cell: (row: TavilyToolUsageDto) => row.clientTokenPrefix ?? '—'
      },
      {
        id: 'query',
        header: t('table.query'),
        dataLabel: t('table.query'),
        cellClassName: 'mono',
        cell: (row: TavilyToolUsageDto) => row.queryPreview ?? (row.queryHash ? `${row.queryHash.slice(0, 10)}…` : '—')
      },
      {
        id: 'latency',
        header: t('table.latency'),
        headerStyle: { width: 120, textAlign: 'right' },
        headerAlign: 'right',
        dataLabel: t('table.latency'),
        cellAlign: 'right',
        cellClassName: 'mono',
        cell: (row: TavilyToolUsageDto) => (typeof row.latencyMs === 'number' ? `${row.latencyMs}ms` : '—')
      }
    ] satisfies DataTableColumn<TavilyToolUsageDto>[];
  }, [t]);

  return (
    <div className="usagePage">
      <div className="card usagePageCard">
        <div className="cardHeader">
          <div className="row">
            <div>
              <div className="h2">{t('title')}</div>
              <div className="help">{t('subtitle')}</div>
            </div>
            <button className="btn" onClick={load} disabled={loading}>
              <IconRefresh className={loading ? 'spin' : ''} />
              {t('actions.refresh')}
            </button>
          </div>
        </div>

        <div className="cardBody">
          {error ? <ErrorBanner message={error} onRetry={load} retrying={loading} /> : null}

          <div className="grid2 gap-3">
            <div className="stack">
              <label htmlFor="usage-tool" className="label">
                {t('filters.tool')}
              </label>
              <select id="usage-tool" className="select" value={toolName} onChange={(e) => setToolName(e.target.value)}>
                <option value="">{t('filters.allTools')}</option>
                {toolOptions.map((tool) => (
                  <option key={tool} value={tool}>
                    {tool}
                  </option>
                ))}
              </select>
            </div>

            <div className="stack">
              <label htmlFor="usage-outcome" className="label">
                {t('filters.outcome')}
              </label>
              <select id="usage-outcome" className="select" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                <option value="">{t('filters.allOutcomes')}</option>
                <option value="success">{t('filters.success')}</option>
                <option value="error">{t('filters.error')}</option>
              </select>
            </div>

            <div className="stack">
              <label htmlFor="usage-client" className="label">
                {t('filters.clientTokenPrefix')}
              </label>
              <div className="searchInput">
                <div className="searchInputIcon">
                  <IconSearch />
                </div>
                <input
                  id="usage-client"
                  type="search"
                  className="input mono"
                  placeholder={t('filters.clientPlaceholder')}
                  value={clientTokenPrefix}
                  onChange={(e) => setClientTokenPrefix(e.target.value)}
                  style={{ paddingLeft: 40 }}
                />
              </div>
            </div>

            <div className="stack">
              <label htmlFor="usage-date-from" className="label">
                {t('filters.from')}
              </label>
              <input id="usage-date-from" type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>

            <div className="stack">
              <label htmlFor="usage-date-to" className="label">
                {t('filters.to')}
              </label>
              <input id="usage-date-to" type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          {summary ? (
            <div className="mt-4">
              <div className="help">
                {t('summary.totalEvents')} <span className="mono">{summary.total}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="cardBody p-0 usageTableScroller">
          <DataTable
            ariaLabel={t('title')}
            columns={columns}
            rows={logs}
            rowKey={(r) => r.id}
            loading={loading && logs.length === 0}
            getRowProps={(row) => ({
              onClick: () => setSelected(row),
              style: { cursor: 'pointer' }
            })}
            empty={<EmptyState message={t('empty.noEvents')} compact />}
          />
        </div>

        {pagination.totalPages > 1 ? (
          <div className="cardBody">
            <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} onPageChange={setCurrentPage} />
          </div>
        ) : null}
      </div>

      <Dialog
        title={t('dialog.title')}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        description={selected ? `${selected.toolName} • ${selected.outcome}` : undefined}
      >
        <div className="stack">
          <div className="grid2">
            <div className="stack">
              <div className="label">{t('dialog.time')}</div>
              <div className="mono">{selected ? formatDateTime(selected.timestamp) : ''}</div>
            </div>
            <div className="stack">
              <div className="label">{t('dialog.client')}</div>
              <div className="mono">{selected?.clientTokenPrefix ?? '—'}</div>
            </div>
            <div className="stack">
              <div className="label">{t('dialog.upstreamKey')}</div>
              <div className="mono">{selected?.upstreamKeyId ?? '—'}</div>
            </div>
            <div className="stack">
              <div className="label">{t('dialog.latency')}</div>
              <div className="mono">{typeof selected?.latencyMs === 'number' ? `${selected.latencyMs}ms` : '—'}</div>
            </div>
          </div>

          <div className="stack">
            <div className="label">{t('dialog.query')}</div>
            <div className="mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {selected?.queryPreview ?? '—'}
            </div>
            {selected?.queryHash ? <div className="help mono">{t('dialog.queryHash', { hash: selected.queryHash })}</div> : null}
          </div>

          {selected?.errorMessage ? (
            <div className="stack">
              <div className="label">{t('dialog.error')}</div>
              <div className="mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {selected.errorMessage}
              </div>
            </div>
          ) : null}

          <div className="stack">
            <div className="label">{t('dialog.args')}</div>
            <textarea className="textarea mono text-xs" readOnly value={JSON.stringify(selected?.argsJson ?? {}, null, 2)} rows={10} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const variant = outcome === 'success' ? 'success' : outcome === 'error' ? 'danger' : 'neutral';
  return (
    <span className="badge mono" data-variant={variant}>
      {outcome}
    </span>
  );
}
