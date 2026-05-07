import type { MatchConfig, MatchFormat } from '../models/match';

export function isSetWon(score: number, opponentScore: number, config: MatchConfig, isLastSet: boolean): boolean {
  const required = isLastSet ? config.pointsLastSet : config.pointsPerSet;
  return score >= required && score - opponentScore >= 2;
}

export function isMatchWon(setsWon: number, config: MatchConfig): boolean {
  return setsWon >= config.setsToWin;
}

export function getTotalSets(config: MatchConfig): number {
  return config.setsToWin * 2 - 1;
}

export function isLastSet(setNumber: number, config: MatchConfig): boolean {
  return setNumber === getTotalSets(config);
}

export function shouldChangeEndsBeach(
  scoreHome: number,
  scoreAway: number,
  setNumber: number,
  config: MatchConfig,
): boolean {
  const totalPoints = scoreHome + scoreAway;
  const interval = isLastSet(setNumber, config) ? 5 : 7;
  return totalPoints > 0 && totalPoints % interval === 0;
}

// Serving order after each rotation: P1 → P6 → P5 → P4 → P3 → P2 → P1
// When a team wins the right to serve they rotate clockwise on court:
// the player at P6 moves to P1 (becomes server), P5→P6, P4→P5, ..., P1→P2.
// In the position array each value increases by 1 (with 6 wrapping to 1).
export const ROTATION_ORDER: [1, 2, 3, 4, 5, 6] = [1, 2, 3, 4, 5, 6];

export function nextRotation(positions: number[]): number[] {
  return positions.map((pos) => (pos === 6 ? 1 : pos + 1));
}

export function canLiberoServe(format: MatchFormat, allowLiberoServe: boolean): boolean {
  if (format === 'beach_2v2') return false;
  return allowLiberoServe;
}

export function isLiberoZone(position: number): boolean {
  // Back row: positions 1, 6, 5
  return position === 1 || position === 6 || position === 5;
}

export function getMaxSubstitutions(config: MatchConfig): number {
  if (config.unlimitedSubstitutions) return Infinity;
  return config.substitutionsPerSet ?? 0;
}

export function getMaxTimeouts(config: MatchConfig): number {
  if (config.unlimitedTimeouts) return Infinity;
  return config.timeoutsPerSet ?? 0;
}

export function canRequestTimeout(
  timeoutsUsed: number,
  config: MatchConfig,
): boolean {
  if (config.unlimitedTimeouts) return true;
  return timeoutsUsed < (config.timeoutsPerSet ?? 0);
}

export function canRequestSubstitution(
  substitutionsUsed: number,
  config: MatchConfig,
): boolean {
  if (config.unlimitedSubstitutions) return true;
  return substitutionsUsed < (config.substitutionsPerSet ?? 0);
}
