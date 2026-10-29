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
  const sorted = [...ids].sort((a, b) => value(b) - value(a));
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
 * the configured order (default: head-to-head, set difference, point
 * difference, points scored). Head-to-head = a mini-ranking of the matches
 * between the tied teams only. Remaining ties: seed, then registration order.
 */
export function computeStandings(teamIds: string[], matches: EngineMatch[], ctx: EngineContext): StandingRow[] {
  const totals = totalsFor(teamIds, matches, ctx);
  const teams = new Map(ctx.teams.map((t) => [t.id, t]));

  const criterion = (rule: TiebreakerRule, group: string[]): ((id: string) => number) => {
    switch (rule) {
      case 'headToHead': {
        const mini = totalsFor(group, matches, ctx);
        return (id) => mini.get(id)!.points;
      }
      case 'setDifference': return (id) => { const t = totals.get(id)!; return t.setsWon - t.setsLost; };
      case 'pointDifference': return (id) => { const t = totals.get(id)!; return t.pointsWon - t.pointsLost; };
      case 'pointsScored': return (id) => totals.get(id)!.pointsWon;
      // A criterion from an older version: no effect
      default: return () => 0;
    }
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
 * Compares teams of different pools (best thirds, non-qualified teams), per
 * match played since pools may differ in size: points, set difference, point
 * difference, points scored; then seed and registration order.
 */
export function compareAcrossPools(rows: StandingRow[], ctx: EngineContext): StandingRow[] {
  const teams = new Map(ctx.teams.map((t) => [t.id, t]));
  const perMatch = (r: StandingRow, value: number) => (r.played === 0 ? 0 : value / r.played);
  const order = finalOrder(rows.map((r) => r.teamId), teams);
  return [...rows].sort((a, b) =>
    perMatch(b, b.points) - perMatch(a, a.points)
    || perMatch(b, b.setsWon - b.setsLost) - perMatch(a, a.setsWon - a.setsLost)
    || perMatch(b, b.pointsWon - b.pointsLost) - perMatch(a, a.pointsWon - a.pointsLost)
    || perMatch(b, b.pointsWon) - perMatch(a, a.pointsWon)
    || order.indexOf(a.teamId) - order.indexOf(b.teamId));
}
