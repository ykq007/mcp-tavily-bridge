import React, { useEffect, useId, useRef } from 'react';
import { IconX } from './icons';

export function Dialog({
  title,
  description,
  open,
  onClose,
  children
}: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus trap + restore focus
  useEffect(() => {
    if (!open) return;

    // Store the element that was focused before dialog opened
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus first focusable element in dialog
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableElements = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    if (firstFocusable) {
      firstFocusable.focus();
    }

    // Cleanup: restore focus when dialog closes
    return () => {
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [open]);

  // Keyboard handlers (Esc + Tab trap)
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap: Tab/Shift+Tab cycling
      if (e.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusableElements = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusableElements.length === 0) return;

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (e.shiftKey) {
          // Shift+Tab: cycle backwards
          if (activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          // Tab: cycle forwards
          if (activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Lock body scroll
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

  if (!open) return null;

  return (
    <div
      className="dialogOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog" ref={dialogRef}>
        <div className="dialogHeader">
          <div className="flex flex-col gap-1">
            <div id={titleId} className="h2">
              {title}
            </div>
            {description === '' ? null : <div className="help">{description ?? 'Press Esc to close'}</div>}
          </div>
          <button className="btn" data-variant="ghost" onClick={onClose} aria-label="Close dialog">
            <IconX />
          </button>
        </div>
        <div className="dialogBody">{children}</div>
      </div>
    </div>
  );
}
