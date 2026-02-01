import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToastProvider } from '../ui/toast';
import { KeyRevealCell } from './KeyRevealCell';

describe('KeyRevealCell', () => {
  it('renders masked key and reveal button by default', () => {
    const api = {
      revealKey: vi.fn()
    } as any;

    const html = renderToStaticMarkup(
      <ToastProvider>
        <KeyRevealCell keyId="k_123" maskedKey="tvly-••••••••••••" api={api} />
      </ToastProvider>
    );

    expect(html).toContain('tvly-••••••••••••');
    expect(html).toContain('class="keyRevealValue"');
    expect(html).toContain('data-revealed="false"');
    expect(html).toContain('aria-label="Reveal key"');
    expect(html).toContain('aria-label="Copy key"');
    expect(html).toContain('disabled=""');
  });
});
