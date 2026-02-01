import React, { useMemo, useState } from 'react';
import { AdminApiError, type AdminApi } from '../lib/adminApi';
import type { Theme } from '../app/prefs';
import { IconLogout, IconRefresh, IconSettings } from '../ui/icons';
import { useToast } from '../ui/toast';

export function SettingsPage({
  api,
  value,
  signedIn,
  onChange,
  onGoToLogin,
  onSignOut
}: {
  api: AdminApi;
  value: { apiBaseUrl: string; theme: Theme };
  signedIn: boolean;
  onChange: (next: { apiBaseUrl: string; theme: Theme }) => void;
  onGoToLogin: () => void;
  onSignOut: () => void;
}) {
  const toast = useToast();
  const [testing, setTesting] = useState(false);
  const baseUrlNeedsScheme = useMemo(() => value.apiBaseUrl.trim() !== '' && !/^https?:\/\//.test(value.apiBaseUrl.trim()), [value.apiBaseUrl]);

  async function testConnection() {
    if (!signedIn) {
      toast.push({ title: 'Sign in required', message: 'Go to Login and enter the server ADMIN_API_TOKEN first.' });
      return;
    }
    setTesting(true);
    try {
      await api.listKeys();
      toast.push({ title: 'Connected', message: 'Admin API authenticated successfully.' });
    } catch (e: any) {
      const status = typeof e?.status === 'number' ? e.status : null;
      if (e instanceof AdminApiError && status === 401) {
        toast.push({
          title: 'Authentication failed (401)',
          message: 'Admin token is invalid. It must match the bridge server environment variable ADMIN_API_TOKEN.'
        });
      } else if (e instanceof AdminApiError && status === 404) {
        toast.push({
          title: 'Not found (404)',
          message: 'Check the Admin API base URL and ensure the bridge server exposes /admin/* routes.'
        });
      } else if (e instanceof AdminApiError && status === 0) {
        toast.push({
          title: 'Network/CORS error',
          message:
            'Could not reach Admin API. In local dev, start bridge-server at http://127.0.0.1:8787 and rely on the Vite /admin proxy (leave base URL empty), or set base URL explicitly.'
        });
      } else {
        toast.push({ title: 'Connection failed', message: typeof e?.message === 'string' ? e.message : 'Unknown error' });
      }
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="cardHeader">
          <div className="row">
            <div>
              <div className="h2">Settings</div>
              <div className="help">Where to send admin requests and how to authenticate</div>
            </div>
            <button className="btn" onClick={testConnection} disabled={testing}>
              <IconRefresh />
              Test connection
            </button>
          </div>
        </div>
        <div className="cardBody">
          <div className="stack">
            <div className="grid2">
              <div className="stack">
                <label htmlFor="api-base-url-input" className="label">Admin API base URL</label>
                <input
                  id="api-base-url-input"
                  className="input mono"
                  value={value.apiBaseUrl}
                  onChange={(e) => onChange({ ...value, apiBaseUrl: e.target.value })}
                  placeholder="(empty = same origin)"
                  autoComplete="off"
                />
                <div className="help">
                  In production, leave this empty when served from the bridge server. In dev, set to e.g. <span className="mono">http://127.0.0.1:8787</span>.
                </div>
                {baseUrlNeedsScheme ? (
                  <div className="badge mono" data-variant="warning">
                    Tip: include http:// or https:// (e.g. http://127.0.0.1:8787)
                  </div>
                ) : null}
              </div>
              <div className="stack">
                <div className="label">Authentication</div>
                <div className="help">
                  Status:{' '}
                  {signedIn ? (
                    <span className="badge mono" data-variant="success">
                      signed in
                    </span>
                  ) : (
                    <span className="badge mono" data-variant="danger">
                      signed out
                    </span>
                  )}
                </div>
                <div className="flex gap-3 items-center flex-wrap">
                  {signedIn ? (
                    <button className="btn" data-variant="ghost" onClick={onGoToLogin}>
                      Change token
                    </button>
                  ) : (
                    <button className="btn" data-variant="primary" onClick={onGoToLogin}>
                      Sign in
                    </button>
                  )}
                  {signedIn ? (
                    <button className="btn" data-variant="danger" onClick={onSignOut}>
                      <IconLogout />
                      Sign out
                    </button>
                  ) : null}
                </div>
                <div className="help">Sign in (or Change token) uses the server ADMIN_API_TOKEN. Client tokens are for MCP clients and are managed in Tokens.</div>
              </div>
            </div>

            <div className="grid2">
              <div className="stack">
                <label htmlFor="theme-select" className="label">Theme</label>
                <select id="theme-select" className="select" value={value.theme} onChange={(e) => onChange({ ...value, theme: e.target.value as Theme })}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
                <div className="help">Matches OS by default.</div>
              </div>
              <div className="stack">
                <div className="label">Notes</div>
                <div className="help">The Admin UI cannot set server environment variables. The token you enter must match what the server was started with.</div>
              </div>
            </div>

            <div className="pill">
              <IconSettings />
              <span className="help">
                Server must be started with <span className="mono">ADMIN_API_TOKEN</span> and <span className="mono">KEY_ENCRYPTION_SECRET</span>.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
