import type { TeamRef } from '../../../models/tournament';
import { compareAcrossPools, computeStandings, type StandingRow } from './standings';
import type { EngineContext, EngineMatch } from './types';

export interface ResolvedTeams {
  homeId: string | null;
  awayId: string | null;
}

/** Ranking of each pool once all its matches are validated (null before). */
export function completedPoolStandings(ctx: EngineContext, matches: EngineMatch[]): (StandingRow[] | null)[] {
  return ctx.pools.map((teamIds, pool) => {
    const inPool = matches.filter((m) => m.stage === 'pool' && m.pool === pool);
    if (inPool.some((m) => m.status !== 'validated')) return null;
    return computeStandings(teamIds, inPool, ctx);
  });
}

/** Teams of every match, as the results known so far decide them. */
export function resolveTeams(ctx: EngineContext, matches: EngineMatch[]): Map<string, ResolvedTeams> {
  const byKey = new Map(matches.map((m) => [m.key, m]));
  const needsPools = matches.some((m) => [m.homeRef, m.awayRef].some((r) => r.type === 'poolRank' || r.type === 'bestOf'));
  const pools = needsPools ? completedPoolStandings(ctx, matches) : [];
  const bestOfCache = new Map<number, StandingRow[] | null>();

  const bestOf = (rank: number): StandingRow[] | null => {
    if (!bestOfCache.has(rank)) {
      const done = pools.length > 0 && pools.every((p) => p !== null);
      const rows = done ? pools.map((p) => p![rank - 1]).filter((r): r is StandingRow => r !== undefined) : null;
      bestOfCache.set(rank, rows ? compareAcrossPools(rows, ctx) : null);
    }
    return bestOfCache.get(rank)!;
  };

  const resolve = (ref: TeamRef): string | null => {
    switch (ref.type) {
      case 'team':
        return ref.id;
      case 'poolRank':
        return pools[ref.pool]?.[ref.rank - 1]?.teamId ?? null;
      case 'bestOf':
        return bestOf(ref.rank)?.[ref.index - 1]?.teamId ?? null;
      case 'winner':
      case 'loser': {
        const m = byKey.get(ref.match);
        if (!m || m.status !== 'validated' || !m.winnerId) return null;
        if (ref.type === 'winner') return m.winnerId;
        return m.winnerId === m.homeId ? m.awayId : m.homeId;
      }
    }
  };

  return new Map(matches.map((m) => [m.key, { homeId: resolve(m.homeRef), awayId: resolve(m.awayRef) }]));
}
