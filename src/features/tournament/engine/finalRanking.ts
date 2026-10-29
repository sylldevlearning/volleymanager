import { completedPoolStandings } from './qualification';
import { compareAcrossPools, computeStandings, type StandingRow } from './standings';
import type { EngineContext, EngineMatch } from './types';

export interface RankingEntry {
  teamId: string;
  /** Shared by the teams out in the same round; null while not decided. */
  rank: number | null;
}

const loserOf = (m: EngineMatch) => (m.winnerId === m.homeId ? m.awayId : m.homeId);

/** Teams in a round of the bracket, from a 'ko:<teams>:<n>' label. */
const roundTeams = (m: EngineMatch) => Number(m.label?.split(':')[1] ?? 0);

/**
 * Final ranking. Championship: the table once every match is played.
 * Brackets: final, 3rd place match, then by round reached; teams out of the
 * pools come after the bracket, best pool place first.
 */
export function finalRanking(ctx: EngineContext, matches: EngineMatch[]): RankingEntry[] {
  if (ctx.format === 'round_robin') {
    const done = matches.every((m) => m.status === 'validated');
    return computeStandings(ctx.teams.map((t) => t.id), matches, ctx)
      .map((r) => ({ teamId: r.teamId, rank: done ? r.rank : null }));
  }

  const rank = new Map<string, number>();
  const bracket = matches.filter((m) => m.stage === 'knockout' || m.stage === 'placement');
  const third = bracket.find((m) => m.label === 'third');
  for (const m of bracket) {
    if (m.status !== 'validated' || !m.winnerId) continue;
    const loser = loserOf(m)!;
    if (m.label === 'third') {
      rank.set(m.winnerId, 3);
      rank.set(loser, 4);
    } else if (roundTeams(m) === 2) {
      rank.set(m.winnerId, 1);
      rank.set(loser, 2);
    } else if (roundTeams(m) === 4) {
      if (!third) rank.set(loser, 3);
    } else {
      rank.set(loser, roundTeams(m) / 2 + 1);
    }
  }

  // Order inside a shared place: pool record when there were pools
  const pools = ctx.format === 'pools_knockout' ? completedPoolStandings(ctx, matches) : [];
  const rows = new Map<string, StandingRow>();
  for (const p of pools) for (const r of p ?? []) rows.set(r.teamId, r);

  if (pools.length > 0 && pools.every((p) => p !== null)) {
    const qualified = new Set(bracket.flatMap((m) => [m.homeId, m.awayId]).filter((t): t is string => t !== null));
    let next = qualified.size + 1;
    const deepest = Math.max(...pools.map((p) => p!.length));
    for (let place = 1; place <= deepest; place++) {
      const tier = pools.map((p) => p![place - 1]).filter((r): r is StandingRow => r !== undefined && !qualified.has(r.teamId));
      for (const r of compareAcrossPools(tier, ctx)) rank.set(r.teamId, next++);
    }
  }

  const position = new Map(ctx.teams.map((t) => [t.id, (t.seedRank ?? 10_000) * 10_000 + t.position]));
  const statsOrder = compareAcrossPools(
    ctx.teams.map((t) => rows.get(t.id) ?? computeStandings([t.id], [], ctx)[0]),
    ctx,
  ).map((r) => r.teamId);
  return ctx.teams
    .map((t) => ({ teamId: t.id, rank: rank.get(t.id) ?? null }))
    .sort((a, b) =>
      (a.rank ?? Infinity) - (b.rank ?? Infinity)
      || (rows.size > 0 ? statsOrder.indexOf(a.teamId) - statsOrder.indexOf(b.teamId) : position.get(a.teamId)! - position.get(b.teamId)!));
}
