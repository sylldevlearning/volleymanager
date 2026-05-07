jest.mock('../src/services/teamService', () => ({
  getAllTeams: jest.fn(),
  createTeam: jest.fn(),
}));

jest.mock('../src/services/playerService', () => ({
  createPlayer: jest.fn(),
}));

import { seedDefaultDataIfEmpty } from '../src/services/seedService';
import { getAllTeams, createTeam } from '../src/services/teamService';
import { createPlayer } from '../src/services/playerService';

const mockGetAllTeams = getAllTeams as jest.Mock;
const mockCreateTeam = createTeam as jest.Mock;
const mockCreatePlayer = createPlayer as jest.Mock;

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

  it('first team is red (home), second is blue (away)', async () => {
    mockGetAllTeams.mockResolvedValue([]);
    mockCreateTeam
      .mockResolvedValueOnce({ id: 'team-a' })
      .mockResolvedValueOnce({ id: 'team-b' });
    mockCreatePlayer.mockResolvedValue({});

    await seedDefaultDataIfEmpty();

    expect(mockCreateTeam).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ color: '#E63946' })
    );
    expect(mockCreateTeam).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ color: '#1D4ED8' })
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

  it('does nothing when teams already exist', async () => {
    mockGetAllTeams.mockResolvedValue([{ id: 'existing-team' }]);

    await seedDefaultDataIfEmpty();

    expect(mockCreateTeam).not.toHaveBeenCalled();
    expect(mockCreatePlayer).not.toHaveBeenCalled();
  });

  it('players have numbers 1-13', async () => {
    mockGetAllTeams.mockResolvedValue([]);
    mockCreateTeam
      .mockResolvedValueOnce({ id: 'team-a' })
      .mockResolvedValueOnce({ id: 'team-b' });
    mockCreatePlayer.mockResolvedValue({});

    await seedDefaultDataIfEmpty();

    const numbersA = mockCreatePlayer.mock.calls
      .filter(([arg]) => arg.teamId === 'team-a')
      .map(([arg]) => arg.number)
      .sort((a: number, b: number) => a - b);
    expect(numbersA).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });
});
