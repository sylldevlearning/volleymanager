// Confirms the real service functions can still read rows that existed
// before migrations v9/v10 — i.e. the exact row shapes produced by
// database-migrations.test.ts (original fields intact, new columns present
// but null/0 since ALTER TABLE ADD COLUMN backfills existing rows that way).

jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => 'gen-id'),
}));

import { getMatchById, getSetsForMatch } from '../src/services/matchService';
import { getEventsForMatch } from '../src/services/eventService';
import { getPairsForSet } from '../src/services/substitutionService';
import { getDb } from '../src/services/database';
import {
  V8_MATCH_ROW,
  V8_SET_ROW,
  V8_EVENT_ROW,
  V8_SUBSTITUTION_PAIR_ROW,
} from './fixtures/migrationFixtures';

const mockGetDb = getDb as jest.Mock;

function makeMockDb(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
    runAsync: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('getMatchById reads a pre-existing match row post-migration (captains present but null)', async () => {
  const postMigrationRow = { ...V8_MATCH_ROW, captain_home_id: null, captain_away_id: null };
  const db = makeMockDb({ getFirstAsync: jest.fn().mockResolvedValue(postMigrationRow) });
  mockGetDb.mockResolvedValue(db);

  const match = await getMatchById('m1');

  expect(match).not.toBeNull();
  expect(match?.id).toBe('m1');
  expect(match?.teamHomeId).toBe('t1');
  expect(match?.teamAwayId).toBe('t2');
  expect(match?.status).toBe('live');
  expect(match?.firstServeTeamId).toBe('t1');
  expect(match?.captainHomeId).toBeNull();
  expect(match?.captainAwayId).toBeNull();
});

test('getSetsForMatch reads a pre-existing set row post-migration (serving_team_id present but null)', async () => {
  const postMigrationRow = { ...V8_SET_ROW, serving_team_id: null };
  const db = makeMockDb({ getAllAsync: jest.fn().mockResolvedValue([postMigrationRow]) });
  mockGetDb.mockResolvedValue(db);

  const sets = await getSetsForMatch('m1');

  expect(sets).toHaveLength(1);
  expect(sets[0]).toMatchObject({
    id: 's1', matchId: 'm1', setNumber: 1, scoreHome: 10, scoreAway: 8, servingTeamId: null,
  });
});

test('getEventsForMatch reads pre-existing events untouched by the migration', async () => {
  const db = makeMockDb({ getAllAsync: jest.fn().mockResolvedValue([V8_EVENT_ROW]) });
  mockGetDb.mockResolvedValue(db);

  const events = await getEventsForMatch('m1');

  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    id: 'e1', matchId: 'm1', setId: 's1', eventType: 'point_home', isCancelled: false,
  });
});

test('getPairsForSet reads a pre-existing substitution pair post-migration (is_exceptional present but 0)', async () => {
  const postMigrationRow = { ...V8_SUBSTITUTION_PAIR_ROW, is_exceptional: 0 };
  const db = makeMockDb({ getAllAsync: jest.fn().mockResolvedValue([postMigrationRow]) });
  mockGetDb.mockResolvedValue(db);

  const pairs = await getPairsForSet('m1', 's1', 't1');

  expect(pairs).toHaveLength(1);
  expect(pairs[0]).toEqual({
    id: 'p1', matchId: 'm1', setId: 's1', teamId: 't1',
    playerOutId: 'P1', playerInId: 'P2', isLibero: false, isExceptional: false, isCancelled: false,
  });
});
