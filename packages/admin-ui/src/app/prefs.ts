import { readJson, writeJson } from '../lib/storage';
import { loadAdminToken, persistAdminToken } from './adminAuth';

export type Theme = 'light' | 'dark';

export type AdminUiPrefs = {
  apiBaseUrl: string;
  theme: Theme;
  rememberAdminToken: boolean;
  sidebarCollapsed: boolean;
};

const STORAGE_KEY_V1 = 'mcp-tavily-bridge.adminUiPrefs.v1';
const STORAGE_KEY_V2 = 'mcp-tavily-bridge.adminUiPrefs.v2';

export function loadPrefs(defaults: Partial<AdminUiPrefs> = {}): AdminUiPrefs {
  const savedV2 = readJson<Partial<AdminUiPrefs>>(STORAGE_KEY_V2) ?? null;
  const savedV1 = savedV2 ? null : (readJson<any>(STORAGE_KEY_V1) ?? null);

  const apiBaseUrl =
    typeof savedV2?.apiBaseUrl === 'string'
      ? savedV2.apiBaseUrl
      : typeof savedV1?.apiBaseUrl === 'string'
        ? savedV1.apiBaseUrl
        : typeof defaults.apiBaseUrl === 'string'
          ? defaults.apiBaseUrl
          : '';

  const theme: Theme =
    savedV2?.theme === 'dark' || savedV2?.theme === 'light'
      ? savedV2.theme
      : savedV1?.theme === 'dark' || savedV1?.theme === 'light'
        ? savedV1.theme
        : defaults.theme === 'dark' || defaults.theme === 'light'
          ? defaults.theme
          : inferTheme();

  const rememberAdminToken =
    typeof savedV2?.rememberAdminToken === 'boolean'
      ? savedV2.rememberAdminToken
      : typeof defaults.rememberAdminToken === 'boolean'
        ? defaults.rememberAdminToken
        : false;

  const sidebarCollapsed =
    typeof savedV2?.sidebarCollapsed === 'boolean'
      ? savedV2.sidebarCollapsed
      : typeof defaults.sidebarCollapsed === 'boolean'
        ? defaults.sidebarCollapsed
        : false;

  const legacyAdminToken = typeof savedV1?.adminToken === 'string' ? savedV1.adminToken : '';
  if (legacyAdminToken.trim() && !loadAdminToken().trim()) {
    persistAdminToken(legacyAdminToken, true);
  }

  return { apiBaseUrl, theme, rememberAdminToken, sidebarCollapsed };
}

export function savePrefs(next: AdminUiPrefs): void {
  writeJson(STORAGE_KEY_V2, next);
}

function inferTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
