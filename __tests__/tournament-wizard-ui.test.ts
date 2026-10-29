import fs from 'fs';
import path from 'path';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';
import { SCREEN_HEADERS } from '../src/navigation/screenHeaders';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const FILES = [
  'app/tournament/index.tsx',
  'app/tournament/new.tsx',
  'src/components/tournament/WizardSteps.tsx',
  'src/components/tournament/TeamLibrarySheet.tsx',
];

const lookup = (dict: unknown, key: string) =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict);

describe('tournament entry and wizard wiring', () => {
  it('"Tournoi" on the home screen opens the tournament list', () => {
    const home = read('app/(tabs)/index.tsx');
    expect(home).toContain("router.push('/tournament')");
    expect(home).toContain("t('home.tournament')");
  });

  it('the list and the wizard have a dark bar with a real title', () => {
    expect(SCREEN_HEADERS['tournament/index'].titleKey).toBe('nav.tournaments');
    expect(SCREEN_HEADERS['tournament/new'].titleKey).toBe('nav.newTournament');
  });

  it('the list reloads when coming back, and opens the wizard', () => {
    const list = read('app/tournament/index.tsx');
    expect(list).toContain('useFocusEffect');
    expect(list).toContain('getTournaments()');
    expect(list).toContain("router.push('/tournament/new')");
  });

  it('the wizard creates through the service, with templates and "Mes équipes"', () => {
    const wizard = read('app/tournament/new.tsx') + read('src/components/tournament/WizardSteps.tsx') + read('src/components/tournament/TeamLibrarySheet.tsx');
    expect(wizard).toContain('createTournament(toCreateInput(');
    expect(wizard).toContain('saveTemplate(');
    expect(wizard).toContain('getTemplates()');
    expect(wizard).toContain('deleteTemplate(');
    expect(wizard).toContain('getAllTeams()');
    expect(wizard).toContain('previewTournament(');
    expect(wizard).toContain('validateStep(');
    // "Retirer au sort" draws a new seed
    expect(wizard).toMatch(/seed: newSeed\(\)/);
    // The setup screens share the same form rows
    expect(wizard).toContain("from '../ui/FormControls'");
    expect(read('app/arbitrage/new.tsx')).toContain("from '../../src/components/ui/FormControls'");
  });

  it('date and start time use the native picker (no typed date or time)', () => {
    const steps = read('src/components/tournament/WizardSteps.tsx');
    expect(steps).toContain("from '@react-native-community/datetimepicker'");
    expect(steps).toContain('<PickerField mode="date"');
    expect(steps).toContain('<PickerField mode="time"');
    expect(steps).not.toContain('datePlaceholder');
    expect(steps).not.toContain('startTimePlaceholder');
  });

  it('teams step: number of teams and courts first, live estimate, editable names, duplicates marked', () => {
    const steps = read('src/components/tournament/WizardSteps.tsx');
    const teamsStep = steps.slice(steps.indexOf('export function TeamsStep'), steps.indexOf('// ─── Step 4'));
    expect(teamsStep.indexOf("t('tournament.wizard.teamCount')")).toBeLessThan(teamsStep.indexOf("t('tournament.wizard.teams'"));
    expect(teamsStep).toContain('setTeamCount(state, count, label)');
    expect(teamsStep).toContain('previewTournament(state)');
    expect(teamsStep).toContain('renameTeam(state, team.key, name)');
    expect(teamsStep).toContain('placeholder={team.fallbackName}');
    expect(teamsStep).toContain('duplicates.has(team.key)');
    expect(teamsStep).toContain("t('tournament.wizard.duplicateName')");
  });

  it('the word "quotient" is gone from the interface', () => {
    expect(JSON.stringify(fr)).not.toMatch(/quotient/i);
    expect(JSON.stringify(en)).not.toMatch(/quotient|ratio/i);
  });

  it('points presets: "Victoire = 1 point" and 3-2-1-0', () => {
    const steps = read('src/components/tournament/WizardSteps.tsx');
    expect(steps).toContain('POINTS_PRESETS.simple');
    expect(steps).toContain('POINTS_PRESETS.fivb');
  });

  it('Brassage + niveaux: a format card, its settings and the matches per team', () => {
    const steps = read('src/components/tournament/WizardSteps.tsx');
    expect(steps).toContain("'brassage_levels'];");
    expect(steps).toContain("t('tournament.wizard.brassageRounds')");
    expect(steps).toContain("t('tournament.wizard.brassageLevels')");
    expect(steps).toContain('estimate.matchesPerTeam');
    for (const dict of [fr, en]) {
      const levels = (dict as unknown as { tournament: { level: Record<string, string> } }).tournament.level;
      expect(Object.keys(levels)).toEqual(['0', '1', '2', '3']);
    }
    expect(fr.tournament.level['0']).toBe('Principale');
    expect(fr.tournament.level['1']).toBe('Consolante');
    expect(fr.tournament.level['2']).toBe('Super-consolante');
  });

  it('asks before throwing away a tournament being set up', () => {
    expect(read('app/tournament/new.tsx')).toContain("'beforeRemove'");
  });

  it('every text it shows exists in French and English', () => {
    const keys = new Set<string>();
    for (const f of FILES) {
      for (const m of read(f).matchAll(/\bt\(\s*'([\w.]+)'/g)) keys.add(m[1]);
      for (const m of read(f).matchAll(/textKey="([\w.]+)"/g)) keys.add(m[1]);
    }
    expect(keys.size).toBeGreaterThan(40);
    // A plural key exists as key_one / key_other
    const kind = (dict: unknown, key: string) =>
      typeof lookup(dict, key) === 'string' || (typeof lookup(dict, `${key}_one`) === 'string' && typeof lookup(dict, `${key}_other`) === 'string')
        ? 'string' : 'missing';
    for (const key of keys) {
      expect([key, kind(fr, key)]).toEqual([key, 'string']);
      expect([key, kind(en, key)]).toEqual([key, 'string']);
    }
  });

  it('dynamic keys exist for every value', () => {
    for (const dict of [fr, en]) {
      const tr = (dict as unknown as { tournament: Record<string, Record<string, string>> }).tournament;
      for (const type of ['indoor_6v6', 'indoor_4v4', 'indoor_3v3', 'beach_2v2']) expect(tr.gameType[type]).toBeTruthy();
      for (const format of ['round_robin', 'pools_knockout', 'knockout', 'brassage_levels']) {
        expect(tr.format[format]).toBeTruthy();
        expect(tr.formatDesc[format]).toBeTruthy();
      }
      for (const rule of ['headToHead', 'setDifference', 'pointDifference', 'pointsScored']) expect(tr.tiebreaker[rule]).toBeTruthy();
      for (const code of ['name_required', 'date_invalid', 'tie_break_too_long', 'team_name_duplicate',
        'start_time_invalid', 'too_few_teams', 'seed_duplicate', 'pool_too_small', 'too_few_qualifiers', 'too_many_best_others',
        'brassage_too_few_teams', 'too_many_levels']) {
        expect(tr.errors[code]).toBeTruthy();
      }
    }
  });
});
