import { getDb, generateId } from './database';
import type { Team, TeamInput } from '../models/team';

function rowToTeam(row: Record<string, unknown>): Team {
  return {
    id: row.id as string,
    name: row.name as string,
    shortName: row.short_name as string | null,
    logoUri: row.logo_uri as string | null,
    color: row.color as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getAllTeams(): Promise<Team[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM teams ORDER BY name ASC'
  );
  return rows.map(rowToTeam);
}

export async function getTeamById(id: string): Promise<Team | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM teams WHERE id = ?',
    [id]
  );
  return row ? rowToTeam(row) : null;
}

export async function createTeam(input: TeamInput): Promise<Team> {
  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO teams (id, name, short_name, logo_uri, color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.shortName, input.logoUri, input.color, now, now]
  );
  return { id, ...input, createdAt: now, updatedAt: now };
}

export async function updateTeam(id: string, input: Partial<TeamInput>): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.shortName !== undefined) { fields.push('short_name = ?'); values.push(input.shortName); }
  if (input.logoUri !== undefined) { fields.push('logo_uri = ?'); values.push(input.logoUri); }
  if (input.color !== undefined) { fields.push('color = ?'); values.push(input.color); }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.runAsync(
    `UPDATE teams SET ${fields.join(', ')} WHERE id = ?`,
    values as import('expo-sqlite').SQLiteBindParams
  );
}

export async function deleteTeam(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM teams WHERE id = ?', [id]);
}
