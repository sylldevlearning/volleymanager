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

// FIVB rotation: clockwise P1→P6→P5→P4→P3→P2→P1
// P1 is always the server
export const ROTATION_ORDER: [1, 2, 3, 4, 5, 6] = [1, 2, 3, 4, 5, 6];

export function nextRotation(positions: number[]): number[] {
  // Rotate clockwise: each player moves to next position
  // P1→P2, P2→P3, P3→P4, P4→P5, P5→P6, P6→P1
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
