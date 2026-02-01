import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
      setError(typeof e?.message === 'string' ? e.message : 'Failed to load tokens');
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const active = tokens.filter((t) => !t.revokedAt).length;
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
      toast.push({ title: 'Token created', message: 'Copy it now; it will not be shown again.' });
      await load();
    } catch (e: any) {
      toast.push({ title: 'Create failed', message: typeof e?.message === 'string' ? e.message : 'Unknown error' });
    } finally {
      setCreating(false);
    }
  }

  async function onDeleteToken() {
    if (!tokenToDelete) return;
    setDeleting(true);
    try {
      await api.deleteToken(tokenToDelete.id);
      toast.push({ title: 'Token deleted', message: `Deleted "${tokenToDelete.tokenPrefix}"` });
      setTokenToDelete(null);
      await load();
    } catch (e: any) {
      toast.push({ title: 'Delete failed', message: typeof e?.message === 'string' ? e.message : 'Unknown error' });
    } finally {
      setDeleting(false);
    }
  }

  const activeTarget = useMemo(() => MCP_SETUP_TARGETS.find((t) => t.id === activeTargetId) ?? MCP_SETUP_TARGETS[0]!, [activeTargetId]);
  const activeSnippet = useMemo(() => activeTarget.render({ apiBaseUrl, origin, clientToken: setupClientToken }), [activeTarget, apiBaseUrl, origin, setupClientToken]);

  return (
    <div className="stack">
      <div className="card">
        <div className="cardHeader">
          <div className="row">
            <div>
              <div className="h2">Client tokens</div>
              <div className="help">
                {stats.total} total • {stats.active} active
              </div>
            </div>
            <div className="flex gap-3 items-center">
              <button className="btn" data-variant="ghost" onClick={() => setDrawerOpen(true)}>
                Setup Info
              </button>
              <button className="btn" onClick={load} disabled={loading}>
                <IconRefresh />
                Refresh
              </button>
              <button className="btn" data-variant="primary" onClick={() => setCreateOpen(true)}>
                <IconPlus />
                Create token
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
            ariaLabel="Client tokens"
            columns={(
              [
                {
                  id: 'prefix',
                  header: 'Prefix',
                  dataLabel: 'Prefix',
                  cellClassName: 'mono',
                  cell: (t: ClientTokenDto) => t.tokenPrefix
                },
                {
                  id: 'description',
                  header: 'Description',
                  dataLabel: 'Description',
                  cellClassName: 'muted',
                  cell: (t: ClientTokenDto) => t.description ?? '—'
                },
                {
                  id: 'expires',
                  header: 'Expires',
                  headerStyle: { width: 170 },
                  dataLabel: 'Expires',
                  cellClassName: 'mono',
                  cell: (t: ClientTokenDto) => formatDateTime(t.expiresAt)
                },
                {
                  id: 'created',
                  header: 'Created',
                  headerStyle: { width: 150 },
                  dataLabel: 'Created',
                  cellClassName: 'mono',
                  cell: (t: ClientTokenDto) => formatDateTime(t.createdAt)
                },
                {
                  id: 'actions',
                  header: 'Actions',
                  headerStyle: { width: 100, textAlign: 'right' },
                  headerAlign: 'right',
                  dataLabel: 'Actions',
                  cellAlign: 'right',
                  cell: (t: ClientTokenDto) => (
                    <button
                      className="btn"
                      data-variant="danger"
                      onClick={() => setTokenToDelete(t)}
                      style={{ padding: '6px 12px', fontSize: 13 }}
                    >
                      Delete
                    </button>
                  )
                }
              ] satisfies DataTableColumn<ClientTokenDto>[]
            )}
            rows={paginatedTokens}
            rowKey={(t) => t.id}
            loading={loading}
            empty={
              <EmptyState
                icon={<IconToken />}
                message="No tokens yet. Create one to authorize clients."
                action={{ label: 'Create token', onClick: () => setCreateOpen(true) }}
                compact
              />
            }
          />
          <Pagination total={tokens.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Client Setup">
        <div className="stack gap-6">
            <div className="stack">
              <div className="label">MCP endpoint</div>
              <input className="input mono" value={mcpUrl} readOnly aria-label="MCP endpoint URL" />
              <div className="help">
                HTTP clients should call <span className="mono">/mcp</span> with <span className="mono">Authorization: Bearer &lt;client_token&gt;</span>.
              </div>
            </div>
            
            <div className="stack">
              <div className="label">Client token (paste full token)</div>
              <input
                className="input mono"
                type="password"
                value={setupClientToken}
                onChange={(e) => setSetupClientToken(e.target.value)}
                placeholder="<YOUR_CLIENT_TOKEN>"
                autoComplete="off"
              />
              <div className="help">Client tokens are shown once when created. Paste a valid token here to generate configuration snippets.</div>
            </div>

            <div className="stack gap-3">
              <div className="label">Configuration Snippets</div>
              <div className="flex flex-wrap gap-2">
                {MCP_SETUP_TARGETS.map((t) => (
                  <button
                    key={t.id}
                    className="btn btn--sm"
                    data-variant={t.id === activeTargetId ? 'primary' : 'ghost'}
                    onClick={() => setActiveTargetId(t.id)}
                    aria-pressed={t.id === activeTargetId}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
              <div className="help">{activeTarget.description}</div>

              <div className="flex gap-3 items-center mt-2">
                <CopyButton
                  text={activeSnippet}
                  variant="primary"
                  label="Copy snippet"
                  buttonText="Copy snippet"
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

      <Dialog title="Create client token" open={createOpen} onClose={() => (creating ? null : setCreateOpen(false))}>
        <div className="stack">
          <div className="grid2">
            <div className="stack">
              <label htmlFor="token-description-input" className="label">Description (optional)</label>
              <input id="token-description-input" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. staging automation" />
              <div className="help">Shown in the token list to help you remember intent.</div>
            </div>
            <div className="stack">
              <label htmlFor="token-expires-input" className="label">Expires in (seconds)</label>
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
                placeholder="e.g. 86400"
              />
              <div className="help">
                {typeof expiresInSeconds === 'number' && expiresInSeconds > 0 ? `≈ ${formatRelativeSeconds(expiresInSeconds)}` : 'Leave empty for no expiry.'}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button className="btn" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </button>
            <button className="btn" data-variant="primary" onClick={onCreate} disabled={creating}>
              <IconToken />
              Create token
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog title="Copy token" open={Boolean(createdToken)} onClose={() => setCreatedToken(null)}>
        <div className="stack">
          <div className="help">
            This token is shown once. Store it securely. Anyone with this token can call your MCP server (subject to rate limits). Use it in the "Client setup" section below.
          </div>
          <div className="flex gap-3 items-center">
            <input className="input mono" value={createdToken ?? ''} readOnly aria-label="Created token" />
            <CopyButton
              text={createdToken ?? ''}
              variant="primary"
              label="Copy token"
              buttonText="Copy"
              disabled={!createdToken}
            />
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!tokenToDelete}
        title="Delete token"
        description={`Delete "${tokenToDelete?.tokenPrefix ?? ''}" permanently.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        requireText="DELETE"
        requireTextLabel="Type DELETE to permanently delete this token"
        confirming={deleting}
        onClose={() => (deleting ? null : setTokenToDelete(null))}
        onConfirm={onDeleteToken}
      />
    </div>
  );
}
