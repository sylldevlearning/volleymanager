import { getDb, generateId } from './database';
import type {
  ResultSource,
  SeedingMode,
  TeamRef,
  Tournament,
  TournamentFormat,
  TournamentGameType,
  TournamentMatch,
  TournamentPool,
  TournamentRules,
  TournamentSchedule,
  TournamentTeam,
  TournamentTemplate,
} from '../models/tournament';
import { generateTournament, validateSetup, type SetupError } from '../features/tournament/engine/generate';
import { scheduleMatches, restSlotsFor, slotStart } from '../features/tournament/engine/scheduler';
import { recordResult, type RecordOutcome, type ResultInput } from '../features/tournament/engine/cascade';
import { poolName } from '../features/tournament/engine/pools';
import type { EngineContext, EngineMatch } from '../features/tournament/engine/types';

export interface TournamentBundle {
  tournament: Tournament;
  pools: TournamentPool[];
  teams: TournamentTeam[];
  matches: TournamentMatch[];
}

export interface CreateTournamentInput {
  name: string;
  date: string;
  location: string | null;
  gameType: TournamentGameType;
  format: TournamentFormat;
  rules: TournamentRules;
  schedule: TournamentSchedule;
  seeding: SeedingMode;
  /** Draw seed; random when omitted. */
  seed?: number;
  teams: { teamId: string | null; name: string; color: string; seedRank: number | null }[];
}

export class TournamentSetupError extends Error {
  constructor(public readonly errors: SetupError[]) {
    super(`Invalid tournament setup: ${errors.join(', ')}`);
    this.name = 'TournamentSetupError';
  }
}

type Row = Record<string, unknown>;

/** Key of the QR codes of a tournament (checks them, does not encrypt). */
function randomHex(length: number): string {
  let out = '';
  while (out.length < length) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

function rowToTournament(row: Row): Tournament {
  return {
    id: row.id as string,
    name: row.name as string,
    date: row.date as string,
    location: (row.location as string | null) ?? null,
    gameType: row.game_type as TournamentGameType,
    format: row.format as TournamentFormat,
    rules: JSON.parse(row.rules_json as string),
    schedule: JSON.parse(row.schedule_json as string),
    seed: row.seed as number,
    seeding: row.seeding as SeedingMode,
    secret: row.secret as string,
    status: row.status as Tournament['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToPool(row: Row): TournamentPool {
  return {
    id: row.id as string,
    tournamentId: row.tournament_id as string,
    name: row.name as string,
    position: row.position as number,
    phase: (row.phase as number | null) ?? null,
    level: (row.level as number | null) ?? null,
  };
}

function rowToTeam(row: Row): TournamentTeam {
  return {
    id: row.id as string,
    tournamentId: row.tournament_id as string,
    teamId: (row.team_id as string | null) ?? null,
    name: row.name as string,
    color: row.color as string,
    seedRank: (row.seed_rank as number | null) ?? null,
    poolId: (row.pool_id as string | null) ?? null,
    position: row.position as number,
  };
}

function rowToMatch(row: Row): TournamentMatch {
  return {
    id: row.id as string,
    tournamentId: row.tournament_id as string,
    stage: row.stage as TournamentMatch['stage'],
    poolId: (row.pool_id as string | null) ?? null,
    phase: (row.phase as number | null) ?? null,
    level: (row.level as number | null) ?? null,
    round: row.round as number,
    bracketSlot: (row.bracket_slot as number | null) ?? null,
    label: (row.label as string | null) ?? null,
    homeId: (row.home_id as string | null) ?? null,
    awayId: (row.away_id as string | null) ?? null,
    homeSource: JSON.parse(row.home_source as string) as TeamRef,
    awaySource: JSON.parse(row.away_source as string) as TeamRef,
    slot: (row.slot as number | null) ?? null,
    court: (row.court as number | null) ?? null,
    scheduledAt: (row.scheduled_at as string | null) ?? null,
    status: row.status as TournamentMatch['status'],
    sets: row.sets_json ? JSON.parse(row.sets_json as string) : null,
    forfeitId: (row.forfeit_id as string | null) ?? null,
    winnerId: (row.winner_id as string | null) ?? null,
    resultSource: (row.result_source as ResultSource | null) ?? null,
    arbitrageMatchId: (row.arbitrage_match_id as string | null) ?? null,
    validatedAt: (row.validated_at as string | null) ?? null,
    updatedAt: row.updated_at as string,
  };
}

// ── Engine ↔ storage ──────────────────────────────────────────────────────

export function engineContext(bundle: TournamentBundle): EngineContext {
  const { tournament, pools, teams } = bundle;
  return {
    format: tournament.format,
    rules: tournament.rules,
    teams: teams.map((t) => ({ id: t.id, seedRank: t.seedRank, position: t.position })),
    pools: pools.map((p) => teams.filter((t) => t.poolId === p.id).map((t) => t.id)),
    poolDefs: pools.map((p) => ({ phase: p.phase, level: p.level })),
  };
}

export function toEngineMatch(m: TournamentMatch, pools: TournamentPool[]): EngineMatch {
  const pool = m.poolId ? pools.findIndex((p) => p.id === m.poolId) : -1;
  return {
    key: m.id,
    stage: m.stage,
    pool: pool >= 0 ? pool : null,
    phase: m.phase,
    level: m.level,
    round: m.round,
    bracketSlot: m.bracketSlot,
    label: m.label,
    homeRef: m.homeSource,
    awayRef: m.awaySource,
    homeId: m.homeId,
    awayId: m.awayId,
    status: m.status,
    sets: m.sets,
    forfeitId: m.forfeitId,
    winnerId: m.winnerId,
    slot: m.slot,
    court: m.court,
  };
}

const scheduledAt = (t: Pick<Tournament, 'date' | 'schedule'>, slot: number) => `${t.date}T${slotStart(t.schedule, slot)}`;

// ── Reads ─────────────────────────────────────────────────────────────────

export async function getTournaments(): Promise<Tournament[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM tournaments ORDER BY created_at DESC');
  return rows.map(rowToTournament);
}

export async function getTournamentBundle(id: string): Promise<TournamentBundle | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>('SELECT * FROM tournaments WHERE id = ?', [id]);
  if (!row) return null;
  const [pools, teams, matches] = await Promise.all([
    db.getAllAsync<Row>('SELECT * FROM tournament_pools WHERE tournament_id = ? ORDER BY position ASC', [id]),
    db.getAllAsync<Row>('SELECT * FROM tournament_teams WHERE tournament_id = ? ORDER BY position ASC', [id]),
    db.getAllAsync<Row>('SELECT * FROM tournament_matches WHERE tournament_id = ? ORDER BY position ASC', [id]),
  ]);
  return {
    tournament: rowToTournament(row),
    pools: pools.map(rowToPool),
    teams: teams.map(rowToTeam),
    matches: matches.map(rowToMatch),
  };
}

// ── Creation ──────────────────────────────────────────────────────────────

/** Draws and plans the tournament, then saves it in one transaction. */
export async function createTournament(input: CreateTournamentInput): Promise<TournamentBundle> {
  const tournamentId = generateId();
  const teamIds = input.teams.map(() => generateId());
  const engineTeams = input.teams.map((t, i) => ({ id: teamIds[i], seedRank: t.seedRank, position: i }));
  const seed = input.seed ?? Math.floor(Math.random() * 2 ** 31);
  const generateInput = {
    format: input.format, rules: input.rules, teams: engineTeams, seed, seeding: input.seeding, keyPrefix: `${tournamentId}:`,
  };
  const errors = validateSetup(generateInput);
  if (errors.length > 0) throw new TournamentSetupError(errors);

  const generated = generateTournament(generateInput);
  const planned = scheduleMatches(generated.matches, { courts: input.schedule.courts, restSlots: restSlotsFor(input.schedule) });
  const poolIds = generated.pools.map(() => generateId());
  const poolOf = new Map(generated.pools.flatMap((ids, p) => ids.map((id) => [id, poolIds[p]] as const)));
  const now = new Date().toISOString();

  const db = await getDb();
  await db.withExclusiveTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO tournaments (id, name, date, location, game_type, format, rules_json, schedule_json, seed, seeding, secret, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tournamentId, input.name.trim(), input.date, input.location?.trim() || null, input.gameType, input.format,
        JSON.stringify(input.rules), JSON.stringify(input.schedule), seed, input.seeding, randomHex(32), 'live', now, now],
    );
    for (let p = 0; p < poolIds.length; p++) {
      const def = generated.poolDefs[p];
      // Letters restart in each mixing round and level: "Tour 2 · Poule A"
      const local = generated.poolDefs.slice(0, p).filter((d) => d.phase === def.phase && d.level === def.level).length;
      await db.runAsync(
        'INSERT INTO tournament_pools (id, tournament_id, name, position, phase, level) VALUES (?, ?, ?, ?, ?, ?)',
        [poolIds[p], tournamentId, poolName(local), p, def.phase, def.level],
      );
    }
    for (let i = 0; i < input.teams.length; i++) {
      const t = input.teams[i];
      await db.runAsync(
        `INSERT INTO tournament_teams (id, tournament_id, team_id, name, color, seed_rank, pool_id, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [teamIds[i], tournamentId, t.teamId, t.name.trim(), t.color, t.seedRank, poolOf.get(teamIds[i]) ?? null, i],
      );
    }
    for (let i = 0; i < planned.length; i++) {
      const m = planned[i];
      await db.runAsync(
        `INSERT INTO tournament_matches (id, tournament_id, stage, pool_id, phase, level, round, bracket_slot, label, home_id, away_id,
           home_source, away_source, slot, court, scheduled_at, status, sets_json, forfeit_id, winner_id, result_source,
           arbitrage_match_id, validated_at, position, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [m.key, tournamentId, m.stage, m.pool === null ? null : poolIds[m.pool], m.phase, m.level, m.round, m.bracketSlot, m.label,
          m.homeId, m.awayId, JSON.stringify(m.homeRef), JSON.stringify(m.awayRef), m.slot, m.court,
          m.slot === null ? null : scheduledAt({ date: input.date, schedule: input.schedule }, m.slot),
          m.status, null, null, null, null, null, null, i, now],
      );
    }
  });
  return (await getTournamentBundle(tournamentId))!;
}

export async function deleteTournament(id: string): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async () => {
    await db.runAsync('DELETE FROM tournament_matches WHERE tournament_id = ?', [id]);
    await db.runAsync('DELETE FROM tournament_teams WHERE tournament_id = ?', [id]);
    await db.runAsync('DELETE FROM tournament_pools WHERE tournament_id = ?', [id]);
    await db.runAsync('DELETE FROM tournaments WHERE id = ?', [id]);
  });
}

/** Renames a team of the tournament (names stay unique, case aside). */
export async function renameTournamentTeam(
  tournamentId: string,
  teamId: string,
  name: string,
): Promise<{ ok: true } | { ok: false; reason: 'empty' | 'duplicate' }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM tournament_teams WHERE tournament_id = ?', [tournamentId]);
  const clash = rows.some((r) => r.id !== teamId && (r.name as string).toLocaleLowerCase() === trimmed.toLocaleLowerCase());
  if (clash) return { ok: false, reason: 'duplicate' };
  await db.runAsync('UPDATE tournament_teams SET name = ? WHERE id = ?', [trimmed, teamId]);
  return { ok: true };
}

// ── Results ───────────────────────────────────────────────────────────────

export type TournamentResultInput = ResultInput & { source: ResultSource; arbitrageMatchId?: string | null };

export type TournamentRecordOutcome = Exclude<RecordOutcome, { ok: true }> | { ok: true; bundle: TournamentBundle };

/**
 * Validates or corrects a result and updates the bracket it feeds. Nothing is
 * saved when the score is invalid or a played match would change teams.
 */
export async function recordTournamentResult(
  tournamentId: string,
  matchId: string,
  input: TournamentResultInput,
): Promise<TournamentRecordOutcome> {
  const bundle = await getTournamentBundle(tournamentId);
  if (!bundle) return { ok: false, reason: 'unknown_match' };
  const engineMatches = bundle.matches.map((m) => toEngineMatch(m, bundle.pools));
  const outcome = recordResult(engineContext(bundle), engineMatches, matchId, input);
  if (!outcome.ok) return outcome;

  const now = new Date().toISOString();
  const byKey = new Map(outcome.matches.map((m) => [m.key, m]));
  const finished = outcome.matches.every((m) => m.status === 'validated');
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async () => {
    for (const key of outcome.changed) {
      const m = byKey.get(key)!;
      if (key === matchId) {
        await db.runAsync(
          `UPDATE tournament_matches SET status = ?, sets_json = ?, forfeit_id = ?, winner_id = ?, result_source = ?,
             arbitrage_match_id = ?, validated_at = ?, updated_at = ? WHERE id = ?`,
          [m.status, JSON.stringify(m.sets), m.forfeitId, m.winnerId, input.source,
            input.arbitrageMatchId ?? null, now, now, key],
        );
      } else {
        await db.runAsync(
          'UPDATE tournament_matches SET home_id = ?, away_id = ?, updated_at = ? WHERE id = ?',
          [m.homeId, m.awayId, now, key],
        );
      }
    }
    await db.runAsync(
      'UPDATE tournaments SET status = ?, updated_at = ? WHERE id = ?',
      [finished ? 'finished' : 'live', now, tournamentId],
    );
  });
  return { ok: true, bundle: (await getTournamentBundle(tournamentId))! };
}

// ── Planning ──────────────────────────────────────────────────────────────

/** New planning settings: matches still to play move, played ones stay. */
export async function rescheduleTournament(tournamentId: string, schedule: TournamentSchedule): Promise<TournamentBundle> {
  const bundle = await getTournamentBundle(tournamentId);
  if (!bundle) throw new Error(`Unknown tournament ${tournamentId}`);
  const engineMatches = bundle.matches.map((m) => toEngineMatch(m, bundle.pools));
  const planned = scheduleMatches(engineMatches, { courts: schedule.courts, restSlots: restSlotsFor(schedule) });
  const now = new Date().toISOString();
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async () => {
    for (const m of planned) {
      if (m.status !== 'scheduled') continue;
      await db.runAsync(
        'UPDATE tournament_matches SET slot = ?, court = ?, scheduled_at = ?, updated_at = ? WHERE id = ?',
        [m.slot, m.court, m.slot === null ? null : scheduledAt({ date: bundle.tournament.date, schedule }, m.slot), now, m.key],
      );
    }
    await db.runAsync(
      'UPDATE tournaments SET schedule_json = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(schedule), now, tournamentId],
    );
  });
  return (await getTournamentBundle(tournamentId))!;
}

// ── Templates ─────────────────────────────────────────────────────────────

export async function saveTemplate(name: string, payload: TournamentTemplate['payload']): Promise<TournamentTemplate> {
  const template: TournamentTemplate = { id: generateId(), name: name.trim(), payload, createdAt: new Date().toISOString() };
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO tournament_templates (id, name, payload_json, created_at) VALUES (?, ?, ?, ?)',
    [template.id, template.name, JSON.stringify(payload), template.createdAt],
  );
  return template;
}

export async function getTemplates(): Promise<TournamentTemplate[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Row>('SELECT * FROM tournament_templates ORDER BY created_at DESC');
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    payload: JSON.parse(r.payload_json as string),
    createdAt: r.created_at as string,
  }));
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM tournament_templates WHERE id = ?', [id]);
}
