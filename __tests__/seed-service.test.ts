jest.mock('../src/services/teamService', () => ({
  getAllTeams: jest.fn(),
  createTeam: jest.fn(),
}));

jest.mock('../src/services/playerService', () => ({
  createPlayer: jest.fn(),
  getPlayersByTeam: jest.fn(),
}));

import { seedDefaultDataIfEmpty } from '../src/services/seedService';
import { getAllTeams, createTeam } from '../src/services/teamService';
import { createPlayer, getPlayersByTeam } from '../src/services/playerService';

const mockGetAllTeams = getAllTeams as jest.Mock;
const mockCreateTeam = createTeam as jest.Mock;
const mockCreatePlayer = createPlayer as jest.Mock;
const mockGetPlayersByTeam = getPlayersByTeam as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('seedDefaultDataIfEmpty', () => {
  it('creates 2 teams and 26 players when DB is empty', async () => {
    mockGetAllTeams.mockResolvedValue([]);
    mockCreateTeam
      .mockResolvedValueOnce({ id: 'team-a' })
      .mockResolvedValueOnce({ id: 'team-b' });
    mockCreatePlayer.mockResolvedValue({});

    await seedDefaultDataIfEmpty();

    expect(mockCreateTeam).toHaveBeenCalledTimes(2);
    expect(mockCreatePlayer).toHaveBeenCalledTimes(26);
  });

  it('first team is France (blue), second is Brazil (amber)', async () => {
    mockGetAllTeams.mockResolvedValue([]);
    mockCreateTeam
      .mockResolvedValueOnce({ id: 'team-a' })
      .mockResolvedValueOnce({ id: 'team-b' });
    mockCreatePlayer.mockResolvedValue({});

    await seedDefaultDataIfEmpty();

    expect(mockCreateTeam).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'France', shortName: 'FRA', color: '#1D4ED8' })
    );
    expect(mockCreateTeam).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'Brésil', shortName: 'BRA', color: '#F59E0B' })
    );
  });

  it('creates 13 players per team', async () => {
    mockGetAllTeams.mockResolvedValue([]);
    mockCreateTeam
      .mockResolvedValueOnce({ id: 'team-a' })
      .mockResolvedValueOnce({ id: 'team-b' });
    mockCreatePlayer.mockResolvedValue({});

    await seedDefaultDataIfEmpty();

    const callsTeamA = mockCreatePlayer.mock.calls.filter(
      ([arg]) => arg.teamId === 'team-a'
    );
    const callsTeamB = mockCreatePlayer.mock.calls.filter(
      ([arg]) => arg.teamId === 'team-b'
    );
    expect(callsTeamA).toHaveLength(13);
    expect(callsTeamB).toHaveLength(13);
  });

  it('does nothing when teams already have players', async () => {
    mockGetAllTeams.mockResolvedValue([{ id: 'existing-team' }]);
    mockGetPlayersByTeam.mockResolvedValue([{ id: 'p1' }]);

    await seedDefaultDataIfEmpty();

    expect(mockCreateTeam).not.toHaveBeenCalled();
    expect(mockCreatePlayer).not.toHaveBeenCalled();
  });

  it('re-seeds players when teams exist but have no players', async () => {
    mockGetAllTeams.mockResolvedValue([{ id: 'existing-team' }]);
    mockGetPlayersByTeam.mockResolvedValue([]);
    mockCreateTeam
      .mockResolvedValueOnce({ id: 'team-france' })
      .mockResolvedValueOnce({ id: 'team-brazil' });
    mockCreatePlayer.mockResolvedValue({});

    await seedDefaultDataIfEmpty();

    expect(mockCreateTeam).toHaveBeenCalledTimes(2);
    expect(mockCreatePlayer).toHaveBeenCalledTimes(26);
  });

  it('France JO 2024 roster includes Ngapeth (#9) and Grebennikov (libero)', async () => {
    mockGetAllTeams.mockResolvedValue([]);
    mockCreateTeam
      .mockResolvedValueOnce({ id: 'team-france' })
      .mockResolvedValueOnce({ id: 'team-brazil' });
    mockCreatePlayer.mockResolvedValue({});

    await seedDefaultDataIfEmpty();

    const francePlayers = mockCreatePlayer.mock.calls
      .filter(([arg]) => arg.teamId === 'team-france')
      .map(([arg]) => arg);

    expect(francePlayers.some((p) => p.lastName === 'Ngapeth' && p.number === 9)).toBe(true);
    expect(francePlayers.some((p) => p.lastName === 'Grebennikov' && p.position === 'libero')).toBe(true);
  });

  it('Brazil JO 2024 roster includes Bruninho (#1) and Thales (libero #7)', async () => {
    mockGetAllTeams.mockResolvedValue([]);
    mockCreateTeam
      .mockResolvedValueOnce({ id: 'team-france' })
      .mockResolvedValueOnce({ id: 'team-brazil' });
    mockCreatePlayer.mockResolvedValue({});

    await seedDefaultDataIfEmpty();

    const brazilPlayers = mockCreatePlayer.mock.calls
      .filter(([arg]) => arg.teamId === 'team-brazil')
      .map(([arg]) => arg);

    expect(brazilPlayers.some((p) => p.firstName === 'Bruno' && p.number === 1)).toBe(true);
    expect(brazilPlayers.some((p) => p.lastName === 'Thales' && p.position === 'libero')).toBe(true);
  });
});
