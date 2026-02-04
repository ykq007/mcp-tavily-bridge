import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminApiError, type AdminApi, type SearchSourceMode, type ServerInfoDto } from '../lib/adminApi';
import type { Theme } from '../app/prefs';
import { IconLogout, IconRefresh, IconSettings } from '../ui/icons';
import { useToast } from '../ui/toast';
import { supportedLanguages, changeLanguage, getCurrentLanguage, type SupportedLocale } from '../i18n';

export function SettingsPage({
  api,
  value,
  signedIn,
  onChange,
  onGoToLogin,
  onSignOut
}: {
  api: AdminApi;
  value: { apiBaseUrl: string; theme: Theme; locale: SupportedLocale };
  signedIn: boolean;
  onChange: (next: { apiBaseUrl: string; theme: Theme; locale: SupportedLocale }) => void;
  onGoToLogin: () => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const [testing, setTesting] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfoDto | null>(null);
  const [serverInfoError, setServerInfoError] = useState<string | null>(null);
  const [serverStrategyDraft, setServerStrategyDraft] = useState<'round_robin' | 'random'>('round_robin');
  const [savingServerStrategy, setSavingServerStrategy] = useState(false);
  const [searchSourceModeDraft, setSearchSourceModeDraft] = useState<SearchSourceMode>('brave_prefer_tavily_fallback');
  const [savingSearchSourceMode, setSavingSearchSourceMode] = useState(false);
  const baseUrlNeedsScheme = useMemo(() => value.apiBaseUrl.trim() !== '' && !/^https?:\/\//.test(value.apiBaseUrl.trim()), [value.apiBaseUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!signedIn) {
      setServerInfo(null);
      setServerInfoError(null);
      return;
    }
    setServerInfoError(null);
    api
      .getServerInfo()
      .then((info) => {
        if (cancelled) return;
        setServerInfo(info);
        setServerStrategyDraft(info.tavilyKeySelectionStrategy);
        setSearchSourceModeDraft(info.searchSourceMode);
      })
      .catch((e: any) => {
        if (cancelled) return;
        const msg = typeof e?.message === 'string' ? e.message : tc('errors.unknownError');
        setServerInfoError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [api, signedIn, tc]);

  async function saveServerStrategy(next: 'round_robin' | 'random') {
    if (!signedIn) {
      toast.push({ title: t('toast.signInRequired'), message: t('toast.signInRequiredMessage') });
      return;
    }
    setSavingServerStrategy(true);
    try {
      const res = await api.updateServerInfo({ tavilyKeySelectionStrategy: next });
      setServerInfo(res);
      setServerStrategyDraft(res.tavilyKeySelectionStrategy);
      toast.push({ title: t('toast.updated'), message: t('toast.updatedMessage', { strategy: res.tavilyKeySelectionStrategy }) });
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : tc('errors.unknownError');
      toast.push({ title: t('toast.updateFailed'), message: msg });
    } finally {
      setSavingServerStrategy(false);
    }
  }

  async function saveSearchSourceMode(next: SearchSourceMode) {
    if (!signedIn) {
      toast.push({ title: t('toast.signInRequired'), message: t('toast.signInRequiredMessage') });
      return;
    }
    setSavingSearchSourceMode(true);
    try {
      const res = await api.updateServerInfo({ searchSourceMode: next });
      setServerInfo(res);
      setSearchSourceModeDraft(res.searchSourceMode);
      toast.push({ title: t('toast.searchSourceModeUpdated'), message: t('toast.searchSourceModeUpdatedMessage', { mode: res.searchSourceMode }) });
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : tc('errors.unknownError');
      toast.push({ title: t('toast.updateFailed'), message: msg });
    } finally {
      setSavingSearchSourceMode(false);
    }
  }

  async function testConnection() {
    if (!signedIn) {
      toast.push({ title: t('toast.signInRequired'), message: t('toast.goToLoginMessage') });
      return;
    }
    setTesting(true);
    try {
      await api.listKeys();
      toast.push({ title: t('toast.connected'), message: t('toast.connectedMessage') });
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : null;
      if (e instanceof AdminApiError && status === 401) {
        toast.push({
          title: t('toast.authFailed'),
          message: t('toast.authFailedMessage')
        });
      } else if (e instanceof AdminApiError && status === 404) {
        toast.push({
          title: t('toast.notFound'),
          message: t('toast.notFoundMessage')
        });
      } else if (e instanceof AdminApiError && status === 0) {
        toast.push({
          title: t('toast.networkError'),
          message: t('toast.networkErrorMessage')
        });
      } else {
        toast.push({ title: t('toast.connectionFailed'), message: typeof e?.message === 'string' ? e.message : tc('errors.unknownError') });
      }
    } finally {
      setTesting(false);
    }
  }

  function handleLanguageChange(locale: SupportedLocale) {
    changeLanguage(locale);
    onChange({ ...value, locale });
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="cardHeader">
          <div className="row">
            <div>
              <div className="h2">{t('title')}</div>
              <div className="help">{t('subtitle')}</div>
            </div>
            <button className="btn" onClick={testConnection} disabled={testing}>
              <IconRefresh />
              {t('actions.testConnection')}
            </button>
          </div>
        </div>
        <div className="cardBody">
          <div className="stack">
            <div className="grid2">
              <div className="stack">
                <label htmlFor="api-base-url-input" className="label">{t('apiBaseUrl.label')}</label>
                <input
                  id="api-base-url-input"
                  className="input mono"
                  value={value.apiBaseUrl}
                  onChange={(e) => onChange({ ...value, apiBaseUrl: e.target.value })}
                  placeholder={t('apiBaseUrl.placeholder')}
                  autoComplete="off"
                />
                <div className="help" dangerouslySetInnerHTML={{ __html: t('apiBaseUrl.help').replace(/<mono>/g, '<span class="mono">').replace(/<\/mono>/g, '</span>') }} />
                {baseUrlNeedsScheme ? (
                  <div className="badge mono" data-variant="warning">
                    {t('apiBaseUrl.schemeTip')}
                  </div>
                ) : null}
              </div>
              <div className="stack">
                <div className="label">{t('auth.label')}</div>
                <div className="help">
                  {t('auth.status')}{' '}
                  {signedIn ? (
                    <span className="badge mono" data-variant="success">
                      {t('auth.signedIn')}
                    </span>
                  ) : (
                    <span className="badge mono" data-variant="danger">
                      {t('auth.signedOut')}
                    </span>
                  )}
                </div>
                <div className="flex gap-3 items-center flex-wrap">
                  {signedIn ? (
                    <button className="btn" data-variant="ghost" onClick={onGoToLogin}>
                      {t('auth.changeToken')}
                    </button>
                  ) : (
                    <button className="btn" data-variant="primary" onClick={onGoToLogin}>
                      {tc('actions.signIn')}
                    </button>
                  )}
                  {signedIn ? (
                    <button className="btn" data-variant="danger" onClick={onSignOut}>
                      <IconLogout />
                      {tc('actions.signOut')}
                    </button>
                  ) : null}
                </div>
                <div className="help">{t('auth.help')}</div>
              </div>
            </div>

            <div className="grid2">
              <div className="stack">
                <label htmlFor="theme-select" className="label">{t('theme.label')}</label>
                <select id="theme-select" className="select" value={value.theme} onChange={(e) => onChange({ ...value, theme: e.target.value as Theme })}>
                  <option value="light">{t('theme.light')}</option>
                  <option value="dark">{t('theme.dark')}</option>
                </select>
                <div className="help">{t('theme.help')}</div>
              </div>
              <div className="stack">
                <label htmlFor="language-select" className="label">{t('language.label')}</label>
                <select
                  id="language-select"
                  className="select"
                  value={getCurrentLanguage()}
                  onChange={(e) => handleLanguageChange(e.target.value as SupportedLocale)}
                >
                  {supportedLanguages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
                <div className="help">{t('language.help')}</div>
              </div>
            </div>

            <div className="grid2">
              <div className="stack">
                <div className="label">{t('server.label')}</div>
                {!signedIn ? (
                  <div className="help">{t('server.signInRequired')}</div>
                ) : serverInfoError ? (
                  <div className="badge mono" data-variant="warning">
                    {t('server.loadError')}
                  </div>
                ) : serverInfo ? (
                  <div className="stack">
                    <div className="flex gap-3 items-center">
                      <div className="help">{t('server.keySelection')}</div>
                      <span className="badge mono" data-variant="info">
                        {serverInfo.tavilyKeySelectionStrategy}
                      </span>
                    </div>
                    <div className="flex gap-3 items-center flex-wrap">
                      <select
                        className="select"
                        value={serverStrategyDraft}
                        onChange={(e) => setServerStrategyDraft(e.target.value === 'random' ? 'random' : 'round_robin')}
                        disabled={savingServerStrategy}
                        aria-label={t('server.keySelection')}
                      >
                        <option value="round_robin">{t('server.roundRobin')}</option>
                        <option value="random">{t('server.random')}</option>
                      </select>
                      <button
                        className="btn btn--sm"
                        data-variant="primary"
                        onClick={() => saveServerStrategy(serverStrategyDraft)}
                        disabled={savingServerStrategy || serverStrategyDraft === serverInfo.tavilyKeySelectionStrategy}
                      >
                        {savingServerStrategy ? tc('status.saving') : tc('actions.save')}
                      </button>
                    </div>
                    <div className="help" dangerouslySetInnerHTML={{ __html: t('server.keySelectionHelp').replace(/<mono>/g, '<span class="mono">').replace(/<\/mono>/g, '</span>') }} />

                    <div className="flex gap-3 items-center mt-4">
                      <div className="help">{t('server.searchSourceMode.label')}</div>
                      <span className="badge mono" data-variant="info">
                        {serverInfo.searchSourceMode}
                      </span>
                    </div>
                    <div className="flex gap-3 items-center flex-wrap">
                      <select
                        className="select"
                        value={searchSourceModeDraft}
                        onChange={(e) => setSearchSourceModeDraft(e.target.value as SearchSourceMode)}
                        disabled={savingSearchSourceMode}
                        aria-label={t('server.searchSourceMode.label')}
                      >
                        <option value="brave_prefer_tavily_fallback">{t('server.searchSourceMode.brave_prefer_tavily_fallback')}</option>
                        <option value="combined">{t('server.searchSourceMode.combined')}</option>
                        <option value="tavily_only">{t('server.searchSourceMode.tavily_only')}</option>
                        <option value="brave_only">{t('server.searchSourceMode.brave_only')}</option>
                      </select>
                      <button
                        className="btn btn--sm"
                        data-variant="primary"
                        onClick={() => saveSearchSourceMode(searchSourceModeDraft)}
                        disabled={savingSearchSourceMode || searchSourceModeDraft === serverInfo.searchSourceMode}
                      >
                        {savingSearchSourceMode ? tc('status.saving') : tc('actions.save')}
                      </button>
                    </div>
                    <div className="help">{t('server.searchSourceMode.help')}</div>

                    {searchSourceModeDraft === 'combined' && (
                      <div className="help" style={{ color: 'var(--color-warning)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                        ⚠️ {t('server.searchSourceMode.costNote')}
                      </div>
                    )}

                    {searchSourceModeDraft === 'brave_only' && !serverInfo.braveSearchEnabled ? (
                      <div className="badge mono" data-variant="warning">
                        {t('server.searchSourceMode.braveUnavailableWarning')}
                      </div>
                    ) : null}

                    {searchSourceModeDraft === 'combined' && !serverInfo.braveSearchEnabled ? (
                      <div className="badge mono" data-variant="warning">
                        {t('server.searchSourceMode.combinedUnavailableWarning')}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="help">{tc('status.loading')}</div>
                )}
              </div>
              <div className="stack">
                <div className="label">{t('rotation.label')}</div>
                <div className="help">{t('rotation.help')}</div>
              </div>
            </div>

            <div className="pill">
              <IconSettings />
              <span className="help" dangerouslySetInnerHTML={{ __html: t('pill.envVars').replace(/<mono>/g, '<span class="mono">').replace(/<\/mono>/g, '</span>') }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
