import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ShellLayout } from './app/Shell';
import { loadPrefs, savePrefs, type AdminUiPrefs } from './app/prefs';
import { clearAdminToken, loadAdminToken, persistAdminToken } from './app/adminAuth';
import { createAdminApi, normalizeBaseUrl } from './lib/adminApi';
import { sanitizeNext } from './lib/sanitizeNext';
import { RequireAuth } from './components/RequireAuth';
import { KeysPage } from './pages/KeysPage';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { TokensPage } from './pages/TokensPage';
import { UsagePage } from './pages/UsagePage';
import { ToastProvider, useToast } from './ui/toast';
import type { AdminApi } from './lib/adminApi';

function getDefaultApiBaseUrl(): string {
  const raw = import.meta.env.VITE_ADMIN_API_BASE;
  return typeof raw === 'string' ? normalizeBaseUrl(raw) : '';
}

export function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <AppInner />
      </HashRouter>
    </ToastProvider>
  );
}

function AppInner() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<AdminUiPrefs>(() => loadPrefs({ apiBaseUrl: getDefaultApiBaseUrl() }));
  const [adminToken, setAdminToken] = useState(() => loadAdminToken());

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs.theme]);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    persistAdminToken(adminToken, prefs.rememberAdminToken);
  }, [adminToken, prefs.rememberAdminToken]);

  const toggleTheme = useCallback(() => {
    setPrefs((prev) => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setPrefs((prev) => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }));
  }, []);

  const signOut = useCallback(() => {
    setAdminToken('');
    clearAdminToken();
  }, []);

  const onAuthFailure = useCallback(() => {
    signOut();
    toast.push({ title: 'Signed out', message: 'Authentication failed. Please sign in again with the admin token.' });
  }, [signOut, toast]);

  const api = useMemo(
    () => createAdminApi({ baseUrl: prefs.apiBaseUrl, adminToken }, { onAuthFailure }),
    [prefs.apiBaseUrl, adminToken, onAuthFailure]
  );

  const connectionSummary = useMemo(() => {
    const base = prefs.apiBaseUrl.trim() ? prefs.apiBaseUrl.trim() : '(same origin)';
    const auth = adminToken.trim() ? 'signed in' : 'signed out';
    return `${base} • ${auth}`;
  }, [prefs.apiBaseUrl, adminToken]);

  const handleLogin = useCallback(
    (opts: { adminToken: string; remember: boolean }) => {
      setPrefs((prev) => ({ ...prev, rememberAdminToken: opts.remember }));
      setAdminToken(opts.adminToken);
    },
    []
  );

  return (
    <Routes>
      {/* Login page - standalone, no Shell */}
      <Route
        path="/login"
        element={
          <LoginPageWrapper
            apiBaseUrl={prefs.apiBaseUrl}
            defaultRemember={prefs.rememberAdminToken}
            onLogin={handleLogin}
          />
        }
      />

      {/* Shell layout for all other pages */}
      <Route
        element={
          <ShellLayout
            connectionSummary={connectionSummary}
            theme={prefs.theme}
            onToggleTheme={toggleTheme}
            signedIn={Boolean(adminToken.trim())}
            sidebarCollapsed={prefs.sidebarCollapsed}
            onToggleSidebar={toggleSidebar}
          />
        }
      >
        {/* Public: Settings */}
        <Route
          path="/settings"
          element={
            <SettingsPageWrapper
              api={api}
              prefs={prefs}
              setPrefs={setPrefs}
              signedIn={Boolean(adminToken.trim())}
              onSignOut={signOut}
            />
          }
        />

        {/* Protected routes */}
        <Route element={<RequireAuth adminToken={adminToken} />}>
          <Route path="/" element={<OverviewPageWrapper api={api} />} />
          <Route path="/keys" element={<KeysPage api={api} />} />
          <Route path="/tokens" element={<TokensPage api={api} apiBaseUrl={prefs.apiBaseUrl} />} />
          <Route path="/usage" element={<UsagePage api={api} />} />
        </Route>
      </Route>

      {/* Fallback: redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/**
 * Wrapper for LoginPage that handles navigation after login
 */
function LoginPageWrapper({
  apiBaseUrl,
  defaultRemember,
  onLogin
}: {
  apiBaseUrl: string;
  defaultRemember: boolean;
  onLogin: (opts: { adminToken: string; remember: boolean }) => void;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get('next');
  const safeNext = sanitizeNext(nextParam);

  const handleLogin = useCallback(
    (opts: { adminToken: string; remember: boolean }) => {
      onLogin(opts);
      navigate(safeNext, { replace: true });
    },
    [onLogin, navigate, safeNext]
  );

  const handleGoToSettings = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  return (
    <div className="authFrame">
      <div className="authCenter">
        <LoginPage
          apiBaseUrl={apiBaseUrl}
          defaultRemember={defaultRemember}
          onLogin={handleLogin}
          onGoToSettings={handleGoToSettings}
        />
      </div>
    </div>
  );
}

/**
 * Wrapper for OverviewPage that provides navigation callbacks
 */
function OverviewPageWrapper({ api }: { api: AdminApi }) {
  const navigate = useNavigate();

  return (
    <OverviewPage
      api={api}
      onGoToKeys={() => navigate('/keys')}
      onGoToTokens={() => navigate('/tokens')}
      onGoToUsage={() => navigate('/usage')}
    />
  );
}

/**
 * Wrapper for SettingsPage that provides navigation callbacks
 */
function SettingsPageWrapper({
  api,
  prefs,
  setPrefs,
  signedIn,
  onSignOut
}: {
  api: AdminApi;
  prefs: AdminUiPrefs;
  setPrefs: React.Dispatch<React.SetStateAction<AdminUiPrefs>>;
  signedIn: boolean;
  onSignOut: () => void;
}) {
  const navigate = useNavigate();

  const handleSignOut = useCallback(() => {
    onSignOut();
    navigate('/login');
  }, [onSignOut, navigate]);

  return (
    <SettingsPage
      api={api}
      value={{ apiBaseUrl: prefs.apiBaseUrl, theme: prefs.theme }}
      signedIn={signedIn}
      onChange={(next) => setPrefs((prev) => ({ ...prev, ...next }))}
      onGoToLogin={() => navigate('/login')}
      onSignOut={handleSignOut}
    />
  );
}
