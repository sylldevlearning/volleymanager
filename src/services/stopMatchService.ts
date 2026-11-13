import { getSetsForMatch, updateMatchStatus, updateSet } from './matchService';
import { computeScore, getEventsForSet } from './eventService';

/**
 * "End match" before the end: the set being played keeps its score (from the
 * events) without a winner, and the match is finished without a winner.
 */
export async function stopMatch(matchId: string): Promise<void> {
  const sets = await getSetsForMatch(matchId);
  for (const set of sets) {
    if (set.winnerTeamId) continue;
    const { home, away } = computeScore(await getEventsForSet(matchId, set.id));
    await updateSet(set.id, home, away);
  }
  await updateMatchStatus(matchId, 'finished');
}
