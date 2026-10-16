import { getDb, generateId } from './database';
import type { Lineup } from '../models/event';

export interface LineupEntry {
  playerId: string;
  position: Lineup['position'];
  isStarter: boolean;
  isLibero: boolean;
}

function rowToLineup(row: Record<string, unknown>): Lineup {
  return {
    id: row.id as string,
    matchId: row.match_id as string,
    setId: row.set_id as string,
    teamId: row.team_id as string,
    playerId: row.player_id as string,
    position: row.position as Lineup['position'],
    isStarter: Boolean(row.is_starter),
    isLibero: Boolean(row.is_libero),
  };
}

/**
 * Persists the starting lineup (positions I-VI + libero flags) for one team,
 * for one specific set. Delete-then-insert — called before every set, not
 * just the first.
 */
export async function saveLineup(
  matchId: string,
  setId: string,
  teamId: string,
  entries: LineupEntry[],
): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM lineups WHERE match_id = ? AND set_id = ? AND team_id = ?',
      [matchId, setId, teamId],
    );
    for (const entry of entries) {
      await db.runAsync(
        `INSERT INTO lineups (id, match_id, set_id, team_id, player_id, position, is_starter, is_libero)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [generateId(), matchId, setId, teamId, entry.playerId, entry.position, entry.isStarter ? 1 : 0, entry.isLibero ? 1 : 0],
      );
    }
  });
}

export async function getLineupForSet(matchId: string, setId: string, teamId: string): Promise<Lineup[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM lineups WHERE match_id = ? AND set_id = ? AND team_id = ? ORDER BY position ASC',
    [matchId, setId, teamId],
  );
  return rows.map(rowToLineup);
}
