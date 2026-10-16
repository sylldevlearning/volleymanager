// Verifies addPointEvent's refactor to use substitutionRules.predictLiberoAutoExit:
// it must still update the court exactly as before (no regression for referee.tsx,
// which ignores the return value), AND now also returns LiberoAutoExit info so a
// caller (arbitrage.tsx) can persist it as an event.

import { useScoringStore } from '../src/stores/scoringStore';
import { DEFAULT_INDOOR_CONFIG } from '../src/models/match';
import type { Match, MatchSet } from '../src/models/match';
import type { MatchEvent } from '../src/models/event';
import type { Player } from '../src/models/player';

const MATCH: Match = {
  id: 'm1', date: '2026-01-01', format: 'indoor_6v6', mode: 'competition',
  teamHomeId: 't1', teamAwayId: 't2', status: 'live', config: DEFAULT_INDOOR_CONFIG,
  winnerTeamId: null, firstServeTeamId: 't2', captainHomeId: null, captainAwayId: null,
  sidesSwapped: false, actingCaptainHomeId: null, actingCaptainAwayId: null,
  createdAt: '2026-01-01', finishedAt: null,
};

const SET1: MatchSet = {
  id: 's1', matchId: 'm1', setNumber: 1, scoreHome: 0, scoreAway: 0,
  winnerTeamId: null, servingTeamId: 't2', startedAt: '2026-01-01', finishedAt: null,
};

function pointEvent(id: string, eventType: 'point_home' | 'point_away'): MatchEvent {
  return {
    id, matchId: 'm1', setId: 's1', eventType, playerId: null,
    teamId: eventType === 'point_home' ? 't1' : 't2',
    timestamp: '2026-01-01T00:00:01.000Z', details: {}, isCancelled: false,
  };
}

beforeEach(() => {
  useScoringStore.getState().initMatch(MATCH, SET1); // firstServeTeamId = away -> initial serving = away
});

test('returns null when no libero is on court', () => {
  useScoringStore.getState().initLineup('home', { 1: 'A1', 2: 'A2', 3: 'A3', 4: 'A4', 5: 'A5', 6: 'A6' }, [], null);

  const result = useScoringStore.getState().addPointEvent('home', pointEvent('pt-1', 'point_home'));
  expect(result).toBeNull();
});

test('libero stays on court when rotation keeps them in the back row (P6 -> P5)', () => {
  useScoringStore.getState().initLineup(
    'home', { 1: 'A1', 2: 'A2', 3: 'A3', 4: 'A4', 5: 'A5', 6: 'L1' }, [],
    { liberoId: 'L1', isOnCourt: true, replacedPlayerId: 'A6', replacedPosition: 6 },
  );

  const result = useScoringStore.getState().addPointEvent('home', pointEvent('pt-1', 'point_home'));

  expect(result).toBeNull();
  const state = useScoringStore.getState();
  expect(state.onCourtHome[5]).toBe('L1'); // rotated with everyone else, still on court
  expect(state.liberoHome).toEqual({ liberoId: 'L1', isOnCourt: true, replacedPlayerId: 'A6', replacedPosition: 5 });
});

test('libero auto-exits and the replaced player returns when rotation moves them to the front row (P5 -> P4)', () => {
  useScoringStore.getState().initLineup(
    'home', { 1: 'A1', 2: 'A2', 3: 'A3', 4: 'A4', 5: 'L1', 6: 'A6' }, [],
    { liberoId: 'L1', isOnCourt: true, replacedPlayerId: 'A5', replacedPosition: 5 },
  );

  const result = useScoringStore.getState().addPointEvent('home', pointEvent('pt-1', 'point_home'));

  expect(result).toEqual({ side: 'home', liberoId: 'L1', replacedPlayerId: 'A5', position: 4 });
  const state = useScoringStore.getState();
  expect(state.onCourtHome[4]).toBe('A5'); // original player restored at the rotated (front-row) slot
  expect(state.liberoHome).toEqual({ liberoId: 'L1', isOnCourt: false, replacedPlayerId: null, replacedPosition: null });
});

// Exact regression guard for the reported bug: "quand la rotation amène le
// libéro de V vers IV, il est renvoyé en VI" — the replaced player must take
// IV directly; the libero must be fully off the court (not parked at VI).
test('BUG REPRO: libero at V rotating to IV — replaced player goes to IV, libero is NOT left at VI', () => {
  useScoringStore.getState().initLineup(
    'home', { 1: 'A1', 2: 'A2', 3: 'A3', 4: 'A4', 5: 'L1', 6: 'A6' }, [],
    { liberoId: 'L1', isOnCourt: true, replacedPlayerId: 'A5', replacedPosition: 5 },
  );

  useScoringStore.getState().addPointEvent('home', pointEvent('pt-1', 'point_home'));
  const state = useScoringStore.getState();

  // Side-out rotation (pos -> pos-1, wrapping 1->6): A1(1)->6, A2(2)->1, A3(3)->2,
  // A4(4)->3, L1(5)->4 (overridden below), A6(6)->5.
  expect(state.onCourtHome).toEqual({ 1: 'A2', 2: 'A3', 3: 'A4', 4: 'A5', 5: 'A6', 6: 'A1' });
  expect(Object.values(state.onCourtHome)).not.toContain('L1'); // libero (L1) is nowhere on court
  expect(state.liberoHome?.isOnCourt).toBe(false); // libero fully exited, not parked anywhere
});

test('auto-exit also works for the away team (symmetric branch)', () => {
  useScoringStore.getState().initLineup(
    'away', { 1: 'B1', 2: 'B2', 3: 'B3', 4: 'B4', 5: 'L2', 6: 'B6' }, [],
    { liberoId: 'L2', isOnCourt: true, replacedPlayerId: 'B5', replacedPosition: 5 },
  );

  // Initial serving is away (firstServeTeamId = t2). Home scores first -> side-out,
  // home now serves. Then away scores -> side-out again, away rotates this time.
  useScoringStore.getState().addPointEvent('home', pointEvent('pt-1', 'point_home'));
  const result = useScoringStore.getState().addPointEvent('away', pointEvent('pt-2', 'point_away'));

  expect(result).toEqual({ side: 'away', liberoId: 'L2', replacedPlayerId: 'B5', position: 4 });
  expect(useScoringStore.getState().onCourtAway[4]).toBe('B5');
});

// ─── Libero availability after exit (bench restoration) ────────────────────

function liberoPlayer(id: string, number: number): Player {
  return { id, teamId: 't1', firstName: null, lastName: null, number, position: 'libero', photoUri: null, isActive: true, createdAt: '' };
}

test('restoreLiberoToBench adds the libero back to the bench for the given side', () => {
  useScoringStore.getState().initLineup('home', {}, [], null);

  useScoringStore.getState().restoreLiberoToBench('home', liberoPlayer('L1', 7));

  expect(useScoringStore.getState().benchHome).toEqual([liberoPlayer('L1', 7)]);
});

test('restoreLiberoToBench on away does not affect the home bench', () => {
  useScoringStore.getState().initLineup('home', {}, [], null);
  useScoringStore.getState().initLineup('away', {}, [], null);

  useScoringStore.getState().restoreLiberoToBench('away', liberoPlayer('L2', 9));

  expect(useScoringStore.getState().benchAway).toEqual([liberoPlayer('L2', 9)]);
  expect(useScoringStore.getState().benchHome).toEqual([]);
});

test('after a manual applyLiberoExit + restoreLiberoToBench, the libero is available again (on the bench, not on court)', () => {
  const libero = liberoPlayer('L1', 7);
  useScoringStore.getState().initLineup(
    'home', { 1: 'A1', 2: 'A2', 3: 'A3', 4: 'A4', 5: 'A5', 6: 'L1' }, [],
    { liberoId: 'L1', isOnCourt: true, replacedPlayerId: 'A6', replacedPosition: 6 },
  );

  useScoringStore.getState().applyLiberoExit('home');
  useScoringStore.getState().restoreLiberoToBench('home', libero);

  const state = useScoringStore.getState();
  expect(state.onCourtHome[6]).toBe('A6'); // original player back on court
  expect(state.liberoHome?.isOnCourt).toBe(false);
  expect(state.benchHome).toContainEqual(libero); // libero selectable again
});
