import { getDb, generateId } from './database';
import type { Player, PlayerInput } from '../models/player';

function rowToPlayer(row: Record<string, unknown>): Player {
  return {
    id: row.id as string,
    teamId: row.team_id as string,
    firstName: (row.first_name as string | null) ?? null,
    lastName: (row.last_name as string | null) ?? null,
    number: row.number as number,
    position: row.position as Player['position'],
    photoUri: row.photo_uri as string | null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
  };
}

export async function getPlayersByTeam(teamId: string): Promise<Player[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM players WHERE team_id = ? AND is_active = 1 ORDER BY number ASC',
    [teamId]
  );
  return rows.map(rowToPlayer);
}

export async function getPlayerById(id: string): Promise<Player | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM players WHERE id = ?',
    [id]
  );
  return row ? rowToPlayer(row) : null;
}

export async function createPlayer(input: PlayerInput): Promise<Player> {
  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  try {
    await db.runAsync(
      `INSERT INTO players (id, team_id, first_name, last_name, number, position, photo_uri, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [id, input.teamId, input.firstName ?? null, input.lastName ?? null, input.number, input.position, input.photoUri, now]
    );
  } catch (e) {
    const msg = String(e);
    if (msg.includes('UNIQUE') && (msg.includes('team_id') || msg.includes('number'))) {
      throw new Error('DUPLICATE_NUMBER');
    }
    throw e;
  }
  return { id, ...input, isActive: true, createdAt: now };
}

export async function updatePlayer(id: string, input: Partial<PlayerInput>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.firstName !== undefined) { fields.push('first_name = ?'); values.push(input.firstName); }
  if (input.lastName !== undefined) { fields.push('last_name = ?'); values.push(input.lastName); }
  if (input.number !== undefined) { fields.push('number = ?'); values.push(input.number); }
  if (input.position !== undefined) { fields.push('position = ?'); values.push(input.position); }
  if (input.photoUri !== undefined) { fields.push('photo_uri = ?'); values.push(input.photoUri); }

  if (fields.length === 0) return;
  values.push(id);

  await db.runAsync(
    `UPDATE players SET ${fields.join(', ')} WHERE id = ?`,
    values as import('expo-sqlite').SQLiteBindParams
  );
}

export async function deletePlayer(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE players SET is_active = 0 WHERE id = ?', [id]);
}
