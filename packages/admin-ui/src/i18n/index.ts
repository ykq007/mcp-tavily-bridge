import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// English translations
import enCommon from './locales/en/common.json';
import enNav from './locales/en/nav.json';
import enKeys from './locales/en/keys.json';
import enTokens from './locales/en/tokens.json';
import enSettings from './locales/en/settings.json';
import enLogin from './locales/en/login.json';
import enOverview from './locales/en/overview.json';
import enUsage from './locales/en/usage.json';

// Chinese translations
import zhCommon from './locales/zh-CN/common.json';
import zhNav from './locales/zh-CN/nav.json';
import zhKeys from './locales/zh-CN/keys.json';
import zhTokens from './locales/zh-CN/tokens.json';
import zhSettings from './locales/zh-CN/settings.json';
import zhLogin from './locales/zh-CN/login.json';
import zhOverview from './locales/zh-CN/overview.json';
import zhUsage from './locales/zh-CN/usage.json';

export const supportedLanguages = [
  { code: 'en', name: 'English' },
  { code: 'zh-CN', name: '简体中文' }
] as const;

export type SupportedLocale = (typeof supportedLanguages)[number]['code'];

const resources = {
  en: {
    common: enCommon,
    nav: enNav,
    keys: enKeys,
    tokens: enTokens,
    settings: enSettings,
    login: enLogin,
    overview: enOverview,
    usage: enUsage
  },
  'zh-CN': {
    common: zhCommon,
    nav: zhNav,
    keys: zhKeys,
    tokens: zhTokens,
    settings: zhSettings,
    login: zhLogin,
    overview: zhOverview,
    usage: zhUsage
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'nav', 'keys', 'tokens', 'settings', 'login', 'overview', 'usage'],
    interpolation: {
      escapeValue: false // React already escapes values
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'mcp-tavily-bridge.locale',
      caches: ['localStorage']
    }
  });

export default i18n;

export function changeLanguage(locale: SupportedLocale): void {
  i18n.changeLanguage(locale);
  localStorage.setItem('mcp-tavily-bridge.locale', locale);
}

export function getCurrentLanguage(): SupportedLocale {
  const lang = i18n.language;
  if (lang === 'zh-CN' || lang.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}
