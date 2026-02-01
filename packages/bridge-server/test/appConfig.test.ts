import { describe, expect, it } from 'vitest';
import { createBridgeApp } from '../src/app.js';

describe('createBridgeApp (config)', () => {
  it('does not throw when required env vars are missing', () => {
    const prevDb = process.env.DATABASE_URL;
    const prevKey = process.env.KEY_ENCRYPTION_SECRET;

    delete process.env.DATABASE_URL;
    delete process.env.KEY_ENCRYPTION_SECRET;

    expect(() => createBridgeApp()).not.toThrow();

    if (typeof prevDb === 'string') process.env.DATABASE_URL = prevDb;
    else delete process.env.DATABASE_URL;
    if (typeof prevKey === 'string') process.env.KEY_ENCRYPTION_SECRET = prevKey;
    else delete process.env.KEY_ENCRYPTION_SECRET;
  });
});

