import { getDb } from './database';
import { addEvent, getEventsForMatch } from './eventService';
import type { MatchEvent } from '../models/event';
import type { SanctionType } from '../utils/sanctionRules';

export interface AddSanctionResult {
  sanctionEvent: MatchEvent;
  pointEvent: MatchEvent | null;
}

export async function addSanction(opts: {
  matchId: string;
  setId: string;
  teamId: string;
  teamSide: 'home' | 'away';
  opponentTeamId: string;
  sanctionType: SanctionType;
  playerId: string | null;
  awardsPoint: boolean;
}): Promise<AddSanctionResult> {
  const { matchId, setId, teamId, teamSide, opponentTeamId, sanctionType, playerId, awardsPoint } = opts;
  const db = await getDb();

  let pointEvent: MatchEvent | null = null;
  let sanctionEvent!: MatchEvent;

  await db.withExclusiveTransactionAsync(async () => {
    if (awardsPoint) {
      // The sanctioned team's opponent scores the point.
      const pointEventType = teamSide === 'home' ? 'point_away' : 'point_home';
      pointEvent = await addEvent({
        matchId,
        setId,
        eventType: pointEventType,
        playerId: null,
        teamId: opponentTeamId,
        details: {},
      });
    }

    const sanctionEventType = teamSide === 'home' ? 'sanction_home' : 'sanction_away';
    sanctionEvent = await addEvent({
      matchId,
      setId,
      eventType: sanctionEventType,
      playerId,
      teamId,
      details: { sanctionType, awardsPoint, pointEventId: pointEvent?.id ?? null },
    });
  });

  return { sanctionEvent, pointEvent };
}

export async function getSanctionsForMatch(matchId: string): Promise<MatchEvent[]> {
  const events = await getEventsForMatch(matchId);
  return events.filter((e) => e.eventType === 'sanction_home' || e.eventType === 'sanction_away');
}
