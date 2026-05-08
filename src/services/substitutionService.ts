import { getDb, generateId } from './database';
import { addEvent } from './eventService';
import type { SubstitutionPair } from '../models/substitution';

// ─── DB helpers ───────────────────────────────────────────────────────────

export async function getPairsForSet(
  matchId: string,
  setId: string,
  teamId: string,
): Promise<SubstitutionPair[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    match_id: string;
    set_id: string;
    team_id: string;
    player_out_id: string;
    player_in_id: string;
    is_libero: number;
    is_cancelled: number;
  }>(
    `SELECT * FROM substitution_pairs WHERE match_id = ? AND set_id = ? AND team_id = ?`,
    [matchId, setId, teamId],
  );

  return rows.map((r) => ({
    id: r.id,
    matchId: r.match_id,
    setId: r.set_id,
    teamId: r.team_id,
    playerOutId: r.player_out_id,
    playerInId: r.player_in_id,
    isLibero: r.is_libero === 1,
    isCancelled: r.is_cancelled === 1,
  }));
}

async function insertPair(pair: Omit<SubstitutionPair, 'id' | 'isCancelled'>): Promise<SubstitutionPair> {
  const db = await getDb();
  const id = generateId();
  await db.runAsync(
    `INSERT INTO substitution_pairs
       (id, match_id, set_id, team_id, player_out_id, player_in_id, is_libero, is_cancelled)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, pair.matchId, pair.setId, pair.teamId, pair.playerOutId, pair.playerInId, pair.isLibero ? 1 : 0],
  );
  return { ...pair, id, isCancelled: false };
}

export async function cancelPair(pairId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE substitution_pairs SET is_cancelled = 1 WHERE id = ?`, [pairId]);
}

// ─── Perform substitution ─────────────────────────────────────────────────

export interface PerformSubResult {
  pair: SubstitutionPair;
  eventId: string;
}

/**
 * Record a substitution: insert pair + add event to match_events.
 * Does NOT validate rules — caller must call validateSubstitution first.
 */
export async function performSubstitution(opts: {
  matchId: string;
  setId: string;
  teamId: string;
  teamSide: 'home' | 'away';
  playerOutId: string;
  playerInId: string;
  position: number;
  isLibero: boolean;
}): Promise<PerformSubResult> {
  const { matchId, setId, teamId, teamSide, playerOutId, playerInId, position, isLibero } = opts;

  const pair = await insertPair({ matchId, setId, teamId, playerOutId, playerInId, isLibero });

  const eventType = teamSide === 'home' ? 'substitution_home' : 'substitution_away';
  const event = await addEvent({
    matchId,
    setId,
    eventType,
    playerId: playerInId,
    teamId,
    details: { playerOutId, position, pairId: pair.id, isLibero },
  });

  return { pair, eventId: event.id };
}

/**
 * Undo a substitution: cancel the pair + cancel the event.
 * The scoring store is responsible for updating onCourt/bench.
 */
export async function undoSubstitution(pairId: string): Promise<void> {
  await cancelPair(pairId);
}
