import fs from 'fs';
import path from 'path';
import { LANGUAGES } from '../src/i18n/languages';
import { routeAfterCreate } from '../src/features/tournament/wizard';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
type Dict = { [key: string]: string | Dict };
const load = (code: string): Dict => JSON.parse(read(`src/i18n/${code}.json`));
const get = (d: Dict, key: string) => key.split('.').reduce<string | Dict>((o, k) => (o as Dict)[k], d) as string;

describe('"Scanner un QR de match" lives on the tournament list', () => {
  it('no longer on the home screen', () => {
    const home = read('app/(tabs)/index.tsx');
    expect(home).not.toContain("'/scan'");
    expect(home).not.toContain('scanMatchQr');
  });

  it('on the tournament list, outside the list itself (visible when it is empty)', () => {
    const list = read('app/tournament/index.tsx');
    expect(list).toContain("router.push('/scan')");
    expect(list).toContain("t('tournament.list.scanMatchQr')");
    // Not inside renderItem / ListEmptyComponent: it sits before the <FlatList
    expect(list.indexOf("router.push('/scan')")).toBeLessThan(list.indexOf('<FlatList'));
  });

  describe.each(LANGUAGES.map((l) => l.code))('%s', (code) => {
    const d = load(code);
    const button = get(d, 'tournament.list.scanMatchQr');
    const tournament = get(d, 'home.tournament');

    it('the old home keys are gone', () => {
      expect((d.home as Dict).scanMatchQr).toBeUndefined();
      expect((d.home as Dict).scanMatchQrDesc).toBeUndefined();
    });

    it.each([
      'help.home',
      'help.tournaments',
      'help.tournamentMatches',
      'tournament.qr.hint',
      'onboarding.tournament.body',
      'tips.tournament.matches',
    ])('%s names the button', (key) => {
      expect(get(d, key)).toContain(button);
    });

    it.each([
      'help.tournamentMatches',
      'tournament.qr.hint',
      'onboarding.tournament.body',
      'tips.tournament.matches',
    ])('%s says where it is (Tournament button)', (key) => {
      expect(get(d, key)).toContain(tournament);
    });
  });

  it('French and English no longer send the referee to the home screen', () => {
    for (const code of ['fr', 'en']) {
      const d = load(code);
      for (const key of ['help.tournamentMatches', 'tournament.qr.hint']) {
        expect(get(d, key)).not.toMatch(/accueil|home screen/);
      }
    }
  });
});

describe('end of the tournament wizard', () => {
  it('"Créer et lancer" opens the tournament, "Enregistrer pour plus tard" goes back to the list', () => {
    expect(routeAfterCreate('launch', 'abc')).toBe('/tournament/abc');
    expect(routeAfterCreate('later', 'abc')).toBeNull();
  });

  it('the last step offers both buttons', () => {
    const wizard = read('app/tournament/new.tsx');
    expect(wizard).toContain("t('tournament.wizard.createAndLaunch')");
    expect(wizard).toContain("t('tournament.wizard.saveForLater')");
    expect(wizard).toContain("handleCreate('launch')");
    expect(wizard).toContain("handleCreate('later')");
    expect(wizard).toContain('router.replace(');
    expect(wizard).not.toContain("t('tournament.wizard.create')");
  });

  it('texts in French as asked', () => {
    const fr = load('fr');
    expect(get(fr, 'tournament.wizard.createAndLaunch')).toBe('Créer et lancer');
    expect(get(fr, 'tournament.wizard.saveForLater')).toBe('Enregistrer pour plus tard');
  });
});
