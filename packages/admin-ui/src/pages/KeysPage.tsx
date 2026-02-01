import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AdminApi, TavilyKeyDto, TavilyKeyStatus } from '../lib/adminApi';
import { formatDateTime } from '../lib/format';
import { KeyRevealCell } from '../app/KeyRevealCell';
import { KeyCreditsCell } from '../app/KeyCreditsCell';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog } from '../ui/Dialog';
import { IconButton } from '../ui/IconButton';
import { StatusMenu } from '../ui/StatusMenu';
import { IconKey, IconPlus, IconRefresh, IconSearch, IconShield, IconToken, IconTrash } from '../ui/icons';
import { Pagination } from '../ui/Pagination';
import { useToast } from '../ui/toast';
import { KpiCard } from '../ui/KpiCard';
import { ErrorBanner } from '../ui/ErrorBanner';
import { EmptyState } from '../ui/EmptyState';
import { DataTable, type DataTableColumn } from '../ui/DataTable';

type SortField = 'label' | 'status' | 'lastUsedAt' | 'createdAt';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE = 10;

export function KeysPage({ api }: { api: AdminApi }) {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [keys, setKeys] = useState<TavilyKeyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingCredits, setSyncingCredits] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TavilyKeyStatus>('all');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination state
  const [page, setPage] = useState(1);

  // Phase 3: Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [touched, setTouched] = useState<{ label?: boolean; apiKey?: boolean }>({});

  const createFromUrl = searchParams.get('create');
  useEffect(() => {
    if (createFromUrl !== '1') return;
    setCreateOpen(true);
    const next = new URLSearchParams(searchParams.toString());
    next.delete('create');
    setSearchParams(next, { replace: true });
  }, [createFromUrl, searchParams, setSearchParams]);

  const [keyToDelete, setKeyToDelete] = useState<TavilyKeyDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setKeys(await api.listKeys());
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Failed to load keys');
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  // Filtered and sorted keys
  const filteredKeys = useMemo(() => {
    let result = keys;

    // Filter by search query
    if (searchQuery.trim()) {
      result = result.filter((k) => k.label.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((k) => k.status === statusFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'label':
          comparison = a.label.localeCompare(b.label);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'lastUsedAt':
          comparison = (a.lastUsedAt || '').localeCompare(b.lastUsedAt || '');
          break;
        case 'createdAt':
          comparison = a.createdAt.localeCompare(b.createdAt);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [keys, searchQuery, statusFilter, sortBy, sortOrder]);

  // Paginated keys
  const paginatedKeys = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredKeys.slice(start, start + PAGE_SIZE);
  }, [filteredKeys, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, sortBy, sortOrder]);

  const stats = useMemo(() => {
    const active = keys.filter((k) => k.status === 'active').length;
    const disabled = keys.filter((k) => k.status === 'disabled').length;
    const cooldown = keys.filter((k) => k.status === 'cooldown').length;
    const invalid = keys.filter((k) => k.status === 'invalid').length;
    const total = keys.length;

    // 2026: Calculate KPI metrics
    const totalCredits = keys.reduce((sum, k) => sum + (k.remainingCredits || 0), 0);
    const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;

    return { active, disabled, cooldown, invalid, total, totalCredits, activeRate };
  }, [keys]);

  // Form validation
  const formErrors = useMemo(() => {
    const errors: { label?: string; apiKey?: string } = {};
    if (touched.label && !newLabel.trim()) {
      errors.label = 'Label is required';
    } else if (touched.label && newLabel.length < 2) {
      errors.label = 'Label must be at least 2 characters';
    }
    if (touched.apiKey && !newApiKey.trim()) {
      errors.apiKey = 'API key is required';
    } else if (touched.apiKey && !newApiKey.startsWith('tvly-')) {
      errors.apiKey = 'API key should start with "tvly-"';
    }
    return errors;
  }, [newLabel, newApiKey, touched]);

  const isFormValid = !formErrors.label && !formErrors.apiKey && newLabel.trim() && newApiKey.trim();

  function clearFilters() {
    setSearchQuery('');
    setStatusFilter('all');
  }

  function handleSortChange(value: string) {
    const [field, order] = value.split('-') as [SortField, SortOrder];
    setSortBy(field);
    setSortOrder(order);
  }

  async function onCreate() {
    if (!newLabel.trim() || !newApiKey.trim()) return;
    setCreating(true);
    try {
      await api.createKey({ label: newLabel.trim(), apiKey: newApiKey.trim() });
      toast.push({ title: 'Key added', message: `Saved "${newLabel.trim()}"`, variant: 'success' });
      setCreateOpen(false);
      setNewLabel('');
      setNewApiKey('');
      setTouched({});
      await load();
    } catch (e: any) {
      toast.push({ title: 'Create failed', message: typeof e?.message === 'string' ? e.message : 'Unknown error', variant: 'error' });
    } finally {
      setCreating(false);
    }
  }

  async function onUpdateStatus(id: string, status: TavilyKeyStatus) {
    try {
      await api.updateKeyStatus(id, status);
      toast.push({ title: 'Key updated', message: `Status set to ${status}`, variant: 'success' });
      await load();
    } catch (e: any) {
      toast.push({ title: 'Update failed', message: typeof e?.message === 'string' ? e.message : 'Unknown error', variant: 'error' });
    }
  }

  async function onDeleteKey() {
    if (!keyToDelete) return;
    setDeleting(true);
    try {
      await api.deleteKey(keyToDelete.id);
      toast.push({ title: 'Key deleted', message: `Deleted "${keyToDelete.label}"`, variant: 'success' });
      setKeyToDelete(null);
      await load();
    } catch (e: any) {
      toast.push({ title: 'Delete failed', message: typeof e?.message === 'string' ? e.message : 'Unknown error', variant: 'error' });
    } finally {
      setDeleting(false);
    }
  }

  async function onSyncAll() {
    if (syncingCredits) return;
    setSyncingCredits(true);
    try {
      toast.push({ title: 'Checking credits…', message: 'Updating credits for all keys', variant: 'info' });
      const result = await api.syncAllKeyCredits();
      toast.push({
        title: 'Credits updated',
        message: `Checked ${result.total} keys (${result.success} ok, ${result.failed} failed)`,
        variant: result.failed > 0 ? 'warning' : 'success'
      });
      await load();
    } catch (e: any) {
      toast.push({ title: 'Sync failed', message: e.message, variant: 'error' });
    } finally {
      setSyncingCredits(false);
    }
  }

  // Phase 3: Multi-select handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedKeys.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedKeys.map(k => k.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const bulkRefreshCredits = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    toast.push({ title: 'Syncing...', message: `Refreshing ${ids.length} keys`, variant: 'info' });

    try {
      await Promise.all(ids.map(id => api.refreshKeyCredits(id)));
      toast.push({ title: 'Success', message: `Refreshed ${ids.length} keys`, variant: 'success' });
      clearSelection();
      await load();
    } catch (e: any) {
      toast.push({ title: 'Bulk refresh failed', message: e.message, variant: 'error' });
    }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleteIds(ids);
  };

  const onBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    setBulkDeleting(true);
    toast.push({ title: 'Deleting...', message: `Removing ${bulkDeleteIds.length} keys`, variant: 'info' });

    try {
      await Promise.all(bulkDeleteIds.map(id => api.deleteKey(id)));
      toast.push({ title: 'Deleted', message: `Removed ${bulkDeleteIds.length} keys`, variant: 'success' });
      clearSelection();
      setBulkDeleteIds(null);
      await load();
    } catch (e: any) {
      toast.push({ title: 'Bulk delete failed', message: e.message, variant: 'error' });
    } finally {
      setBulkDeleting(false);
    }
  };

  const hasFilters = searchQuery.trim() || statusFilter !== 'all';

  return (
    <div className="stack">
      {/* 2026: KPI Dashboard */}
      <div className="kpis">
        <KpiCard
          title="Total Capacity"
          value={stats.totalCredits.toLocaleString()}
          icon={<IconToken />}
          variant="tokens"
        />
        <KpiCard
          title="Active Keys"
          value={`${stats.active}/${stats.total}`}
          icon={<IconKey />}
          variant="keys"
        />
        <KpiCard
          title="System Health"
          value={`${stats.activeRate}%`}
          icon={<IconShield />}
          variant="usage"
        />
      </div>

      <div className="card">
        <div className="cardHeader">
          <div className="row">
            <div>
              <div className="h2">Tavily keys</div>
              <div className="help">
                {stats.total} total • {stats.active} active • {stats.cooldown} cooldown • {stats.invalid} invalid •{' '}
                {stats.disabled} disabled
              </div>
            </div>
            <div className="flex gap-3 items-center">
              <button className="btn" onClick={load} disabled={loading}>
                <IconRefresh className={loading ? 'spin' : ''} />
                Refresh
              </button>
              <button
                className="btn"
                onClick={onSyncAll}
                title="Check credits for all keys"
                disabled={syncingCredits}
                style={{ minWidth: 140 }}
              >
                <IconRefresh className={syncingCredits ? 'spin' : ''} />
                {syncingCredits ? 'Checking…' : 'Check Credits'}
              </button>
              <button className="btn" data-variant="primary" onClick={() => setCreateOpen(true)}>
                <IconPlus />
                Add key
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="filterBar">
          <div className="filterBarGrid">
            {/* Search input */}
            <div className="searchInput">
              <div className="searchInputIcon">
                <IconSearch />
              </div>
              <input
                type="search"
                className="input"
                placeholder="Search keys by label..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 40 }}
              />
            </div>

            {/* Status filter */}
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | TavilyKeyStatus)}
              style={{ minWidth: 150 }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
              <option value="cooldown">Cooldown</option>
              <option value="invalid">Invalid</option>
            </select>

            {/* Sort selector */}
            <select
              className="select"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => handleSortChange(e.target.value)}
              style={{ minWidth: 160 }}
            >
              <option value="createdAt-desc">Newest first</option>
              <option value="createdAt-asc">Oldest first</option>
              <option value="label-asc">Label A-Z</option>
              <option value="label-desc">Label Z-A</option>
              <option value="lastUsedAt-desc">Recently used</option>
              <option value="status-asc">Status A-Z</option>
            </select>
          </div>

          {/* Results count */}
          <div className="filterResults">
            <span>
              Showing {filteredKeys.length} of {keys.length} keys
            </span>
            {hasFilters && (
              <button className="btn btn--xs" data-variant="ghost" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Phase 3: Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="bulkActionsBar">
            <div className="bulkActionsInfo">
              <strong>{selectedIds.size}</strong> {selectedIds.size === 1 ? 'key' : 'keys'} selected
            </div>
            <div className="bulkActionsButtons">
              <button className="btn" onClick={bulkRefreshCredits} title="Refresh credits for selected keys">
                <IconRefresh />
                Refresh Credits
              </button>
              <button className="btn" data-variant="danger" onClick={bulkDelete} title="Delete selected keys">
                <IconTrash />
                Delete Selected
              </button>
              <button className="btn" data-variant="ghost" onClick={clearSelection}>
                Clear Selection
              </button>
            </div>
          </div>
        )}

        <div className="cardBody p-0">
          {error ? (
            <div className="p-4">
              <ErrorBanner message={error} onRetry={load} retrying={loading} />
            </div>
          ) : null}

          <DataTable
            ariaLabel="Tavily keys"
            columns={(
              [
                {
                  id: 'select',
                  header: (
                    <input
                      type="checkbox"
                      checked={selectedIds.size === paginatedKeys.length && paginatedKeys.length > 0}
                      onChange={toggleSelectAll}
                      aria-label="Select all keys"
                      style={{ cursor: 'pointer' }}
                    />
                  ),
                  headerStyle: { width: 40 },
                  dataLabel: 'Select',
                  cell: (k: TavilyKeyDto) => (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(k.id)}
                      onChange={() => toggleSelect(k.id)}
                      aria-label={`Select ${k.label}`}
                      style={{ cursor: 'pointer' }}
                    />
                  )
                },
                {
                  id: 'label',
                  header: 'Label',
                  headerStyle: { width: '15%' },
                  dataLabel: 'Label',
                  cellClassName: 'mono',
                  cell: (k: TavilyKeyDto) => k.label
                },
                {
                  id: 'key',
                  header: 'API Key',
                  headerStyle: { width: '25%' },
                  dataLabel: 'API Key',
                  cell: (k: TavilyKeyDto) => (
                    <KeyRevealCell
                      keyId={k.id}
                      maskedKey={k.maskedKey || '••••••••••••'}
                      api={api}
                    />
                  )
                },
                {
                  id: 'credits',
                  header: 'Credits',
                  headerStyle: { width: '20%' },
                  dataLabel: 'Credits',
                  cell: (k: TavilyKeyDto) => (
                    <KeyCreditsCell
                      keyId={k.id}
                      remaining={k.remainingCredits}
                      total={k.totalCredits}
                      lastChecked={k.lastCheckedAt}
                      api={api}
                      onUpdate={load}
                    />
                  )
                },
                {
                  id: 'status',
                  header: 'Status',
                  headerStyle: { width: '12%' },
                  dataLabel: 'Status',
                  cell: (k: TavilyKeyDto) => (
                    <StatusMenu
                      status={k.status}
                      onChange={(s) => onUpdateStatus(k.id, s)}
                    />
                  )
                },
                {
                  id: 'lastUsed',
                  header: 'Last used',
                  headerStyle: { width: '14%' },
                  dataLabel: 'Last used',
                  cellClassName: 'mono',
                  cell: (k: TavilyKeyDto) => formatDateTime(k.lastUsedAt)
                },
                {
                  id: 'created',
                  header: 'Created',
                  headerStyle: { width: '14%' },
                  dataLabel: 'Created',
                  cellClassName: 'mono',
                  cell: (k: TavilyKeyDto) => formatDateTime(k.createdAt)
                },
                {
                  id: 'actions',
                  header: '',
                  headerStyle: { width: '10%', textAlign: 'right' },
                  headerAlign: 'right',
                  dataLabel: 'Actions',
                  cellAlign: 'right',
                  cell: (k: TavilyKeyDto) => (
                    <IconButton
                      icon={<IconTrash />}
                      variant="ghost-danger"
                      onClick={() => setKeyToDelete(k)}
                      title="Delete key"
                    />
                  )
                }
              ] satisfies DataTableColumn<TavilyKeyDto>[]
            )}
            rows={paginatedKeys}
            rowKey={(k) => k.id}
            loading={loading && keys.length === 0}
            empty={
              <EmptyState
                icon={<IconKey />}
                message={hasFilters ? 'No keys match your filters.' : 'No keys found. Add a key to start rotating.'}
                action={
                  hasFilters
                    ? { label: 'Clear filters', onClick: clearFilters, variant: 'ghost' }
                    : { label: 'Add key', onClick: () => setCreateOpen(true) }
                }
              />
            }
          />
          <Pagination total={filteredKeys.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>

      <Dialog title="Add Tavily key" open={createOpen} onClose={() => (creating ? null : setCreateOpen(false))}>
        <div className="stack">
          <div className="grid2">
            <div className="stack">
              <label className="label" htmlFor="key-label">
                Label <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="key-label"
                className="input"
                data-error={!!(formErrors.label && touched.label)}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, label: true }))}
                placeholder="e.g. prod-key-01"
                autoComplete="off"
                aria-invalid={!!(formErrors.label && touched.label)}
                aria-describedby={formErrors.label && touched.label ? 'label-error' : 'label-help'}
              />
              {formErrors.label && touched.label ? (
                <div id="label-error" className="fieldError">
                  {formErrors.label}
                </div>
              ) : (
                <div id="label-help" className="help">
                  Must be unique.
                </div>
              )}
            </div>
            <div className="stack">
              <label className="label" htmlFor="api-key">
                API key <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="api-key"
                className="input mono"
                data-error={!!(formErrors.apiKey && touched.apiKey)}
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, apiKey: true }))}
                placeholder="tvly-..."
                autoComplete="off"
                aria-invalid={!!(formErrors.apiKey && touched.apiKey)}
                aria-describedby={formErrors.apiKey && touched.apiKey ? 'apikey-error' : 'apikey-help'}
              />
              {formErrors.apiKey && touched.apiKey ? (
                <div id="apikey-error" className="fieldError">
                  {formErrors.apiKey}
                </div>
              ) : (
                <div id="apikey-help" className="help">
                  Stored encrypted server-side.
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </button>
            <button className="btn" data-variant="primary" onClick={onCreate} disabled={creating || !isFormValid}>
              <IconKey />
              {creating ? 'Adding...' : 'Add key'}
            </button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!keyToDelete}
        title="Delete key"
        description={`Delete "${keyToDelete?.label ?? ''}" permanently.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        requireText="DELETE"
        requireTextLabel="Type DELETE to permanently delete this key"
        confirming={deleting}
        onClose={() => (deleting ? null : setKeyToDelete(null))}
        onConfirm={onDeleteKey}
      />

      <ConfirmDialog
        open={bulkDeleteIds !== null}
        title="Delete selected keys"
        description={`Delete ${bulkDeleteIds?.length ?? 0} selected key${(bulkDeleteIds?.length ?? 0) === 1 ? '' : 's'} permanently.`}
        confirmLabel="Delete selected"
        confirmVariant="danger"
        requireText="DELETE"
        requireTextLabel="Type DELETE to permanently delete the selected keys"
        confirming={bulkDeleting}
        onClose={() => (bulkDeleting ? null : setBulkDeleteIds(null))}
        onConfirm={onBulkDelete}
      />
    </div>
  );
}
