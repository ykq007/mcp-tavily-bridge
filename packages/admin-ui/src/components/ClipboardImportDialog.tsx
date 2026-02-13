import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '../ui/Dialog';
import type { KeyExportDto, BatchImportResult } from '../lib/adminApi';
import { parseJsonSafely, validateImportData, type ImportPreview } from '../lib/importUtils';

export function ClipboardImportDialog({
  open,
  onClose,
  onConfirm
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: KeyExportDto) => Promise<BatchImportResult>;
}) {
  const { t } = useTranslation('keys');
  const { t: tc } = useTranslation('common');
  const [jsonText, setJsonText] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BatchImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setJsonText(text);
    setPreview(null);
    setError(null);
    setResult(null);

    if (!text.trim()) return;

    setParsing(true);

    try {
      const { data, error: parseError } = parseJsonSafely(text);

      if (parseError) {
        setError(parseError);
        setParsing(false);
        return;
      }

      const previewData = validateImportData(data);
      setPreview(previewData);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to parse JSON');
    } finally {
      setParsing(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      setError(t('import.clipboardReadFailed'));
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      setJsonText(text);
      setPreview(null);
      setError(null);
      setResult(null);
      setParsing(true);

      const { data, error: parseError } = parseJsonSafely(text);

      if (parseError) {
        setError(parseError);
        setParsing(false);
        return;
      }

      const previewData = validateImportData(data);
      setPreview(previewData);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : t('import.clipboardReadFailed'));
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!jsonText || !preview) return;

    setImporting(true);
    setError(null);

    try {
      const data = JSON.parse(jsonText);
      const importResult = await onConfirm(data);
      setResult(importResult);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to import keys');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setJsonText('');
    setPreview(null);
    setError(null);
    setResult(null);
    setParsing(false);
    setImporting(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} title={t('import.clipboardTitle')}>
      <div className="stack">
        {!result ? (
          <>
            <div className="stack">
              <label className="label" htmlFor="import-json">
                {t('import.pasteJson')}
              </label>
              <textarea
                id="import-json"
                value={jsonText}
                onChange={handleTextChange}
                disabled={importing}
                className="input"
                rows={10}
                placeholder='{"schemaVersion": 1, "tavily": [...], "brave": [...]}'
                style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
              />
              <div className="help">{t('import.pasteHelp')}</div>
              <button
                className="btn"
                onClick={handlePasteFromClipboard}
                disabled={importing}
                style={{ alignSelf: 'flex-start' }}
              >
                {t('import.pasteFromClipboard')}
              </button>
            </div>

            {parsing && <div className="help">{t('import.parsing')}</div>}

            {error && (
              <div className="help" style={{ color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            {preview && (
              <div className="stack">
                <div className="help">
                  {t('import.preview', {
                    valid: preview.valid,
                    invalid: preview.invalid,
                    tavily: preview.tavilyCount,
                    brave: preview.braveCount
                  })}
                </div>
                {preview.invalid > 0 && (
                  <div className="help" style={{ color: 'var(--warning)' }}>
                    {t('import.invalidWarning', { count: preview.invalid })}
                  </div>
                )}
              </div>
            )}

            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn" onClick={handleClose} disabled={importing}>
                {tc('actions.cancel')}
              </button>
              <button
                className="btn"
                data-variant="primary"
                onClick={handleImport}
                disabled={!preview || preview.valid === 0 || importing}
              >
                {importing ? t('import.importing') : t('import.confirm')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="stack">
              <div className="h3">{t('import.resultTitle')}</div>
              <div className="help">
                {t('import.resultSummary', {
                  imported: result.summary.imported,
                  failed: result.summary.failed,
                  renamed: result.summary.renamed
                })}
              </div>

              {result.renamed.length > 0 && (
                <div className="stack">
                  <div className="label">{t('import.renamedKeys')}</div>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                    {result.renamed.map((r, i) => (
                      <li key={i}>
                        <span className="mono">{r.from}</span> → <span className="mono">{r.to}</span> ({r.provider})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="stack">
                  <div className="label" style={{ color: 'var(--danger)' }}>
                    {t('import.errors')}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                    {result.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>
                        <span className="mono">{e.label}</span> ({e.provider}): {e.error}
                      </li>
                    ))}
                    {result.errors.length > 10 && (
                      <li>...and {result.errors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" data-variant="primary" onClick={handleClose}>
                {tc('actions.close')}
              </button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
