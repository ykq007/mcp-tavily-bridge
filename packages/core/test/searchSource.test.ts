import { describe, it, expect } from 'vitest';
import { parseSearchSourceMode } from '../src/mcp/searchSource.js';

describe('parseSearchSourceMode', () => {
  it('should parse valid modes', () => {
    expect(parseSearchSourceMode('tavily_only')).toBe('tavily_only');
    expect(parseSearchSourceMode('brave_only')).toBe('brave_only');
    expect(parseSearchSourceMode('combined')).toBe('combined');
    expect(parseSearchSourceMode('brave_prefer_tavily_fallback')).toBe('brave_prefer_tavily_fallback');
  });

  it('should handle case insensitivity', () => {
    expect(parseSearchSourceMode('TAVILY_ONLY')).toBe('tavily_only');
    expect(parseSearchSourceMode('Combined')).toBe('combined');
    expect(parseSearchSourceMode('  BRAVE_ONLY  ')).toBe('brave_only');
  });

  it('should fallback on invalid values', () => {
    expect(parseSearchSourceMode('invalid')).toBe('brave_prefer_tavily_fallback');
    expect(parseSearchSourceMode('')).toBe('brave_prefer_tavily_fallback');
    expect(parseSearchSourceMode(null)).toBe('brave_prefer_tavily_fallback');
    expect(parseSearchSourceMode(undefined)).toBe('brave_prefer_tavily_fallback');
    expect(parseSearchSourceMode(123)).toBe('brave_prefer_tavily_fallback');
  });

  it('should use custom fallback', () => {
    expect(parseSearchSourceMode('invalid', 'tavily_only')).toBe('tavily_only');
    expect(parseSearchSourceMode(null, 'brave_only')).toBe('brave_only');
  });
});
