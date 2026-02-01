import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function sha256Bytes(input: string): Buffer {
  return createHash('sha256').update(input, 'utf8').digest();
}

export function timingSafeEqualBytes(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function parseAes256GcmKeyFromEnv(envVar: string): Buffer {
  const raw = process.env[envVar];
  if (!raw) {
    throw new Error(`${envVar} is required (32-byte key as hex or base64).`);
  }
  const hexMatch = /^[0-9a-fA-F]{64}$/.test(raw);
  const key = hexMatch ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(`${envVar} must decode to 32 bytes (got ${key.length}).`);
  }
  return key;
}

export type ParsedAes256GcmEnvKey =
  | { ok: true; key: Buffer }
  | { ok: false; error: string };

export function tryParseAes256GcmKeyFromEnv(envVar: string): ParsedAes256GcmEnvKey {
  try {
    return { ok: true, key: parseAes256GcmKeyFromEnv(envVar) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid key' };
  }
}

export function encryptAes256Gcm(plaintext: string, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

export function decryptAes256Gcm(payload: Buffer, key: Buffer): string {
  if (payload.length < 12 + 16) throw new Error('Invalid encrypted payload');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
