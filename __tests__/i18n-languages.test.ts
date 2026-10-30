import fs from 'fs';
import path from 'path';
import { LANGUAGES, deviceLanguage, resolveLanguage, type AppLanguage } from '../src/i18n/languages';
import { formatClock, formatDate, formatNumber, formatPercent } from '../src/i18n/format';

const DICT_DIR = path.join(__dirname, '../src/i18n');
type Dict = { [key: string]: string | Dict };
const load = (code: string): Dict => JSON.parse(fs.readFileSync(path.join(DICT_DIR, `${code}.json`), 'utf8'));

function flatten(dict: Dict, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(dict)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(key, v);
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
  }
  return out;
}

const PLURAL = /_(zero|one|two|few|many|other)$/;
const base = (key: string) => key.replace(PLURAL, '');
const vars = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

const reference = flatten(load('fr'));
const referenceBases = new Set([...reference.keys()].map(base));
const pluralBases = new Set([...reference.keys()].filter((k) => PLURAL.test(k)).map(base));

describe('languages of the app', () => {
  it('French, English and 9 more, none written right to left', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['fr', 'en', 'es', 'pt-BR', 'it', 'de', 'pl', 'tr', 'ru', 'ja', 'zh-Hans']);
    for (const l of LANGUAGES) expect(['ar', 'he', 'fa', 'ur']).not.toContain(l.code);
  });

  it('every language is registered in i18next', () => {
    const index = fs.readFileSync(path.join(DICT_DIR, 'index.ts'), 'utf8');
    for (const l of LANGUAGES) expect(fs.existsSync(path.join(DICT_DIR, `${l.code}.json`))).toBe(true);
    expect(index).toContain('LANGUAGES');
    expect(index).toContain("import 'intl-pluralrules'");
  });

  describe.each(LANGUAGES.map((l) => l.code))('%s', (code) => {
    const dict = flatten(load(code));
    const bases = new Set([...dict.keys()].map(base));

    it('has every key of the app, and no other', () => {
      const missing = [...referenceBases].filter((k) => !bases.has(k));
      const extra = [...bases].filter((k) => !referenceBases.has(k));
      expect(missing).toEqual([]);
      expect(extra).toEqual([]);
    });

    it('has every plural form the language needs', () => {
      // Forms used by counts from 0 to 1000 (Spanish "many" is for millions only)
      const rules = new Intl.PluralRules(code);
      const categories = [...new Set(Array.from({ length: 1001 }, (_, n) => rules.select(n)))];
      const missing: string[] = [];
      for (const b of pluralBases) for (const c of categories) if (!dict.has(`${b}_${c}`)) missing.push(`${b}_${c}`);
      expect(missing).toEqual([]);
    });

    it('keeps the same {{variables}} and no empty text', () => {
      const wrong: string[] = [];
      for (const [key, text] of dict) {
        if (text.trim() === '') wrong.push(`${key}: empty`);
        const ref = reference.get(key) ?? reference.get(`${base(key)}_other`);
        if (ref === undefined) continue;
        // A plural form may leave out {{count}} ("one match")
        const own = vars(text).filter((v) => v !== 'count');
        const expected = vars(ref).filter((v) => v !== 'count');
        if (JSON.stringify([...new Set(own)]) !== JSON.stringify([...new Set(expected)])) wrong.push(`${key}: ${own} ≠ ${expected}`);
      }
      expect(wrong).toEqual([]);
    });
  });
});

describe('phone language', () => {
  const loc = (languageCode: string | null, regionCode: string | null = null, languageScriptCode: string | null = null) =>
    ({ languageCode, regionCode, languageScriptCode });

  it('the first language of the phone the app speaks', () => {
    expect(deviceLanguage([loc('de', 'DE')])).toBe('de');
    expect(deviceLanguage([loc('nl', 'NL'), loc('it', 'IT')])).toBe('it');
    expect(deviceLanguage([loc('pt', 'PT')])).toBe('pt-BR');
    expect(deviceLanguage([loc('zh', 'CN', 'Hans')])).toBe('zh-Hans');
  });

  it('otherwise English (traditional Chinese, Dutch…)', () => {
    expect(deviceLanguage([loc('zh', 'TW')])).toBe('en');
    expect(deviceLanguage([loc('zh', null, 'Hant')])).toBe('en');
    expect(deviceLanguage([loc('nl', 'NL')])).toBe('en');
    expect(deviceLanguage([])).toBe('en');
  });

  it('"Langue du téléphone" follows the phone, a manual choice wins', () => {
    expect(resolveLanguage('system', [loc('ja', 'JP')])).toBe('ja');
    expect(resolveLanguage('pl', [loc('ja', 'JP')])).toBe('pl');
  });
});

describe('dates, times and numbers in the format of the language', () => {
  it('dates', () => {
    expect(formatDate('2026-05-16', 'fr')).toBe('16/05/2026');
    expect(formatDate('2026-05-16', 'en')).toBe('5/16/2026');
    expect(formatDate('2026-05-16', 'de')).toBe('16.5.2026');
    expect(formatDate('2026-05-16', 'ja')).toBe('2026/5/16');
    expect(formatDate('2026-05-16', 'fr', 'long')).toBe('samedi 16 mai 2026');
    expect(formatDate('2026-05-16', 'pl', 'long')).toBe('sobota, 16 maja 2026');
  });

  it('times', () => {
    expect(formatClock('09:00', 'fr')).toBe('09:00');
    expect(formatClock('09:00', 'de')).toBe('09:00');
    expect(formatClock('09:00', 'en')).toMatch(/^9:00\sAM$/);
    expect(formatClock('14:30', 'en')).toMatch(/^2:30\sPM$/);
    expect(formatClock('bad', 'fr')).toBe('bad');
  });

  it('numbers and percentages', () => {
    expect(formatNumber(1234.5, 'fr')).toMatch(/^1\s234,5$/);
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
    expect(formatNumber(1234.5, 'de')).toBe('1.234,5');
    expect(formatPercent(45, 'fr')).toMatch(/^45\s%$/);
    expect(formatPercent(45, 'en')).toBe('45%');
    expect(formatPercent(45, 'tr')).toBe('%45');
  });

  it('language codes are valid Intl locales', () => {
    for (const l of LANGUAGES) {
      expect(Intl.DateTimeFormat.supportedLocalesOf([l.code as AppLanguage])).toHaveLength(1);
    }
  });
});

describe('language preference kept by the app', () => {
  // Required lazily: the store imports AsyncStorage (mocked by jest-expo)
  const { migrateSettings } = require('../src/stores/settingsStore') as typeof import('../src/stores/settingsStore');

  it('French was only the default: it now follows the phone; English stays a choice', () => {
    expect(migrateSettings({ language: 'fr', hapticsEnabled: false }, 0)).toEqual({ language: 'system', hapticsEnabled: false });
    expect(migrateSettings({ language: 'en' }, 0)).toEqual({ language: 'en' });
    expect(migrateSettings({ language: 'de' }, 1)).toEqual({ language: 'de' });
  });

  it('Settings: "Langue du téléphone" first, then the 11 languages, applied at the root', () => {
    const settings = fs.readFileSync(path.join(__dirname, '../app/(tabs)/settings.tsx'), 'utf8');
    expect(settings).toContain("['system', ...LANGUAGES.map((l) => l.code)]");
    const layout = fs.readFileSync(path.join(__dirname, '../app/_layout.tsx'), 'utf8');
    expect(layout).toContain('i18n.changeLanguage(resolveLanguage(language, phoneLocales))');
  });
});

describe('volleyball positions in French', () => {
  it('outside hitter is "Réceptionneur-attaquant", opposite is "Pointu"', () => {
    const fr = load('fr') as { player: { positions: Record<string, string> } };
    expect(fr.player.positions.outside).toBe('Réceptionneur-attaquant');
    expect(fr.player.positions.opposite).toBe('Pointu');
    const en = load('en') as { player: { positions: Record<string, string> } };
    expect([en.player.positions.outside, en.player.positions.opposite]).toEqual(['Outside', 'Opposite']);
  });
});
