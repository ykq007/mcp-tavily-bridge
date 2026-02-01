import { describe, expect, it } from 'vitest';
import { parseClientToken } from '../src/auth/clientToken.js';

describe('clientToken', () => {
  it('parses mcp_<prefix>.<secret>', () => {
    const parsed = parseClientToken('mcp_abcd.1234');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.prefix).toBe('mcp_abcd');
      expect(parsed.secret).toBe('1234');
    }
  });
});

