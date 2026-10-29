import type { BrassageRules, TeamRef, TournamentStage } from '../../../models/tournament';
import { buildPlacementBracket } from './bracket';
import { defaultBrassageRules } from './defaults';
import { drawPools } from './pools';
import { roundRobin } from './roundRobin';
import type { EngineContext, EngineMatch, GenerateInput, Generated, PoolDef } from './types';

/** n split into `parts` sizes as equal as possible, the bigger ones first. */
function split(n: number, parts: number): number[] {
  const base = Math.floor(n / parts);
  const extra = n % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Pools of 4 first, completed with pools of 3 (one pool below 6 teams). */
export function poolSizes(n: number): number[] {
  return n < 6 ? [n] : split(n, Math.ceil(n / 4));
}

/** Levels of equal size (Principale first). */
export function levelSizes(n: number, levels: number): number[] {
  return split(n, levels);
}

export type LevelFormat = 'pool' | 'bracket' | 'pools';

const isPowerOf2 = (n: number) => n > 0 && (n & (n - 1)) === 0;

/**
 * One pool up to 5 teams; a bracket where every place is played for 8, 16,
 * 32 teams (everyone plays the same number of matches); pools of 4 / 3
 * otherwise — a level of 6 plays two pools of 3, not 5 matches each.
 */
export function levelFormat(size: number): LevelFormat {
  if (size <= 5) return 'pool';
  if (isPowerOf2(size)) return 'bracket';
  return 'pools';
}

export function brassageRulesOf(ctx: Pick<EngineContext, 'rules' | 'teams'>): BrassageRules {
  return ctx.rules.brassage ?? defaultBrassageRules(ctx.teams.length);
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Pools of the next round, from the ranking of the previous one: teams of the
 * same level together (1-4, 5-8…). Two teams that already met are separated
 * when possible, by swapping the lower one with the closest team of a
 * neighbour pool that creates no new meeting.
 */
export function composePools(ranking: string[], sizes: number[], met: Set<string>): string[][] {
  const pools: string[][] = [];
  let i = 0;
  for (const size of sizes) {
    pools.push(ranking.slice(i, i + size));
    i += size;
  }
  const rank = new Map(ranking.map((t, k) => [t, k]));
  const meets = (team: string, pool: string[], except: string) => pool.some((o) => o !== team && o !== except && met.has(pairKey(team, o)));

  for (let p = 0; p < pools.length; p++) {
    for (let guard = 0; guard < 50; guard++) {
      const pool = pools[p];
      const clash = pool.flatMap((a, x) => pool.slice(x + 1).filter((b) => met.has(pairKey(a, b))).map((b) => [a, b] as const))[0];
      if (!clash) break;
      // Move the lower-ranked team of the pair
      const mover = rank.get(clash[0])! > rank.get(clash[1])! ? clash[0] : clash[1];
      let swapped = false;
      for (const q of [p + 1, p - 1]) {
        const other = pools[q];
        if (!other) continue;
        const candidates = q > p ? other : [...other].reverse();
        const pick = candidates.find((c) => !meets(c, pool, mover) && !meets(mover, other, c));
        if (pick) {
          pools[p] = pool.map((t) => (t === mover ? pick : t));
          pools[q] = other.map((t) => (t === pick ? mover : t));
          swapped = true;
          break;
        }
      }
      if (!swapped) break;
    }
  }
  return pools.map((pool) => [...pool].sort((a, b) => rank.get(a)! - rank.get(b)!));
}

// ─── Generation ─────────────────────────────────────────────────────────────

function match(
  key: string,
  fields: Pick<EngineMatch, 'stage' | 'pool' | 'round' | 'phase' | 'level'>,
  homeRef: TeamRef,
  awayRef: TeamRef,
): EngineMatch {
  const idOf = (ref: TeamRef) => (ref.type === 'team' ? ref.id : null);
  return {
    key, ...fields, bracketSlot: null, label: null,
    homeRef, awayRef, homeId: idOf(homeRef), awayId: idOf(awayRef),
    status: 'scheduled', sets: null, forfeitId: null, winnerId: null, slot: null, court: null,
  };
}

/** Round robin on refs (Berger tables work on placeholders). */
function poolMatches(
  refs: TeamRef[],
  legs: 1 | 2,
  keyOf: (round: number, n: number) => string,
  fields: { stage: TournamentStage; pool: number; phase: number | null; level: number | null },
): EngineMatch[] {
  const placeholders = refs.map((_, i) => String(i));
  const counters = new Map<number, number>();
  return roundRobin(placeholders, legs).map((p) => {
    const n = (counters.get(p.round) ?? 0) + 1;
    counters.set(p.round, n);
    return match(keyOf(p.round, n), { ...fields, round: p.round }, refs[Number(p.home)], refs[Number(p.away)]);
  });
}

/** Serpentine split of ranks 1..size into `count` pools (balanced levels). */
function serpentine(size: number, count: number): number[][] {
  const pools: number[][] = Array.from({ length: count }, () => []);
  for (let i = 0; i < size; i++) {
    const lap = Math.floor(i / count);
    const offset = i % count;
    pools[lap % 2 === 0 ? offset : count - 1 - offset].push(i + 1);
  }
  return pools;
}

/** Mixing rounds then levels — later pools refer to places decided by results. */
export function generateBrassage(input: GenerateInput, rng: () => number, prefix: string): Generated {
  const n = input.teams.length;
  const { rounds, levels } = input.rules.brassage ?? defaultBrassageRules(n);
  const legs = input.rules.roundRobinLegs;
  const sizes = poolSizes(n);
  const pools: string[][] = [];
  const poolDefs: PoolDef[] = [];
  const matches: EngineMatch[] = [];

  const round1 = drawPools(input.teams, sizes.length, input.seeding, rng);
  round1.forEach((ids, q) => {
    const pool = pools.length;
    pools.push(ids);
    poolDefs.push({ phase: 1, level: null });
    matches.push(...poolMatches(ids.map((id) => ({ type: 'team', id })), legs,
      (round, k) => `${prefix}B1P${q + 1}-${round}-${k}`, { stage: 'brassage', pool, phase: 1, level: null }));
  });

  for (let phase = 2; phase <= rounds; phase++) {
    sizes.forEach((size, q) => {
      const pool = pools.length;
      pools.push([]);
      poolDefs.push({ phase, level: null });
      const seats = Array.from({ length: size }, (_, seat): TeamRef => ({ type: 'seat', phase, pool, seat }));
      matches.push(...poolMatches(seats, legs,
        (round, k) => `${prefix}B${phase}P${q + 1}-${round}-${k}`, { stage: 'brassage', pool, phase, level: null }));
    });
  }

  levelSizes(n, levels).forEach((size, level) => {
    const rankRef = (rank: number): TeamRef => ({ type: 'levelRank', level, rank });
    const format = levelFormat(size);
    if (format === 'bracket') {
      matches.push(...buildPlacementBracket(
        Array.from({ length: size }, (_, i) => rankRef(i + 1)),
        { keyPrefix: `${prefix}V${level + 1}`, level },
      ));
      return;
    }
    const groups = format === 'pool' ? [Array.from({ length: size }, (_, i) => i + 1)] : serpentine(size, Math.ceil(size / 4));
    groups.forEach((ranks, q) => {
      const pool = pools.length;
      pools.push([]);
      poolDefs.push({ phase: null, level });
      matches.push(...poolMatches(ranks.map(rankRef), legs,
        (round, k) => `${prefix}V${level + 1}P${q + 1}-${round}-${k}`, { stage: 'level', pool, phase: null, level }));
    });
  });

  return { pools, poolDefs, matches };
}
