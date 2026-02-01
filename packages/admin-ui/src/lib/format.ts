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

export function formatRelativeSeconds(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return 'No expiry';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export function maskSecret(token: string): string {
  if (!token) return '';
  if (token.length <= 10) return '••••••';
  return `${token.slice(0, 6)}••••••${token.slice(-4)}`;
}

