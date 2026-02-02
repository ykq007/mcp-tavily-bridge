import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('login');
  const { t: tc } = useTranslation('common');
  const toast = useToast();
  const [adminToken, setAdminToken] = useState('');
  const [remember, setRemember] = useState(defaultRemember);
  const [testing, setTesting] = useState(false);

  const masked = useMemo(() => maskSecret(adminToken), [adminToken]);

  async function testAndContinue() {
    const token = adminToken.trim();
    if (!token) {
      toast.push({ title: t('toast.tokenRequired'), message: t('toast.tokenRequiredMessage') });
      return;
    }

    setTesting(true);
    try {
      const api = createAdminApi({ baseUrl: apiBaseUrl, adminToken: token });
      await api.listKeys();
      onLogin({ adminToken: token, remember });
      toast.push({ title: t('toast.signedIn') });
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
        toast.push({ title: t('toast.signInFailed'), message: typeof e?.message === 'string' ? e.message : tc('errors.unknownError') });
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
              <div className="h2">{t('title')}</div>
              <div className="help">{t('subtitle')}</div>
            </div>
            <button className="btn" onClick={onGoToSettings}>
              {tc('actions.settings', { defaultValue: 'Settings' })}
            </button>
          </div>
        </div>
        <div className="cardBody">
          <div className="stack">
            <div className="stack">
              <label htmlFor="admin-token-input" className="label">{t('form.tokenLabel')}</label>
              <input
                id="admin-token-input"
                className="input mono"
                type="password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                placeholder={t('form.tokenPlaceholder')}
                autoComplete="off"
              />
              <div className="help">
                {t('form.tokenHelp')} {masked ? <span className="mono">({masked})</span> : null}
              </div>
            </div>

            <label className="flex items-center gap-3">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="help">{t('form.remember')}</span>
            </label>

            <div className="flex justify-end gap-3">
              <button className="btn" data-variant="primary" onClick={testAndContinue} disabled={testing}>
                <IconShield />
                {tc('actions.signIn')}
              </button>
            </div>

            <div className="pill">
              <IconShield />
              <span className="help">
                {t('pill.info')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
