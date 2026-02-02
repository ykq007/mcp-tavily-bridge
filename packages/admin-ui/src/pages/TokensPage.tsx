import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { AdminApi, ClientTokenDto } from '../lib/adminApi';
import { formatDateTime, formatRelativeSeconds } from '../lib/format';
import { MCP_SETUP_TARGETS, resolveMcpUrl } from '../app/mcpSetupTemplates';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CopyButton } from '../ui/CopyButton';
import { Dialog } from '../ui/Dialog';
import { Drawer } from '../ui/Drawer';
import { IconPlus, IconRefresh, IconToken } from '../ui/icons';
import { Pagination } from '../ui/Pagination';
import { useToast } from '../ui/toast';
import { ErrorBanner } from '../ui/ErrorBanner';
import { EmptyState } from '../ui/EmptyState';
import { DataTable, type DataTableColumn } from '../ui/DataTable';

const PAGE_SIZE = 10;

export function TokensPage({ api, apiBaseUrl }: { api: AdminApi; apiBaseUrl: string }) {
  const { t } = useTranslation('tokens');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tokens, setTokens] = useState<ClientTokenDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [description, setDescription] = useState('');
  const [expiresInSeconds, setExpiresInSeconds] = useState<number | ''>('');

  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [setupClientToken, setSetupClientToken] = useState('');
  const [activeTargetId, setActiveTargetId] = useState(() => MCP_SETUP_TARGETS[0]?.id ?? 'http-curl');

  const [tokenToDelete, setTokenToDelete] = useState<ClientTokenDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);

  const createFromUrl = searchParams.get('create');
  const setupFromUrl = searchParams.get('setup');
  useEffect(() => {
    if (createFromUrl === '1') {
      setCreateOpen(true);
      const next = new URLSearchParams(searchParams.toString());
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
    if (setupFromUrl === '1') {
      setDrawerOpen(true);
      const next = new URLSearchParams(searchParams.toString());
      next.delete('setup');
      setSearchParams(next, { replace: true });
    }
  }, [createFromUrl, searchParams, setSearchParams, setupFromUrl]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const mcpUrl = useMemo(() => resolveMcpUrl({ apiBaseUrl, origin }), [apiBaseUrl, origin]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTokens(await api.listTokens());
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : tc('errors.unknownError'));
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }, [api, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const active = tokens.filter((tok) => !tok.revokedAt).length;
    return { active, total: tokens.length };
  }, [tokens]);

  // Paginated tokens
  const paginatedTokens = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return tokens.slice(start, start + PAGE_SIZE);
  }, [tokens, page]);

  async function onCreate() {
    setCreating(true);
    try {
      const res = await api.createToken({
        description: description.trim() ? description.trim() : undefined,
        expiresInSeconds: typeof expiresInSeconds === 'number' ? expiresInSeconds : undefined
      });
      setCreateOpen(false);
      setCreatedToken(res.token);
      setSetupClientToken(res.token);
      setDescription('');
      setExpiresInSeconds('');
      toast.push({ title: t('toast.created'), message: t('toast.createdMessage') });
      await load();
    } catch (e: any) {
      toast.push({ title: t('toast.createFailed'), message: typeof e?.message === 'string' ? e.message : tc('errors.unknownError') });
    } finally {
      setCreating(false);
    }
  }

  async function onDeleteToken() {
    if (!tokenToDelete) return;
    setDeleting(true);
    try {
      await api.deleteToken(tokenToDelete.id);
      toast.push({ title: t('toast.deleted'), message: t('toast.deletedMessage', { prefix: tokenToDelete.tokenPrefix }) });
      setTokenToDelete(null);
      await load();
    } catch (e: any) {
      toast.push({ title: t('toast.deleteFailed'), message: typeof e?.message === 'string' ? e.message : tc('errors.unknownError') });
    } finally {
      setDeleting(false);
    }
  }

  const activeTarget = useMemo(() => MCP_SETUP_TARGETS.find((target) => target.id === activeTargetId) ?? MCP_SETUP_TARGETS[0]!, [activeTargetId]);
  const activeSnippet = useMemo(() => activeTarget.render({ apiBaseUrl, origin, clientToken: setupClientToken }), [activeTarget, apiBaseUrl, origin, setupClientToken]);

  return (
    <div className="stack">
      <div className="card">
        <div className="cardHeader">
          <div className="row">
            <div>
              <div className="h2">{t('title')}</div>
              <div className="help">
                {stats.total} {t('stats.total', { count: stats.total }).replace(`${stats.total} `, '')} • {stats.active} {t('stats.active', { count: stats.active }).replace(`${stats.active} `, '')}
              </div>
            </div>
            <div className="flex gap-3 items-center">
              <button className="btn" data-variant="ghost" onClick={() => setDrawerOpen(true)}>
                {t('actions.setupInfo')}
              </button>
              <button className="btn" onClick={load} disabled={loading}>
                <IconRefresh />
                {t('actions.refresh')}
              </button>
              <button className="btn" data-variant="primary" onClick={() => setCreateOpen(true)}>
                <IconPlus />
                {t('actions.createToken')}
              </button>
            </div>
          </div>
        </div>
        <div className="cardBody p-0">
          {error ? (
            <div className="p-4">
              <ErrorBanner message={error} onRetry={load} retrying={loading} />
            </div>
          ) : null}
          <DataTable
            ariaLabel={t('title')}
            columns={(
              [
                {
                  id: 'prefix',
                  header: t('table.prefix'),
                  dataLabel: t('table.prefix'),
                  cellClassName: 'mono',
                  cell: (tok: ClientTokenDto) => tok.tokenPrefix
                },
                {
                  id: 'description',
                  header: t('table.description'),
                  dataLabel: t('table.description'),
                  cellClassName: 'muted',
                  cell: (tok: ClientTokenDto) => tok.description ?? '—'
                },
                {
                  id: 'expires',
                  header: t('table.expires'),
                  headerStyle: { width: 170 },
                  dataLabel: t('table.expires'),
                  cellClassName: 'mono',
                  cell: (tok: ClientTokenDto) => formatDateTime(tok.expiresAt)
                },
                {
                  id: 'created',
                  header: t('table.created'),
                  headerStyle: { width: 150 },
                  dataLabel: t('table.created'),
                  cellClassName: 'mono',
                  cell: (tok: ClientTokenDto) => formatDateTime(tok.createdAt)
                },
                {
                  id: 'actions',
                  header: t('table.actions'),
                  headerStyle: { width: 100, textAlign: 'right' },
                  headerAlign: 'right',
                  dataLabel: t('table.actions'),
                  cellAlign: 'right',
                  cell: (tok: ClientTokenDto) => (
                    <button
                      className="btn"
                      data-variant="danger"
                      onClick={() => setTokenToDelete(tok)}
                      style={{ padding: '6px 12px', fontSize: 13 }}
                    >
                      {tc('actions.delete')}
                    </button>
                  )
                }
              ] satisfies DataTableColumn<ClientTokenDto>[]
            )}
            rows={paginatedTokens}
            rowKey={(tok) => tok.id}
            loading={loading}
            empty={
              <EmptyState
                icon={<IconToken />}
                message={t('empty.noTokens')}
                action={{ label: t('actions.createToken'), onClick: () => setCreateOpen(true) }}
                compact
              />
            }
          />
          <Pagination total={tokens.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={t('setup.title')}>
        <div className="stack gap-6">
            <div className="stack">
              <div className="label">{t('setup.mcpEndpoint')}</div>
              <input className="input mono" value={mcpUrl} readOnly aria-label={t('setup.mcpEndpoint')} />
              <div className="help" dangerouslySetInnerHTML={{ __html: t('setup.mcpEndpointHelp').replace(/<mono>/g, '<span class="mono">').replace(/<\/mono>/g, '</span>') }} />
            </div>

            <div className="stack">
              <div className="label">{t('setup.clientToken')}</div>
              <input
                className="input mono"
                type="password"
                value={setupClientToken}
                onChange={(e) => setSetupClientToken(e.target.value)}
                placeholder={t('setup.clientTokenPlaceholder')}
                autoComplete="off"
              />
              <div className="help">{t('setup.clientTokenHelp')}</div>
            </div>

            <div className="stack gap-3">
              <div className="label">{t('setup.configSnippets')}</div>
              <div className="flex flex-wrap gap-2">
                {MCP_SETUP_TARGETS.map((target) => (
                  <button
                    key={target.id}
                    className="btn btn--sm"
                    data-variant={target.id === activeTargetId ? 'primary' : 'ghost'}
                    onClick={() => setActiveTargetId(target.id)}
                    aria-pressed={target.id === activeTargetId}
                  >
                    {target.title}
                  </button>
                ))}
              </div>
              <div className="help">{activeTarget.description}</div>

              <div className="flex gap-3 items-center mt-2">
                <CopyButton
                  text={activeSnippet}
                  variant="primary"
                  label={t('setup.copySnippet')}
                  buttonText={t('setup.copySnippet')}
                  disabled={!activeSnippet.trim()}
                />
              </div>
              <textarea
                className="textarea mono text-xs"
                value={activeSnippet}
                readOnly
                rows={Math.min(14, Math.max(6, activeSnippet.split('\n').length + 1))}
              />
            </div>
        </div>
      </Drawer>

      <Dialog title={t('dialog.createTitle')} open={createOpen} onClose={() => (creating ? null : setCreateOpen(false))}>
        <div className="stack">
          <div className="grid2">
            <div className="stack">
              <label htmlFor="token-description-input" className="label">{t('form.description')}</label>
              <input id="token-description-input" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('form.descriptionPlaceholder')} />
              <div className="help">{t('form.descriptionHelp')}</div>
            </div>
            <div className="stack">
              <label htmlFor="token-expires-input" className="label">{t('form.expiresIn')}</label>
              <input
                id="token-expires-input"
                className="input mono"
                inputMode="numeric"
                value={expiresInSeconds}
                onChange={(e) => {
                  const next = e.target.value.trim();
                  if (!next) return setExpiresInSeconds('');
                  const n = Number(next);
                  setExpiresInSeconds(Number.isFinite(n) ? Math.max(0, Math.floor(n)) : '');
                }}
                placeholder={t('form.expiresInPlaceholder')}
              />
              <div className="help">
                {typeof expiresInSeconds === 'number' && expiresInSeconds > 0 ? `≈ ${formatRelativeSeconds(expiresInSeconds, (key, opts) => tc(`time.${key}`, opts))}` : t('form.expiresInHelp')}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button className="btn" onClick={() => setCreateOpen(false)} disabled={creating}>
              {tc('actions.cancel')}
            </button>
            <button className="btn" data-variant="primary" onClick={onCreate} disabled={creating}>
              <IconToken />
              {t('actions.createToken')}
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog title={t('dialog.copyTitle')} open={Boolean(createdToken)} onClose={() => setCreatedToken(null)}>
        <div className="stack">
          <div className="help">
            {t('copyDialog.warning')}
          </div>
          <div className="flex gap-3 items-center">
            <input className="input mono" value={createdToken ?? ''} readOnly aria-label={t('copyDialog.copyToken')} />
            <CopyButton
              text={createdToken ?? ''}
              variant="primary"
              label={t('copyDialog.copyToken')}
              buttonText={tc('actions.copy')}
              disabled={!createdToken}
            />
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!tokenToDelete}
        title={t('dialog.deleteTitle')}
        description={t('dialog.deleteDescription', { prefix: tokenToDelete?.tokenPrefix ?? '' })}
        confirmLabel={tc('actions.delete')}
        confirmVariant="danger"
        requireText="DELETE"
        requireTextLabel={t('dialog.requireDeleteText')}
        confirming={deleting}
        onClose={() => (deleting ? null : setTokenToDelete(null))}
        onConfirm={onDeleteToken}
      />
    </div>
  );
}
