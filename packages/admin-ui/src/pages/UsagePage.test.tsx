import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UsagePage } from './UsagePage';

describe('UsagePage layout', () => {
  it('renders a dedicated scroll container for the table', () => {
    const html = renderToStaticMarkup(<UsagePage api={{} as any} />);
    expect(html).toContain('usageTableScroller');
  });
});

