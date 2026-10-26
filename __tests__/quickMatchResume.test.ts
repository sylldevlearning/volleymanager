// Quick match screen (referee.tsx) closed in the middle of a set: on resume it
// rebuilt the default lineup and an empty set (initMatch + initLineup), so the
// substitutions already made — and the score, rotation and libero — were lost.
// It must replay the set from the DB like the arbitrage screen does
// (reconstructLiveState).

import { FakeSqlDb } from './helpers/fakeSqlDb';

let mockIdCounter = 0;
jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => `id-${++mockIdCounter}`),
}));

import { getDb } from '../src/services/database';
import { createMatch, createSet, updateMatchStatus, updateSet } from '../src/services/matchService';
import { addEvent } from '../src/services/eventService';
import { createPlayer } from '../src/services/playerService';
import { getLineupForSet } from '../src/services/lineupService';
import { useScoringStore, type CourtMap } from '../src/stores/scoringStore';
import { recordSubstitution } from '../src/features/match/recordSubstitution';
import {
  resumeQuickMatch,
  saveStartingLineups,
  startingCourtForNextSet,
} from '../src/features/match/quickMatchLineup';
import { buildLineupState } from '../src/features/lineup/lineupState';
import { DEFAULT_INDOOR_CONFIG } from '../src/models/match';
import type { Player } from '../src/models/player';

const mockGetDb = getDb as jest.Mock;

beforeEach(() => {
  mockIdCounter = 0;
  mockGetDb.mockResolvedValue(new FakeSqlDb());
  useScoringStore.getState().reset();
});

async function setUpMatch() {
  const mk = (teamId: string, number: number, position: Player['position'] = null) =>
    createPlayer({ teamId, firstName: null, lastName: `${teamId}-${number}`, number, position, photoUri: null, isActive: true });
  const home = await Promise.all([1, 2, 3, 4, 5, 6, 7].map((n) => mk('t1', n)));
  const homeLibero = await mk('t1', 13, 'libero');
  const away = await Promise.all([1, 2, 3, 4, 5, 6].map((n) => mk('t2', n)));
  const homeRoster = [...home, homeLibero];

  const created = await createMatch({ format: 'indoor_6v6', mode: 'leisure', teamHomeId: 't1', teamAwayId: 't2', config: DEFAULT_INDOOR_CONFIG });
  await updateMatchStatus(created.id, 'live');
  const match = { ...created, status: 'live' as const };
  const homeCourt: CourtMap = { 1: home[0].id, 2: home[1].id, 3: home[2].id, 4: home[3].id, 5: home[4].id, 6: home[5].id };
  const awayCourt: CourtMap = { 1: away[0].id, 2: away[1].id, 3: away[2].id, 4: away[3].id, 5: away[4].id, 6: away[5].id };
  return { match, home, homeLibero, homeRoster, away, homeCourt, awayCourt };
}

async function point(matchId: string, team: 'home' | 'away') {
  const s = useScoringStore.getState();
  const event = await addEvent({
    matchId, setId: s.currentSet!.id, eventType: team === 'home' ? 'point_home' : 'point_away',
    playerId: null, teamId: null, details: {},
  });
  s.addPointEvent(team, event);
}

test('reproduces the bug: substitutions made before closing the app are replayed on resume', async () => {
  const { match, home, homeLibero, homeRoster, away, homeCourt, awayCourt } = await setUpMatch();

  // ── Live, like referee.tsx: set 1, starting lineups, points, a substitution ──
  const set1 = await createSet(match.id, 1);
  const store = useScoringStore.getState();
  store.initMatch(match, set1);
  await saveStartingLineups(match, set1.id, homeCourt, awayCourt);
  const homeState = buildLineupState(homeRoster, homeCourt);
  store.initLineup('home', homeCourt, homeState.bench, homeState.liberoState);
  store.initLineup('away', awayCourt, [], null);

  await point(match.id, 'home');
  await point(match.id, 'away');
  const ctx = { matchId: match.id, setId: set1.id, teamId: 't1', side: 'home' as const, roster: homeRoster };
  const subPosition = Number(Object.entries(useScoringStore.getState().onCourtHome).find(([, id]) => id === home[3].id)![0]);
  await recordSubstitution(ctx, { playerOutId: home[3].id, playerInId: home[6].id, position: subPosition, isLibero: false });
  await point(match.id, 'away');

  const live = useScoringStore.getState();
  const expected = {
    scoreHome: live.scoreHome, scoreAway: live.scoreAway,
    onCourtHome: live.onCourtHome, onCourtAway: live.onCourtAway,
    benchHome: live.benchHome.map((p) => p.id).sort(),
    substitutionsHome: live.substitutionsHome,
    servingTeam: live.servingTeam,
  };
  expect(expected.onCourtHome[subPosition]).toBe(home[6].id);

  // ── App closed, then the match is opened again ──
  useScoringStore.getState().reset();
  const resumed = await resumeQuickMatch(match.id, { home: homeCourt, away: awayCourt });
  expect(resumed).not.toBeNull();
  useScoringStore.getState().hydrate(resumed!);

  const s = useScoringStore.getState();
  expect(s.onCourtHome).toEqual(expected.onCourtHome);
  expect(s.onCourtAway).toEqual(expected.onCourtAway);
  expect(s.benchHome.map((p) => p.id).sort()).toEqual(expected.benchHome);
  expect(s.benchHome.map((p) => p.id)).toContain(home[3].id); // can still come back
  expect(s.substitutionsHome).toBe(1);
  expect(s.pairsHome.filter((p) => !p.isCancelled)).toHaveLength(1);
  expect([s.scoreHome, s.scoreAway]).toEqual([expected.scoreHome, expected.scoreAway]);
  expect(s.servingTeam).toBe(expected.servingTeam);
  expect(s.liberoHome?.liberoId).toBe(homeLibero.id);
  expect(away).toHaveLength(6);
});

test('a match started before this fix (no saved lineup) still replays its substitutions', async () => {
  const { match, home, homeRoster, homeCourt, awayCourt } = await setUpMatch();
  const set1 = await createSet(match.id, 1);
  useScoringStore.getState().initMatch(match, set1);
  const homeState = buildLineupState(homeRoster, homeCourt);
  useScoringStore.getState().initLineup('home', homeCourt, homeState.bench, homeState.liberoState);
  // No saveStartingLineups: older quick matches never saved one
  await recordSubstitution(
    { matchId: match.id, setId: set1.id, teamId: 't1', side: 'home', roster: homeRoster },
    { playerOutId: home[0].id, playerInId: home[6].id, position: 1, isLibero: false },
  );

  useScoringStore.getState().reset();
  const resumed = await resumeQuickMatch(match.id, { home: homeCourt, away: awayCourt });
  expect(resumed!.onCourtHome[1]).toBe(home[6].id);
  // The default lineup is saved for that set, so the next resume is identical
  expect(await getLineupForSet(match.id, set1.id, 't1')).toHaveLength(6);
});

test('resumes the unfinished set, not the first one', async () => {
  const { match, homeCourt, awayCourt } = await setUpMatch();
  const set1 = await createSet(match.id, 1);
  await saveStartingLineups(match, set1.id, homeCourt, awayCourt);
  useScoringStore.getState().initMatch(match, set1);
  await point(match.id, 'home');
  await updateSet(set1.id, 25, 20, 't1');
  const set2 = await createSet(match.id, 2);
  await saveStartingLineups(match, set2.id, homeCourt, awayCourt);

  const resumed = await resumeQuickMatch(match.id, { home: homeCourt, away: awayCourt });
  expect(resumed!.currentSet.id).toBe(set2.id);
  expect([resumed!.scoreHome, resumed!.scoreAway]).toEqual([0, 0]);
  expect(resumed!.setsHome).toBe(1);
});

test('the next set starts with the players on court, the libero back to the player they replaced', () => {
  const court = { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'L', 6: 'p6' };
  expect(startingCourtForNextSet(court, { liberoId: 'L', isOnCourt: true, replacedPlayerId: 'p5', replacedPosition: 5 }))
    .toEqual({ ...court, 5: 'p5' });
  expect(startingCourtForNextSet(court, null)).toEqual(court);
});
