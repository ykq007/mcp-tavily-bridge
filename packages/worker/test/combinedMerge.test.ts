import { describe, it, expect } from 'vitest';
import { mergeAndDedupe } from '../src/mcp/combinedMerge.js';

describe('mergeAndDedupe', () => {
  it('should interleave results from both sources', () => {
    const tavily = [
      { title: 'T1', url: 'https://t1.com', description: 'Tavily 1' },
      { title: 'T2', url: 'https://t2.com', description: 'Tavily 2' }
    ];
    const brave = [
      { title: 'B1', url: 'https://b1.com', description: 'Brave 1' },
      { title: 'B2', url: 'https://b2.com', description: 'Brave 2' }
    ];

    const result = mergeAndDedupe({ tavily, brave });

    expect(result).toHaveLength(4);
    expect(result[0].url).toBe('https://t1.com');
    expect(result[1].url).toBe('https://b1.com');
    expect(result[2].url).toBe('https://t2.com');
    expect(result[3].url).toBe('https://b2.com');
  });

  it('should deduplicate by URL', () => {
    const tavily = [
      { title: 'T1', url: 'https://same.com', description: 'Tavily version' }
    ];
    const brave = [
      { title: 'B1', url: 'https://same.com', description: 'Brave version' }
    ];

    const result = mergeAndDedupe({ tavily, brave });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('T1'); // Tavily wins (appears first)
    expect(result[0].description).toBe('Tavily version');
  });

  it('should respect count limit', () => {
    const tavily = [
      { title: 'T1', url: 'https://t1.com' },
      { title: 'T2', url: 'https://t2.com' },
      { title: 'T3', url: 'https://t3.com' }
    ];
    const brave = [
      { title: 'B1', url: 'https://b1.com' },
      { title: 'B2', url: 'https://b2.com' }
    ];

    const result = mergeAndDedupe({ tavily, brave, count: 3 });

    expect(result).toHaveLength(3);
    expect(result[0].url).toBe('https://t1.com');
    expect(result[1].url).toBe('https://b1.com');
    expect(result[2].url).toBe('https://t2.com');
  });

  it('should handle empty inputs', () => {
    expect(mergeAndDedupe({ tavily: [], brave: [] })).toEqual([]);
    expect(mergeAndDedupe({ tavily: [{ title: 'T1', url: 'https://t1.com' }], brave: [] })).toHaveLength(1);
    expect(mergeAndDedupe({ tavily: [], brave: [{ title: 'B1', url: 'https://b1.com' }] })).toHaveLength(1);
  });

  it('should skip results without URL', () => {
    const tavily = [
      { title: 'T1', url: '', description: 'No URL' },
      { title: 'T2', url: 'https://t2.com', description: 'Has URL' }
    ];
    const brave = [
      { title: 'B1', url: 'https://b1.com' }
    ];

    const result = mergeAndDedupe({ tavily, brave });

    expect(result).toHaveLength(2);
    expect(result.find(r => r.title === 'T1')).toBeUndefined();
  });

  it('should handle uneven lengths', () => {
    const tavily = [
      { title: 'T1', url: 'https://t1.com' }
    ];
    const brave = [
      { title: 'B1', url: 'https://b1.com' },
      { title: 'B2', url: 'https://b2.com' },
      { title: 'B3', url: 'https://b3.com' }
    ];

    const result = mergeAndDedupe({ tavily, brave });

    expect(result).toHaveLength(4);
    expect(result[0].url).toBe('https://t1.com');
    expect(result[1].url).toBe('https://b1.com');
    expect(result[2].url).toBe('https://b2.com');
    expect(result[3].url).toBe('https://b3.com');
  });
});
