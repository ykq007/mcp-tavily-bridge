import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../ui/toast';
import { SettingsPage } from './SettingsPage';

function renderSettingsPage(opts: { signedIn: boolean }): string {
  return renderToStaticMarkup(
    <ToastProvider>
      <SettingsPage
        api={{} as any}
        value={{ apiBaseUrl: '', theme: 'light' }}
        signedIn={opts.signedIn}
        onChange={vi.fn()}
        onGoToLogin={vi.fn()}
        onSignOut={vi.fn()}
      />
    </ToastProvider>
  );
}

describe('SettingsPage auth actions', () => {
  it('shows Sign in (primary) when signed out', () => {
    const html = renderSettingsPage({ signedIn: false });
    expect(html).toContain('data-variant="primary">Sign in');
    expect(html).not.toContain('data-variant="ghost">Change token');
    expect(html).not.toContain('Sign out');
  });

  it('shows Change token + Sign out when signed in', () => {
    const html = renderSettingsPage({ signedIn: true });
    expect(html).toContain('data-variant="ghost">Change token');
    expect(html).not.toContain('data-variant="primary">Sign in');
    expect(html).toContain('Sign out');
  });
});

