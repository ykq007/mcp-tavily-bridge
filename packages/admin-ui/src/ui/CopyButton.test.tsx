import React from 'react';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyButton } from './CopyButton';
import { ToastProvider } from './toast';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('CopyButton', () => {
  it('renders with type button to avoid form submission side effects', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <CopyButton text="mcp_test.123" />
      </ToastProvider>
    );

    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="copy.copied"');
  });

  it('passes disabled state through to the button', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <CopyButton text="mcp_test.123" disabled />
      </ToastProvider>
    );

    expect(html).toContain('disabled=""');
  });

  it('keeps disabled state independent from copied state so copy can be retried', () => {
    const source = readFileSync(new URL('./CopyButton.tsx', import.meta.url), 'utf8');
    expect(source).toContain('disabled={disabled}');
    expect(source).not.toMatch(/disabled=\{[^}]*copied[^}]*\}/);
    expect(source).toContain('setCopied(false)');
  });
});
