import { describe, expect, it } from 'vitest';
import { formatResearchResultsV0216, formatResultsV0216 } from '../src/tavily/format-v0216.js';

describe('format-v0216', () => {
  it('formats search results with headings', () => {
    const text = formatResultsV0216({
      answer: 'a',
      results: [
        { title: 't', url: 'u', content: 'c', raw_content: 'r', favicon: 'f' }
      ]
    });
    expect(text).toContain('Answer: a');
    expect(text).toContain('Detailed Results:');
    expect(text).toContain('Title: t');
    expect(text).toContain('URL: u');
    expect(text).toContain('Content: c');
    expect(text).toContain('Raw Content: r');
    expect(text).toContain('Favicon: f');
  });

  it('formats research errors with prefix', () => {
    expect(formatResearchResultsV0216({ error: 'x' })).toBe('Research Error: x');
  });
});

