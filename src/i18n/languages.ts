/** Languages of the app, left to right only. `code` is the i18next code and the Intl locale. */
export const LANGUAGES = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'it', name: 'Italiano' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pl', name: 'Polski' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'zh-Hans', name: '简体中文' },
] as const;

export type AppLanguage = (typeof LANGUAGES)[number]['code'];
/** "system": follows the phone */
export type LanguagePreference = 'system' | AppLanguage;

/** For a phone in a language the app does not have */
export const FALLBACK_LANGUAGE: AppLanguage = 'en';

export interface DeviceLocale {
  languageCode: string | null;
  languageScriptCode?: string | null;
  regionCode: string | null;
}

const CODES = LANGUAGES.map((l) => l.code) as readonly string[];

function supported(locale: DeviceLocale): AppLanguage | null {
  const code = locale.languageCode?.toLowerCase();
  if (!code) return null;
  // Portuguese: Brazil only; Chinese: simplified script only (not Taiwan, Hong Kong, Macao)
  if (code === 'pt') return 'pt-BR';
  if (code === 'zh') {
    const traditional = locale.languageScriptCode === 'Hant' || ['TW', 'HK', 'MO'].includes(locale.regionCode ?? '');
    return traditional ? null : 'zh-Hans';
  }
  return CODES.includes(code) ? (code as AppLanguage) : null;
}

/** First phone language the app speaks, in the order of the phone settings. */
export function deviceLanguage(locales: DeviceLocale[]): AppLanguage {
  for (const locale of locales) {
    const lang = supported(locale);
    if (lang) return lang;
  }
  return FALLBACK_LANGUAGE;
}

export function resolveLanguage(preference: LanguagePreference, locales: DeviceLocale[]): AppLanguage {
  return preference === 'system' ? deviceLanguage(locales) : preference;
}
