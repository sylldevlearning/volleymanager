import { getDb, generateId } from './database';
import type { MatchEvent, MatchEventInput } from '../models/event';

function rowToEvent(row: Record<string, unknown>): MatchEvent {
  return {
    id: row.id as string,
    matchId: row.match_id as string,
    setId: row.set_id as string,
    eventType: row.event_type as MatchEvent['eventType'],
    playerId: row.player_id as string | null,
    teamId: row.team_id as string | null,
    timestamp: row.timestamp as string,
    details: JSON.parse((row.details_json as string) || '{}'),
    isCancelled: Boolean(row.is_cancelled),
  };
}

export async function addEvent(input: MatchEventInput): Promise<MatchEvent> {
  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO match_events
     (id, match_id, set_id, event_type, player_id, team_id, timestamp, details_json, is_cancelled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      input.matchId,
      input.setId,
      input.eventType,
      input.playerId,
      input.teamId,
      now,
      JSON.stringify(input.details),
    ]
  );
  return {
    id,
    matchId: input.matchId,
    setId: input.setId,
    eventType: input.eventType,
    playerId: input.playerId,
    teamId: input.teamId,
    timestamp: now,
    details: input.details,
    isCancelled: false,
  };
}

export async function undoLastEvent(matchId: string, setId: string): Promise<string | null> {
  const db = await getDb();
  const last = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM match_events
     WHERE match_id = ? AND set_id = ? AND is_cancelled = 0
       AND event_type NOT IN ('undo')
     ORDER BY timestamp DESC
     LIMIT 1`,
    [matchId, setId]
  );
  if (!last) return null;

  const cancelledId = last.id as string;
  await db.withExclusiveTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE match_events SET is_cancelled = 1 WHERE id = ?',
      [cancelledId]
    );
    await addEvent({
      matchId,
      setId,
      eventType: 'undo',
      playerId: null,
      teamId: null,
      details: { cancelledEventId: cancelledId },
    });
  });
  return cancelledId;
}

export async function removeLastPoint(
  matchId: string,
  setId: string,
  team: 'home' | 'away',
): Promise<string | null> {
  const db = await getDb();
  const eventType = team === 'home' ? 'point_home' : 'point_away';
  const correctionType = team === 'home' ? 'point_correction_home' : 'point_correction_away';
  const last = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM match_events
     WHERE match_id = ? AND set_id = ? AND event_type = ? AND is_cancelled = 0
     ORDER BY timestamp DESC
     LIMIT 1`,
    [matchId, setId, eventType]
  );
  if (!last) return null;

  const cancelledId = last.id as string;
  await db.withExclusiveTransactionAsync(async () => {
    await db.runAsync('UPDATE match_events SET is_cancelled = 1 WHERE id = ?', [cancelledId]);
    await addEvent({ matchId, setId, eventType: correctionType, playerId: null, teamId: null, details: { cancelledEventId: cancelledId } });
  });
  return cancelledId;
}

export async function getEventsForSet(matchId: string, setId: string): Promise<MatchEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM match_events
     WHERE match_id = ? AND set_id = ? AND is_cancelled = 0
     ORDER BY timestamp ASC`,
    [matchId, setId]
  );
  return rows.map(rowToEvent);
}

export async function getEventsForMatch(matchId: string): Promise<MatchEvent[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM match_events
     WHERE match_id = ? AND is_cancelled = 0
     ORDER BY timestamp ASC`,
    [matchId]
  );
  return rows.map(rowToEvent);
}

export async function getMatchIdsForPlayer(playerId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ match_id: string }>(
    'SELECT DISTINCT match_id FROM match_events WHERE player_id = ? AND is_cancelled = 0',
    [playerId]
  );
  return rows.map((r) => r.match_id);
}

// Recalculate score from non-cancelled events (source of truth)
export function computeScore(events: MatchEvent[]): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const e of events) {
    if (e.isCancelled) continue;
    if (e.eventType === 'point_home') home++;
    if (e.eventType === 'point_away') away++;
  }
  return { home, away };
}

// Count timeouts used for a team across provided events
export function computeTimeoutsUsed(events: MatchEvent[], teamId: string): number {
  return events.filter(
    (e) =>
      !e.isCancelled &&
      e.teamId === teamId &&
      (e.eventType === 'timeout_home' || e.eventType === 'timeout_away'),
  ).length;
}
