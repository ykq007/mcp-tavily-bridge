import React from 'react';
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
  const toast = useToast();
  const [copied, setCopied] = React.useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.push({ title: label || 'Copied to clipboard', variant: 'success' });
      onCopied?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.push({ title: 'Copy failed', message: 'Clipboard permission denied', variant: 'error' });
    }
  };

  return (
    <button
      className={`btn ${variant === 'ghost' ? 'btn--icon' : ''} ${className || ''}`}
      data-variant={variant}
      onClick={copy}
      disabled={disabled}
      aria-label={label || 'Copy to clipboard'}
      title={label || 'Copy to clipboard'}
    >
      {copied ? <IconCheck /> : <IconCopy />}
      {typeof buttonText === 'string' && buttonText.trim() ? <span>{buttonText}</span> : null}
    </button>
  );
}
