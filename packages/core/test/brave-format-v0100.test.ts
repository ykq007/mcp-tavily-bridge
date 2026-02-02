import { describe, expect, it } from 'vitest';

import { formatBraveLocalResultsV0100, formatBraveWebResultsFromTavilyV0100, formatBraveWebResultsV0100 } from '../src/brave/format-v0100.js';

describe('brave format-v0100', () => {
  it('formats web.results into JSON array', () => {
    const text = formatBraveWebResultsV0100({
      web: {
        results: [{ title: 't', url: 'u', description: 'd' }]
      }
    });
    const parsed = JSON.parse(text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toEqual({ title: 't', url: 'u', description: 'd' });
  });

  it('formats top-level results into JSON array', () => {
    const text = formatBraveWebResultsV0100({
      results: [{ title: 't2', url: 'u2', snippet: 's2' }]
    });
    const parsed = JSON.parse(text);
    expect(parsed[0]).toEqual({ title: 't2', url: 'u2', description: 's2' });
  });

  it('formats local results (fallback shapes) into JSON array', () => {
    const text = formatBraveLocalResultsV0100({
      local: {
        results: [{ name: 'n', website: 'w', description: 'd' }]
      }
    });
    const parsed = JSON.parse(text);
    expect(parsed[0]).toEqual({ title: 'n', url: 'w', description: 'd' });
  });

  it('formats Tavily results into Brave JSON array', () => {
    const text = formatBraveWebResultsFromTavilyV0100({
      results: [{ title: 't', url: 'u', content: 'c' }]
    });
    const parsed = JSON.parse(text);
    expect(parsed[0]).toEqual({ title: 't', url: 'u', description: 'c' });
  });
});

