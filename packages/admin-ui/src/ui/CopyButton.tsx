import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconCheck, IconCopy } from './icons';
import { useToast } from './toast';

export function CopyButton({
  text,
  className,
  variant = 'ghost',
  label,
  buttonText,
  disabled,
  onCopied
}: {
  text: string;
  className?: string;
  variant?: 'ghost' | 'primary' | 'secondary';
  label?: string;
  buttonText?: string;
  disabled?: boolean;
  onCopied?: () => void;
}) {
  const { t } = useTranslation('common');
  const toast = useToast();
  const [copied, setCopied] = React.useState(false);
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultLabel = t('copy.copied');

  React.useEffect(
    () => () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    },
    []
  );

  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(text);
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      setCopied(true);
      toast.push({ title: label || defaultLabel, variant: 'success' });
      onCopied?.();
      resetTimerRef.current = setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = null;
      }, 2000);
    } catch {
      toast.push({ title: t('copy.failed'), message: t('copy.permissionDenied'), variant: 'error' });
    }
  };

  return (
    <button
      className={`btn ${variant === 'ghost' ? 'btn--icon' : ''} ${className || ''}`}
      data-variant={variant}
      onClick={copy}
      type="button"
      disabled={disabled}
      aria-label={label || defaultLabel}
      title={label || defaultLabel}
    >
      {copied ? <IconCheck /> : <IconCopy />}
      {typeof buttonText === 'string' && buttonText.trim() ? <span>{buttonText}</span> : null}
    </button>
  );
}
