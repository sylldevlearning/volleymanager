jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => 'gen-id'),
}));

import { createSet, setMatchCaptains, getMatchById, getSetsForMatch } from '../src/services/matchService';
import { getDb } from '../src/services/database';

const mockGetDb = getDb as jest.Mock;

function makeMockDb(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    runAsync: jest.fn().mockResolvedValue(undefined),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── createSet with serving_team_id ────────────────────────────────────────

describe('createSet', () => {
  it('persists serving_team_id when provided', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);

    const result = await createSet('m1', 1, 't1');

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('serving_team_id'),
      expect.arrayContaining(['t1']),
    );
    expect(result.servingTeamId).toBe('t1');
  });

  it('defaults serving_team_id to null when not provided', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);

    const result = await createSet('m1', 2);

    expect(result.servingTeamId).toBeNull();
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([null]),
    );
  });
});

// ─── setMatchCaptains ───────────────────────────────────────────────────────

describe('setMatchCaptains', () => {
  it('updates captain_home_id and captain_away_id for the match', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);

    await setMatchCaptains('m1', 'P5', 'P12');

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('captain_home_id'),
      ['P5', 'P12', 'm1'],
    );
  });

  it('accepts null captains (not designated)', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);

    await setMatchCaptains('m1', null, null);

    expect(db.runAsync).toHaveBeenCalledWith(expect.anything(), [null, null, 'm1']);
  });
});

// ─── getMatchById — captain mapping ─────────────────────────────────────────

describe('getMatchById', () => {
  const baseRow = {
    id: 'm1', date: '2026-01-01', format: 'indoor_6v6', mode: 'competition',
    team_home_id: 't1', team_away_id: 't2', status: 'created', config_json: '{}',
    winner_team_id: null, first_serve_team_id: null,
    created_at: '2026-01-01', finished_at: null,
  };

  it('maps captain_home_id/captain_away_id from the row', async () => {
    const db = makeMockDb({
      getFirstAsync: jest.fn().mockResolvedValue({ ...baseRow, captain_home_id: 'P5', captain_away_id: 'P20' }),
    });
    mockGetDb.mockResolvedValue(db);

    const match = await getMatchById('m1');
    expect(match?.captainHomeId).toBe('P5');
    expect(match?.captainAwayId).toBe('P20');
  });

  it('defaults captains to null when the columns are absent', async () => {
    const db = makeMockDb({ getFirstAsync: jest.fn().mockResolvedValue({ ...baseRow }) });
    mockGetDb.mockResolvedValue(db);

    const match = await getMatchById('m1');
    expect(match?.captainHomeId).toBeNull();
    expect(match?.captainAwayId).toBeNull();
  });
});

// ─── getSetsForMatch — serving_team_id mapping ──────────────────────────────

describe('getSetsForMatch', () => {
  it('maps serving_team_id from the row', async () => {
    const db = makeMockDb({
      getAllAsync: jest.fn().mockResolvedValue([
        { id: 's1', match_id: 'm1', set_number: 1, score_home: 0, score_away: 0, winner_team_id: null, started_at: '2026-01-01', finished_at: null, serving_team_id: 't2' },
      ]),
    });
    mockGetDb.mockResolvedValue(db);

    const sets = await getSetsForMatch('m1');
    expect(sets[0].servingTeamId).toBe('t2');
  });

  it('defaults serving_team_id to null when absent', async () => {
    const db = makeMockDb({
      getAllAsync: jest.fn().mockResolvedValue([
        { id: 's1', match_id: 'm1', set_number: 1, score_home: 0, score_away: 0, winner_team_id: null, started_at: '2026-01-01', finished_at: null },
      ]),
    });
    mockGetDb.mockResolvedValue(db);

    const sets = await getSetsForMatch('m1');
    expect(sets[0].servingTeamId).toBeNull();
  });
});
