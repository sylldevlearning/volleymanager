import { computeStandings } from '../src/features/tournament/engine/standings';
import { DEFAULT_POINTS, DEFAULT_TIEBREAKERS, POINTS_PRESETS, defaultRules } from '../src/features/tournament/engine/defaults';
import type { EngineContext, EngineMatch } from '../src/features/tournament/engine/types';
import type { SetScore, TiebreakerRule, TournamentRules } from '../src/models/tournament';

const TEAMS = ['A', 'B', 'C', 'D'];

function ctxWith(rules: Partial<TournamentRules> = {}, setsToWin = 2, teams = TEAMS): EngineContext {
  const base = defaultRules('indoor_6v6', 'round_robin', teams.length);
  return {
    format: 'round_robin',
    rules: { ...base, match: { ...base.match, setsToWin }, ...rules },
    teams: teams.map((id, i) => ({ id, seedRank: null, position: i })),
    pools: [],
  };
}

let n = 0;
function played(home: string, away: string, sets: SetScore[], forfeitId: string | null = null): EngineMatch {
  const setsHome = sets.filter(([h, a]) => h > a).length;
  const setsAway = sets.length - setsHome;
  return {
    key: `m${++n}`, stage: 'league', pool: null, round: 1, bracketSlot: null, label: null,
    homeRef: { type: 'team', id: home }, awayRef: { type: 'team', id: away },
    homeId: home, awayId: away, status: 'validated', sets, forfeitId,
    winnerId: setsHome > setsAway ? home : away, slot: 0, court: 1,
  };
}

const order = (rows: { teamId: string }[]) => rows.map((r) => r.teamId);
const fivb = { points: POINTS_PRESETS.fivb };

describe('ranking points', () => {
  it('by default a win is worth 1 point, a loss 0 — whatever the score', () => {
    expect(DEFAULT_POINTS).toEqual({ winClear: 1, winTight: 1, lossTight: 0, lossClear: 0, forfeitLoss: 0 });
    const rows = computeStandings(TEAMS, [
      played('A', 'B', [[25, 10], [25, 10]]),
      played('C', 'D', [[25, 10], [10, 25], [15, 10]]),
    ], ctxWith());
    expect(Object.fromEntries(rows.map((r) => [r.teamId, r.points]))).toEqual({ A: 1, B: 0, C: 1, D: 0 });
  });

  it('3/2/1/0 stays available: 2-0 → 3/0, 2-1 → 2/1', () => {
    const rows = computeStandings(TEAMS, [
      played('A', 'B', [[25, 10], [25, 10]]),
      played('C', 'D', [[25, 10], [10, 25], [15, 10]]),
    ], ctxWith(fivb));
    expect(Object.fromEntries(rows.map((r) => [r.teamId, r.points]))).toEqual({ A: 3, B: 0, C: 2, D: 1 });
  });

  it('3/2/1/0 with 3 winning sets: 3-0 and 3-1 → 3/0, 3-2 → 2/1', () => {
    const w = [25, 20] as SetScore;
    const l = [20, 25] as SetScore;
    const rows = computeStandings(TEAMS, [
      played('A', 'B', [w, w, w]),
      played('C', 'D', [w, l, w, w]),
      played('A', 'C', [w, l, w, l, [15, 13]]),
    ], ctxWith(fivb, 3));
    expect(Object.fromEntries(rows.map((r) => [r.teamId, r.points]))).toEqual({ A: 5, B: 0, C: 4, D: 0 });
  });

  it('a forfeit gives the forfeit-loss points', () => {
    const rules = { points: { ...DEFAULT_POINTS, forfeitLoss: -1 } };
    const rows = computeStandings(TEAMS, [played('A', 'B', [[25, 0], [25, 0]], 'B')], ctxWith(rules));
    const b = rows.find((r) => r.teamId === 'B')!;
    expect([b.points, b.forfeits]).toEqual([-1, 1]);
  });

  it('counts sets and points, and teams without a match', () => {
    const rows = computeStandings(TEAMS, [played('A', 'B', [[25, 20], [23, 25], [15, 9]])], ctxWith());
    expect(rows.find((r) => r.teamId === 'A')).toMatchObject({ played: 1, won: 1, lost: 0, setsWon: 2, setsLost: 1, pointsWon: 63, pointsLost: 54 });
    expect(rows.find((r) => r.teamId === 'D')).toMatchObject({ played: 0, points: 0 });
    expect(rows).toHaveLength(4);
  });
});

describe('tie-breakers', () => {
  // A, B and C each win once against each other — same points
  const cycle = (aB: SetScore[], bC: SetScore[], cA: SetScore[]) => [
    played('A', 'B', aB), played('B', 'C', bC), played('C', 'A', cA),
  ];

  it('default order: head-to-head, set difference, point difference, points scored', () => {
    const expected: TiebreakerRule[] = ['headToHead', 'setDifference', 'pointDifference', 'pointsScored'];
    expect(DEFAULT_TIEBREAKERS).toEqual(expected);
  });

  it('head-to-head first, before the set difference', () => {
    const matches = [
      played('A', 'C', [[25, 10], [25, 10]]),           // A: 1 win, sets 2-0
      played('B', 'A', [[25, 20], [20, 25], [15, 10]]), // B beats A — A sets 3-2 overall
      played('D', 'B', [[25, 10], [25, 10]]),           // B: sets 2-3 overall
    ];
    // A, B and D: 1 point each. Between them B beat A, D beat B → A last;
    // B and D still tied → set difference (D +2, B -1)
    expect(order(computeStandings(TEAMS, matches, ctxWith()))).toEqual(['D', 'B', 'A', 'C']);
    // Set difference alone: D +2, A +1, B -1
    expect(order(computeStandings(TEAMS, matches, ctxWith({ tiebreakers: ['setDifference'] })))).toEqual(['D', 'A', 'B', 'C']);
  });

  it('set difference when head-to-head cannot split (cycle)', () => {
    const rows = computeStandings(['A', 'B', 'C'], cycle(
      [[25, 20], [20, 25], [15, 10]], // A 2-1 B
      [[25, 20], [25, 20]],           // B 2-0 C
      [[25, 20], [25, 20]],           // C 2-0 A
    ), ctxWith());
    // 1 pt each — sets: B +1, C 0, A -1
    expect(order(rows)).toEqual(['B', 'C', 'A']);
  });

  it('then the point difference', () => {
    const rows = computeStandings(['A', 'B', 'C'], cycle(
      [[25, 23], [25, 23]],
      [[25, 10], [25, 10]],
      [[25, 20], [25, 20]],
    ), ctxWith());
    // Sets 2-2 each; points A 90-96 (-6), B 96-70 (+26), C 70-90 (-20)
    expect(order(rows)).toEqual(['B', 'A', 'C']);
  });

  it('then the most points scored', () => {
    const rows = computeStandings(['A', 'B', 'C'], [
      played('C', 'A', [[30, 28], [25, 23]]),
      played('A', 'B', [[25, 23], [25, 23]]),
      played('B', 'C', [[27, 25], [25, 23]]),
    ], ctxWith());
    // Sets 2-2 and point difference 0 for all; scored C 103, A 101, B 98
    expect(rows.map((r) => r.pointsWon - r.pointsLost)).toEqual([0, 0, 0]);
    expect(order(rows)).toEqual(['C', 'A', 'B']);
  });

  it('follows the configured order of criteria', () => {
    const matches = cycle(
      [[25, 23], [25, 23]],
      [[25, 10], [25, 10]],
      [[25, 20], [25, 20]],
    );
    // Only "points scored": A 90, B 96, C 70
    expect(order(computeStandings(['A', 'B', 'C'], matches, ctxWith({ tiebreakers: ['pointsScored'] })))).toEqual(['B', 'A', 'C']);
    // No criterion: the registration order decides
    expect(order(computeStandings(['A', 'B', 'C'], matches, ctxWith({ tiebreakers: [] })))).toEqual(['A', 'B', 'C']);
  });

  it('three teams tied: a mini-ranking between them', () => {
    const win = [[25, 20], [25, 20]] as SetScore[];
    const teams = ['A', 'B', 'C', 'D', 'E'];
    const rows = computeStandings(teams, [
      played('A', 'B', win), played('A', 'C', win), played('B', 'C', win),
      played('D', 'A', win), played('E', 'A', win),
      played('B', 'D', win), played('E', 'B', win),
      played('C', 'D', win), played('C', 'E', win),
      played('D', 'E', [[25, 20], [20, 25], [15, 10]]),
    ], ctxWith({ ...fivb, tiebreakers: ['headToHead'] }, 2, teams));
    // 3/2/1/0: E 7, A/B/C 6, D 5 — between A, B and C: A 2 wins, B 1, C 0
    expect(order(rows)).toEqual(['E', 'A', 'B', 'C', 'D']);
    expect(rows.map((r) => r.points)).toEqual([7, 6, 6, 6, 5]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('then the seed, then the registration order', () => {
    const ctx = ctxWith();
    ctx.teams = [
      { id: 'A', seedRank: null, position: 0 },
      { id: 'B', seedRank: 2, position: 1 },
      { id: 'C', seedRank: 1, position: 2 },
      { id: 'D', seedRank: null, position: 3 },
    ];
    expect(order(computeStandings(TEAMS, [], ctx))).toEqual(['C', 'B', 'A', 'D']);
  });

  it('ignores criteria it does not know (older tournaments)', () => {
    const legacy = ['setQuotient'] as unknown as TiebreakerRule[];
    expect(order(computeStandings(TEAMS, [], ctxWith({ tiebreakers: legacy })))).toEqual(TEAMS);
  });

  it('ignores matches that are not validated or outside the group', () => {
    const pending = { ...played('A', 'B', [[25, 10], [25, 10]]), status: 'scheduled' as const };
    const outside = played('C', 'X', [[25, 10], [25, 10]]);
    const rows = computeStandings(TEAMS, [pending, outside], ctxWith());
    expect(rows.every((r) => r.points === 0)).toBe(true);
  });
});
