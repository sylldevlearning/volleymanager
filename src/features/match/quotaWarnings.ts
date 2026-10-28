import type { MatchConfig } from '../../models/match';

export type TimeoutWarningKey = 'arbitrage.warn.lastTimeout' | 'arbitrage.warn.noTimeout';
export type SubstitutionWarningKey = 'arbitrage.warn.lastSub' | 'arbitrage.warn.subQuota';

/** Banner text after a team's timeout (`used` includes it): one left, or none left this set. */
export function timeoutWarning(used: number, config: MatchConfig): TimeoutWarningKey | null {
  if (config.unlimitedTimeouts || config.timeoutsPerSet == null) return null;
  const left = config.timeoutsPerSet - used;
  if (left === 1) return 'arbitrage.warn.lastTimeout';
  if (left <= 0) return 'arbitrage.warn.noTimeout';
  return null;
}

/** Banner text after a regular substitution (`used` includes it): one left, or quota reached. */
export function substitutionWarning(used: number, config: MatchConfig): SubstitutionWarningKey | null {
  if (config.unlimitedSubstitutions) return null;
  const left = (config.substitutionsPerSet ?? 6) - used;
  if (left === 1) return 'arbitrage.warn.lastSub';
  if (left <= 0) return 'arbitrage.warn.subQuota';
  return null;
}
