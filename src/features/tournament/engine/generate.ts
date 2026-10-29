import { buildBracket, nextPowerOf2, seedPositions, type Entrant } from './bracket';
import { drawOrder, drawPools } from './pools';
import { createRng } from './rng';
import { roundRobin } from './roundRobin';
import type { EngineMatch, GenerateInput, Generated } from './types';

export type SetupError =
  | 'too_few_teams'
  | 'seed_duplicate'
  | 'pool_too_small'
  | 'too_few_qualifiers'
  | 'too_many_best_others';

export function validateSetup(input: GenerateInput): SetupError[] {
  const errors: SetupError[] = [];
  const n = input.teams.length;
  if (n < 2) errors.push('too_few_teams');
  const seeds = input.teams.map((t) => t.seedRank).filter((s): s is number => s !== null);
  if (new Set(seeds).size !== seeds.length) errors.push('seed_duplicate');

  const pools = input.rules.pools;
  if (input.format === 'pools_knockout' && pools && n >= 2) {
    const smallest = Math.floor(n / Math.max(1, pools.count));
    const needed = Math.max(2, pools.qualifiersPerPool + (pools.bestOthers > 0 ? 1 : 0));
    if (pools.count < 1 || smallest < needed) errors.push('pool_too_small');
    if (pools.count * pools.qualifiersPerPool + pools.bestOthers < 2) errors.push('too_few_qualifiers');
    if (pools.bestOthers > pools.count) errors.push('too_many_best_others');
  }
  return errors;
}

function newMatch(key: string, fields: Pick<EngineMatch, 'stage' | 'pool' | 'round'>, home: string, away: string): EngineMatch {
  return {
    key, ...fields, bracketSlot: null, label: null,
    homeRef: { type: 'team', id: home }, awayRef: { type: 'team', id: away },
    homeId: home, awayId: away,
    status: 'scheduled', sets: null, forfeitId: null, winnerId: null, slot: null, court: null,
  };
}

/** Same-pool meetings in the first round, among the entrants placed so far. */
function firstRoundClashes(entrants: Entrant[], positions: number[]): number {
  let clashes = 0;
  for (let j = 0; j < positions.length / 2; j++) {
    const a = entrants[positions[2 * j] - 1];
    const b = entrants[positions[2 * j + 1] - 1];
    if (a && b && a.pool !== null && a.pool === b.pool) clashes++;
  }
  return clashes;
}

/**
 * Qualified teams in seed order: every 1st (pool order), every 2nd…, then the
 * best others. Each tier is rotated to keep teams of a pool apart in round 1.
 */
function qualifierEntrants(poolCount: number, qualifiersPerPool: number, bestOthers: number): Entrant[] {
  const total = poolCount * qualifiersPerPool + bestOthers;
  const positions = seedPositions(nextPowerOf2(total));
  const entrants: Entrant[] = [];
  for (let rank = 1; rank <= qualifiersPerPool; rank++) {
    let best: Entrant[] = [];
    let bestClashes = Infinity;
    for (let shift = 0; shift < poolCount; shift++) {
      const tier = Array.from({ length: poolCount }, (_, i): Entrant => {
        const pool = (i + shift) % poolCount;
        return { ref: { type: 'poolRank', pool, rank }, pool, teamId: null };
      });
      const clashes = firstRoundClashes([...entrants, ...tier], positions);
      if (clashes < bestClashes) {
        best = tier;
        bestClashes = clashes;
      }
      if (rank === 1) break;
    }
    entrants.push(...best);
  }
  for (let index = 1; index <= bestOthers; index++) {
    entrants.push({ ref: { type: 'bestOf', rank: qualifiersPerPool + 1, index }, pool: null, teamId: null });
  }
  return entrants;
}

/** Pools, matches and bracket of a tournament. Deterministic for a seed. */
export function generateTournament(input: GenerateInput): Generated {
  const rng = createRng(input.seed);
  const prefix = input.keyPrefix ?? '';
  const { rules } = input;

  if (input.format === 'round_robin') {
    const ids = drawOrder(input.teams, input.seeding, rng).map((t) => t.id);
    const counters = new Map<number, number>();
    const matches = roundRobin(ids, rules.roundRobinLegs).map((p) => {
      const n = (counters.get(p.round) ?? 0) + 1;
      counters.set(p.round, n);
      return newMatch(`${prefix}L${p.round}-${n}`, { stage: 'league', pool: null, round: p.round }, p.home, p.away);
    });
    return { pools: [], matches };
  }

  if (input.format === 'knockout') {
    const entrants = drawOrder(input.teams, input.seeding, rng).map((t): Entrant => ({
      ref: { type: 'team', id: t.id }, pool: null, teamId: t.id,
    }));
    return { pools: [], matches: buildBracket(entrants, { thirdPlace: rules.knockout.thirdPlace, keyPrefix: prefix }) };
  }

  const poolRules = rules.pools!;
  const pools = drawPools(input.teams, poolRules.count, input.seeding, rng);
  const poolMatches = pools.flatMap((ids, pool) => {
    const counters = new Map<number, number>();
    return roundRobin(ids, rules.roundRobinLegs).map((p) => {
      const n = (counters.get(p.round) ?? 0) + 1;
      counters.set(p.round, n);
      return newMatch(`${prefix}P${pool + 1}-${p.round}-${n}`, { stage: 'pool', pool, round: p.round }, p.home, p.away);
    });
  });
  const entrants = qualifierEntrants(pools.length, poolRules.qualifiersPerPool, poolRules.bestOthers);
  const bracket = buildBracket(entrants, { thirdPlace: rules.knockout.thirdPlace, keyPrefix: prefix });
  return { pools, matches: [...poolMatches, ...bracket] };
}
