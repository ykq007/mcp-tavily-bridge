import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconDownload, IconUpload, IconClipboard } from './icons';
import { Portal } from './Portal';

export function ImportExportActions({
  onExportToFile,
  onExportToClipboard,
  onImportFromFile,
  onImportFromClipboard,
  loading
}: {
  onExportToFile: () => void;
  onExportToClipboard: () => void;
  onImportFromFile: () => void;
  onImportFromClipboard: () => void;
  loading?: boolean;
}) {
  const { t } = useTranslation('keys');
  const importMenuId = useId();
  const exportMenuId = useId();

  const [openMenu, setOpenMenu] = useState<null | 'import' | 'export'>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const importRootRef = useRef<HTMLDivElement>(null);
  const exportRootRef = useRef<HTMLDivElement>(null);
  const importTriggerRef = useRef<HTMLButtonElement>(null);
  const exportTriggerRef = useRef<HTMLButtonElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const importItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const exportItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [importMenuPos, setImportMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [exportMenuPos, setExportMenuPos] = useState<{ top: number; left: number } | null>(null);

  const importItems = useMemo(
    () => [
      { key: 'file', icon: <IconUpload />, label: t('import.fromFile'), onSelect: onImportFromFile },
      { key: 'clipboard', icon: <IconClipboard />, label: t('import.fromClipboard'), onSelect: onImportFromClipboard }
    ],
    [onImportFromClipboard, onImportFromFile, t]
  );

  const exportItems = useMemo(
    () => [
      { key: 'file', icon: <IconDownload />, label: t('export.toFile'), onSelect: onExportToFile },
      { key: 'clipboard', icon: <IconClipboard />, label: t('export.toClipboard'), onSelect: onExportToClipboard }
    ],
    [onExportToClipboard, onExportToFile, t]
  );

  const clampMenuPosition = useCallback(
    (opts: { trigger: HTMLButtonElement; menu: HTMLDivElement }) => {
      const rect = opts.trigger.getBoundingClientRect();
      const menuWidth = opts.menu.offsetWidth || 180;
      const menuHeight = opts.menu.offsetHeight || 160;
      const margin = 8;

      let left = rect.left;
      if (left + menuWidth > window.innerWidth - margin) {
        left = window.innerWidth - margin - menuWidth;
      }
      left = Math.max(margin, left);

      const belowTop = rect.bottom + 4;
      const aboveTop = rect.top - 4 - menuHeight;
      const top =
        belowTop + menuHeight <= window.innerHeight - margin
          ? belowTop
          : aboveTop >= margin
            ? aboveTop
            : Math.max(margin, Math.min(belowTop, window.innerHeight - margin - menuHeight));

      return { top, left };
    },
    []
  );

  const updatePosition = useCallback(() => {
    if (openMenu === 'import') {
      const trigger = importTriggerRef.current;
      const menu = importMenuRef.current;
      if (!trigger || !menu) return;
      setImportMenuPos(clampMenuPosition({ trigger, menu }));
      return;
    }
    if (openMenu === 'export') {
      const trigger = exportTriggerRef.current;
      const menu = exportMenuRef.current;
      if (!trigger || !menu) return;
      setExportMenuPos(clampMenuPosition({ trigger, menu }));
    }
  }, [clampMenuPosition, openMenu]);

  const closeMenu = useCallback(
    (menu: 'import' | 'export') => {
      setOpenMenu(null);
      if (menu === 'import') importTriggerRef.current?.focus();
      if (menu === 'export') exportTriggerRef.current?.focus();
    },
    []
  );

  // Click outside to close
  useEffect(() => {
    if (!openMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (importRootRef.current?.contains(target) || importMenuRef.current?.contains(target)) return;
      if (exportRootRef.current?.contains(target) || exportMenuRef.current?.contains(target)) return;

      closeMenu(openMenu);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeMenu, openMenu]);

  useEffect(() => {
    if (!openMenu) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = openMenu === 'import' ? importItems : exportItems;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          closeMenu(openMenu);
          return;
        case 'Tab':
          e.preventDefault();
          closeMenu(openMenu);
          return;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => (prev + 1) % items.length);
          return;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => (prev - 1 + items.length) % items.length);
          return;
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          return;
        case 'End':
          e.preventDefault();
          setFocusedIndex(items.length - 1);
          return;
        case 'Enter':
        case ' ':
          e.preventDefault();
          items[focusedIndex]?.onSelect();
          closeMenu(openMenu);
          return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeMenu, exportItems, focusedIndex, importItems, openMenu]);

  useEffect(() => {
    if (!openMenu) return;
    const refs = openMenu === 'import' ? importItemRefs : exportItemRefs;
    refs.current[focusedIndex]?.focus();
  }, [focusedIndex, openMenu]);

  useEffect(() => {
    if (!openMenu) return;

    // Reset focus index when opening.
    setFocusedIndex(0);
  }, [openMenu]);

  useEffect(() => {
    if (!openMenu) return;

    // Measure + position and focus first item.
    requestAnimationFrame(() => {
      updatePosition();
      const refs = openMenu === 'import' ? importItemRefs : exportItemRefs;
      refs.current[0]?.focus();
    });
  }, [openMenu, updatePosition]);

  useEffect(() => {
    if (!openMenu) return;
    const onWindowChange = () => updatePosition();
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [openMenu, updatePosition]);

  return (
    <>
      {/* Import Button with Dropdown */}
      <div ref={importRootRef} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          ref={importTriggerRef}
          className="btn"
          onClick={() => setOpenMenu((prev) => (prev === 'import' ? null : 'import'))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenMenu('import');
            }
          }}
          disabled={loading}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'import'}
          aria-controls={importMenuId}
        >
          <IconUpload />
          {t('import.button', 'Import')}
        </button>

        {openMenu === 'import' && (
          <Portal>
            <div
              ref={importMenuRef}
              className="actionMenu"
              role="menu"
              id={importMenuId}
              aria-label={t('import.button', 'Import')}
              style={{
                position: 'fixed',
                top: importMenuPos?.top ?? 0,
                left: importMenuPos?.left ?? 0
              }}
            >
              {importItems.map((item, idx) => (
                <button
                  key={item.key}
                  ref={(el) => {
                    importItemRefs.current[idx] = el;
                  }}
                  type="button"
                  className="actionMenuItem"
                  role="menuitem"
                  tabIndex={focusedIndex === idx ? 0 : -1}
                  data-focused={focusedIndex === idx}
                  onMouseMove={() => setFocusedIndex(idx)}
                  onFocus={() => setFocusedIndex(idx)}
                  onClick={() => {
                    item.onSelect();
                    closeMenu('import');
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </Portal>
        )}
      </div>

      {/* Export Button with Dropdown */}
      <div ref={exportRootRef} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          ref={exportTriggerRef}
          className="btn"
          onClick={() => setOpenMenu((prev) => (prev === 'export' ? null : 'export'))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpenMenu('export');
            }
          }}
          disabled={loading}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'export'}
          aria-controls={exportMenuId}
        >
          <IconDownload />
          {t('export.button', 'Export')}
        </button>

        {openMenu === 'export' && (
          <Portal>
            <div
              ref={exportMenuRef}
              className="actionMenu"
              role="menu"
              id={exportMenuId}
              aria-label={t('export.button', 'Export')}
              style={{
                position: 'fixed',
                top: exportMenuPos?.top ?? 0,
                left: exportMenuPos?.left ?? 0
              }}
            >
              {exportItems.map((item, idx) => (
                <button
                  key={item.key}
                  ref={(el) => {
                    exportItemRefs.current[idx] = el;
                  }}
                  type="button"
                  className="actionMenuItem"
                  role="menuitem"
                  tabIndex={focusedIndex === idx ? 0 : -1}
                  data-focused={focusedIndex === idx}
                  onMouseMove={() => setFocusedIndex(idx)}
                  onFocus={() => setFocusedIndex(idx)}
                  onClick={() => {
                    item.onSelect();
                    closeMenu('export');
                  }}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </Portal>
        )}
      </div>
    </>
  );
}
