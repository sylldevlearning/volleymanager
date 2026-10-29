import fs from 'fs';
import path from 'path';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';
import { SCREEN_HEADERS } from '../src/navigation/screenHeaders';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const FILES = [
  'app/tournament/[id]/index.tsx',
  'app/tournament/[id]/match/[matchId].tsx',
  'app/tournament/[id]/teams.tsx',
  'app/tournament/[id]/schedule.tsx',
  'src/components/tournament/MatchRow.tsx',
  'src/components/tournament/StandingsTableView.tsx',
];

const lookup = (dict: unknown, key: string) =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict);
const exists = (dict: unknown, key: string) =>
  typeof lookup(dict, key) === 'string' || (typeof lookup(dict, `${key}_one`) === 'string' && typeof lookup(dict, `${key}_other`) === 'string');

describe('tournament screens (phase 3)', () => {
  it('a tournament opens from the list', () => {
    expect(read('app/tournament/index.tsx')).toContain('router.push(`/tournament/${item.id}`)');
  });

  it('every screen has a dark bar with a real title', () => {
    expect(SCREEN_HEADERS['tournament/[id]/index'].titleKey).toBe('nav.tournament');
    expect(SCREEN_HEADERS['tournament/[id]/match/[matchId]'].titleKey).toBe('nav.tournamentMatch');
    expect(SCREEN_HEADERS['tournament/[id]/teams'].titleKey).toBe('nav.tournamentTeams');
    expect(SCREEN_HEADERS['tournament/[id]/schedule'].titleKey).toBe('nav.tournamentSchedule');
  });

  it('the tournament screen: Planning, Matchs, Classement, reloaded when coming back', () => {
    const screen = read('app/tournament/[id]/index.tsx');
    for (const tab of ['tabPlanning', 'tabMatches', 'tabStandings']) expect(screen).toContain(`t('tournament.view.${tab}')`);
    expect(screen).toContain('useFocusEffect');
    expect(screen).toContain('getTournamentBundle(id)');
    expect(screen).toContain('title: bundle?.tournament.name');
    for (const fn of ['slotGroups(', 'matchGroups(', 'standingsTables(', 'bracketRounds(', 'rankingRows(']) expect(screen).toContain(fn);
  });

  it('matches can be filtered by status, phase and team', () => {
    const screen = read('app/tournament/[id]/index.tsx');
    expect(screen).toContain("t('tournament.view.filterToPlay')");
    expect(screen).toContain("t('tournament.view.allPhases')");
    expect(screen).toContain("t('tournament.view.allTeams')");
  });

  it('the menu renames teams, recomputes the schedule, deletes after confirmation', () => {
    const screen = read('app/tournament/[id]/index.tsx');
    expect(screen).toContain('/teams`');
    expect(screen).toContain('/schedule`');
    expect(screen).toContain("t('tournament.view.deleteTitle'");
    expect(screen).toContain('deleteTournament(id)');
  });

  it('score entry: sets, computed winner, forfeit, correction, blocked correction', () => {
    const screen = read('app/tournament/[id]/match/[matchId].tsx');
    expect(screen).toContain('evaluateScore(');
    expect(screen).toContain("source: 'manual'");
    expect(screen).toContain('forfeitId: team.id');
    expect(screen).toContain("t('tournament.score.correctTitle')");
    expect(screen).toContain("outcome.reason === 'blocked'");
    expect(screen).toContain("t('tournament.score.blockedTitle')");
    expect(screen).toContain("t('tournament.score.teamsUnknown')");
    expect(screen).toContain('scoreErrorText(');
    expect(screen).toContain('keyboardType="number-pad"');
  });

  it('teams renamed after creation, planning recomputed without touching results', () => {
    expect(read('app/tournament/[id]/teams.tsx')).toContain('renameTournamentTeam(');
    const schedule = read('app/tournament/[id]/schedule.tsx');
    expect(schedule).toContain('rescheduleTournament(');
    expect(schedule).toContain('<PickerField mode="time"');
  });

  it('every text exists in French and English', () => {
    const keys = new Set<string>();
    for (const f of FILES) {
      for (const m of read(f).matchAll(/\bt\(\s*'([\w.]+)'/g)) keys.add(m[1]);
      for (const m of read(f).matchAll(/textKey="([\w.]+)"/g)) keys.add(m[1]);
    }
    expect(keys.size).toBeGreaterThan(30);
    for (const key of keys) {
      expect([key, exists(fr, key)]).toEqual([key, true]);
      expect([key, exists(en, key)]).toEqual([key, true]);
    }
  });
});
