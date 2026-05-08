import type { MatchConfig, MatchFormat } from '../models/match';
import type { SubstitutionPair, SubstitutionOutcome } from '../models/substitution';

export const BACK_ROW_POSITIONS = [1, 5, 6] as const;

export function isBackRow(position: number): boolean {
  return BACK_ROW_POSITIONS.includes(position as (typeof BACK_ROW_POSITIONS)[number]);
}

/** How many non-libero subs have been used (non-cancelled pairs). */
export function countNormalSubs(pairs: SubstitutionPair[]): number {
  return pairs.filter((p) => !p.isCancelled && !p.isLibero).length;
}

/**
 * Validate a regular (non-libero) substitution.
 *
 * @param playerOutId  The starter going to the bench.
 * @param playerInId   The reserve coming on court.
 * @param pairs        All non-cancelled pairs for this set + team.
 * @param subsUsed     Current count of normal subs used.
 * @param config       Match config.
 * @param format       Match format.
 * @param mode         'competition' | 'leisure'
 */
export function validateSubstitution(
  playerOutId: string,
  playerInId: string,
  pairs: SubstitutionPair[],
  subsUsed: number,
  config: MatchConfig,
  format: MatchFormat,
  mode: 'competition' | 'leisure',
): SubstitutionOutcome {
  // Beach: no subs
  if (format === 'beach_2v2') {
    return { ok: false, error: 'beach_no_sub' };
  }

  // Leisure: unlimited, no reciprocity
  if (mode === 'leisure') {
    return { ok: true, isLibero: false };
  }

  // Max subs check
  if (!config.unlimitedSubstitutions) {
    const max = config.substitutionsPerSet ?? 6;
    if (subsUsed >= max) {
      return { ok: false, error: 'max_reached' };
    }
  }

  // Reciprocity check for playerInId (the reserve who was already on court before)
  // Rule: if playerInId previously went OUT, only the player who replaced them can go back in.
  const priorPairForIn = pairs.find((p) => !p.isCancelled && p.playerOutId === playerInId);
  if (priorPairForIn) {
    // playerInId was a starter who went out earlier. To re-enter, only priorPairForIn.playerInId
    // can be the one leaving (i.e. playerOutId must equal priorPairForIn.playerInId).
    if (playerOutId !== priorPairForIn.playerInId) {
      return {
        ok: false,
        error: 'reciprocity_violation',
        errorData: { playerName: playerInId, pairPlayerId: priorPairForIn.playerInId },
      };
    }
  }

  // Reciprocity check for playerOutId (the one going to the bench)
  // Rule: if playerOutId was a reserve who entered court before, they can only be replaced
  // by the original starter they replaced.
  const priorPairForOut = pairs.find((p) => !p.isCancelled && p.playerInId === playerOutId);
  if (priorPairForOut) {
    if (playerInId !== priorPairForOut.playerOutId) {
      return {
        ok: false,
        error: 'reciprocity_violation',
        errorData: { playerName: playerOutId, pairPlayerId: priorPairForOut.playerOutId },
      };
    }
  }

  // A reserve player can only play once per set (can't sub in twice)
  const alreadyPlayed = pairs.find((p) => !p.isCancelled && p.playerInId === playerInId);
  if (alreadyPlayed) {
    return { ok: false, error: 'not_eligible' };
  }

  return { ok: true, isLibero: false };
}

/**
 * Validate a libero substitution (does NOT consume a sub slot).
 *
 * @param position  The position on court where the libero would enter.
 * @param format    Match format.
 */
export function validateLiberoSubstitution(
  position: number,
  format: MatchFormat,
): SubstitutionOutcome {
  if (format === 'beach_2v2') {
    return { ok: false, error: 'beach_no_sub' };
  }
  if (!isBackRow(position)) {
    return { ok: false, error: 'libero_front_row' };
  }
  return { ok: true, isLibero: true };
}

/**
 * Check if the libero must exit because their occupied position has
 * rotated into the front row.
 */
export function liberoMustExit(liberoPosition: number): boolean {
  return !isBackRow(liberoPosition);
}

/**
 * Determine pairs that are still active (reserve on court, starter on bench)
 * for a given set. Used to reconstruct eligibility after undo.
 */
export function getActivePairs(pairs: SubstitutionPair[]): SubstitutionPair[] {
  return pairs.filter((p) => !p.isCancelled);
}

// Re-export for convenience in SubstitutionPair type narrowing
export type { SubstitutionPair };
