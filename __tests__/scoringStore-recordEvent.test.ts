// Reproduces a real bug found while building the full-match integration test:
// `state.events` was only ever appended to by addPointEvent, so a substitution
// event was NEVER visible in it. SubstitutionSheet's strict mode passes
// `events` straight into rulesValidator.checkLiberoRallySinceLastReplacement,
// which scans for the LAST libero substitution event — since it was never
// there, the "at least one rally between two libero replacements" rule could
// never actually trigger in the live app (always vacuously ok).

import { useScoringStore } from '../src/stores/scoringStore';
import type { MatchEvent } from '../src/models/event';
import { checkLiberoRallySinceLastReplacement } from '../src/utils/rulesValidator';

function subEvent(id: string, isLibero: boolean): MatchEvent {
  return {
    id, matchId: 'm1', setId: 's1', eventType: 'substitution_home',
    playerId: 'lib1', teamId: 't1', timestamp: `2026-01-01T00:00:00.00${id}Z`,
    details: { playerOutId: 'p6', position: 6, isLibero }, isCancelled: false,
  };
}

beforeEach(() => {
  useScoringStore.getState().reset();
});

test('recordEvent appends an arbitrary event to state.events', () => {
  const event = subEvent('1', true);
  useScoringStore.getState().recordEvent(event);
  expect(useScoringStore.getState().events).toEqual([event]);
});

test('bug repro: without recording the substitution event, the rally rule never sees it (always vacuously ok)', () => {
  // No recordEvent call — mirrors the pre-fix arbitrage.tsx, which only ever
  // appended POINT events to state.events.
  const result = checkLiberoRallySinceLastReplacement(useScoringStore.getState().events, 'home');
  expect(result.ok).toBe(true); // vacuous pass: the rule can't see the libero ever entered
});

test('fix verified: once the libero substitution event is recorded, re-entering with no rally in between is blocked', () => {
  useScoringStore.getState().recordEvent(subEvent('1', true));
  const result = checkLiberoRallySinceLastReplacement(useScoringStore.getState().events, 'home');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.code).toBe('libero_rally_required');
});

test('fix verified: a point recorded after the libero substitution satisfies the rally rule', () => {
  useScoringStore.getState().recordEvent(subEvent('1', true));
  const pointEvent: MatchEvent = {
    id: 'pt1', matchId: 'm1', setId: 's1', eventType: 'point_home',
    playerId: null, teamId: 't1', timestamp: '2026-01-01T00:00:00.002Z', details: {}, isCancelled: false,
  };
  useScoringStore.getState().recordEvent(pointEvent);
  const result = checkLiberoRallySinceLastReplacement(useScoringStore.getState().events, 'home');
  expect(result.ok).toBe(true);
});
