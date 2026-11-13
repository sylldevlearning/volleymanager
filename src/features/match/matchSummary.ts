import type { Match, MatchSet } from '../../models/match';

export interface SummarySet {
  id: string;
  setNumber: number;
  scoreHome: number;
  scoreAway: number;
  winnerTeamId: string | null;
  /** The set being played when the match was stopped */
  stopped: boolean;
}

export interface MatchSummary {
  /** Finished without a winner: ended by the referee before the end */
  stopped: boolean;
  winnerTeamId: string | null;
  setsHome: number;
  setsAway: number;
  sets: SummarySet[];
}

/**
 * What the summary shows. A set without a winner takes its score from the
 * events (`liveScores`, by set id), so a match stopped mid-set shows the points
 * of that set — also for matches stopped by older versions, which kept 0-0.
 */
export function summarizeMatch(
  match: Match,
  sets: MatchSet[],
  liveScores: Record<string, { home: number; away: number }>,
): MatchSummary {
  const stopped = match.status === 'finished' && !match.winnerTeamId;
  const rows: SummarySet[] = [];
  for (const s of [...sets].sort((a, b) => a.setNumber - b.setNumber)) {
    if (s.winnerTeamId) {
      rows.push({ id: s.id, setNumber: s.setNumber, scoreHome: s.scoreHome, scoreAway: s.scoreAway, winnerTeamId: s.winnerTeamId, stopped: false });
      continue;
    }
    const live = liveScores[s.id] ?? { home: s.scoreHome, away: s.scoreAway };
    // A set opened right before stopping, without a single point, says nothing
    if (stopped && live.home === 0 && live.away === 0) continue;
    rows.push({ id: s.id, setNumber: s.setNumber, scoreHome: live.home, scoreAway: live.away, winnerTeamId: null, stopped });
  }
  return {
    stopped,
    winnerTeamId: stopped ? null : match.winnerTeamId,
    setsHome: sets.filter((s) => s.winnerTeamId === match.teamHomeId).length,
    setsAway: sets.filter((s) => s.winnerTeamId === match.teamAwayId).length,
    sets: rows,
  };
}
