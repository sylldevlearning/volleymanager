import type { MatchEvent } from '../models/event';

export type SanctionType = 'warning' | 'penalty' | 'expulsion' | 'disqualification' | 'delay';

function isActiveSanction(event: MatchEvent, playerId: string, type: SanctionType): boolean {
  if (event.isCancelled) return false;
  if (event.eventType !== 'sanction_home' && event.eventType !== 'sanction_away') return false;
  if (event.playerId !== playerId) return false;
  return event.details.sanctionType === type;
}

/**
 * FIVB rule: the first delay-of-game sanction in a match is a warning (no point).
 * Every subsequent delay sanction (for either team) is a penalty (point + opponent serve).
 */
export function getDelaySanctionOutcome(priorDelayCountForMatch: number): { awardsPoint: boolean } {
  return { awardsPoint: priorDelayCountForMatch >= 1 };
}

export function isPlayerExpelled(playerId: string, sanctionEventsForSet: MatchEvent[]): boolean {
  return sanctionEventsForSet.some((e) => isActiveSanction(e, playerId, 'expulsion'));
}

export function isPlayerDisqualified(playerId: string, sanctionEventsForMatch: MatchEvent[]): boolean {
  return sanctionEventsForMatch.some((e) => isActiveSanction(e, playerId, 'disqualification'));
}
