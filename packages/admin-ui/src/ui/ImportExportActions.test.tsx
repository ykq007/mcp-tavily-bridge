import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImportExportActions } from './ImportExportActions';

describe('ImportExportActions', () => {
  it('renders menu triggers with correct aria attributes', () => {
    const html = renderToStaticMarkup(
      <ImportExportActions
        onExportToFile={() => {}}
        onExportToClipboard={() => {}}
        onImportFromFile={() => {}}
        onImportFromClipboard={() => {}}
      />
    );

    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/aria-controls=\"[^\"]+\"/);
  });
});

