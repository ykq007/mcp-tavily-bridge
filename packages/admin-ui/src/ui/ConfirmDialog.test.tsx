import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('disables confirm button until required text is entered', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <ConfirmDialog
          open
          title="Delete key"
          description="This action cannot be undone."
          confirmLabel="Delete"
          confirmVariant="danger"
          requireText="DELETE"
          onClose={() => {}}
          onConfirm={() => {}}
        />
      </I18nextProvider>
    );

    expect(html).toContain('Type DELETE to confirm');
    expect(html).toContain('data-variant="danger"');
    expect(html).toContain('disabled=""');
  });
});

