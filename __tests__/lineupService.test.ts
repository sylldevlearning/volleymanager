jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => 'gen-id'),
}));

import { saveLineup, getLineupForSet } from '../src/services/lineupService';
import { getDb, generateId } from '../src/services/database';

const mockGetDb = getDb as jest.Mock;
const mockGenerateId = generateId as jest.Mock;

function makeMockDb(rows: object[] = []) {
  return {
    getAllAsync: jest.fn().mockResolvedValue(rows),
    runAsync: jest.fn().mockResolvedValue(undefined),
    withExclusiveTransactionAsync: jest.fn(async (cb: () => Promise<void>) => {
      await cb();
    }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGenerateId.mockReturnValue('gen-id');
});

// ─── saveLineup ─────────────────────────────────────────────────────────────

describe('saveLineup', () => {
  it('deletes existing rows for (match, set, team) before inserting', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);

    await saveLineup('m1', 's1', 't1', [
      { playerId: 'P1', position: 1, isStarter: true, isLibero: false },
    ]);

    expect(db.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('DELETE FROM lineups'),
      ['m1', 's1', 't1'],
    );
  });

  it('inserts one row per entry', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);

    await saveLineup('m1', 's1', 't1', [
      { playerId: 'P1', position: 1, isStarter: true, isLibero: false },
      { playerId: 'P2', position: 2, isStarter: true, isLibero: false },
    ]);

    expect(db.runAsync).toHaveBeenCalledTimes(3); // 1 delete + 2 inserts
    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO lineups'),
      ['gen-id', 'm1', 's1', 't1', 'P1', 1, 1, 0],
    );
  });

  it('encodes isStarter/isLibero as 0/1', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);

    await saveLineup('m1', 's1', 't1', [
      { playerId: 'L1', position: 5, isStarter: false, isLibero: true },
    ]);

    expect(db.runAsync).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      ['gen-id', 'm1', 's1', 't1', 'L1', 5, 0, 1],
    );
  });

  it('saving an empty lineup only deletes, inserts nothing', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);

    await saveLineup('m1', 's1', 't1', []);

    expect(db.runAsync).toHaveBeenCalledTimes(1);
  });

  it('wraps the whole delete+insert sequence in a single transaction', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);

    await saveLineup('m1', 's1', 't1', [
      { playerId: 'P1', position: 1, isStarter: true, isLibero: false },
    ]);

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });
});

// ─── getLineupForSet ────────────────────────────────────────────────────────

describe('getLineupForSet', () => {
  it('returns empty array when no lineup has been saved yet', async () => {
    const db = makeMockDb([]);
    mockGetDb.mockResolvedValue(db);

    expect(await getLineupForSet('m1', 's1', 't1')).toEqual([]);
  });

  it('maps DB rows to Lineup entries', async () => {
    const db = makeMockDb([
      { id: 'l1', match_id: 'm1', set_id: 's1', team_id: 't1', player_id: 'P1', position: 1, is_starter: 1, is_libero: 0 },
    ]);
    mockGetDb.mockResolvedValue(db);

    const result = await getLineupForSet('m1', 's1', 't1');
    expect(result).toEqual([
      { id: 'l1', matchId: 'm1', setId: 's1', teamId: 't1', playerId: 'P1', position: 1, isStarter: true, isLibero: false },
    ]);
  });

  it('round-trips a saved libero entry correctly', async () => {
    const db = makeMockDb([
      { id: 'l2', match_id: 'm1', set_id: 's1', team_id: 't1', player_id: 'L1', position: 6, is_starter: 0, is_libero: 1 },
    ]);
    mockGetDb.mockResolvedValue(db);

    const result = await getLineupForSet('m1', 's1', 't1');
    expect(result[0].isLibero).toBe(true);
    expect(result[0].isStarter).toBe(false);
  });
});
