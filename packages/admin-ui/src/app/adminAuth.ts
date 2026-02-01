export type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const SESSION_KEY = 'mcp-tavily-bridge.adminUiAdminToken.session.v1';
const LOCAL_KEY = 'mcp-tavily-bridge.adminUiAdminToken.local.v1';

function safeGet(storage: StorageLike | null | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: StorageLike | null | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // ignore (storage may be disabled)
  }
}

function safeRemove(storage: StorageLike | null | undefined, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // ignore (storage may be disabled)
  }
}

function defaultSessionStorage(): StorageLike | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function defaultLocalStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadAdminToken(opts: { session?: StorageLike | null; local?: StorageLike | null } = {}): string {
  const session = opts.session ?? defaultSessionStorage();
  const local = opts.local ?? defaultLocalStorage();
  const sessionToken = safeGet(session, SESSION_KEY);
  if (typeof sessionToken === 'string' && sessionToken.trim()) return sessionToken;
  const localToken = safeGet(local, LOCAL_KEY);
  if (typeof localToken === 'string' && localToken.trim()) return localToken;
  return '';
}

export function persistAdminToken(
  token: string,
  remember: boolean,
  opts: { session?: StorageLike | null; local?: StorageLike | null } = {}
): void {
  const session = opts.session ?? defaultSessionStorage();
  const local = opts.local ?? defaultLocalStorage();
  const trimmed = token.trim();

  if (!trimmed) {
    safeRemove(session, SESSION_KEY);
    safeRemove(local, LOCAL_KEY);
    return;
  }

  if (remember) {
    safeSet(local, LOCAL_KEY, trimmed);
    safeRemove(session, SESSION_KEY);
  } else {
    safeSet(session, SESSION_KEY, trimmed);
    safeRemove(local, LOCAL_KEY);
  }
}

export function clearAdminToken(opts: { session?: StorageLike | null; local?: StorageLike | null } = {}): void {
  const session = opts.session ?? defaultSessionStorage();
  const local = opts.local ?? defaultLocalStorage();
  safeRemove(session, SESSION_KEY);
  safeRemove(local, LOCAL_KEY);
}

