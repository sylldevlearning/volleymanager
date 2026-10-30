// Plural rules for every language (Polish, Russian…), whatever the JS engine provides
import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import fr from './fr.json';
import en from './en.json';
import es from './es.json';
import ptBR from './pt-BR.json';
import it from './it.json';
import de from './de.json';
import pl from './pl.json';
import tr from './tr.json';
import ru from './ru.json';
import ja from './ja.json';
import zhHans from './zh-Hans.json';
import { FALLBACK_LANGUAGE, LANGUAGES, deviceLanguage, type AppLanguage } from './languages';

const dictionaries: Record<AppLanguage, typeof fr> = {
  fr, en, es, 'pt-BR': ptBR, it, de, pl, tr, ru, ja, 'zh-Hans': zhHans,
};

const resources = Object.fromEntries(LANGUAGES.map(({ code }) => [code, { translation: dictionaries[code] }]));

i18n.use(initReactI18next).init({
  resources,
  // The root layout then applies the choice made in Settings ("system" by default)
  lng: deviceLanguage(Localization.getLocales()),
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export default i18n;
