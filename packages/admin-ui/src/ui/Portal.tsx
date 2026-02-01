import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  const container = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.dataset.portalRoot = 'true';
    return el;
  }, []);

  useEffect(() => {
    if (!container) return;
    document.body.appendChild(container);
    setMounted(true);
    return () => {
      container.remove();
    };
  }, [container]);

  if (!container || !mounted) return null;
  return createPortal(children, container);
}

