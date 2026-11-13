/**
 * Up to 1.2.3 the app created two teams at first launch with the rosters of
 * real national teams. They are removed from the phone when they are exactly
 * as created (team details and the 13 players) and were never used in a match
 * or a tournament; otherwise they are the user's data and stay.
 *
 * The rosters are recognised by a fingerprint, so no real name ships in the app.
 */
import { getDb } from './database';

export interface RosterEntry {
  number: number;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
}

/** FNV-1a (32 bits) of the roster sorted by number — stable, order-independent. */
export function rosterFingerprint(players: RosterEntry[]): string {
  const text = [...players]
    .sort((a, b) => a.number - b.number)
    .map((p) => `${p.number}|${p.firstName ?? ''}|${p.lastName ?? ''}|${p.position ?? ''}`)
    .join('\n');
  let hash = 0x811c9dc5;
  for (const ch of text) {
    hash ^= ch.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export const LEGACY_SEED_TEAMS = [
  { name: 'France', shortName: 'FRA', color: '#1D4ED8', size: 13, roster: '28456ad0' },
  { name: 'Brésil', shortName: 'BRA', color: '#F59E0B', size: 13, roster: 'b094cc35' },
];

type Row = Record<string, unknown>;

async function isUntouched(team: Row, def: (typeof LEGACY_SEED_TEAMS)[number]): Promise<boolean> {
  const db = await getDb();
  if (team.short_name !== def.shortName || team.color !== def.color) return false;
  if (team.logo_uri || team.coach_name || team.libero_color || team.is_ad_hoc === 1) return false;
  if (team.updated_at !== team.created_at) return false;

  const players = await db.getAllAsync<Row>('SELECT * FROM players WHERE team_id = ?', [team.id as string]);
  if (players.length !== def.size) return false;
  if (players.some((p) => p.is_active !== 1 && p.is_active !== true)) return false;
  if (players.some((p) => p.photo_uri || p.license_number)) return false;
  const fingerprint = rosterFingerprint(players.map((p) => ({
    number: p.number as number,
    firstName: (p.first_name as string | null) ?? null,
    lastName: (p.last_name as string | null) ?? null,
    position: (p.position as string | null) ?? null,
  })));
  return fingerprint === def.roster;
}

async function isUsed(teamId: string): Promise<boolean> {
  const db = await getDb();
  const asHome = await db.getFirstAsync<Row>('SELECT id FROM matches WHERE team_home_id = ?', [teamId]);
  if (asHome) return true;
  const asAway = await db.getFirstAsync<Row>('SELECT id FROM matches WHERE team_away_id = ?', [teamId]);
  if (asAway) return true;
  const inTournament = await db.getFirstAsync<Row>('SELECT id FROM tournament_teams WHERE team_id = ?', [teamId]);
  return inTournament !== null;
}

/** Removes the untouched, unused legacy teams. Returns how many were removed. */
export async function removeUntouchedLegacyTeams(): Promise<number> {
  const db = await getDb();
  let removed = 0;
  for (const def of LEGACY_SEED_TEAMS) {
    const teams = await db.getAllAsync<Row>('SELECT * FROM teams WHERE name = ?', [def.name]);
    for (const team of teams) {
      const id = team.id as string;
      if (!(await isUntouched(team, def)) || (await isUsed(id))) continue;
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM players WHERE team_id = ?', [id]);
        await db.runAsync('DELETE FROM teams WHERE id = ?', [id]);
      });
      removed++;
    }
  }
  return removed;
}
