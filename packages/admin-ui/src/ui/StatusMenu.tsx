import React, { useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect } from 'react';
import type { TavilyKeyStatus } from '../lib/adminApi';
import { Portal } from './Portal';

interface StatusMenuProps {
  status: TavilyKeyStatus;
  onChange: (status: TavilyKeyStatus) => void;
  disabled?: boolean;
}

export function StatusMenu({ status, onChange, disabled }: StatusMenuProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const options: TavilyKeyStatus[] = useMemo(() => ['active', 'disabled', 'cooldown', 'invalid'], []);
  const variant = status === 'active' ? 'success' : status === 'disabled' ? 'neutral' : status === 'cooldown' ? 'warning' : 'danger';

  const [menuPos, setMenuPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const minWidth = rect.width;

    const menuEl = menuRef.current;
    const measuredWidth = menuEl?.offsetWidth ?? Math.max(160, minWidth);
    const measuredHeight = menuEl?.offsetHeight ?? 240;

    let left = rect.left;
    if (left + measuredWidth > window.innerWidth - margin) {
      left = window.innerWidth - margin - measuredWidth;
    }
    left = Math.max(margin, left);

    const belowTop = rect.bottom + 6;
    const aboveTop = rect.top - 6 - measuredHeight;

    const top =
      belowTop + measuredHeight <= window.innerHeight - margin
        ? belowTop
        : aboveTop >= margin
          ? aboveTop
          : Math.max(margin, Math.min(belowTop, window.innerHeight - margin - measuredHeight));

    setMenuPos({ top, left, minWidth });
  }, []);

  const handleMenuRef = useCallback(
    (el: HTMLDivElement | null) => {
      menuRef.current = el;
      if (el) updatePosition();
    },
    [updatePosition]
  );

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;

      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
          break;

        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => (prev + 1) % options.length);
          break;

        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => (prev - 1 + options.length) % options.length);
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          onChange(options[focusedIndex]);
          setOpen(false);
          triggerRef.current?.focus();
          break;

        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;

        case 'End':
          e.preventDefault();
          setFocusedIndex(options.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, focusedIndex, options, onChange]);

  // Reset focus index when opening
  useEffect(() => {
    if (open) {
      const currentIndex = options.indexOf(status);
      setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  }, [open, status, options]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onWindowChange = () => updatePosition();
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [open, updatePosition]);

  return (
    <div ref={rootRef}>
      <button
        ref={triggerRef}
        className="badge mono"
        data-variant={variant}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        disabled={disabled}
        style={{ cursor: disabled ? 'default' : 'pointer', border: 'none' }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Status: ${status}. Click to change.`}
      >
        {status}
        {!disabled && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>▼</span>}
      </button>

      {open ? (
        <Portal>
          <div
            ref={handleMenuRef}
            className="statusMenu"
            role="listbox"
            aria-activedescendant={`status-option-${options[focusedIndex]}`}
            style={{
              position: 'fixed',
              top: menuPos?.top ?? 0,
              left: menuPos?.left ?? 0,
              minWidth: menuPos?.minWidth ?? 140
            }}
          >
            {options.map((opt, index) => (
              <div
                key={opt}
                id={`status-option-${opt}`}
                className="statusMenuItem"
                role="option"
                aria-selected={opt === status}
                data-focused={index === focusedIndex}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: getStatusColor(opt) }} />
                <span className="mono text-sm capitalize">{opt}</span>
              </div>
            ))}
          </div>
        </Portal>
      ) : null}
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active': return 'var(--success)';
    case 'disabled': return 'var(--muted)';
    case 'cooldown': return 'var(--warning)';
    case 'invalid': return 'var(--danger)';
    default: return 'var(--text)';
  }
}
