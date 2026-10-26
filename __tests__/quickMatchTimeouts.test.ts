// Quick match screen (referee.tsx): timeouts were only counted in memory —
// never saved, so a resume forgot them, and "Annuler" could not undo one.
// They are now saved like on the arbitrage screen.

import { FakeSqlDb } from './helpers/fakeSqlDb';

let mockIdCounter = 0;
jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => `id-${++mockIdCounter}`),
}));

import { getDb } from '../src/services/database';
import { createMatch, createSet, updateMatchStatus } from '../src/services/matchService';
import { addEvent } from '../src/services/eventService';
import { useScoringStore, type CourtMap } from '../src/stores/scoringStore';
import { recordTimeout, undoQuickMatchEvent } from '../src/features/match/quickMatchEvents';
import { resumeQuickMatch, saveStartingLineups } from '../src/features/match/quickMatchLineup';
import { DEFAULT_INDOOR_CONFIG } from '../src/models/match';

const mockGetDb = getDb as jest.Mock;
const court = (prefix: string): CourtMap => ({ 1: `${prefix}1`, 2: `${prefix}2`, 3: `${prefix}3`, 4: `${prefix}4`, 5: `${prefix}5`, 6: `${prefix}6` });

beforeEach(() => {
  mockIdCounter = 0;
  mockGetDb.mockResolvedValue(new FakeSqlDb());
  useScoringStore.getState().reset();
  useScoringStore.setState({ timeoutsHome: 0, timeoutsAway: 0 });
});

async function startMatch() {
  const created = await createMatch({ format: 'indoor_6v6', mode: 'leisure', teamHomeId: 't1', teamAwayId: 't2', config: DEFAULT_INDOOR_CONFIG });
  await updateMatchStatus(created.id, 'live');
  const match = { ...created, status: 'live' as const };
  const set1 = await createSet(match.id, 1);
  useScoringStore.getState().initMatch(match, set1);
  await saveStartingLineups(match, set1.id, court('h'), court('a'));
  return { match, ctx: { matchId: match.id, setId: set1.id, homeTeamId: 't1', awayTeamId: 't2' } };
}

async function point(matchId: string, setId: string, team: 'home' | 'away') {
  const event = await addEvent({ matchId, setId, eventType: team === 'home' ? 'point_home' : 'point_away', playerId: null, teamId: null, details: {} });
  useScoringStore.getState().addPointEvent(team, event);
}

const fallback = { home: court('h'), away: court('a') };

test('a timeout is saved and comes back after closing the app', async () => {
  const { match, ctx } = await startMatch();
  await point(match.id, ctx.setId, 'home');
  await recordTimeout(ctx, 'away');
  expect(useScoringStore.getState().timeoutsAway).toBe(1);

  useScoringStore.getState().reset();
  const resumed = await resumeQuickMatch(match.id, fallback);
  expect([resumed!.timeoutsHome, resumed!.timeoutsAway]).toEqual([0, 1]);
});

test('"Annuler" undoes the last timeout', async () => {
  const { match, ctx } = await startMatch();
  await point(match.id, ctx.setId, 'home');
  await recordTimeout(ctx, 'home');

  await undoQuickMatchEvent(ctx, { home: [], away: [] });
  const s = useScoringStore.getState();
  expect(s.timeoutsHome).toBe(0);
  expect(s.scoreHome).toBe(1); // the point before it stays

  const resumed = await resumeQuickMatch(match.id, fallback);
  expect(resumed!.timeoutsHome).toBe(0);
});

test('"Annuler" still undoes the last point', async () => {
  const { match, ctx } = await startMatch();
  await recordTimeout(ctx, 'home');
  await point(match.id, ctx.setId, 'away');

  await undoQuickMatchEvent(ctx, { home: [], away: [] });
  const s = useScoringStore.getState();
  expect([s.scoreHome, s.scoreAway]).toEqual([0, 0]);
  expect(s.timeoutsHome).toBe(1);
});
