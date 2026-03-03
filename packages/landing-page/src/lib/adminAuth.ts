type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export const ADMIN_SESSION_TOKEN_KEY = 'mcp-nexus.adminUiAdminToken.session.v1';
export const ADMIN_LOCAL_TOKEN_KEY = 'mcp-nexus.adminUiAdminToken.local.v1';
const ADMIN_PREFS_KEY = 'mcp-nexus.adminUiPrefs.v2';

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

  const sessionToken = safeGet(session, ADMIN_SESSION_TOKEN_KEY);
  if (typeof sessionToken === 'string' && sessionToken.trim()) return sessionToken.trim();

  const localToken = safeGet(local, ADMIN_LOCAL_TOKEN_KEY);
  if (typeof localToken === 'string' && localToken.trim()) return localToken.trim();

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
    safeRemove(session, ADMIN_SESSION_TOKEN_KEY);
    safeRemove(local, ADMIN_LOCAL_TOKEN_KEY);
    return;
  }

  if (remember) {
    safeSet(local, ADMIN_LOCAL_TOKEN_KEY, trimmed);
    safeRemove(session, ADMIN_SESSION_TOKEN_KEY);
    return;
  }

  safeSet(session, ADMIN_SESSION_TOKEN_KEY, trimmed);
  safeRemove(local, ADMIN_LOCAL_TOKEN_KEY);
}

function hasRememberedAdminToken(opts: { local?: StorageLike | null } = {}): boolean {
  const local = opts.local ?? defaultLocalStorage();
  const token = safeGet(local, ADMIN_LOCAL_TOKEN_KEY);
  return typeof token === 'string' && token.trim().length > 0;
}

export function loadRememberAdminTokenPreference(): boolean {
  try {
    const raw = localStorage.getItem(ADMIN_PREFS_KEY);
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = JSON.parse(raw) as { rememberAdminToken?: unknown };
      if (typeof parsed?.rememberAdminToken === 'boolean') {
        return parsed.rememberAdminToken;
      }
    }
  } catch {
    // ignore parse/storage failures
  }
  return hasRememberedAdminToken();
}

export function persistRememberAdminTokenPreference(remember: boolean): void {
  try {
    const raw = localStorage.getItem(ADMIN_PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next =
      parsed && typeof parsed === 'object'
        ? { ...(parsed as Record<string, unknown>), rememberAdminToken: remember }
        : { rememberAdminToken: remember };
    localStorage.setItem(ADMIN_PREFS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage write failures
  }
}
