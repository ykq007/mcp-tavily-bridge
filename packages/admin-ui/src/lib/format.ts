export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export type TimeTranslator = (key: string, options?: { count: number }) => string;

export function formatRelativeSeconds(
  seconds: number | null | undefined,
  t?: TimeTranslator
): string {
  if (!seconds || seconds <= 0) {
    return t ? t('noExpiry') : 'No expiry';
  }
  if (seconds < 60) {
    return t ? t('seconds', { count: seconds }) : `${seconds}s`;
  }
  if (seconds < 3600) {
    const mins = Math.round(seconds / 60);
    return t ? t('minutes', { count: mins }) : `${mins}m`;
  }
  if (seconds < 86400) {
    const hours = Math.round(seconds / 3600);
    return t ? t('hours', { count: hours }) : `${hours}h`;
  }
  const days = Math.round(seconds / 86400);
  return t ? t('days', { count: days }) : `${days}d`;
}

export function maskSecret(token: string): string {
  if (!token) return '';
  if (token.length <= 10) return '••••••';
  return `${token.slice(0, 6)}••••••${token.slice(-4)}`;
}

