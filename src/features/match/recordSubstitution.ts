import { performSubstitution } from '../../services/substitutionService';
import { useScoringStore } from '../../stores/scoringStore';
import type { Player } from '../../models/player';

export interface SubstitutionContext {
  matchId: string;
  setId: string;
  teamId: string;
  side: 'home' | 'away';
  /** The team's full roster — the player leaving goes back to the bench */
  roster: Player[];
}

export interface SubstitutionRequest {
  playerOutId: string;
  playerInId: string;
  position: number;
  isLibero: boolean;
  isExceptional?: boolean;
}

/**
 * Records a substitution exactly like the substitution sheet: persisted pair +
 * event (cancellable with "Annuler"), then mirrored into the live store.
 * A libero leaving for the player they replaced is a libero exit.
 * Does NOT validate rules — callers validate with rulesValidator first.
 */
export async function recordSubstitution(ctx: SubstitutionContext, sub: SubstitutionRequest): Promise<void> {
  const { pair, event } = await performSubstitution({
    matchId: ctx.matchId,
    setId: ctx.setId,
    teamId: ctx.teamId,
    teamSide: ctx.side,
    playerOutId: sub.playerOutId,
    playerInId: sub.playerInId,
    position: sub.position,
    isLibero: sub.isLibero,
    isExceptional: sub.isExceptional ?? false,
  });

  const store = useScoringStore.getState();
  const libero = ctx.side === 'home' ? store.liberoHome : store.liberoAway;
  const isLiberoExit = sub.isLibero && libero?.isOnCourt === true && sub.playerOutId === libero.liberoId;
  if (isLiberoExit) {
    store.applyLiberoExit(ctx.side);
    const liberoPlayer = ctx.roster.find((p) => p.id === sub.playerOutId);
    if (liberoPlayer) store.restoreLiberoToBench(ctx.side, liberoPlayer);
  } else {
    store.applySubstitution(ctx.side, sub.playerOutId, sub.playerInId, sub.position, sub.isLibero, pair, {
      playerOut: ctx.roster.find((p) => p.id === sub.playerOutId),
      isExceptional: sub.isExceptional,
    });
  }
  store.recordEvent(event);
}
