import { describe, expect, it } from 'vitest';
import { tryParseAes256GcmKeyFromEnv } from '../src/crypto/crypto.js';

describe('tryParseAes256GcmKeyFromEnv', () => {
  it('returns ok:false when env var is missing', () => {
    const prev = process.env.TEST_AES_KEY;
    delete process.env.TEST_AES_KEY;

    const parsed = tryParseAes256GcmKeyFromEnv('TEST_AES_KEY');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error).toContain('TEST_AES_KEY');
    }

    if (typeof prev === 'string') process.env.TEST_AES_KEY = prev;
  });

  it('accepts 64-char hex (32 bytes)', () => {
    const prev = process.env.TEST_AES_KEY;
    process.env.TEST_AES_KEY = '00'.repeat(32);

    const parsed = tryParseAes256GcmKeyFromEnv('TEST_AES_KEY');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.key.length).toBe(32);
    }

    if (typeof prev === 'string') process.env.TEST_AES_KEY = prev;
    else delete process.env.TEST_AES_KEY;
  });
});

