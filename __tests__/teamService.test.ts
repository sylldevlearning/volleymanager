jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => 'gen-id'),
}));

import { getAllTeams, createTeam, createAdHocTeam } from '../src/services/teamService';
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

// ─── getAllTeams excludes ad-hoc teams ─────────────────────────────────────

describe('getAllTeams', () => {
  it('queries only registered (non ad-hoc) teams', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);

    await getAllTeams();

    expect(db.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining('is_ad_hoc = 0'),
    );
  });

  it('maps coach_name and is_ad_hoc from the row', async () => {
    const db = makeMockDb({
      getAllAsync: jest.fn().mockResolvedValue([{
        id: 't1', name: 'Les Aigles', short_name: 'AIG', logo_uri: null, color: '#1D4ED8',
        coach_name: 'Coach Dupont', is_ad_hoc: 0, created_at: '2026-01-01', updated_at: '2026-01-01',
      }]),
    });
    mockGetDb.mockResolvedValue(db);

    const teams = await getAllTeams();
    expect(teams[0]).toMatchObject({ coachName: 'Coach Dupont', isAdHoc: false });
  });
});

// ─── createTeam — registered, not ad-hoc ───────────────────────────────────

describe('createTeam', () => {
  it('inserts with is_ad_hoc = 0', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);

    const team = await createTeam({ name: 'Les Aigles', shortName: 'AIG', logoUri: null, color: '#1D4ED8' });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO teams'),
      expect.arrayContaining(['gen-id', 'Les Aigles', 'AIG', null, '#1D4ED8', null]),
    );
    expect(team.isAdHoc).toBe(false);
  });
});

// ─── createAdHocTeam — scoped to one match, never merged on name conflict ─

describe('createAdHocTeam', () => {
  it('inserts with is_ad_hoc = 1', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);

    const team = await createAdHocTeam({ name: 'Domicile', shortName: null, logoUri: null, color: '#1D4ED8', coachName: 'Coach A' });

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO teams'),
      ['gen-id', 'Domicile', null, null, '#1D4ED8', 'Coach A', expect.any(String), expect.any(String)],
    );
    expect(team.isAdHoc).toBe(true);
  });

  it('never catches a UNIQUE violation to merge with an existing team (ad-hoc names can repeat)', async () => {
    const db = makeMockDb({ runAsync: jest.fn().mockRejectedValue(new Error('UNIQUE constraint failed: teams.name')) });
    mockGetDb.mockResolvedValue(db);

    await expect(createAdHocTeam({ name: 'Domicile', shortName: null, logoUri: null, color: '#1D4ED8' })).rejects.toThrow();
  });
});
