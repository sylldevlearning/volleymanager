import { getDb, generateId } from './database';
import type { Team, TeamInput } from '../models/team';

function rowToTeam(row: Record<string, unknown>): Team {
  return {
    id: row.id as string,
    name: row.name as string,
    shortName: row.short_name as string | null,
    logoUri: row.logo_uri as string | null,
    color: row.color as string,
    coachName: (row.coach_name as string | null) ?? null,
    isAdHoc: row.is_ad_hoc === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** Registered teams only — ad-hoc teams created for a single arbitrage match never appear here. */
export async function getAllTeams(): Promise<Team[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM teams WHERE is_ad_hoc = 0 ORDER BY name ASC'
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

export async function getTeamByName(name: string): Promise<Team | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM teams WHERE name = ?',
    [name]
  );
  return row ? rowToTeam(row) : null;
}

export async function createTeam(input: TeamInput): Promise<Team> {
  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  const coachName = input.coachName ?? null;
  try {
    await db.runAsync(
      `INSERT INTO teams (id, name, short_name, logo_uri, color, coach_name, is_ad_hoc, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [id, input.name, input.shortName, input.logoUri, input.color, coachName, now, now]
    );
    return { id, ...input, coachName, isAdHoc: false, createdAt: now, updatedAt: now };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('UNIQUE constraint failed')) {
      const existing = await getTeamByName(input.name);
      if (existing) return existing;
    }
    throw e;
  }
}

/**
 * Creates a team scoped to a single arbitrage match — never shown in the team
 * library, never merged with a same-named registered team (ad-hoc names are
 * exempt from the unique-name constraint, see migration v11).
 */
export async function createAdHocTeam(input: TeamInput): Promise<Team> {
  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  const coachName = input.coachName ?? null;
  await db.runAsync(
    `INSERT INTO teams (id, name, short_name, logo_uri, color, coach_name, is_ad_hoc, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, input.name, input.shortName, input.logoUri, input.color, coachName, now, now]
  );
  return { id, ...input, coachName, isAdHoc: true, createdAt: now, updatedAt: now };
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
