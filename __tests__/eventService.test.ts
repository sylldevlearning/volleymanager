jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => 'gen-id'),
}));

import { undoLastEvent } from '../src/services/eventService';
import { getDb } from '../src/services/database';

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

beforeEach(() => {
  jest.clearAllMocks();
});

test('returns null when there is nothing to undo', async () => {
  const db = makeMockDb(null);
  mockGetDb.mockResolvedValue(db);

  expect(await undoLastEvent('m1', 's1')).toBeNull();
});

test('cancels a plain point event with no linked event', async () => {
  const db = makeMockDb({ id: 'pt-1', event_type: 'point_home', details_json: '{}' });
  mockGetDb.mockResolvedValue(db);

  const result = await undoLastEvent('m1', 's1');

  expect(result).toEqual({ cancelledEventId: 'pt-1', linkedCancelledEventId: null });
  const cancelCalls = db.runAsync.mock.calls.filter(([sql]) => String(sql).includes('is_cancelled = 1'));
  expect(cancelCalls).toEqual([['UPDATE match_events SET is_cancelled = 1 WHERE id = ?', ['pt-1']]]);
});

test('cascades: undoing a penalty sanction also cancels its linked point event', async () => {
  const db = makeMockDb({
    id: 'sanction-1',
    event_type: 'sanction_home',
    details_json: JSON.stringify({ sanctionType: 'penalty', awardsPoint: true, pointEventId: 'point-9' }),
  });
  mockGetDb.mockResolvedValue(db);

  const result = await undoLastEvent('m1', 's1');

  expect(result).toEqual({ cancelledEventId: 'sanction-1', linkedCancelledEventId: 'point-9' });
  expect(db.runAsync).toHaveBeenCalledWith('UPDATE match_events SET is_cancelled = 1 WHERE id = ?', ['sanction-1']);
  expect(db.runAsync).toHaveBeenCalledWith('UPDATE match_events SET is_cancelled = 1 WHERE id = ?', ['point-9']);
});

test('does not cascade a warning sanction (no awarded point)', async () => {
  const db = makeMockDb({
    id: 'sanction-2',
    event_type: 'sanction_home',
    details_json: JSON.stringify({ sanctionType: 'warning', awardsPoint: false, pointEventId: null }),
  });
  mockGetDb.mockResolvedValue(db);

  const result = await undoLastEvent('m1', 's1');

  expect(result).toEqual({ cancelledEventId: 'sanction-2', linkedCancelledEventId: null });
  const cancelCalls = db.runAsync.mock.calls.filter(([sql]) => String(sql).includes('is_cancelled = 1'));
  expect(cancelCalls).toHaveLength(1);
});

test('does not cascade a non-sanction event even if it happens to carry a pointEventId-shaped detail', async () => {
  const db = makeMockDb({
    id: 'sub-1',
    event_type: 'substitution_home',
    details_json: JSON.stringify({ isLibero: false }),
  });
  mockGetDb.mockResolvedValue(db);

  const result = await undoLastEvent('m1', 's1');
  expect(result).toEqual({ cancelledEventId: 'sub-1', linkedCancelledEventId: null });
});

test('undoing a substitution event also cancels its linked substitution_pairs row', async () => {
  const db = makeMockDb({
    id: 'sub-2',
    event_type: 'substitution_home',
    details_json: JSON.stringify({ playerOutId: 'P4', position: 1, pairId: 'pair-7', isLibero: false, isExceptional: false, isAutomatic: false }),
  });
  mockGetDb.mockResolvedValue(db);

  await undoLastEvent('m1', 's1');

  expect(db.runAsync).toHaveBeenCalledWith(
    'UPDATE substitution_pairs SET is_cancelled = 1 WHERE id = ?',
    ['pair-7'],
  );
});

test('undoing a substitution_away event also cancels its pair', async () => {
  const db = makeMockDb({
    id: 'sub-3',
    event_type: 'substitution_away',
    details_json: JSON.stringify({ playerOutId: 'P9', position: 6, pairId: 'pair-8', isLibero: true, isAutomatic: true }),
  });
  mockGetDb.mockResolvedValue(db);

  await undoLastEvent('m1', 's1');

  expect(db.runAsync).toHaveBeenCalledWith(
    'UPDATE substitution_pairs SET is_cancelled = 1 WHERE id = ?',
    ['pair-8'],
  );
});

test('undoing a point event does not touch substitution_pairs', async () => {
  const db = makeMockDb({ id: 'pt-9', event_type: 'point_home', details_json: '{}' });
  mockGetDb.mockResolvedValue(db);

  await undoLastEvent('m1', 's1');

  const pairCalls = db.runAsync.mock.calls.filter(([sql]) => String(sql).includes('substitution_pairs'));
  expect(pairCalls).toHaveLength(0);
});

test('wraps the cascading cancels + undo insert in a single transaction', async () => {
  const db = makeMockDb({
    id: 'sanction-3',
    event_type: 'sanction_away',
    details_json: JSON.stringify({ sanctionType: 'penalty', awardsPoint: true, pointEventId: 'point-5' }),
  });
  mockGetDb.mockResolvedValue(db);

  await undoLastEvent('m1', 's1');

  expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
});

test('describes an undone substitution so the live screen can revert the court', async () => {
  const db = makeMockDb({
    id: 'sub-1',
    event_type: 'substitution_away',
    player_id: 'p7',
    details_json: JSON.stringify({ playerOutId: 'p12', position: 4, pairId: 'pair-1', isLibero: false, isExceptional: false }),
  });
  mockGetDb.mockResolvedValue(db);

  const result = await undoLastEvent('m1', 's1');

  expect(result).toEqual({
    cancelledEventId: 'sub-1',
    linkedCancelledEventId: null,
    substitution: {
      side: 'away', playerOutId: 'p12', playerInId: 'p7', position: 4, pairId: 'pair-1', isLibero: false, isExceptional: false,
    },
  });
});
