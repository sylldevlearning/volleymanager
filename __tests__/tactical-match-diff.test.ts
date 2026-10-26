import {
  effectiveCourt,
  computeBoardSubstitutions,
  positionsToLineup,
  lineupDiffers,
  type BenchMove,
  type MatchTeamState,
} from '../src/features/tactical/matchDiff';
import { HOME_POSITION_COORDS, AWAY_POSITION_COORDS } from '../src/features/tactical/positionUtils';
import type { PlayerPosition } from '../src/models/tactical';
import type { Player } from '../src/models/player';

jest.mock('../src/services/database', () => ({ generateId: () => 'id', getDb: jest.fn() }));

const player = (id: string, number: number, position: Player['position'] = null, teamId = 'H'): Player => ({
  id, teamId, firstName: null, lastName: `P${number}`, number, position,
  photoUri: null, isActive: true, createdAt: '',
});

// Home roster: p1..p6 starters, p7..p12 substitutes, L libero
const players = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => player(`p${n}`, n)),
  player('L', 13, 'libero'),
];
const court = { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' };
const team: MatchTeamState = { court, libero: null, players };

const at = (id: string, zone: 1 | 2 | 3 | 4 | 5 | 6, isHome = true, number = 0): PlayerPosition => {
  const c = (isHome ? HOME_POSITION_COORDS : AWAY_POSITION_COORDS)[zone];
  return { playerId: id, x: c.x, y: c.y, teamId: isHome ? 'H' : 'A', number, label: '', isHome };
};
const ball: PlayerPosition = { playerId: 'ball', x: 0.5, y: 0.5, teamId: '', number: 0, label: '', isHome: false, isBall: true };

/** Board = match court with some ids replaced in place */
function boardWith(replace: Record<string, string> = {}): PlayerPosition[] {
  return [
    ...([1, 2, 3, 4, 5, 6] as const).map((z) => at(replace[court[z]] ?? court[z], z)),
    at('A1', 1, false), ball,
  ];
}

describe('effectiveCourt', () => {
  it('shows the libero in the slot they occupy', () => {
    const withLibero: MatchTeamState = {
      ...team,
      libero: { liberoId: 'L', isOnCourt: true, replacedPlayerId: 'p5', replacedPosition: 5 },
    };
    expect(effectiveCourt(withLibero)[5]).toBe('L');
    expect(effectiveCourt(team)).toEqual(court);
  });
});

describe('computeBoardSubstitutions', () => {
  it('finds nothing when the board matches the match', () => {
    expect(computeBoardSubstitutions(boardWith(), [], true, team)).toEqual([]);
  });

  it('ignores position moves', () => {
    const moved = boardWith().map((p) => (p.playerId === 'p2' ? { ...p, x: 0.1, y: 0.9 } : p));
    expect(computeBoardSubstitutions(moved, [], true, team)).toEqual([]);
  });

  it('turns a bench swap into "7 in for 4", at the match zone of 4', () => {
    const moves: BenchMove[] = [{ type: 'swap', inId: 'p7', outId: 'p4' }];
    expect(computeBoardSubstitutions(boardWith({ p4: 'p7' }), moves, true, team)).toEqual([
      { isHome: true, playerOutId: 'p4', playerInId: 'p7', position: 4, isLibero: false },
    ]);
  });

  it('collapses chained swaps: 7 for 12... 9 for 7 → 9 in for the original player', () => {
    const moves: BenchMove[] = [
      { type: 'swap', inId: 'p7', outId: 'p2' },
      { type: 'swap', inId: 'p9', outId: 'p7' },
    ];
    expect(computeBoardSubstitutions(boardWith({ p2: 'p9' }), moves, true, team)).toEqual([
      expect.objectContaining({ playerOutId: 'p2', playerInId: 'p9', position: 2 }),
    ]);
  });

  it('cancels a round trip', () => {
    const moves: BenchMove[] = [
      { type: 'swap', inId: 'p7', outId: 'p2' },
      { type: 'swap', inId: 'p2', outId: 'p7' },
    ];
    expect(computeBoardSubstitutions(boardWith(), moves, true, team)).toEqual([]);
  });

  it('keeps the pairing from the swaps even after the players were moved around', () => {
    // 7 for 2, 8 for 3, then the coach drags 7 to zone 3 and 8 to zone 2
    const moves: BenchMove[] = [
      { type: 'swap', inId: 'p7', outId: 'p2' },
      { type: 'swap', inId: 'p8', outId: 'p3' },
    ];
    const board = boardWith({ p2: 'p8', p3: 'p7' });
    expect(computeBoardSubstitutions(board, moves, true, team)).toEqual([
      expect.objectContaining({ playerOutId: 'p2', playerInId: 'p7', position: 2 }),
      expect.objectContaining({ playerOutId: 'p3', playerInId: 'p8', position: 3 }),
    ]);
  });

  it('pairs a separate exit + entry with the zone the entering player stands in', () => {
    const moves: BenchMove[] = [
      { type: 'out', outId: 'p6' },
      { type: 'out', outId: 'p1' },
      { type: 'in', inId: 'p10', x: 0, y: 0 },
      { type: 'in', inId: 'p11', x: 0, y: 0 },
    ];
    // p10 dropped in zone 1, p11 in zone 6
    const board = boardWith({ p1: 'p10', p6: 'p11' });
    expect(computeBoardSubstitutions(board, moves, true, team)).toEqual([
      expect.objectContaining({ playerOutId: 'p1', playerInId: 'p10', position: 1 }),
      expect.objectContaining({ playerOutId: 'p6', playerInId: 'p11', position: 6 }),
    ]);
  });

  it('falls back to the zones when there is no move history (e.g. after reopening)', () => {
    expect(computeBoardSubstitutions(boardWith({ p4: 'p7' }), [], true, team)).toEqual([
      expect.objectContaining({ playerOutId: 'p4', playerInId: 'p7', position: 4 }),
    ]);
  });

  it('ignores a player who left without anybody entering', () => {
    const board = boardWith().filter((p) => p.playerId !== 'p3');
    expect(computeBoardSubstitutions(board, [{ type: 'out', outId: 'p3' }], true, team)).toEqual([]);
  });

  it('flags a libero entry and a libero exit', () => {
    const entry = computeBoardSubstitutions(boardWith({ p5: 'L' }), [{ type: 'swap', inId: 'L', outId: 'p5' }], true, team);
    expect(entry).toEqual([expect.objectContaining({ playerOutId: 'p5', playerInId: 'L', position: 5, isLibero: true })]);

    const liberoOnCourt: MatchTeamState = {
      ...team,
      libero: { liberoId: 'L', isOnCourt: true, replacedPlayerId: 'p5', replacedPosition: 5 },
    };
    const exit = computeBoardSubstitutions(boardWith(), [{ type: 'swap', inId: 'p5', outId: 'L' }], true, liberoOnCourt);
    expect(exit).toEqual([expect.objectContaining({ playerOutId: 'L', playerInId: 'p5', position: 5, isLibero: true })]);
  });

  it('ignores the numbered tokens of a team without roster', () => {
    const noRoster: MatchTeamState = { court: {}, libero: null, players: [] };
    const board = [at('away_0', 1, false), at('away_b7', 2, false), ball];
    expect(computeBoardSubstitutions(board, [{ type: 'swap', inId: 'away_b7', outId: 'away_1' }], false, noRoster)).toEqual([]);
  });

  it('only looks at its own team', () => {
    const moves: BenchMove[] = [{ type: 'swap', inId: 'p7', outId: 'p4' }];
    const awayTeam: MatchTeamState = { court: { 1: 'A1' }, libero: null, players: [player('A1', 1, null, 'A')] };
    expect(computeBoardSubstitutions(boardWith({ p4: 'p7' }), moves, false, awayTeam)).toEqual([]);
  });
});

describe('positionsToLineup', () => {
  const six = ([1, 2, 3, 4, 5, 6] as const).map((z) => at(`p${z}`, z));

  it('maps each player to the nearest zone', () => {
    const shuffled = [at('p7', 4), at('p2', 2), at('p3', 3), at('p1', 1), at('p5', 5), at('p6', 6), ball];
    expect(positionsToLineup(shuffled, true, players)).toEqual({
      ok: true,
      court: { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p7', 5: 'p5', 6: 'p6' },
    });
  });

  it('accepts players slightly off their zone', () => {
    const off = six.map((p) => ({ ...p, x: p.x + 0.05, y: p.y - 0.04 }));
    expect(positionsToLineup(off, true, players).ok).toBe(true);
  });

  it('uses the away team mirrored zones', () => {
    const away = [
      player('a1', 1, null, 'A'), player('a2', 2, null, 'A'), player('a3', 3, null, 'A'),
      player('a4', 4, null, 'A'), player('a5', 5, null, 'A'), player('a6', 6, null, 'A'),
    ];
    const board = ([1, 2, 3, 4, 5, 6] as const).map((z) => at(`a${z}`, z, false));
    expect(positionsToLineup(board, false, away)).toEqual({
      ok: true, court: { 1: 'a1', 2: 'a2', 3: 'a3', 4: 'a4', 5: 'a5', 6: 'a6' },
    });
  });

  it('needs exactly 6 players', () => {
    expect(positionsToLineup(six.slice(0, 5), true, players)).toEqual({
      ok: false, code: 'lineup_count', params: { count: 5 },
    });
  });

  it('refuses two players in the same zone', () => {
    const twoInZone4 = [...six.slice(0, 3), at('p4', 4), { ...at('p5', 4), x: 0.2 }, at('p6', 6)];
    expect(positionsToLineup(twoInZone4, true, players)).toEqual({
      ok: false, code: 'lineup_same_zone', params: { zone: 'IV', first: 4, second: 5 },
    });
  });

  it('refuses the libero in the starting six', () => {
    const withLibero = [...six.slice(0, 5), at('L', 6)];
    expect(positionsToLineup(withLibero, true, players)).toEqual({
      ok: false, code: 'lineup_libero', params: { number: 13 },
    });
  });

  it('cannot build a lineup from numbered tokens (no roster)', () => {
    expect(positionsToLineup([at('home_0', 1)], true, [])).toEqual({ ok: false, code: 'lineup_no_roster' });
  });
});

describe('lineupDiffers', () => {
  it('compares a lineup with the match court', () => {
    expect(lineupDiffers(court, court)).toBe(false);
    expect(lineupDiffers({ ...court, 1: 'p2', 2: 'p1' }, court)).toBe(true);
  });
});

describe('tacticalStore — bench move history', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useTacticalStore } = require('../src/features/tactical/tacticalStore') as typeof import('../src/features/tactical/tacticalStore');
  const bench = (id: string) => ({ playerId: id, teamId: 'H', number: 7, label: '7', isHome: true });

  beforeEach(() => {
    const s = useTacticalStore.getState();
    s.resetBoard();
    s.setPositions([at('p1', 1), at('p2', 2), ball]);
    s.setBench([bench('p7'), bench('p8')], []);
  });

  it('records swaps, exits and entries in order', () => {
    const s = useTacticalStore.getState();
    s.swapWithBench('p7', 'p1');
    s.sendToBench('p2');
    s.enterFromBench('p8', 0.4, 0.7);
    expect(useTacticalStore.getState().benchMoves).toEqual([
      { type: 'swap', inId: 'p7', outId: 'p1' },
      { type: 'out', outId: 'p2' },
      { type: 'in', inId: 'p8', x: 0.4, y: 0.7 },
    ]);
  });

  it('does not record a refused move', () => {
    useTacticalStore.getState().swapWithBench('p7', 'ball');
    useTacticalStore.getState().sendToBench('ball');
    expect(useTacticalStore.getState().benchMoves).toEqual([]);
  });

  it('is saved with the board and cleared on demand', () => {
    const s = useTacticalStore.getState();
    s.swapWithBench('p7', 'p1');
    const snap = s.getSnapshot();
    expect(snap.benchMoves).toHaveLength(1);
    s.clearBenchMoves();
    expect(useTacticalStore.getState().benchMoves).toEqual([]);
    s.restoreSnapshot(snap);
    expect(useTacticalStore.getState().benchMoves).toHaveLength(1);
    s.resetBoard();
    expect(useTacticalStore.getState().benchMoves).toEqual([]);
  });

  it('restores an older save without move history', () => {
    const { benchMoves: _moves, ...older } = useTacticalStore.getState().getSnapshot();
    useTacticalStore.getState().restoreSnapshot(older as never);
    expect(useTacticalStore.getState().benchMoves).toEqual([]);
  });
});
