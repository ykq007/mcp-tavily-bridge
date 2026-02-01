import React, { useState, useEffect } from 'react';
import type { AdminApi } from '../lib/adminApi';
import { IconEye, IconEyeOff } from '../ui/icons';
import { CopyButton } from '../ui/CopyButton';
import { IconButton } from '../ui/IconButton';
import { useToast } from '../ui/toast';

interface KeyRevealCellProps {
  keyId: string;
  maskedKey: string;
  api: AdminApi;
}

export function KeyRevealCell({ keyId, maskedKey, api }: KeyRevealCellProps) {
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullKey, setFullKey] = useState<string | null>(null);
  const toast = useToast();

  // Auto-hide after 15 seconds
  useEffect(() => {
    if (revealed && fullKey) {
      const timer = setTimeout(() => {
        setRevealed(false);
        setFullKey(null);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [revealed, fullKey]);

  // Hide on window blur / tab hidden (reduces shoulder-surfing risk)
  useEffect(() => {
    if (!revealed) return;
    const hide = () => {
      setRevealed(false);
      setFullKey(null);
    };
    const onVisibilityChange = () => {
      if (document.hidden) hide();
    };
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [revealed]);

  const handleReveal = async () => {
    if (revealed) {
      // Hide
      setRevealed(false);
      setFullKey(null);
      return;
    }

    // Reveal
    setLoading(true);
    try {
      const { apiKey } = await api.revealKey(keyId);
      setFullKey(apiKey);
      setRevealed(true);
    } catch (e: any) {
      toast.push({ title: 'Reveal failed', message: e.message || 'Error', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="keyReveal">
      <div className="keyRevealValue" data-revealed={revealed}>
        <span className="keyReveal__text mono">
          {revealed && fullKey ? fullKey : maskedKey}
        </span>
      </div>
      <div className="keyReveal__actions">
        <span
          style={{
            visibility: revealed && fullKey ? 'visible' : 'hidden',
            pointerEvents: revealed && fullKey ? 'auto' : 'none'
          }}
        >
          <CopyButton
            text={fullKey ?? ''}
            variant="primary"
            label="Copy key"
            disabled={!revealed || !fullKey}
            className="btn--icon"
          />
        </span>
        <IconButton
          icon={revealed ? <IconEyeOff /> : <IconEye />}
          onClick={handleReveal}
          loading={loading}
          size="sm"
          title={revealed ? 'Hide key' : 'Reveal key'}
          aria-label={revealed ? 'Hide key' : 'Reveal key'}
        />
      </div>
    </div>
  );
}
