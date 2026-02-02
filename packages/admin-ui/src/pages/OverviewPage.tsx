import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('overview');
  const { t: tc } = useTranslation('common');
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
      setError(typeof e?.message === 'string' ? e.message : tc('errors.unknownError'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [api, tc]);

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
                  label={t('kpi.tavilyKeys')}
                  value={kpis.totalKeys}
                  hint={t('kpi.keysHint', { active: kpis.activeKeys, unhealthy: kpis.unhealthyKeys })}
                  icon={<IconKey />}
                  variant="keys"
                  onClick={onGoToKeys}
                />
                <KpiCard
                  label={t('kpi.clientTokens')}
                  value={kpis.totalTokens}
                  hint={t('kpi.tokensHint', { active: kpis.activeTokens, revoked: kpis.revokedTokens })}
                  icon={<IconToken />}
                  variant="tokens"
                  onClick={onGoToTokens}
                />
                <KpiCard
                  label={t('kpi.usage')}
                  value={data?.usage?.length ?? 0}
                  hint={t('kpi.usageHint')}
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
                <div className="h2">{t('recentUsage.title')}</div>
                <div className="help">{t('recentUsage.subtitle')}</div>
              </div>
              <button className="btn" data-variant="ghost" onClick={onGoToUsage}>
                {t('actions.viewAll')}
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
              ariaLabel={t('recentUsage.title')}
              columns={(
                [
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
                    id: 'query',
                    header: t('table.query'),
                    dataLabel: t('table.query'),
                    cellClassName: 'mono',
                    cell: (row: TavilyToolUsageDto) => row.queryPreview ?? (row.queryHash ? `${row.queryHash.slice(0, 10)}…` : '—')
                  }
                ] satisfies DataTableColumn<TavilyToolUsageDto>[]
              )}
              rows={data?.usage ?? []}
              rowKey={(row) => row.id}
              loading={loading && !data}
              empty={<EmptyState message={t('empty.noUsage')} compact />}
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
