import React, { useMemo, useState } from 'react';
import { AdminApiError, createAdminApi } from '../lib/adminApi';
import { maskSecret } from '../lib/format';
import { IconShield } from '../ui/icons';
import { useToast } from '../ui/toast';

export function LoginPage({
  apiBaseUrl,
  defaultRemember,
  onLogin,
  onGoToSettings
}: {
  apiBaseUrl: string;
  defaultRemember: boolean;
  onLogin: (opts: { adminToken: string; remember: boolean }) => void;
  onGoToSettings: () => void;
}) {
  const toast = useToast();
  const [adminToken, setAdminToken] = useState('');
  const [remember, setRemember] = useState(defaultRemember);
  const [testing, setTesting] = useState(false);

  const masked = useMemo(() => maskSecret(adminToken), [adminToken]);

  async function testAndContinue() {
    const token = adminToken.trim();
    if (!token) {
      toast.push({ title: 'Admin token required', message: 'Paste the server ADMIN_API_TOKEN to sign in.' });
      return;
    }

    setTesting(true);
    try {
      const api = createAdminApi({ baseUrl: apiBaseUrl, adminToken: token });
      await api.listKeys();
      onLogin({ adminToken: token, remember });
      toast.push({ title: 'Signed in' });
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
        toast.push({ title: 'Sign in failed', message: typeof e?.message === 'string' ? e.message : 'Unknown error' });
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
              <div className="h2">Sign in</div>
              <div className="help">Use the server ADMIN_API_TOKEN to access the admin console</div>
            </div>
            <button className="btn" onClick={onGoToSettings}>
              Settings
            </button>
          </div>
        </div>
        <div className="cardBody">
          <div className="stack">
            <div className="stack">
              <label htmlFor="admin-token-input" className="label">Admin API token</label>
              <input
                id="admin-token-input"
                className="input mono"
                type="password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                placeholder="ADMIN_API_TOKEN"
                autoComplete="off"
              />
              <div className="help">
                Paste the admin token that the server was started with. This is not a client token. {masked ? <span className="mono">({masked})</span> : null}
              </div>
            </div>

            <label className="flex items-center gap-3">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="help">Remember on this device (stores token in localStorage)</span>
            </label>

            <div className="flex justify-end gap-3">
              <button className="btn" data-variant="primary" onClick={testAndContinue} disabled={testing}>
                <IconShield />
                Sign in
              </button>
            </div>

            <div className="pill">
              <IconShield />
              <span className="help">
                Signed-in sessions can manage keys/tokens. Client tokens are for MCP clients and should never be used to sign into the admin console.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
