import { describe, expect, it } from 'vitest';
import { clearAdminToken, loadAdminToken, persistAdminToken, type StorageLike } from './adminAuth';

function createMemoryStorage(): StorageLike & { _dump: () => Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
    _dump: () => Object.fromEntries(map.entries())
  };
}

describe('adminAuth', () => {
  it('stores session-only by default and prefers session on load', () => {
    const session = createMemoryStorage();
    const local = createMemoryStorage();

    persistAdminToken('  abc  ', false, { session, local });
    expect(loadAdminToken({ session, local })).toBe('abc');
    expect(Object.keys(local._dump()).length).toBe(0);
  });

  it('stores persistently when remember=true and clears session', () => {
    const session = createMemoryStorage();
    const local = createMemoryStorage();

    persistAdminToken('abc', false, { session, local });
    persistAdminToken('abc', true, { session, local });

    expect(loadAdminToken({ session, local })).toBe('abc');
    expect(Object.keys(session._dump()).length).toBe(0);
    expect(Object.keys(local._dump()).length).toBe(1);
  });

  it('clears token from both storages', () => {
    const session = createMemoryStorage();
    const local = createMemoryStorage();

    persistAdminToken('abc', true, { session, local });
    clearAdminToken({ session, local });
    expect(loadAdminToken({ session, local })).toBe('');
  });

  it('persistAdminToken with empty token clears both storages', () => {
    const session = createMemoryStorage();
    const local = createMemoryStorage();

    persistAdminToken('abc', false, { session, local });
    persistAdminToken('', false, { session, local });
    expect(loadAdminToken({ session, local })).toBe('');
    expect(Object.keys(session._dump()).length).toBe(0);
    expect(Object.keys(local._dump()).length).toBe(0);
  });
});

