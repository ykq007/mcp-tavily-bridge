import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconAlertCircle, IconRefresh } from './icons';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorBanner({ message, onRetry, retrying }: ErrorBannerProps) {
  const { t } = useTranslation('common');
  return (
    <div role="alert" className="card errorBanner">
      <div className="flex items-center gap-3">
        <div className="errorBannerIcon">
          <IconAlertCircle />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="errorBannerTitle">{t('errors.loadingData')}</div>
          <div className="errorBannerMessage">{message}</div>
        </div>
        {onRetry && (
          <button
            className="btn"
            data-variant="ghost"
            onClick={onRetry}
            disabled={retrying}
            style={{ flexShrink: 0 }}
          >
            <IconRefresh className={retrying ? 'spin' : ''} />
            {t('actions.retry')}
          </button>
        )}
      </div>
    </div>
  );
}
