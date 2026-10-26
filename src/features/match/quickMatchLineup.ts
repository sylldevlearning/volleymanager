import { getSetsForMatch } from '../../services/matchService';
import { getLineupForSet, saveLineup } from '../../services/lineupService';
import { reconstructLiveState, type ReconstructedLiveMatch } from '../../services/matchStateReconstruction';
import type { Match } from '../../models/match';
import type { LiberoState } from '../../models/substitution';
import type { CourtMap } from '../../stores/scoringStore';
import { toLineupEntries } from '../lineup/lineupState';

/** Saves both teams' starting lineup of a set — what the replay starts from on resume. */
export async function saveStartingLineups(
  match: Pick<Match, 'id' | 'teamHomeId' | 'teamAwayId'>,
  setId: string,
  homeCourt: CourtMap,
  awayCourt: CourtMap,
): Promise<void> {
  await saveLineup(match.id, setId, match.teamHomeId, toLineupEntries(homeCourt));
  await saveLineup(match.id, setId, match.teamAwayId, toLineupEntries(awayCourt));
}

/** The players on court at the end of a set start the next one; the libero gives the slot back. */
export function startingCourtForNextSet(court: CourtMap, libero: LiberoState | null): CourtMap {
  if (!libero?.isOnCourt || libero.replacedPosition == null || !libero.replacedPlayerId) return court;
  return { ...court, [libero.replacedPosition]: libero.replacedPlayerId };
}

/**
 * Resumes a quick match exactly where it was left: score, rotation, court,
 * substitutions, libero — replayed from the DB like the arbitrage screen.
 * Matches started before starting lineups were saved fall back to `fallback`
 * (the default lineup), which is then saved so every resume replays the same.
 */
export async function resumeQuickMatch(
  matchId: string,
  fallback: { home: CourtMap; away: CourtMap },
): Promise<ReconstructedLiveMatch | null> {
  const sets = await getSetsForMatch(matchId);
  const currentSet = sets.find((s) => !s.finishedAt) ?? sets[sets.length - 1];
  if (!currentSet) return null;

  const reconstructed = await reconstructLiveState(matchId);
  if (!reconstructed) return null;
  const { match } = reconstructed;
  const [homeRows, awayRows] = await Promise.all([
    getLineupForSet(matchId, currentSet.id, match.teamHomeId),
    getLineupForSet(matchId, currentSet.id, match.teamAwayId),
  ]);
  if (homeRows.length > 0 && awayRows.length > 0) return reconstructed;

  if (homeRows.length === 0) await saveLineup(matchId, currentSet.id, match.teamHomeId, toLineupEntries(fallback.home));
  if (awayRows.length === 0) await saveLineup(matchId, currentSet.id, match.teamAwayId, toLineupEntries(fallback.away));
  return reconstructLiveState(matchId);
}
