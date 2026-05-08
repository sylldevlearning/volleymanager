jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => 'test-id-' + Math.random().toString(36).slice(2)),
}));

jest.mock('../src/services/eventService', () => ({
  addEvent: jest.fn(),
}));

import { getPairsForSet, performSubstitution, cancelPair, undoSubstitution } from '../src/services/substitutionService';
import { getDb, generateId } from '../src/services/database';
import { addEvent } from '../src/services/eventService';

const mockGetDb = getDb as jest.Mock;
const mockAddEvent = addEvent as jest.Mock;
const mockGenerateId = generateId as jest.Mock;

function makeMockDb(rows: object[] = []) {
  return {
    getAllAsync: jest.fn().mockResolvedValue(rows),
    runAsync: jest.fn().mockResolvedValue(undefined),
    getFirstAsync: jest.fn().mockResolvedValue(null),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGenerateId.mockReturnValue('gen-id');
});

// ─── getPairsForSet ───────────────────────────────────────────────────────

describe('getPairsForSet', () => {
  it('returns empty array when no pairs exist', async () => {
    const db = makeMockDb([]);
    mockGetDb.mockResolvedValue(db);

    const result = await getPairsForSet('m1', 's1', 't1');
    expect(result).toEqual([]);
  });

  it('maps DB rows to SubstitutionPair correctly', async () => {
    const db = makeMockDb([{
      id: 'p1', match_id: 'm1', set_id: 's1', team_id: 't1',
      player_out_id: 'A', player_in_id: 'B', is_libero: 0, is_cancelled: 0,
    }]);
    mockGetDb.mockResolvedValue(db);

    const result = await getPairsForSet('m1', 's1', 't1');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'p1', matchId: 'm1', setId: 's1', teamId: 't1',
      playerOutId: 'A', playerInId: 'B', isLibero: false, isCancelled: false,
    });
  });

  it('correctly parses isLibero = 1 from DB', async () => {
    const db = makeMockDb([{
      id: 'p2', match_id: 'm1', set_id: 's1', team_id: 't1',
      player_out_id: 'Starter', player_in_id: 'Libero', is_libero: 1, is_cancelled: 0,
    }]);
    mockGetDb.mockResolvedValue(db);

    const result = await getPairsForSet('m1', 's1', 't1');
    expect(result[0].isLibero).toBe(true);
  });

  it('correctly parses isCancelled = 1 from DB', async () => {
    const db = makeMockDb([{
      id: 'p3', match_id: 'm1', set_id: 's1', team_id: 't1',
      player_out_id: 'A', player_in_id: 'B', is_libero: 0, is_cancelled: 1,
    }]);
    mockGetDb.mockResolvedValue(db);

    const result = await getPairsForSet('m1', 's1', 't1');
    expect(result[0].isCancelled).toBe(true);
  });
});

// ─── performSubstitution ──────────────────────────────────────────────────

describe('performSubstitution', () => {
  it('inserts pair and records event', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);
    mockAddEvent.mockResolvedValue({ id: 'event-1' });

    const result = await performSubstitution({
      matchId: 'm1',
      setId: 's1',
      teamId: 't1',
      teamSide: 'home',
      playerOutId: 'A',
      playerInId: 'B',
      position: 3,
      isLibero: false,
    });

    expect(db.runAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO substitution_pairs'),
      expect.arrayContaining(['m1', 's1', 't1', 'A', 'B', 0]),
    );
    expect(mockAddEvent).toHaveBeenCalledWith(expect.objectContaining({
      matchId: 'm1',
      setId: 's1',
      eventType: 'substitution_home',
      playerId: 'B',
      teamId: 't1',
    }));
    expect(result.pair.playerOutId).toBe('A');
    expect(result.pair.playerInId).toBe('B');
    expect(result.eventId).toBe('event-1');
  });

  it('uses substitution_away event type for away team', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);
    mockAddEvent.mockResolvedValue({ id: 'ev-2' });

    await performSubstitution({
      matchId: 'm1', setId: 's1', teamId: 't2', teamSide: 'away',
      playerOutId: 'C', playerInId: 'D', position: 5, isLibero: false,
    });

    expect(mockAddEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'substitution_away' }),
    );
  });

  it('sets isLibero = 1 in DB for libero swap', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);
    mockAddEvent.mockResolvedValue({ id: 'ev-3' });

    await performSubstitution({
      matchId: 'm1', setId: 's1', teamId: 't1', teamSide: 'home',
      playerOutId: 'Starter', playerInId: 'Libero', position: 1, isLibero: true,
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([1]), // is_libero = 1
    );
  });

  it('returns the created pair with correct fields', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);
    mockAddEvent.mockResolvedValue({ id: 'ev-4' });
    mockGenerateId.mockReturnValue('pair-id-123');

    const result = await performSubstitution({
      matchId: 'm2', setId: 's2', teamId: 't2', teamSide: 'home',
      playerOutId: 'X', playerInId: 'Y', position: 6, isLibero: false,
    });

    expect(result.pair).toMatchObject({
      id: 'pair-id-123',
      matchId: 'm2',
      setId: 's2',
      teamId: 't2',
      playerOutId: 'X',
      playerInId: 'Y',
      isLibero: false,
      isCancelled: false,
    });
  });
});

// ─── cancelPair / undoSubstitution ───────────────────────────────────────

describe('cancelPair', () => {
  it('sets is_cancelled = 1 for the pair', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);

    await cancelPair('pair-xyz');

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('is_cancelled = 1'),
      ['pair-xyz'],
    );
  });
});

describe('undoSubstitution', () => {
  it('delegates to cancelPair', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);

    await undoSubstitution('pair-abc');

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('is_cancelled = 1'),
      ['pair-abc'],
    );
  });
});
