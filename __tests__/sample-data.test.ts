/**
 * Sample data (« Exemple »): two invented teams in a 5-1, a 3-1 match made of
 * real events (points, rotations, libero, substitutions, timeouts), a half
 * played tournament of 8 invented teams — created once on a fresh install,
 * removed in one go without touching the user's data.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FakeSqlDb } from './helpers/fakeSqlDb';
import { LEGACY_TEAMS } from './fixtures/legacySeedRosters';

let mockIdCounter = 0;
jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => `id-${++mockIdCounter}`),
}));

import { getDb } from '../src/services/database';
import {
  SAMPLE_AWAY, SAMPLE_HOME, SAMPLE_MATCH_SEED, SAMPLE_SETS, SAMPLE_TEAM_KEYS, SAMPLE_TOURNAMENT, type SampleTeam,
} from '../src/features/sample/sampleData';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';
import { buildSampleSets, keyOf, type SampleEvent, type Side } from '../src/features/sample/sampleMatch';
import {
  createSampleDataIfEmpty, deleteSampleData, hasSampleData, SAMPLE_CHECKED_KEY,
} from '../src/services/sampleDataService';
import { createTeam, getAllTeams } from '../src/services/teamService';
import { createMatch, getMatchById, getSetsForMatch } from '../src/services/matchService';
import { computeScore, computeTimeoutsUsed, getEventsForMatch, getEventsForSet } from '../src/services/eventService';
import { getPlayerStatsForMatch } from '../src/services/statsService';
import { getTournamentBundle, getTournaments } from '../src/services/tournamentService';
import { summarizeMatch } from '../src/features/match/matchSummary';
import { replayCourtState } from '../src/utils/courtRotation';
import { validateLiberoSubstitution, checkLiberoRallySinceLastReplacement } from '../src/utils/rulesValidator';
import { isSetWon } from '../src/utils/volleyball-rules';
import { useSettingsStore } from '../src/stores/settingsStore';
import { DEFAULT_INDOOR_CONFIG } from '../src/models/match';
import type { MatchEvent } from '../src/models/event';
import type { Player } from '../src/models/player';

const TEAMS: Record<Side, SampleTeam> = { home: SAMPLE_HOME, away: SAMPLE_AWAY };
const FR = { tournamentName: 'T', teamNames: fr.sample.teams };
const SETS = buildSampleSets(TEAMS, SAMPLE_SETS, SAMPLE_MATCH_SEED);

const mockGetDb = getDb as jest.Mock;
let db: FakeSqlDb;
beforeEach(async () => {
  mockIdCounter = 0;
  db = new FakeSqlDb();
  mockGetDb.mockResolvedValue(db);
  await AsyncStorage.clear();
});

describe('rosters', () => {
  it.each(['home', 'away'] as const)('%s: 12 invented players, a captain, one libero, unique numbers', (side) => {
    const team = TEAMS[side];
    expect(team.players).toHaveLength(12);
    expect(new Set(team.players.map((p) => p.number)).size).toBe(12);
    expect(team.players.filter((p) => p.position === 'libero')).toHaveLength(1);
    const captain = team.players.find((p) => p.number === team.captain)!;
    expect(captain.position).not.toBe('libero');
    const legacy = new Set(LEGACY_TEAMS.flatMap((t) => t.players.map((p) => p.lastName)));
    expect(team.players.filter((p) => legacy.has(p.lastName))).toEqual([]);
  });

  it.each(['home', 'away'] as const)('%s: 5-1 lineup (setter 1, opposite 4, outsides 2 and 5, middles 3 and 6)', (side) => {
    const team = TEAMS[side];
    const at = (pos: 1 | 2 | 3 | 4 | 5 | 6) => team.players.find((p) => p.number === team.lineup[pos])!.position;
    expect([at(1), at(2), at(3), at(4), at(5), at(6)]).toEqual(['setter', 'outside', 'middle', 'opposite', 'outside', 'middle']);
  });

  it('8 tournament teams, the two match teams among them', () => {
    expect(new Set(SAMPLE_TOURNAMENT.teams.map((t) => t.key))).toEqual(new Set(SAMPLE_TEAM_KEYS));
    expect(SAMPLE_TOURNAMENT.teams.map((t) => t.key)).toEqual(expect.arrayContaining([SAMPLE_HOME.key, SAMPLE_AWAY.key]));
  });
});

/** Sample events → MatchEvents (player keys as ids) for the app's own replay and rules. */
function toEvents(events: SampleEvent[]): MatchEvent[] {
  return events.map((e, i) => {
    const base = { id: `e${i}`, matchId: 'm', setId: 's', teamId: e.side, timestamp: String(i).padStart(5, '0'), isCancelled: false, playerId: null as string | null };
    if (e.kind === 'point') return { ...base, eventType: e.side === 'home' ? 'point_home' : 'point_away', details: {} };
    if (e.kind === 'timeout') return { ...base, eventType: e.side === 'home' ? 'timeout_home' : 'timeout_away', details: {} };
    if (e.kind === 'stat') return { ...base, eventType: e.type, playerId: e.player, details: {} };
    return {
      ...base, eventType: e.side === 'home' ? 'substitution_home' : 'substitution_away', playerId: e.playerIn,
      details: { playerOutId: e.playerOut, position: e.position, isLibero: e.isLibero },
    };
  }) as MatchEvent[];
}
const rosterOf = (side: Side): Player[] => TEAMS[side].players.map((p) => ({
  id: keyOf(side, p.number), teamId: side, firstName: p.firstName, lastName: p.lastName, number: p.number,
  position: p.position, photoUri: null, isActive: true, createdAt: '',
}));

describe('the sample match (pure)', () => {
  it('3-1 with the planned scores', () => {
    expect(SETS.map((s) => [s.scoreHome, s.scoreAway, s.winner])).toEqual(SAMPLE_SETS.map((p) => [p.home, p.away, p.home > p.away ? 'home' : 'away']));
    expect(SETS.filter((s) => s.winner === 'home')).toHaveLength(3);
  });

  it.each(SETS.map((s) => [s.setNumber, s] as const))('set %i: the set is won on its last point only', (_n, set) => {
    const events = toEvents(set.events);
    const points = events.filter((e) => e.eventType === 'point_home' || e.eventType === 'point_away');
    points.forEach((_, i) => {
      const { home, away } = computeScore(points.slice(0, i + 1));
      const won = isSetWon(home, away, DEFAULT_INDOOR_CONFIG, false) || isSetWon(away, home, DEFAULT_INDOOR_CONFIG, false);
      expect(won).toBe(i === points.length - 1);
    });
  });

  it.each(SETS.map((s) => [s.setNumber, s] as const))('set %i: at most 2 timeouts and 6 substitutions per team', (_n, set) => {
    const events = toEvents(set.events);
    for (const side of ['home', 'away'] as const) {
      expect(computeTimeoutsUsed(events, side)).toBeLessThanOrEqual(2);
      expect(set.events.filter((e) => e.kind === 'sub' && e.side === side && !e.isLibero).length).toBeLessThanOrEqual(6);
    }
  });

  it.each(SETS.map((s) => [s.setNumber, s] as const))('set %i: libero only for a middle, in the back row, a rally between replacements, never in the front row', (_n, set) => {
    const events = toEvents(set.events);
    set.events.forEach((e, i) => {
      if (e.kind !== 'sub' || !e.isLibero || e.isAutomatic) return;
      const liberoEntering = TEAMS[e.side].players.find((p) => keyOf(e.side, p.number) === e.playerIn)?.position === 'libero';
      if (liberoEntering) {
        expect(TEAMS[e.side].players.find((p) => keyOf(e.side, p.number) === e.playerOut)!.position).toBe('middle');
        expect(validateLiberoSubstitution(e.position).ok).toBe(true);
      }
      expect(checkLiberoRallySinceLastReplacement(events.slice(0, i), e.side).ok).toBe(true);
    });
    // Replayed by the app event by event: 6 players each side, the libero never in front
    for (let i = 1; i <= events.length; i++) {
      const state = replayCourtState({
        startingOnCourtHome: set.lineup.home, startingOnCourtAway: set.lineup.away,
        homeRoster: rosterOf('home'), awayRoster: rosterOf('away'),
        events: events.slice(0, i), initialServingTeam: set.serve,
      });
      for (const side of ['home', 'away'] as const) {
        const court = side === 'home' ? state.onCourtHome : state.onCourtAway;
        expect(new Set(Object.values(court)).size).toBe(6);
        const libero = keyOf(side, TEAMS[side].players.find((p) => p.position === 'libero')!.number);
        expect([court[2], court[3], court[4]]).not.toContain(libero);
      }
    }
  });

  it('the libero plays, and leaves automatically when rotating to the front row', () => {
    const all = SETS.flatMap((s) => s.events);
    expect(all.some((e) => e.kind === 'sub' && e.isLibero && !e.isAutomatic)).toBe(true);
    expect(all.some((e) => e.kind === 'sub' && e.isLibero && e.isAutomatic)).toBe(true);
  });

  it('a starter comes back only for his own substitute, at the place the substitute holds', () => {
    for (const set of SETS) {
      const events = toEvents(set.events);
      set.events.forEach((back, i) => {
        if (back.kind !== 'sub' || back.isLibero) return;
        const first = set.events.slice(0, i).find((s) => s.kind === 'sub' && !s.isLibero && s.playerIn === back.playerOut);
        if (first && first.kind === 'sub') expect(back.playerIn).toBe(first.playerOut);
        const state = replayCourtState({
          startingOnCourtHome: set.lineup.home, startingOnCourtAway: set.lineup.away,
          homeRoster: rosterOf('home'), awayRoster: rosterOf('away'),
          events: events.slice(0, i), initialServingTeam: set.serve,
        });
        const court = back.side === 'home' ? state.onCourtHome : state.onCourtAway;
        expect(court[back.position]).toBe(back.playerOut);
      });
    }
  });

  it('every player action comes from a player of that team', () => {
    for (const e of SETS.flatMap((s) => s.events)) {
      if (e.kind === 'stat') expect(e.player.startsWith(`${e.side}:`)).toBe(true);
    }
  });
});

describe('created on a fresh install', () => {
  it('teams, match, tournament — all marked as samples', async () => {
    expect(await createSampleDataIfEmpty({ ...FR, tournamentName: 'Tournoi d’exemple' })).toBe(true);

    const teams = await getAllTeams();
    expect(teams.map((t) => [t.name, t.shortName, t.isSample])).toEqual([['Les Hérons', 'HÉR', true], ['Les Mouettes', 'MOU', true]]);
    expect(db.tables.get('players')).toHaveLength(24);

    const [matchRow] = db.tables.get('matches')!;
    const match = (await getMatchById(matchRow.id as string))!;
    expect(match).toMatchObject({ status: 'finished', isSample: true, winnerTeamId: match.teamHomeId });
    const sets = await getSetsForMatch(match.id);
    expect(sets.map((s) => [s.scoreHome, s.scoreAway])).toEqual(SAMPLE_SETS.map((p) => [p.home, p.away]));
    for (const s of sets) {
      expect(computeScore(await getEventsForSet(match.id, s.id))).toEqual({ home: s.scoreHome, away: s.scoreAway });
    }
    expect(summarizeMatch(match, sets, {})).toMatchObject({ stopped: false, setsHome: 3, setsAway: 1, winnerTeamId: match.teamHomeId });
    const stats = await getPlayerStatsForMatch(match.id);
    expect(stats.some((s) => s.attackKill > 0)).toBe(true);
    expect((await getEventsForMatch(match.id)).some((e) => e.eventType === 'timeout_away')).toBe(true);

    const [tournament] = await getTournaments();
    expect(tournament).toMatchObject({ name: 'Tournoi d’exemple', isSample: true });
    const bundle = (await getTournamentBundle(tournament.id))!;
    expect(bundle.teams.map((t) => t.name).sort()).toEqual(SAMPLE_TEAM_KEYS.map((k) => fr.sample.teams[k].name).sort());
    const played = bundle.matches.filter((m) => m.winnerId !== null);
    expect(played).toHaveLength(Math.floor(bundle.matches.length / 2));
    expect(bundle.matches.some((m) => m.stage !== 'pool')).toBe(true);
  });

  it('in the phone language (English here), match and tournament teams alike', async () => {
    await createSampleDataIfEmpty({ tournamentName: en.sample.tournamentName, teamNames: en.sample.teams });
    expect((await getAllTeams()).map((t) => t.name)).toEqual(['The Gulls', 'The Herons']);
    const [tournament] = await getTournaments();
    expect(tournament.name).toBe('Sample tournament');
    const bundle = (await getTournamentBundle(tournament.id))!;
    expect(bundle.teams.map((t) => t.name)).toContain('The Hedgehogs');
  });

  it('only once: never again, even after removing them', async () => {
    await createSampleDataIfEmpty(FR);
    await deleteSampleData();
    expect(await createSampleDataIfEmpty(FR)).toBe(false);
    expect(await getAllTeams()).toEqual([]);
  });

  it('not when the app already has data', async () => {
    await createTeam({ name: 'Mon club', shortName: null, logoUri: null, color: '#123456' });
    expect(await createSampleDataIfEmpty(FR)).toBe(false);
    expect(await AsyncStorage.getItem(SAMPLE_CHECKED_KEY)).toBe('1');
    expect(await hasSampleData()).toBe(false);
  });

  it('does not count for the rating request', async () => {
    await createSampleDataIfEmpty(FR);
    expect(useSettingsStore.getState().finishedMatchCount).toBe(0);
  });
});

describe('deleteSampleData', () => {
  it('removes every sample and keeps the user data', async () => {
    await createSampleDataIfEmpty(FR);
    const mine = await createTeam({ name: 'Mon club', shortName: null, logoUri: null, color: '#123456' });
    const other = await createTeam({ name: 'Voisins', shortName: null, logoUri: null, color: '#654321' });
    const myMatch = await createMatch({ format: 'indoor_6v6', mode: 'leisure', teamHomeId: mine.id, teamAwayId: other.id, config: DEFAULT_INDOOR_CONFIG });
    expect(await hasSampleData()).toBe(true);

    await deleteSampleData();

    expect(await hasSampleData()).toBe(false);
    expect((await getAllTeams()).map((t) => t.name)).toEqual(['Mon club', 'Voisins']);
    expect(db.tables.get('players')).toEqual([]);
    expect(db.tables.get('matches')!.map((m) => m.id)).toEqual([myMatch.id]);
    for (const t of ['sets', 'match_events', 'lineups', 'substitution_pairs', 'tournaments', 'tournament_teams', 'tournament_matches', 'tournament_pools']) {
      expect(db.tables.get(t) ?? []).toEqual([]);
    }
  });

  it('a sample team used in one of the user matches stays, as the user team', async () => {
    await createSampleDataIfEmpty(FR);
    const gulls = (await getAllTeams()).find((t) => t.name === 'Les Mouettes')!;
    const mine = await createTeam({ name: 'Mon club', shortName: null, logoUri: null, color: '#123456' });
    await createMatch({ format: 'indoor_6v6', mode: 'leisure', teamHomeId: mine.id, teamAwayId: gulls.id, config: DEFAULT_INDOOR_CONFIG });

    await deleteSampleData();

    const left = await getAllTeams();
    expect(left.map((t) => [t.name, t.isSample])).toEqual([['Les Mouettes', false], ['Mon club', false]]);
  });
});

describe('screens and texts', () => {
  const fs = jest.requireActual<typeof import('fs')>('fs');
  const path = jest.requireActual<typeof import('path')>('path');
  const ROOT = path.join(__dirname, '..');
  const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

  it('created at startup, after the legacy teams cleanup', () => {
    const src = read('src/services/seedService.ts');
    expect(src.indexOf('removeUntouchedLegacyTeams()')).toBeLessThan(src.indexOf('createSampleDataIfEmpty('));
    const layout = read('app/_layout.tsx');
    expect(layout).toMatch(/tournamentName: i18n\.t\('sample\.tournamentName'\)/);
    expect(layout).toMatch(/teamNames: i18n\.t\('sample\.teams', \{ returnObjects: true \}\)/);
  });

  it('« Supprimer les exemples » in the Settings, with a confirmation', () => {
    const src = read('app/(tabs)/settings.tsx');
    expect(src).toMatch(/hasSampleData\(\)/);
    expect(src).toMatch(/await deleteSampleData\(\)/);
    expect(src).toMatch(/t\('settings\.samples\.confirmMessage'\)/);
  });

  it.each([
    ['app/(tabs)/teams.tsx', 'item.team.isSample'],
    ['app/(tabs)/matches.tsx', 'match.isSample'],
    ['app/tournament/index.tsx', 'item.isSample'],
  ])('%s shows the « Exemple » badge', (file, flag) => {
    expect(read(file)).toContain(`{${flag} && <SampleBadge />}`);
  });

  it.each(fs.readdirSync(path.join(ROOT, 'src/i18n')).filter((f: string) => f.endsWith('.json')))('%s has every sample text', (f) => {
    const json = JSON.parse(read(`src/i18n/${f}`));
    for (const v of [json.sample.badge, json.sample.tournamentName, ...Object.values(json.settings.samples)]) {
      expect(typeof v).toBe('string');
      expect((v as string).length).toBeGreaterThan(0);
    }
    expect(Object.keys(json.settings.samples).sort()).toEqual(['confirmMessage', 'confirmTitle', 'delete', 'hint', 'title']);
    // 8 team names, all different, with a short name for the scoreboard
    expect(Object.keys(json.sample.teams).sort()).toEqual([...SAMPLE_TEAM_KEYS].sort());
    const teams = Object.values(json.sample.teams) as { name: string; short: string }[];
    expect(new Set(teams.map((t) => t.name)).size).toBe(8);
    for (const t of teams) {
      expect(t.name.length).toBeGreaterThan(0);
      expect([...t.short].length).toBeGreaterThanOrEqual(2);
      expect([...t.short].length).toBeLessThanOrEqual(4);
    }
  });
});
