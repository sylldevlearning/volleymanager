import { matchPhase, planBoardApply, rulesContextFromStore, type ApplyInput } from '../src/features/tactical/applyToMatch';
import { applyBoardLineup } from '../src/features/match/applyLineup';
import { buildLineupState, toLineupEntries, courtFromLineupRows } from '../src/features/lineup/lineupState';
import { saveLineup } from '../src/services/lineupService';
import { useScoringStore } from '../src/stores/scoringStore';
import { HOME_POSITION_COORDS, AWAY_POSITION_COORDS } from '../src/features/tactical/positionUtils';
import { DEFAULT_INDOOR_CONFIG } from '../src/models/match';
import type { Player } from '../src/models/player';
import type { PlayerPosition } from '../src/models/tactical';
import type { MatchEvent } from '../src/models/event';
import type { MatchSet } from '../src/models/match';

jest.mock('../src/services/database', () => ({ generateId: () => 'id', getDb: jest.fn() }));
jest.mock('../src/services/lineupService', () => ({ saveLineup: jest.fn().mockResolvedValue(undefined) }));

const player = (id: string, number: number, teamId: string, position: Player['position'] = null): Player => ({
  id, teamId, firstName: null, lastName: id, number, position, photoUri: null, isActive: true, createdAt: '',
});
const home = [...Array.from({ length: 8 }, (_, i) => player(`h${i + 1}`, i + 1, 'H')), player('hL', 13, 'H', 'libero')];
const away = Array.from({ length: 6 }, (_, i) => player(`a${i + 1}`, i + 1, 'A'));
const homeCourt = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' };
const awayCourt = { 1: 'a1', 2: 'a2', 3: 'a3', 4: 'a4', 5: 'a5', 6: 'a6' };
const ZONES = [1, 2, 3, 4, 5, 6] as const;

const at = (id: string, zone: 1 | 2 | 3 | 4 | 5 | 6, isHome: boolean): PlayerPosition => {
  const c = (isHome ? HOME_POSITION_COORDS : AWAY_POSITION_COORDS)[zone];
  return { playerId: id, x: c.x, y: c.y, teamId: isHome ? 'H' : 'A', number: 0, label: '', isHome };
};
function board(homeMap: Record<number, string> = homeCourt, awayMap: Record<number, string> = awayCourt): PlayerPosition[] {
  return [
    ...ZONES.map((z) => at(homeMap[z], z, true)),
    ...ZONES.map((z) => at(awayMap[z], z, false)),
  ];
}
const set = (overrides: Partial<MatchSet> = {}) => ({ id: 's2', winnerTeamId: null, ...overrides }) as MatchSet;
const point = { id: 'e1', eventType: 'point_home', isCancelled: false } as MatchEvent;

function input(overrides: Partial<ApplyInput> = {}): ApplyInput {
  const base = (side: 'home' | 'away', court: Record<number, string>, players: Player[]) => ({
    side,
    team: { court, libero: null, players },
    pairs: [], subsUsed: 0,
    config: { ...DEFAULT_INDOOR_CONFIG, substitutionsPerSet: 6, unlimitedSubstitutions: false },
    isTeamServing: side === 'home', setEvents: [], sanctionEventsForSet: [], sanctionEventsForMatch: [],
  });
  return {
    positions: board(), benchMoves: [], phase: 'in_set',
    home: base('home', homeCourt, home), away: base('away', awayCourt, away),
    ...overrides,
  };
}

describe('matchPhase', () => {
  it('is "before_first_point" while the set has no rally yet (between two sets)', () => {
    expect(matchPhase(set(), [])).toBe('before_first_point');
    expect(matchPhase(set(), [{ ...point, isCancelled: true }])).toBe('before_first_point');
  });
  it('is "in_set" once something happened in the set', () => {
    expect(matchPhase(set(), [point])).toBe('in_set');
    expect(matchPhase(set(), [{ ...point, eventType: 'substitution_home' }])).toBe('in_set');
  });
  it('is "set_over" when the set is won, "none" without a set', () => {
    expect(matchPhase(set({ winnerTeamId: 'H' }), [point])).toBe('set_over');
    expect(matchPhase(null, [])).toBe('none');
  });
});

describe('planBoardApply — during a set', () => {
  it('has nothing to apply when only positions moved', () => {
    const moved = board().map((p) => (p.playerId === 'h2' ? { ...p, x: 0.1 } : p));
    expect(planBoardApply(input({ positions: moved }))).toEqual({ kind: 'none' });
  });

  it('lists the substitutions of both teams', () => {
    const plan = planBoardApply(input({ positions: board({ ...homeCourt, 4: 'h7' }) }));
    expect(plan).toEqual({
      kind: 'substitutions',
      ok: true,
      home: { ok: true, items: [expect.objectContaining({ playerOutId: 'h4', playerInId: 'h7', inNumber: 7, outNumber: 4 })] },
      away: { ok: true, items: [] },
    });
  });

  it('is refused as a whole when one substitution breaks a rule', () => {
    const plan = planBoardApply(input({
      positions: board({ ...homeCourt, 4: 'h7' }),
      home: { ...input().home, subsUsed: 6 },
    }));
    expect(plan).toMatchObject({ kind: 'substitutions', ok: false });
  });
});

describe('planBoardApply — before the first point (starting lineup)', () => {
  it('proposes the board positions as the starting lineup, players included', () => {
    const plan = planBoardApply(input({ phase: 'before_first_point', positions: board({ ...homeCourt, 1: 'h2', 2: 'h7' }) }));
    expect(plan).toEqual({
      kind: 'lineup',
      ok: true,
      home: { status: 'changed', court: { ...homeCourt, 1: 'h2', 2: 'h7' } },
      away: { status: 'unchanged' },
    });
  });

  it('reports a lineup error for a team whose players changed', () => {
    const fiveHome = board({ ...homeCourt, 2: 'h7' }).filter((p) => p.playerId !== 'h1');
    const plan = planBoardApply(input({ phase: 'before_first_point', positions: fiveHome }));
    expect(plan).toMatchObject({ kind: 'lineup', ok: false, home: { status: 'error', error: { code: 'lineup_count' } } });
  });

  it('ignores a play drawn off the zones when the players did not change', () => {
    const drawn = board().map((p) => (p.isHome ? { ...p, x: 0.5, y: 0.7 } : p));
    expect(planBoardApply(input({ phase: 'before_first_point', positions: drawn }))).toEqual({ kind: 'none' });
  });
});

describe('planBoardApply — nothing to do', () => {
  it('after the end of a set', () => {
    expect(planBoardApply(input({ phase: 'set_over', positions: board({ ...homeCourt, 4: 'h7' }) }))).toEqual({ kind: 'none' });
  });
});

describe('rulesContextFromStore', () => {
  it('reads the team state the substitution sheet uses', () => {
    const ctx = rulesContextFromStore({
      match: { config: DEFAULT_INDOOR_CONFIG } as never,
      onCourtHome: homeCourt, onCourtAway: awayCourt, liberoHome: null, liberoAway: null,
      pairsHome: [], pairsAway: [], substitutionsHome: 2, substitutionsAway: 0,
      servingTeam: 'away', events: [point],
    }, 'home', home);
    expect(ctx).toMatchObject({ side: 'home', subsUsed: 2, isTeamServing: false, setEvents: [point], team: { court: homeCourt, players: home } });
  });
});

describe('applyBoardLineup', () => {
  beforeEach(() => {
    (saveLineup as jest.Mock).mockClear();
    useScoringStore.getState().reset();
  });

  it('saves the starting lineup of the set and puts it on the court', async () => {
    const court = { ...homeCourt, 2: 'h7' };
    await applyBoardLineup({ matchId: 'm1', setId: 's2', teamId: 'H', side: 'home', roster: home }, court);

    expect(saveLineup).toHaveBeenCalledWith('m1', 's2', 'H', toLineupEntries(court));
    const s = useScoringStore.getState();
    expect(s.onCourtHome).toEqual(court);
    expect(s.benchHome.map((p) => p.id)).toEqual(['h2', 'h8', 'hL']);
    expect(s.liberoHome).toEqual({ liberoId: 'hL', isOnCourt: false, replacedPlayerId: null, replacedPosition: null });
  });
});

describe('lineupState', () => {
  it('builds the bench and libero state of a starting six', () => {
    expect(buildLineupState(home, homeCourt).bench.map((p) => p.id)).toEqual(['h7', 'h8', 'hL']);
  });

  it('reads a saved lineup back (resuming a quick match)', () => {
    const rows = ZONES.map((z) => ({ position: z, playerId: homeCourt[z] }));
    expect(courtFromLineupRows(rows)).toEqual(homeCourt);
    expect(courtFromLineupRows([])).toBeNull();
  });
});
