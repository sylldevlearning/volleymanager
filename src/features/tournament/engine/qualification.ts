import type { TeamRef } from '../../../models/tournament';
import { brassageRulesOf, composePools, levelSizes, pairKey } from './brassage';
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

/** Ranking of mixed pools: every 1st, then every 2nd…, each place compared across pools. */
function rankByPlace(standings: StandingRow[][], ctx: EngineContext): string[] {
  const deepest = Math.max(0, ...standings.map((s) => s.length));
  const out: string[] = [];
  for (let place = 0; place < deepest; place++) {
    const tier = standings.map((s) => s[place]).filter((r): r is StandingRow => r !== undefined);
    out.push(...compareAcrossPools(tier, ctx).map((r) => r.teamId));
  }
  return out;
}

export interface BrassageView {
  /** Mixing rounds in the tournament */
  rounds: number;
  /** Teams of a mixing pool (null while not known) */
  poolTeams: (pool: number) => string[] | null;
  /** Ranking after a round, once all its matches are validated */
  ranking: (phase: number) => string[] | null;
  /** Teams of each level, from the ranking of the last round */
  levels: () => string[][] | null;
}

/**
 * Brassage + niveaux, read from the results: round 1 is ranked place by place
 * across pools (pools are mixed); from round 2, pools are of the same level, so
 * the ranking follows the pools (A first, then B…). Levels split the ranking of
 * the last round only.
 */
export function brassageView(ctx: EngineContext, matches: EngineMatch[]): BrassageView {
  const mixing = matches.filter((m) => m.stage === 'brassage');
  const rounds = Math.max(0, ...mixing.map((m) => m.phase ?? 0));
  const poolsOf = (phase: number) => [...new Set(mixing.filter((m) => m.phase === phase).map((m) => m.pool!))].sort((a, b) => a - b);
  const rankings = new Map<number, string[] | null>();
  const compositions = new Map<number, Map<number, string[]> | null>();

  const composition = (phase: number): Map<number, string[]> | null => {
    if (!compositions.has(phase)) {
      const previous = ranking(phase - 1);
      let result: Map<number, string[]> | null = null;
      if (previous) {
        const pools = poolsOf(phase);
        const sizes = pools.map((p) => 1 + Math.max(...mixing
          .filter((m) => m.pool === p)
          .flatMap((m) => [m.homeRef, m.awayRef])
          .map((r) => (r.type === 'seat' ? r.seat : 0))));
        const met = new Set(mixing
          .filter((m) => (m.phase ?? 0) < phase && m.homeId && m.awayId)
          .map((m) => pairKey(m.homeId!, m.awayId!)));
        const composed = composePools(previous, sizes, met);
        result = new Map(pools.map((p, i) => [p, composed[i]]));
      }
      compositions.set(phase, result);
    }
    return compositions.get(phase)!;
  };

  const poolTeams = (pool: number): string[] | null => {
    const phase = mixing.find((m) => m.pool === pool)?.phase ?? null;
    if (phase === null) return null;
    if (phase === 1) return ctx.pools[pool] ?? null;
    return composition(phase)?.get(pool) ?? null;
  };

  function ranking(phase: number): string[] | null {
    if (phase < 1) return null;
    if (!rankings.has(phase)) {
      const inRound = mixing.filter((m) => m.phase === phase);
      let result: string[] | null = null;
      if (inRound.length > 0 && inRound.every((m) => m.status === 'validated')) {
        const standings = poolsOf(phase).map((p) =>
          computeStandings(poolTeams(p) ?? [], inRound.filter((m) => m.pool === p), ctx));
        result = phase === 1 ? rankByPlace(standings, ctx) : standings.flat().map((r) => r.teamId);
      }
      rankings.set(phase, result);
    }
    return rankings.get(phase)!;
  }

  const levels = (): string[][] | null => {
    const last = ranking(rounds);
    if (!last) return null;
    const out: string[][] = [];
    let i = 0;
    for (const size of levelSizes(last.length, brassageRulesOf(ctx).levels)) {
      out.push(last.slice(i, i + size));
      i += size;
    }
    return out;
  };

  return { rounds, poolTeams, ranking, levels };
}

/** Teams of every match, as the results known so far decide them. */
export function resolveTeams(ctx: EngineContext, matches: EngineMatch[]): Map<string, ResolvedTeams> {
  const byKey = new Map(matches.map((m) => [m.key, m]));
  const needsPools = matches.some((m) => [m.homeRef, m.awayRef].some((r) => r.type === 'poolRank' || r.type === 'bestOf'));
  const pools = needsPools ? completedPoolStandings(ctx, matches) : [];
  const bestOfCache = new Map<number, StandingRow[] | null>();
  let brassage: BrassageView | null = null;
  const view = () => (brassage ??= brassageView(ctx, matches));

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
      case 'seat':
        return view().poolTeams(ref.pool)?.[ref.seat] ?? null;
      case 'levelRank':
        return view().levels()?.[ref.level]?.[ref.rank - 1] ?? null;
    }
  };

  return new Map(matches.map((m) => [m.key, { homeId: resolve(m.homeRef), awayId: resolve(m.awayRef) }]));
}
