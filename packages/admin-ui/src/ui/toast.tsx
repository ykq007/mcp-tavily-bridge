import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { IconAlertCircle, IconCheck, IconInfo, IconX } from './icons';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

type Toast = {
  id: string;
  title: string;
  message?: string;
  variant?: ToastVariant;
};

type ToastApi = {
  push: (toast: Omit<Toast, 'id'>) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const TOAST_DURATION = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const full: Toast = { ...toast, id, variant: toast.variant ?? 'info' };
      setToasts((prev) => [full, ...prev].slice(0, 4));
    },
    []
  );

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toastWrap" aria-live="polite" aria-relevant="additions removals">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [progress, setProgress] = useState(100);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const interval = 50;
    const decrement = (interval / TOAST_DURATION) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - decrement;
        if (next <= 0) {
          clearInterval(timer);
          handleDismiss();
          return 0;
        }
        return next;
      });
    }, interval);

    return () => clearInterval(timer);
  }, []);

  function handleDismiss() {
    setIsExiting(true);
    setTimeout(onDismiss, 200);
  }

  const variant = toast.variant ?? 'info';

  const variantConfig = {
    success: { icon: <IconCheck />, color: 'var(--success)' },
    error: { icon: <IconAlertCircle />, color: 'var(--danger)' },
    warning: { icon: <IconAlertCircle />, color: 'var(--warning)' },
    info: { icon: <IconInfo />, color: 'var(--primary)' },
  };

  const config = variantConfig[variant];

  return (
    <div
      className={`toast${isExiting ? ' toast--exiting' : ''}`}
      data-variant={variant}
      role="status"
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div className="toastIcon" data-variant={variant}>
          {config.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="toastTitle">{toast.title}</p>
          {toast.message ? <p className="toastMsg">{toast.message}</p> : null}
        </div>
        <button
          onClick={handleDismiss}
          className="toastDismiss"
          aria-label="Dismiss notification"
        >
          <IconX />
        </button>
      </div>
      <div className="toastProgress">
        <div
          className="toastProgressBar"
          style={{
            width: `${progress}%`,
            background: config.color,
          }}
        />
      </div>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
