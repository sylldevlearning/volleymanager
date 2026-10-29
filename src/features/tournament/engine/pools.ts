import type { SeedingMode } from '../../../models/tournament';
import { shuffle } from './rng';
import type { EngineTeam } from './types';

/** Seeded teams by seed, then the others in a seeded random order. */
export function drawOrder(teams: readonly EngineTeam[], seeding: SeedingMode, rng: () => number): EngineTeam[] {
  if (seeding === 'random') return shuffle(teams, rng);
  const seeded = teams.filter((t) => t.seedRank !== null).sort((a, b) => a.seedRank! - b.seedRank!);
  const others = shuffle(teams.filter((t) => t.seedRank === null), rng);
  return [...seeded, ...others];
}

/** Serpentine dealing (A B C C B A…): balanced sizes, top seeds spread. */
export function drawPools(teams: readonly EngineTeam[], count: number, seeding: SeedingMode, rng: () => number): string[][] {
  const pools: string[][] = Array.from({ length: count }, () => []);
  drawOrder(teams, seeding, rng).forEach((team, i) => {
    const lap = Math.floor(i / count);
    const offset = i % count;
    pools[lap % 2 === 0 ? offset : count - 1 - offset].push(team.id);
  });
  return pools;
}

export function poolName(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : `P${index + 1}`;
}
