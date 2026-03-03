/**
 * Crypto utilities for Cloudflare Workers
 * Uses Web Crypto API instead of Node.js crypto
 */

/**
 * Encrypt data using AES-256-GCM
 */
export async function encrypt(plaintext: string, keyBase64: string): Promise<Uint8Array> {
  const key = await importKey(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Combine IV + ciphertext
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.length);

  return result;
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decrypt(encrypted: Uint8Array, keyBase64: string): Promise<string> {
  const key = await importKey(keyBase64);

  // Extract IV (first 12 bytes) and ciphertext
  const iv = encrypted.slice(0, 12);
  const ciphertext = encrypted.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

/**
 * Import a base64-encoded key for AES-256-GCM
 */
function decodeAes256KeyBytes(keyEncoded: string): Uint8Array {
  const raw = keyEncoded.trim();
  if (!raw) {
    throw new Error('Invalid KEY_ENCRYPTION_SECRET: value is empty.');
  }

  const unquoted =
    (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))
      ? raw.slice(1, -1).trim()
      : raw;

  const normalized = unquoted.replace(/\s+/g, '');

  // Support hex (common in Node deployments). 32 bytes => 64 hex chars.
  const hexMatch = /^(?:0x)?[0-9a-fA-F]{64}$/.test(normalized);
  if (hexMatch) {
    const hex = normalized.startsWith('0x') ? normalized.slice(2) : normalized;
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  // Support base64url ('-' '_' no padding) as well as standard base64.
  let b64 = normalized.replace(/-/g, '+').replace(/_/g, '/');
  const mod = b64.length % 4;
  if (mod === 1) {
    throw new Error(
      'Invalid KEY_ENCRYPTION_SECRET: not valid base64/base64url (bad length). Generate one with `openssl rand -base64 32`.'
    );
  }
  if (mod !== 0) b64 += '='.repeat(4 - mod);

  let decoded: string;
  try {
    decoded = atob(b64);
  } catch (err) {
    // atob() throws a very technical error; surface something actionable.
    throw new Error(
      'Invalid KEY_ENCRYPTION_SECRET: not valid base64/base64url. Generate one with `openssl rand -base64 32`.'
    );
  }

  const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
  if (bytes.length !== 32) {
    throw new Error(
      `Invalid KEY_ENCRYPTION_SECRET: must decode to 32 bytes (got ${bytes.length}). Generate one with \`openssl rand -base64 32\`.`
    );
  }

  return bytes;
}

async function importKey(keyEncoded: string): Promise<CryptoKey> {
  const keyBytes = decodeAes256KeyBytes(keyEncoded);

  return crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}


/**
 * Generate a random token
 */
export function generateToken(length: number = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Mask an API key for display (show first 4 and last 4 chars)
 */
export function maskApiKey(key: string): string {
  if (key.length <= 12) {
    return '*'.repeat(key.length);
  }
  return `${key.substring(0, 4)}${'*'.repeat(key.length - 8)}${key.substring(key.length - 4)}`;
}
