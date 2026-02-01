import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminApi, ClientTokenDto, TavilyKeyDto, TavilyToolUsageDto } from '../lib/adminApi';
import { formatDateTime } from '../lib/format';
import { IconKey, IconRefresh, IconSearch, IconToken } from '../ui/icons';
import { KpiCard } from '../ui/KpiCard';
import { ErrorBanner } from '../ui/ErrorBanner';
import { EmptyState } from '../ui/EmptyState';
import { DataTable, type DataTableColumn } from '../ui/DataTable';

type OverviewData = {
  keys: TavilyKeyDto[];
  tokens: ClientTokenDto[];
  usage: TavilyToolUsageDto[];
};

export function OverviewPage({
  api,
  onGoToKeys,
  onGoToTokens,
  onGoToUsage
}: {
  api: AdminApi;
  onGoToKeys: () => void;
  onGoToTokens: () => void;
  onGoToUsage: () => void;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [keys, tokens, usageResponse] = await Promise.all([
        api.listKeys(),
        api.listTokens(),
        api.listUsage({ limit: 10, order: 'desc' })
      ]);
      setData({ keys, tokens, usage: usageResponse.logs });
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Failed to load overview');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    const keys = data?.keys ?? [];
    const tokens = data?.tokens ?? [];

    const activeKeys = keys.filter((k) => k.status === 'active').length;
    const unhealthyKeys = keys.filter((k) => k.status === 'invalid' || k.status === 'cooldown').length;

    const activeTokens = tokens.filter((t) => !t.revokedAt).length;
    const revokedTokens = tokens.filter((t) => Boolean(t.revokedAt)).length;

    return {
      totalKeys: keys.length,
      activeKeys,
      unhealthyKeys,
      totalTokens: tokens.length,
      activeTokens,
      revokedTokens
    };
  }, [data]);

  return (
    <div className="stack">
      <div className="card">
        <div className="cardHeader">
          <div className="row">
            <div>
              <div className="h2">Overview</div>
              <div className="help">Keys, client tokens, and recent Tavily usage</div>
            </div>
            <button className="btn" onClick={load} disabled={loading}>
              <IconRefresh className={loading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
        <div className="cardBody">
          {error ? (
            <ErrorBanner message={error} onRetry={load} retrying={loading} />
          ) : null}

          <div className="kpis mt-2">
            {loading && !data ? (
              <>
                <div className="skeleton skeletonKpi" />
                <div className="skeleton skeletonKpi" />
                <div className="skeleton skeletonKpi" />
              </>
            ) : (
              <>
                <KpiCard
                  label="Tavily keys"
                  value={kpis.totalKeys}
                  hint={`${kpis.activeKeys} active • ${kpis.unhealthyKeys} cooldown/invalid`}
                  icon={<IconKey />}
                  variant="keys"
                  onClick={onGoToKeys}
                />
                <KpiCard
                  label="Client tokens"
                  value={kpis.totalTokens}
                  hint={`${kpis.activeTokens} active • ${kpis.revokedTokens} revoked`}
                  icon={<IconToken />}
                  variant="tokens"
                  onClick={onGoToTokens}
                />
                <KpiCard
                  label="Usage"
                  value={data?.usage?.length ?? 0}
                  hint="Last 10 events"
                  icon={<IconSearch />}
                  variant="usage"
                  onClick={onGoToUsage}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="overviewBentoRow">
        <div className="card">
          <div className="cardHeader">
            <div className="row">
              <div>
                <div className="h2">Recent usage</div>
                <div className="help">Newest first</div>
              </div>
              <button className="btn" data-variant="ghost" onClick={onGoToUsage}>
                View all
              </button>
            </div>
          </div>
          <div className="cardBody p-0">
            {loading && !data ? (
              <div className="p-4">
                <div className="skeleton skeletonTableRow" />
                <div className="skeleton skeletonTableRow" />
                <div className="skeleton skeletonTableRow" />
              </div>
            ) : (
            <DataTable
              ariaLabel="Recent Tavily usage"
              columns={(
                [
                  {
                    id: 'time',
                    header: 'Time',
                    headerStyle: { width: 170 },
                    dataLabel: 'Time',
                    cellClassName: 'mono',
                    cell: (row: TavilyToolUsageDto) => formatDateTime(row.timestamp)
                  },
                  {
                    id: 'tool',
                    header: 'Tool',
                    headerStyle: { width: 140 },
                    dataLabel: 'Tool',
                    cellClassName: 'mono',
                    cell: (row: TavilyToolUsageDto) => row.toolName
                  },
                  {
                    id: 'outcome',
                    header: 'Outcome',
                    headerStyle: { width: 120 },
                    dataLabel: 'Outcome',
                    cell: (row: TavilyToolUsageDto) => <OutcomeBadge outcome={row.outcome} />
                  },
                  {
                    id: 'query',
                    header: 'Query',
                    dataLabel: 'Query',
                    cellClassName: 'mono',
                    cell: (row: TavilyToolUsageDto) => row.queryPreview ?? (row.queryHash ? `${row.queryHash.slice(0, 10)}…` : '—')
                  }
                ] satisfies DataTableColumn<TavilyToolUsageDto>[]
              )}
              rows={data?.usage ?? []}
              rowKey={(row) => row.id}
              loading={loading && !data}
              empty={<EmptyState message="No usage yet." compact />}
            />
            )}
          </div>
        </div>
      </div>
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
