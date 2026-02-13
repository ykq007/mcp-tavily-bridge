import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const importRootRef = useRef<HTMLDivElement>(null);
  const exportRootRef = useRef<HTMLDivElement>(null);
  const importTriggerRef = useRef<HTMLButtonElement>(null);
  const exportTriggerRef = useRef<HTMLButtonElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const [importMenuPos, setImportMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [exportMenuPos, setExportMenuPos] = useState<{ top: number; left: number } | null>(null);

  const updateImportPosition = useCallback(() => {
    const trigger = importTriggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const top = rect.bottom + 4;
    const left = rect.left;

    setImportMenuPos({ top, left });
  }, []);

  const updateExportPosition = useCallback(() => {
    const trigger = exportTriggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const top = rect.bottom + 4;
    const left = rect.left;

    setExportMenuPos({ top, left });
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!importMenuOpen && !exportMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (importRootRef.current?.contains(target) || importMenuRef.current?.contains(target)) return;
      if (exportRootRef.current?.contains(target) || exportMenuRef.current?.contains(target)) return;

      setImportMenuOpen(false);
      setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [importMenuOpen, exportMenuOpen]);

  // Keyboard navigation for Import menu
  useEffect(() => {
    if (!importMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setImportMenuOpen(false);
        importTriggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [importMenuOpen]);

  // Keyboard navigation for Export menu
  useEffect(() => {
    if (!exportMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setExportMenuOpen(false);
        exportTriggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [exportMenuOpen]);

  useEffect(() => {
    if (importMenuOpen) updateImportPosition();
  }, [importMenuOpen, updateImportPosition]);

  useEffect(() => {
    if (exportMenuOpen) updateExportPosition();
  }, [exportMenuOpen, updateExportPosition]);

  return (
    <>
      {/* Import Button with Dropdown */}
      <div ref={importRootRef} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          ref={importTriggerRef}
          className="btn"
          onClick={() => setImportMenuOpen(!importMenuOpen)}
          disabled={loading}
          aria-haspopup="menu"
          aria-expanded={importMenuOpen}
        >
          <IconUpload />
          {t('import.button', 'Import')}
        </button>

        {importMenuOpen && (
          <Portal>
            <div
              ref={importMenuRef}
              className="actionMenu"
              role="menu"
              style={{
                position: 'fixed',
                top: importMenuPos?.top ?? 0,
                left: importMenuPos?.left ?? 0
              }}
            >
              <button
                type="button"
                className="actionMenuItem"
                role="menuitem"
                onClick={() => {
                  onImportFromFile();
                  setImportMenuOpen(false);
                }}
              >
                <IconUpload />
                <span>{t('import.fromFile')}</span>
              </button>
              <button
                type="button"
                className="actionMenuItem"
                role="menuitem"
                onClick={() => {
                  onImportFromClipboard();
                  setImportMenuOpen(false);
                }}
              >
                <IconClipboard />
                <span>{t('import.fromClipboard')}</span>
              </button>
            </div>
          </Portal>
        )}
      </div>

      {/* Export Button with Dropdown */}
      <div ref={exportRootRef} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          ref={exportTriggerRef}
          className="btn"
          onClick={() => setExportMenuOpen(!exportMenuOpen)}
          disabled={loading}
          aria-haspopup="menu"
          aria-expanded={exportMenuOpen}
        >
          <IconDownload />
          {t('export.button', 'Export')}
        </button>

        {exportMenuOpen && (
          <Portal>
            <div
              ref={exportMenuRef}
              className="actionMenu"
              role="menu"
              style={{
                position: 'fixed',
                top: exportMenuPos?.top ?? 0,
                left: exportMenuPos?.left ?? 0
              }}
            >
              <button
                type="button"
                className="actionMenuItem"
                role="menuitem"
                onClick={() => {
                  onExportToFile();
                  setExportMenuOpen(false);
                }}
              >
                <IconDownload />
                <span>{t('export.toFile')}</span>
              </button>
              <button
                type="button"
                className="actionMenuItem"
                role="menuitem"
                onClick={() => {
                  onExportToClipboard();
                  setExportMenuOpen(false);
                }}
              >
                <IconClipboard />
                <span>{t('export.toClipboard')}</span>
              </button>
            </div>
          </Portal>
        )}
      </div>
    </>
  );
}
