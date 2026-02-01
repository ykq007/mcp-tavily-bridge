import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToastProvider } from '../ui/toast';
import { KeyCreditsCell } from './KeyCreditsCell';

describe('KeyCreditsCell', () => {
  const api = { refreshKeyCredits: vi.fn() } as any;

  it('renders remaining and provided total', () => {
    const remaining = 500;
    const total = 1500;

    const html = renderToStaticMarkup(
      <ToastProvider>
        <KeyCreditsCell keyId="k_1" remaining={remaining} total={total} lastChecked={null} api={api} />
      </ToastProvider>
    );

    expect(html).toContain(remaining.toLocaleString());
    expect(html).toContain(`/ ${total.toLocaleString()}`);
  });

  it('renders default total (1000) when total is null', () => {
    const remaining = 1000;

    const html = renderToStaticMarkup(
      <ToastProvider>
        <KeyCreditsCell keyId="k_2" remaining={remaining} total={null} lastChecked={null} api={api} />
      </ToastProvider>
    );

    expect(html).toContain(remaining.toLocaleString());
    expect(html).toContain(`/ ${(1000).toLocaleString()}`);
  });

  it('renders Unknown when remaining is null', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <KeyCreditsCell keyId="k_3" remaining={null} total={null} lastChecked={null} api={api} />
      </ToastProvider>
    );

    expect(html).toContain('Unknown');
  });
});

