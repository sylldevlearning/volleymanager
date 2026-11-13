/**
 * Up to 1.2.3 the app created two teams at first launch with the rosters of
 * real national teams. From 1.2.5 they are removed from the phone in every
 * case — even edited or used — with the matches that use them. This runs once:
 * a team the user creates later under the same name is theirs.
 *
 * A renamed team is still recognised by its roster fingerprint, so no real
 * name ships in the app. Sample teams are never touched.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from './database';
import { deleteMatchBoard } from '../features/tactical/boardPersistence';

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

/** Set once the cleanup has run on this phone */
export const LEGACY_TEAMS_REMOVED_KEY = '@volleymanager/legacy_teams_removed_v2';

type Row = Record<string, unknown>;

const LEGACY_NAMES = LEGACY_SEED_TEAMS.map((d) => d.name.toLocaleLowerCase());
const LEGACY_ROSTERS = LEGACY_SEED_TEAMS.map((d) => d.roster);

async function isLegacy(team: Row): Promise<boolean> {
  if (team.is_sample === 1) return false;
  const name = typeof team.name === 'string' ? team.name.trim().toLocaleLowerCase() : '';
  if (LEGACY_NAMES.includes(name)) return true;
  // Renamed: still the legacy roster
  const db = await getDb();
  const players = await db.getAllAsync<Row>('SELECT * FROM players WHERE team_id = ?', [team.id as string]);
  if (players.length === 0) return false;
  const fingerprint = rosterFingerprint(players.map((p) => ({
    number: p.number as number,
    firstName: (p.first_name as string | null) ?? null,
    lastName: (p.last_name as string | null) ?? null,
    position: (p.position as string | null) ?? null,
  })));
  return LEGACY_ROSTERS.includes(fingerprint);
}

async function deleteMatchCompletely(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const child of ['match_events', 'lineups', 'substitution_pairs', 'sets']) {
      await db.runAsync(`DELETE FROM ${child} WHERE match_id = ?`, [id]);
    }
    await db.runAsync('UPDATE tournament_matches SET arbitrage_match_id = NULL WHERE arbitrage_match_id = ?', [id]);
    await db.runAsync('DELETE FROM matches WHERE id = ?', [id]);
  });
  await deleteMatchBoard(id);
}

/** Removes the legacy teams, their players and every match they play in. Returns how many teams were removed. */
export async function removeLegacyTeams(): Promise<number> {
  const db = await getDb();
  let removed = 0;
  for (const team of await db.getAllAsync<Row>('SELECT * FROM teams')) {
    if (!(await isLegacy(team))) continue;
    const id = team.id as string;
    const matches = [
      ...(await db.getAllAsync<Row>('SELECT id FROM matches WHERE team_home_id = ?', [id])),
      ...(await db.getAllAsync<Row>('SELECT id FROM matches WHERE team_away_id = ?', [id])),
    ];
    for (const matchId of new Set(matches.map((m) => m.id as string))) {
      await deleteMatchCompletely(matchId);
    }
    await db.withTransactionAsync(async () => {
      // A tournament keeps its own team names: it only loses the link
      await db.runAsync('UPDATE tournament_teams SET team_id = NULL WHERE team_id = ?', [id]);
      await db.runAsync('DELETE FROM players WHERE team_id = ?', [id]);
      await db.runAsync('DELETE FROM teams WHERE id = ?', [id]);
    });
    removed++;
  }
  return removed;
}

/** Once per phone: removes the legacy teams, then remembers it. */
export async function removeLegacyTeamsOnce(): Promise<number> {
  if (await AsyncStorage.getItem(LEGACY_TEAMS_REMOVED_KEY)) return 0;
  const removed = await removeLegacyTeams();
  await AsyncStorage.setItem(LEGACY_TEAMS_REMOVED_KEY, '1');
  return removed;
}
