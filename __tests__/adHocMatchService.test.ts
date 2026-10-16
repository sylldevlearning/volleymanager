jest.mock('../src/services/teamService', () => ({
  createAdHocTeam: jest.fn(),
}));
jest.mock('../src/services/playerService', () => ({
  createPlayer: jest.fn(),
}));
jest.mock('../src/services/matchService', () => ({
  createMatch: jest.fn(),
  setMatchCaptains: jest.fn(),
}));

import { createAdHocMatch } from '../src/services/adHocMatchService';
import { createAdHocTeam } from '../src/services/teamService';
import { createPlayer } from '../src/services/playerService';
import { createMatch, setMatchCaptains } from '../src/services/matchService';
import { DEFAULT_INDOOR_CONFIG } from '../src/models/match';
import type { Team } from '../src/models/team';
import type { Player } from '../src/models/player';

const mockCreateAdHocTeam = createAdHocTeam as jest.Mock;
const mockCreatePlayer = createPlayer as jest.Mock;
const mockCreateMatch = createMatch as jest.Mock;
const mockSetMatchCaptains = setMatchCaptains as jest.Mock;

function team(id: string, overrides: Partial<Team> = {}): Team {
  return { id, name: 'Team', shortName: null, logoUri: null, color: '#1D4ED8', coachName: null, isAdHoc: true, createdAt: '', updatedAt: '', ...overrides };
}

function player(id: string, teamId: string, number: number, overrides: Partial<Player> = {}): Player {
  return { id, teamId, firstName: null, lastName: null, number, position: null, photoUri: null, isActive: true, createdAt: '', ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
});

const HOME_INPUT = {
  name: 'Domicile',
  color: '#1D4ED8',
  coachName: 'Coach A',
  players: [
    { number: 1, name: 'Dupont' },
    { number: 2, name: '' },
    { number: 3, name: '' },
    { number: 4, name: '' },
    { number: 5, name: '' },
    { number: 6, name: '', isLibero: true },
  ],
  captainNumber: 1,
};

const AWAY_INPUT = {
  name: 'Extérieur',
  color: '#E63946',
  coachName: null,
  players: [
    { number: 10, name: '' },
    { number: 11, name: '' },
    { number: 12, name: '' },
    { number: 13, name: '' },
    { number: 14, name: '' },
    { number: 15, name: '' },
  ],
  captainNumber: 10,
};

test('creates one ad-hoc team per side with the right color/coach', async () => {
  mockCreateAdHocTeam
    .mockResolvedValueOnce(team('home-team'))
    .mockResolvedValueOnce(team('away-team'));
  mockCreatePlayer.mockImplementation(async (input) => player('p-' + input.number, input.teamId, input.number));
  mockCreateMatch.mockResolvedValue({ id: 'match-1' });

  await createAdHocMatch({ format: 'indoor_6v6', mode: 'competition', config: DEFAULT_INDOOR_CONFIG, home: HOME_INPUT, away: AWAY_INPUT });

  expect(mockCreateAdHocTeam).toHaveBeenNthCalledWith(1, expect.objectContaining({ name: 'Domicile', color: '#1D4ED8', coachName: 'Coach A' }));
  expect(mockCreateAdHocTeam).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: 'Extérieur', color: '#E63946', coachName: null }));
});

test('creates one player per selected number, scoped to the correct ad-hoc team', async () => {
  mockCreateAdHocTeam
    .mockResolvedValueOnce(team('home-team'))
    .mockResolvedValueOnce(team('away-team'));
  mockCreatePlayer.mockImplementation(async (input) => player('p-' + input.number, input.teamId, input.number));
  mockCreateMatch.mockResolvedValue({ id: 'match-1' });

  await createAdHocMatch({ format: 'indoor_6v6', mode: 'competition', config: DEFAULT_INDOOR_CONFIG, home: HOME_INPUT, away: AWAY_INPUT });

  expect(mockCreatePlayer).toHaveBeenCalledTimes(12);
  expect(mockCreatePlayer).toHaveBeenCalledWith(expect.objectContaining({ teamId: 'home-team', number: 1, lastName: 'Dupont' }));
  expect(mockCreatePlayer).toHaveBeenCalledWith(expect.objectContaining({ teamId: 'away-team', number: 10 }));
});

test('marks the chosen libero number with position "libero"', async () => {
  mockCreateAdHocTeam
    .mockResolvedValueOnce(team('home-team'))
    .mockResolvedValueOnce(team('away-team'));
  mockCreatePlayer.mockImplementation(async (input) => player('p-' + input.number, input.teamId, input.number));
  mockCreateMatch.mockResolvedValue({ id: 'match-1' });

  await createAdHocMatch({ format: 'indoor_6v6', mode: 'competition', config: DEFAULT_INDOOR_CONFIG, home: HOME_INPUT, away: AWAY_INPUT });

  expect(mockCreatePlayer).toHaveBeenCalledWith(expect.objectContaining({ teamId: 'home-team', number: 6, position: 'libero' }));
  expect(mockCreatePlayer).toHaveBeenCalledWith(expect.objectContaining({ teamId: 'home-team', number: 1, position: null }));
});

test('creates the match with the ad-hoc team ids and sets captains by player id', async () => {
  mockCreateAdHocTeam
    .mockResolvedValueOnce(team('home-team'))
    .mockResolvedValueOnce(team('away-team'));
  mockCreatePlayer.mockImplementation(async (input) => player('p-' + input.number, input.teamId, input.number));
  mockCreateMatch.mockResolvedValue({ id: 'match-1' });

  const match = await createAdHocMatch({ format: 'indoor_6v6', mode: 'competition', config: DEFAULT_INDOOR_CONFIG, home: HOME_INPUT, away: AWAY_INPUT });

  expect(mockCreateMatch).toHaveBeenCalledWith(expect.objectContaining({
    format: 'indoor_6v6', mode: 'competition', teamHomeId: 'home-team', teamAwayId: 'away-team', config: DEFAULT_INDOOR_CONFIG,
  }));
  expect(mockSetMatchCaptains).toHaveBeenCalledWith('match-1', 'p-1', 'p-10');
  expect(match.id).toBe('match-1');
});
