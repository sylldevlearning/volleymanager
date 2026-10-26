import { saveLineup } from '../../services/lineupService';
import { useScoringStore, type CourtMap } from '../../stores/scoringStore';
import { buildLineupState, toLineupEntries } from '../lineup/lineupState';
import type { SubstitutionContext } from './recordSubstitution';

/**
 * Sets a team's starting lineup for the current set (before its first rally):
 * saved for the set, then put on the court — no substitution is recorded.
 */
export async function applyBoardLineup(ctx: SubstitutionContext, court: CourtMap): Promise<void> {
  await saveLineup(ctx.matchId, ctx.setId, ctx.teamId, toLineupEntries(court));
  const { bench, liberoState } = buildLineupState(ctx.roster, court);
  useScoringStore.getState().initLineup(ctx.side, court, bench, liberoState);
}
