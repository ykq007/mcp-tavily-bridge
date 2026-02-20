import React, { useEffect, useId, useRef } from 'react';
import { IconButton } from './IconButton';
import { IconX } from './icons';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Drawer({ open, onClose, title, children }: DrawerProps) {
  const titleId = useId();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus management: trap focus and restore on close
  useEffect(() => {
    if (!open) return;

    // Save current focus
    previousActiveElement.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Focus the drawer
    const drawer = drawerRef.current;
    if (!drawer) return;

    const focusableElements = drawer.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = closeButtonRef.current ?? focusableElements[0] ?? drawer;
    firstFocusable.focus();

    // Restore focus on cleanup
    return () => {
      previousActiveElement.current?.focus();
    };
  }, [open]);

  // Keyboard handlers: Esc + Tab trap
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Handle Escape
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Handle Tab trap
      if (e.key !== 'Tab') return;

      const drawer = drawerRef.current;
      if (!drawer) return;

      const focusableElements = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !(el as any).disabled);

      if (focusableElements.length === 0) {
        e.preventDefault();
        drawer.focus();
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (!activeElement || !drawer.contains(activeElement)) {
        e.preventDefault();
        (e.shiftKey ? lastFocusable : firstFocusable).focus();
        return;
      }

      if (e.shiftKey) {
        if (activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Don't render when closed (fixes a11y issue: aria-modal should not persist)
  if (!open) return null;

  return (
    <>
      <div
        className="drawerOverlay"
        data-open={open}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="drawer"
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={drawerRef}
        tabIndex={-1}
      >
        <div className="drawerHeader">
          <div id={titleId} className="h2">{title}</div>
          <IconButton ref={closeButtonRef} icon={<IconX />} onClick={onClose} aria-label="Close drawer" type="button" />
        </div>
        <div className="drawerBody">
          {children}
        </div>
      </div>
    </>
  );
}
