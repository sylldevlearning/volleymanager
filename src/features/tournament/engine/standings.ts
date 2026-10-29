import type { TiebreakerRule } from '../../../models/tournament';
import { evaluateScore, rulesForStage } from './results';
import type { EngineContext, EngineMatch, EngineTeam } from './types';

export interface StandingRow {
  teamId: string;
  rank: number;
  played: number;
  won: number;
  lost: number;
  forfeits: number;
  points: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
}

type Totals = Omit<StandingRow, 'rank'>;

function emptyTotals(teamId: string): Totals {
  return { teamId, played: 0, won: 0, lost: 0, forfeits: 0, points: 0, setsWon: 0, setsLost: 0, pointsWon: 0, pointsLost: 0 };
}

/** won / lost, with x/0 above any finite quotient. */
export function quotient(won: number, lost: number): number {
  if (lost === 0) return won === 0 ? 0 : Infinity;
  return won / lost;
}

function totalsFor(teamIds: string[], matches: EngineMatch[], ctx: EngineContext): Map<string, Totals> {
  const totals = new Map(teamIds.map((id) => [id, emptyTotals(id)]));
  for (const m of matches) {
    if (m.status !== 'validated' || !m.sets || !m.homeId || !m.awayId) continue;
    const home = totals.get(m.homeId);
    const away = totals.get(m.awayId);
    if (!home || !away) continue;
    const evaluation = evaluateScore(m.sets, rulesForStage(ctx.rules, m.stage));
    if (!evaluation.ok) continue;
    const s = evaluation.summary;
    const scale = ctx.rules.points;
    const sides: [Totals, number, number, number, number, boolean][] = [
      [home, s.setsHome, s.setsAway, s.pointsHome, s.pointsAway, s.winner === 'home'],
      [away, s.setsAway, s.setsHome, s.pointsAway, s.pointsHome, s.winner === 'away'],
    ];
    for (const [row, setsFor, setsAgainst, ptsFor, ptsAgainst, won] of sides) {
      const forfeited = m.forfeitId === row.teamId;
      row.played++;
      row.setsWon += setsFor;
      row.setsLost += setsAgainst;
      row.pointsWon += ptsFor;
      row.pointsLost += ptsAgainst;
      if (won) {
        row.won++;
        row.points += s.tight ? scale.winTight : scale.winClear;
      } else {
        row.lost++;
        if (forfeited) row.forfeits++;
        row.points += forfeited ? scale.forfeitLoss : s.tight ? scale.lossTight : scale.lossClear;
      }
    }
  }
  return totals;
}

/** Splits `ids` into groups of equal value, best first. */
function groupBy(ids: string[], value: (id: string) => number): string[][] {
  // No subtraction: quotients can be Infinity
  const sorted = [...ids].sort((a, b) => (value(a) === value(b) ? 0 : value(b) > value(a) ? 1 : -1));
  const groups: string[][] = [];
  for (const id of sorted) {
    const last = groups[groups.length - 1];
    if (last && value(last[0]) === value(id)) last.push(id);
    else groups.push([id]);
  }
  return groups;
}

function finalOrder(ids: string[], teams: Map<string, EngineTeam>): string[] {
  return [...ids].sort((a, b) => {
    const ta = teams.get(a);
    const tb = teams.get(b);
    const sa = ta?.seedRank ?? Infinity;
    const sb = tb?.seedRank ?? Infinity;
    if (sa !== sb) return sa - sb;
    return (ta?.position ?? 0) - (tb?.position ?? 0);
  });
}

/**
 * Ranking of a group (pool, league): ranking points, then the tie-breakers in
 * the configured order. Head-to-head = a mini-ranking of the matches between
 * the tied teams only. Remaining ties: seed, then registration order.
 */
export function computeStandings(teamIds: string[], matches: EngineMatch[], ctx: EngineContext): StandingRow[] {
  const totals = totalsFor(teamIds, matches, ctx);
  const teams = new Map(ctx.teams.map((t) => [t.id, t]));

  const criterion = (rule: TiebreakerRule, group: string[]): ((id: string) => number) => {
    if (rule === 'setQuotient') return (id) => { const t = totals.get(id)!; return quotient(t.setsWon, t.setsLost); };
    if (rule === 'pointQuotient') return (id) => { const t = totals.get(id)!; return quotient(t.pointsWon, t.pointsLost); };
    const mini = totalsFor(group, matches, ctx);
    return (id) => mini.get(id)!.points;
  };

  const rank = (group: string[], level: number): string[] => {
    if (group.length <= 1) return group;
    if (level >= ctx.rules.tiebreakers.length) return finalOrder(group, teams);
    const value = criterion(ctx.rules.tiebreakers[level], group);
    return groupBy(group, value).flatMap((g) => rank(g, level + 1));
  };

  const ordered = groupBy(teamIds, (id) => totals.get(id)!.points).flatMap((g) => rank(g, 0));
  return ordered.map((id, i) => ({ ...totals.get(id)!, rank: i + 1 }));
}

/**
 * Compares teams of different pools (best thirds, non-qualified teams):
 * points per match (pools may differ in size), set quotient, point quotient,
 * seed, registration order.
 */
export function compareAcrossPools(rows: StandingRow[], ctx: EngineContext): StandingRow[] {
  const teams = new Map(ctx.teams.map((t) => [t.id, t]));
  const perMatch = (r: StandingRow) => (r.played === 0 ? 0 : r.points / r.played);
  const order = finalOrder(rows.map((r) => r.teamId), teams);
  return [...rows].sort((a, b) =>
    perMatch(b) - perMatch(a)
    || quotientDiff(b.setsWon, b.setsLost, a.setsWon, a.setsLost)
    || quotientDiff(b.pointsWon, b.pointsLost, a.pointsWon, a.pointsLost)
    || order.indexOf(a.teamId) - order.indexOf(b.teamId));
}

function quotientDiff(w1: number, l1: number, w2: number, l2: number): number {
  const q1 = quotient(w1, l1);
  const q2 = quotient(w2, l2);
  if (q1 === q2) return 0;
  return q1 > q2 ? 1 : -1;
}
