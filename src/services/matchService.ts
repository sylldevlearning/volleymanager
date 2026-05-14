import { getDb, generateId } from './database';
import type { Match, MatchInput, MatchSet } from '../models/match';

function rowToMatch(row: Record<string, unknown>): Match {
  return {
    id: row.id as string,
    date: row.date as string,
    format: row.format as Match['format'],
    mode: row.mode as Match['mode'],
    teamHomeId: row.team_home_id as string,
    teamAwayId: row.team_away_id as string,
    status: row.status as Match['status'],
    config: JSON.parse(row.config_json as string),
    winnerTeamId: row.winner_team_id as string | null,
    firstServeTeamId: row.first_serve_team_id as string | null ?? null,
    createdAt: row.created_at as string,
    finishedAt: row.finished_at as string | null,
  };
}

function rowToSet(row: Record<string, unknown>): MatchSet {
  return {
    id: row.id as string,
    matchId: row.match_id as string,
    setNumber: row.set_number as number,
    scoreHome: row.score_home as number,
    scoreAway: row.score_away as number,
    winnerTeamId: row.winner_team_id as string | null,
    startedAt: row.started_at as string,
    finishedAt: row.finished_at as string | null,
  };
}

export async function getAllMatches(): Promise<Match[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM matches ORDER BY created_at DESC'
  );
  return rows.map(rowToMatch);
}

export async function getMatchesByTeam(teamId: string): Promise<Match[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM matches WHERE team_home_id = ? OR team_away_id = ? ORDER BY created_at DESC',
    [teamId, teamId]
  );
  return rows.map(rowToMatch);
}

export async function getMatchById(id: string): Promise<Match | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM matches WHERE id = ?',
    [id]
  );
  return row ? rowToMatch(row) : null;
}

export async function createMatch(input: MatchInput): Promise<Match> {
  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  const firstServeTeamId = input.firstServeTeamId ?? null;
  await db.runAsync(
    `INSERT INTO matches (id, date, format, mode, team_home_id, team_away_id, status, config_json, first_serve_team_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'created', ?, ?, ?)`,
    [id, now, input.format, input.mode, input.teamHomeId, input.teamAwayId, JSON.stringify(input.config), firstServeTeamId, now]
  );
  return {
    id,
    date: now,
    format: input.format,
    mode: input.mode,
    teamHomeId: input.teamHomeId,
    teamAwayId: input.teamAwayId,
    status: 'created',
    config: input.config,
    winnerTeamId: null,
    firstServeTeamId,
    createdAt: now,
    finishedAt: null,
  };
}

export async function updateMatchStatus(
  id: string,
  status: Match['status'],
  winnerTeamId?: string,
): Promise<void> {
  const db = await getDb();
  const finishedAt = status === 'finished' ? new Date().toISOString() : null;
  await db.runAsync(
    'UPDATE matches SET status = ?, winner_team_id = ?, finished_at = ? WHERE id = ?',
    [status, winnerTeamId ?? null, finishedAt, id]
  );
}

export async function createSet(matchId: string, setNumber: number): Promise<MatchSet> {
  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO sets (id, match_id, set_number, score_home, score_away, started_at) VALUES (?, ?, ?, 0, 0, ?)',
    [id, matchId, setNumber, now]
  );
  return { id, matchId, setNumber, scoreHome: 0, scoreAway: 0, winnerTeamId: null, startedAt: now, finishedAt: null };
}

export async function getSetsForMatch(matchId: string): Promise<MatchSet[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM sets WHERE match_id = ? ORDER BY set_number ASC',
    [matchId]
  );
  return rows.map(rowToSet);
}

export async function updateSet(
  setId: string,
  scoreHome: number,
  scoreAway: number,
  winnerTeamId?: string,
): Promise<void> {
  const db = await getDb();
  const finishedAt = winnerTeamId ? new Date().toISOString() : null;
  await db.runAsync(
    'UPDATE sets SET score_home = ?, score_away = ?, winner_team_id = ?, finished_at = ? WHERE id = ?',
    [scoreHome, scoreAway, winnerTeamId ?? null, finishedAt, setId]
  );
}
