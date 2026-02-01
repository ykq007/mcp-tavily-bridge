import React, { useEffect, useMemo, useState } from 'react';
import { Dialog } from './Dialog';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmVariant = 'danger',
  cancelLabel = 'Cancel',
  requireText,
  requireTextLabel,
  onClose,
  onConfirm,
  confirming
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  cancelLabel?: string;
  requireText?: string;
  requireTextLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
  confirming?: boolean;
}) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  const needsText = typeof requireText === 'string' && requireText.length > 0;
  const canConfirm = useMemo(() => {
    if (confirming) return false;
    if (!needsText) return true;
    return value === requireText;
  }, [confirming, needsText, requireText, value]);

  return (
    <Dialog title={title} description={description} open={open} onClose={onClose}>
      <div className="stack">
        {needsText ? (
          <div className="stack">
            <label className="label" htmlFor="confirm-input">
              {requireTextLabel || 'Type to confirm'}
            </label>
            <input
              id="confirm-input"
              className="input mono"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Type ${requireText} to confirm`}
              autoComplete="off"
            />
            <div className="help">
              This action cannot be undone.
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose} disabled={confirming}>
            {cancelLabel}
          </button>
          <button className="btn" data-variant={confirmVariant} onClick={onConfirm} disabled={!canConfirm}>
            {confirming ? `${confirmLabel}…` : confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

