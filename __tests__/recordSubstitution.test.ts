import { useScoringStore } from '../src/stores/scoringStore';
import { recordSubstitution } from '../src/features/match/recordSubstitution';
import { performSubstitution } from '../src/services/substitutionService';
import type { Player } from '../src/models/player';

jest.mock('../src/services/database', () => ({ generateId: () => 'id', getDb: jest.fn() }));
jest.mock('../src/services/substitutionService', () => ({ performSubstitution: jest.fn() }));

const mockPerform = performSubstitution as jest.Mock;
const player = (id: string, number: number, position: Player['position'] = null): Player => ({
  id, teamId: 'H', firstName: null, lastName: id, number, position, photoUri: null, isActive: true, createdAt: '',
});
const roster = [1, 2, 3, 4, 5, 6, 7].map((n) => player(`p${n}`, n)).concat(player('L', 13, 'libero'));
const court = { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' };
const ctx = { matchId: 'm1', setId: 's1', teamId: 'H', side: 'home' as const, roster };
const state = () => useScoringStore.getState();

beforeEach(() => {
  mockPerform.mockReset();
  mockPerform.mockImplementation(async (o) => ({
    pair: { id: `pair-${o.playerInId}`, matchId: 'm1', setId: 's1', teamId: 'H', playerOutId: o.playerOutId, playerInId: o.playerInId, isLibero: o.isLibero, isExceptional: !!o.isExceptional, isCancelled: false },
    eventId: `ev-${o.playerInId}`,
    event: { id: `ev-${o.playerInId}`, matchId: 'm1', setId: 's1', eventType: 'substitution_home', playerId: o.playerInId, teamId: 'H', timestamp: 't', details: { ...o, isLibero: o.isLibero }, isCancelled: false },
  }));
  state().reset();
  useScoringStore.setState({ substitutionsHome: 0, events: [] });
  state().initLineup('home', court, [roster[6], roster[7]], { liberoId: 'L', isOnCourt: false, replacedPlayerId: null, replacedPosition: null });
});

it('records a regular substitution: DB, court, bench, quota and event', async () => {
  await recordSubstitution(ctx, { playerOutId: 'p4', playerInId: 'p7', position: 4, isLibero: false });
  expect(mockPerform).toHaveBeenCalledWith(expect.objectContaining({ matchId: 'm1', setId: 's1', teamId: 'H', teamSide: 'home', playerOutId: 'p4', playerInId: 'p7', position: 4 }));
  expect(state().onCourtHome[4]).toBe('p7');
  expect(state().benchHome.map((p) => p.id)).toEqual(['L', 'p4']);
  expect(state().substitutionsHome).toBe(1);
  expect(state().events.map((e) => e.id)).toEqual(['ev-p7']);
});

it('records a libero exit as the libero leaving, not as a new libero entry', async () => {
  await recordSubstitution(ctx, { playerOutId: 'p5', playerInId: 'L', position: 5, isLibero: true });
  await recordSubstitution(ctx, { playerOutId: 'L', playerInId: 'p5', position: 5, isLibero: true });
  expect(state().onCourtHome[5]).toBe('p5');
  expect(state().liberoHome).toEqual({ liberoId: 'L', isOnCourt: false, replacedPlayerId: null, replacedPosition: null });
  expect(state().benchHome.map((p) => p.id)).toEqual(['p7', 'L']);
  expect(state().substitutionsHome).toBe(0);
});
