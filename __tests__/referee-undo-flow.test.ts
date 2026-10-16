// Confirms the exact two-step flow referee.tsx's handleUndo performs for a
// SIMPLE point (not a sanction) still works after undoLastEvent's return
// shape changed from a bare string to { cancelledEventId, linkedCancelledEventId }.
//
//   const result = await undoLastEvent(match.id, currentSet.id);
//   if (result) {
//     undoPoint(result.cancelledEventId);
//     if (result.linkedCancelledEventId) undoPoint(result.linkedCancelledEventId);
//   }
//
// Uses the REAL eventService.undoLastEvent (DB mocked) and the REAL
// scoringStore (not mocked) to catch any integration regression between them.

jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => 'gen-id'),
}));

import { undoLastEvent } from '../src/services/eventService';
import { getDb } from '../src/services/database';
import { useScoringStore } from '../src/stores/scoringStore';
import { DEFAULT_INDOOR_CONFIG } from '../src/models/match';
import type { Match, MatchSet } from '../src/models/match';
import type { MatchEvent } from '../src/models/event';

const mockGetDb = getDb as jest.Mock;

function makeMockDb(lastRow: Record<string, unknown> | null) {
  return {
    getFirstAsync: jest.fn().mockResolvedValue(lastRow),
    runAsync: jest.fn().mockResolvedValue(undefined),
    withExclusiveTransactionAsync: jest.fn(async (cb: () => Promise<void>) => {
      await cb();
    }),
  };
}

const MATCH: Match = {
  id: 'm1', date: '2026-01-01', format: 'indoor_6v6', mode: 'competition',
  teamHomeId: 't1', teamAwayId: 't2', status: 'live', config: DEFAULT_INDOOR_CONFIG,
  winnerTeamId: null, firstServeTeamId: 't1', captainHomeId: null, captainAwayId: null,
  sidesSwapped: false, actingCaptainHomeId: null, actingCaptainAwayId: null,
  createdAt: '2026-01-01', finishedAt: null,
};

const SET1: MatchSet = {
  id: 's1', matchId: 'm1', setNumber: 1, scoreHome: 0, scoreAway: 0,
  winnerTeamId: null, servingTeamId: 't1', startedAt: '2026-01-01', finishedAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  useScoringStore.getState().initMatch(MATCH, SET1);
});

test('undoing a simple point reverts the score and the serving team', async () => {
  const pointEvent: MatchEvent = {
    id: 'pt-1', matchId: 'm1', setId: 's1', eventType: 'point_home',
    playerId: null, teamId: 't1', timestamp: '2026-01-01T00:00:01.000Z',
    details: {}, isCancelled: false,
  };
  // Simulate the referee tapping the home score button (home scores -> serving stays home,
  // since home was already serving per SET1.servingTeamId / initialServingTeam = home).
  useScoringStore.getState().addPointEvent('home', pointEvent);
  expect(useScoringStore.getState().scoreHome).toBe(1);

  // referee.tsx's handleUndo: call the real undoLastEvent, DB mocked to return that point row.
  const db = makeMockDb({ id: 'pt-1', event_type: 'point_home', details_json: '{}' });
  mockGetDb.mockResolvedValue(db);

  const result = await undoLastEvent('m1', 's1');
  expect(result).toEqual({ cancelledEventId: 'pt-1', linkedCancelledEventId: null });

  useScoringStore.getState().undoPoint(result!.cancelledEventId);
  if (result!.linkedCancelledEventId) useScoringStore.getState().undoPoint(result!.linkedCancelledEventId);

  expect(useScoringStore.getState().scoreHome).toBe(0);
  expect(useScoringStore.getState().scoreAway).toBe(0);
  expect(useScoringStore.getState().servingTeam).toBe('home');
});

test('undoing a simple away point after a side-out reverts the rotation side-effect too', async () => {
  // Home scores first (stays serving home), then away scores (side-out -> away now serves).
  useScoringStore.getState().addPointEvent('home', {
    id: 'pt-1', matchId: 'm1', setId: 's1', eventType: 'point_home',
    playerId: null, teamId: 't1', timestamp: '2026-01-01T00:00:01.000Z', details: {}, isCancelled: false,
  });
  useScoringStore.getState().addPointEvent('away', {
    id: 'pt-2', matchId: 'm1', setId: 's1', eventType: 'point_away',
    playerId: null, teamId: 't2', timestamp: '2026-01-01T00:00:02.000Z', details: {}, isCancelled: false,
  });
  expect(useScoringStore.getState().servingTeam).toBe('away');

  const db = makeMockDb({ id: 'pt-2', event_type: 'point_away', details_json: '{}' });
  mockGetDb.mockResolvedValue(db);

  const result = await undoLastEvent('m1', 's1');
  useScoringStore.getState().undoPoint(result!.cancelledEventId);

  expect(useScoringStore.getState().scoreHome).toBe(1);
  expect(useScoringStore.getState().scoreAway).toBe(0);
  // Serving team is recomputed from the remaining active events -> back to home.
  expect(useScoringStore.getState().servingTeam).toBe('home');
});

test('undoing a simple point never triggers a second cascading cancel', async () => {
  useScoringStore.getState().addPointEvent('home', {
    id: 'pt-1', matchId: 'm1', setId: 's1', eventType: 'point_home',
    playerId: null, teamId: 't1', timestamp: '2026-01-01T00:00:01.000Z', details: {}, isCancelled: false,
  });

  const db = makeMockDb({ id: 'pt-1', event_type: 'point_home', details_json: '{}' });
  mockGetDb.mockResolvedValue(db);

  const result = await undoLastEvent('m1', 's1');

  expect(result!.linkedCancelledEventId).toBeNull();
  const cancelCalls = db.runAsync.mock.calls.filter(([sql]) => String(sql).includes('is_cancelled = 1'));
  expect(cancelCalls).toHaveLength(1);
});
