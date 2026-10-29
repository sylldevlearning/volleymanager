import { computeStandings } from '../src/features/tournament/engine/standings';
import { DEFAULT_POINTS, DEFAULT_TIEBREAKERS, defaultRules } from '../src/features/tournament/engine/defaults';
import type { EngineContext, EngineMatch } from '../src/features/tournament/engine/types';
import type { SetScore, TiebreakerRule, TournamentRules } from '../src/models/tournament';

const TEAMS = ['A', 'B', 'C', 'D'];

function ctxWith(rules: Partial<TournamentRules> = {}, setsToWin = 2): EngineContext {
  const base = defaultRules('indoor_6v6', 'round_robin', TEAMS.length);
  return {
    format: 'round_robin',
    rules: { ...base, match: { ...base.match, setsToWin }, ...rules },
    teams: TEAMS.map((id, i) => ({ id, seedRank: null, position: i })),
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

describe('ranking points (default scale)', () => {
  it('2 winning sets: 2-0 → 3/0, 2-1 → 2/1', () => {
    const rows = computeStandings(TEAMS, [
      played('A', 'B', [[25, 10], [25, 10]]),
      played('C', 'D', [[25, 10], [10, 25], [15, 10]]),
    ], ctxWith());
    const pts = Object.fromEntries(rows.map((r) => [r.teamId, r.points]));
    expect(pts).toEqual({ A: 3, B: 0, C: 2, D: 1 });
  });

  it('3 winning sets: 3-0 and 3-1 → 3/0, 3-2 → 2/1', () => {
    const w = [25, 20] as SetScore;
    const l = [20, 25] as SetScore;
    const rows = computeStandings(TEAMS, [
      played('A', 'B', [w, w, w]),
      played('C', 'D', [w, l, w, w]),
      played('A', 'C', [w, l, w, l, [15, 13]]),
    ], ctxWith({}, 3));
    const pts = Object.fromEntries(rows.map((r) => [r.teamId, r.points]));
    expect(pts).toEqual({ A: 5, B: 0, C: 4, D: 0 });
  });

  it('uses a modified scale', () => {
    const rules = { points: { winClear: 2, winTight: 2, lossTight: 1, lossClear: 1, forfeitLoss: 0 } };
    const rows = computeStandings(TEAMS, [played('A', 'B', [[25, 10], [25, 10]])], ctxWith(rules));
    expect(rows.find((r) => r.teamId === 'B')!.points).toBe(1);
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

  const flat = { points: { winClear: 3, winTight: 3, lossTight: 0, lossClear: 0, forfeitLoss: 0 } };

  it('set quotient first', () => {
    const rows = computeStandings(['A', 'B', 'C'], cycle(
      [[25, 20], [20, 25], [15, 10]], // A 2-1 B
      [[25, 20], [25, 20]],           // B 2-0 C
      [[25, 20], [25, 20]],           // C 2-0 A
    ), ctxWith(flat));
    // 3 pts each — sets: B 3-2, C 2-2, A 2-3
    expect(order(rows)).toEqual(['B', 'C', 'A']);
  });

  it('a set quotient with no set lost beats any other', () => {
    const matches = [
      played('A', 'C', [[25, 23], [25, 23]]),           // A: sets 2-0, points 50/46
      played('B', 'C', [[25, 10], [10, 25], [15, 5]]),  // B: sets 2-1, points 50/40
    ];
    expect(order(computeStandings(['A', 'B', 'C'], matches, ctxWith(flat)))).toEqual(['A', 'B', 'C']);
    // Point quotient first: B
    const pointsFirst = ctxWith({ ...flat, tiebreakers: ['pointQuotient', 'setQuotient'] });
    expect(order(computeStandings(['A', 'B', 'C'], matches, pointsFirst))).toEqual(['B', 'A', 'C']);
  });

  it('point quotient after the set quotient', () => {
    const rows = computeStandings(['A', 'B', 'C'], cycle(
      [[25, 23], [25, 23]],
      [[25, 10], [25, 10]],
      [[25, 20], [25, 20]],
    ), ctxWith());
    // 3 pts and 2-2 sets each; points A 90/96, B 96/70, C 70/90
    expect(order(rows)).toEqual(['B', 'A', 'C']);
  });

  it('head-to-head between two teams with equal quotients', () => {
    const rows = computeStandings(['A', 'B', 'C', 'D'], [
      played('B', 'A', [[25, 20], [25, 20]]),
      played('A', 'C', [[25, 20], [25, 20]]),
      played('D', 'B', [[25, 20], [25, 20]]),
      played('D', 'C', [[25, 20], [25, 20]]),
    ], ctxWith());
    // A and B: 3 pts, 2-2 sets, 90-90 points; B beat A
    expect(order(rows)).toEqual(['D', 'B', 'A', 'C']);
  });

  it('follows the configured order of criteria', () => {
    const matches = cycle(
      [[25, 23], [25, 23]],
      [[25, 10], [25, 10]],
      [[25, 20], [25, 20]],
    );
    const headToHeadFirst: TiebreakerRule[] = ['headToHead', 'setQuotient', 'pointQuotient'];
    // A cycle: head-to-head cannot split → the point quotient still decides
    expect(order(computeStandings(['A', 'B', 'C'], matches, ctxWith({ tiebreakers: headToHeadFirst })))).toEqual(['B', 'A', 'C']);
    // Without the point quotient, the registration order decides
    expect(order(computeStandings(['A', 'B', 'C'], matches, ctxWith({ tiebreakers: ['setQuotient'] })))).toEqual(['A', 'B', 'C']);
    expect(DEFAULT_TIEBREAKERS).toEqual(['setQuotient', 'pointQuotient', 'headToHead']);
  });

  it('three teams tied: a mini-ranking between them', () => {
    const win = [[25, 20], [25, 20]] as SetScore[];
    const teams = ['A', 'B', 'C', 'D', 'E'];
    const ctx = ctxWith({ tiebreakers: ['headToHead'] });
    ctx.teams = teams.map((id, i) => ({ id, seedRank: null, position: i }));
    const rows = computeStandings(teams, [
      played('A', 'B', win), played('A', 'C', win), played('B', 'C', win),
      played('D', 'A', win), played('E', 'A', win),
      played('B', 'D', win), played('E', 'B', win),
      played('C', 'D', win), played('C', 'E', win),
      played('D', 'E', [[25, 20], [20, 25], [15, 10]]),
    ], ctx);
    // E 7, A/B/C 6, D 5 — between A, B and C: A 2 wins, B 1, C 0
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

  it('ignores matches that are not validated or outside the group', () => {
    const pending = { ...played('A', 'B', [[25, 10], [25, 10]]), status: 'scheduled' as const };
    const outside = played('C', 'X', [[25, 10], [25, 10]]);
    const rows = computeStandings(TEAMS, [pending, outside], ctxWith());
    expect(rows.every((r) => r.points === 0)).toBe(true);
  });
});
