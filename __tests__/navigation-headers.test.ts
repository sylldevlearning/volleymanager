import fs from 'fs';
import path from 'path';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';
import { SCREEN_HEADERS, darkHeaderOptions } from '../src/navigation/screenHeaders';
import { palette } from '../src/theme/tokens';

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Every route of the root stack, as Expo Router names it ("match/[id]/summary") */
function stackRoutes(dir = APP, prefix = ''): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '(tabs)') return [];
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return stackRoutes(path.join(dir, entry.name), rel);
    if (!entry.name.endsWith('.tsx') || entry.name === '_layout.tsx' || entry.name === '+html.tsx') return [];
    return [rel.replace(/\.tsx$/, '')];
  });
}

const dict = (lang: unknown, key: string) =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], lang);

describe('navigation headers', () => {
  it('declares a header choice for every screen — no technical title like "arbitrage/new"', () => {
    const declared = Object.keys(SCREEN_HEADERS).sort();
    expect(declared).toEqual(stackRoutes().sort());
  });

  it('hides the bar on immersive screens (they have their own buttons)', () => {
    for (const name of ['match/[id]/arbitrage', 'match/[id]/referee', 'match/[id]/lineup', 'onboarding']) {
      expect(SCREEN_HEADERS[name].hidden).toBe(true);
    }
  });

  it.each([
    ['arbitrage/new', 'Configuration du match'],
    ['match/new', 'Nouveau match'],
    ['team/new', 'Nouvelle équipe'],
    ['team/[id]', 'Équipe'],
    ['match/[id]/summary', 'Résumé du match'],
    ['about', 'À propos'],
    ['+not-found', 'Page introuvable'],
  ])('%s gets a real French title: %s', (name, title) => {
    const { titleKey } = SCREEN_HEADERS[name];
    expect(dict(fr, titleKey!)).toBe(title);
    expect(typeof dict(en, titleKey!)).toBe('string');
  });

  it('uses the dark theme of the app, back arrow without text', () => {
    expect(darkHeaderOptions.headerStyle).toEqual({ backgroundColor: palette.background });
    expect(darkHeaderOptions.headerTintColor).toBe(palette.textPrimary);
    expect(darkHeaderOptions.headerBackButtonDisplayMode).toBe('minimal');
    expect(darkHeaderOptions.contentStyle).toEqual({ backgroundColor: palette.background });
  });

  it('the root stack is built from that table', () => {
    const layout = read('app/_layout.tsx');
    expect(layout).toContain('screenOptions={darkHeaderOptions}');
    expect(layout).toContain('SCREEN_HEADERS');
  });

  it('the team screen shows the team name', () => {
    expect(read('app/team/[id].tsx')).toMatch(/<Stack\.Screen options=\{\{ title: team\?\.name \?\? t\('nav\.team'\) \}\} \/>/);
  });

  it('no duplicated in-page header on screens that now have the bar', () => {
    expect(read('app/about.tsx')).not.toContain('styles.backBtn');
    expect(read('app/arbitrage/new.tsx')).not.toContain("t('arbitrageSetup.title')");
  });

  it('the lineup screen has its own back arrow', () => {
    const lineup = read('app/match/[id]/lineup.tsx');
    expect(lineup).toContain('router.back()');
    expect(lineup).toContain('ArrowLeft');
  });
});
