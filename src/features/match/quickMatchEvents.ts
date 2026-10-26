import { addEvent, undoLastEvent } from '../../services/eventService';
import { useScoringStore } from '../../stores/scoringStore';
import type { Player } from '../../models/player';

export interface QuickMatchSetContext {
  matchId: string;
  setId: string;
  homeTeamId: string;
  awayTeamId: string;
}

/** Saves a timeout like the arbitrage screen (replayed on resume, undoable), then counts it. */
export async function recordTimeout(ctx: QuickMatchSetContext, side: 'home' | 'away'): Promise<void> {
  const event = await addEvent({
    matchId: ctx.matchId,
    setId: ctx.setId,
    eventType: side === 'home' ? 'timeout_home' : 'timeout_away',
    playerId: null,
    teamId: side === 'home' ? ctx.homeTeamId : ctx.awayTeamId,
    details: {},
  });
  const store = useScoringStore.getState();
  store.recordEvent(event);
  store.requestTimeout(side);
}

/**
 * "Annuler" on the quick match screen: cancels the last event of the set and
 * reverts what it did — point, substitution (court, bench, quota) or timeout.
 * Returns false when there was nothing to undo.
 */
export async function undoQuickMatchEvent(
  ctx: QuickMatchSetContext,
  rosters: { home: Player[]; away: Player[] },
): Promise<boolean> {
  const result = await undoLastEvent(ctx.matchId, ctx.setId);
  if (!result) return false;
  const store = useScoringStore.getState();
  const sub = result.substitution;
  if (sub) store.revertSubstitution(sub.side, sub, rosters[sub.side].find((p) => p.id === sub.playerInId));
  if (result.timeout) store.cancelTimeout(result.timeout);
  store.undoPoint(result.cancelledEventId);
  if (result.linkedCancelledEventId) store.undoPoint(result.linkedCancelledEventId);
  return true;
}
