/**
 * No real person's name in the app: the two teams created at first launch up
 * to 1.2.3 (real national-team players) are removed from phones in every case,
 * with the matches that use them, once. Sample teams are never touched.
 */
import fs from 'fs';
import path from 'path';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FakeSqlDb } from './helpers/fakeSqlDb';
import { LEGACY_TEAMS, type LegacySeedPlayer } from './fixtures/legacySeedRosters';

let mockIdCounter = 0;
jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => `id-${++mockIdCounter}`),
}));

import { getDb } from '../src/services/database';
import { createTeam, getAllTeams, updateTeam } from '../src/services/teamService';
import { createPlayer, getPlayersByTeam, updatePlayer } from '../src/services/playerService';
import {
  removeLegacyTeams, removeLegacyTeamsOnce, rosterFingerprint, LEGACY_SEED_TEAMS, LEGACY_TEAMS_REMOVED_KEY,
} from '../src/services/legacySeedCleanup';

const mockGetDb = getDb as jest.Mock;
let db: FakeSqlDb;

beforeEach(async () => {
  mockIdCounter = 0;
  db = new FakeSqlDb();
  mockGetDb.mockResolvedValue(db);
  await AsyncStorage.clear();
});

async function createLegacyTeam(index: 0 | 1) {
  const def = LEGACY_TEAMS[index];
  const team = await createTeam({ name: def.name, shortName: def.shortName, logoUri: null, color: def.color });
  const players = [];
  for (const p of def.players as readonly LegacySeedPlayer[]) {
    players.push(await createPlayer({
      teamId: team.id, firstName: p.firstName ?? null, lastName: p.lastName, number: p.number,
      position: p.position, photoUri: null, isActive: true,
    }));
  }
  return { team, players };
}

async function addMatch(id: string, home: string, away: string) {
  await db.runAsync('INSERT INTO matches (id, team_home_id, team_away_id) VALUES (?, ?, ?)', [id, home, away]);
  await db.runAsync('INSERT INTO sets (id, match_id) VALUES (?, ?)', [`${id}-s1`, id]);
  await db.runAsync('INSERT INTO match_events (id, match_id) VALUES (?, ?)', [`${id}-e1`, id]);
  await db.runAsync('INSERT INTO lineups (id, match_id) VALUES (?, ?)', [`${id}-l1`, id]);
  await db.runAsync('INSERT INTO substitution_pairs (id, match_id) VALUES (?, ?)', [`${id}-p1`, id]);
}

const ids = (table: string) => (db.tables.get(table) ?? []).map((r) => r.id);

describe('fingerprints', () => {
  it('match the two legacy rosters', () => {
    LEGACY_TEAMS.forEach((def, i) => {
      const fp = rosterFingerprint(def.players.map((p) => ({
        number: p.number, firstName: (p as LegacySeedPlayer).firstName ?? null, lastName: p.lastName, position: p.position,
      })));
      expect(fp).toBe(LEGACY_SEED_TEAMS[i].roster);
    });
  });
});

describe('removeLegacyTeams', () => {
  it('removes both teams and their players, and keeps the user team', async () => {
    await createLegacyTeam(0);
    await createLegacyTeam(1);
    const kept = await createTeam({ name: 'Mon club', shortName: null, logoUri: null, color: '#123456' });
    await createPlayer({ teamId: kept.id, firstName: null, lastName: 'Martin', number: 3, position: null, photoUri: null, isActive: true });

    expect(await removeLegacyTeams()).toBe(2);

    expect((await getAllTeams()).map((t) => t.name)).toEqual(['Mon club']);
    expect(db.tables.get('players')!.map((p) => p.team_id)).toEqual([kept.id]);
  });

  it('removes a team used in a match, with that match and all its data', async () => {
    const { team } = await createLegacyTeam(0);
    const mine = await createTeam({ name: 'Mon club', shortName: null, logoUri: null, color: '#123456' });
    const other = await createTeam({ name: 'Autre club', shortName: null, logoUri: null, color: '#654321' });
    await addMatch('m1', mine.id, team.id);
    await addMatch('m2', mine.id, other.id);
    await db.runAsync('INSERT INTO tournament_matches (id, arbitrage_match_id) VALUES (?, ?)', ['tm1', 'm1']);

    expect(await removeLegacyTeams()).toBe(1);

    expect(ids('matches')).toEqual(['m2']);
    for (const table of ['sets', 'match_events', 'lineups', 'substitution_pairs']) {
      expect(db.tables.get(table)!.map((r) => r.match_id)).toEqual(['m2']);
    }
    expect(db.tables.get('tournament_matches')![0].arbitrage_match_id).toBeNull();
    expect((await getAllTeams()).map((t) => t.name).sort()).toEqual(['Autre club', 'Mon club']);
  });

  it('removes a match between the two legacy teams', async () => {
    const { team: fra } = await createLegacyTeam(0);
    const { team: bra } = await createLegacyTeam(1);
    await addMatch('m1', fra.id, bra.id);
    expect(await removeLegacyTeams()).toBe(2);
    expect(ids('matches')).toEqual([]);
  });

  it('removes a team used in a tournament; the tournament keeps its team, unlinked', async () => {
    const { team } = await createLegacyTeam(1);
    await db.runAsync('INSERT INTO tournament_teams (id, team_id) VALUES (?, ?)', ['tt1', team.id]);
    expect(await removeLegacyTeams()).toBe(1);
    expect(db.tables.get('tournament_teams')).toEqual([expect.objectContaining({ id: 'tt1', team_id: null })]);
  });

  it('removes a team whose details or roster were edited', async () => {
    const { team, players } = await createLegacyTeam(0);
    await updateTeam(team.id, { color: '#000000', shortName: 'XYZ' });
    await updatePlayer(players[0].id, { lastName: 'Durand' });
    await createPlayer({ teamId: team.id, firstName: null, lastName: 'Petit', number: 30, position: null, photoUri: null, isActive: true });
    expect(await removeLegacyTeams()).toBe(1);
    expect(await getPlayersByTeam(team.id)).toHaveLength(0);
  });

  it('removes a renamed team recognised by its roster', async () => {
    const { team } = await createLegacyTeam(1);
    await updateTeam(team.id, { name: 'Mes amis' });
    expect(await removeLegacyTeams()).toBe(1);
    expect(await getAllTeams()).toHaveLength(0);
  });

  it('removes an empty team named France or Brésil', async () => {
    await createTeam({ name: 'France', shortName: null, logoUri: null, color: '#1D4ED8' });
    await createTeam({ name: 'brésil ', shortName: null, logoUri: null, color: '#1D4ED8' });
    expect(await removeLegacyTeams()).toBe(2);
  });

  it('never touches a sample team', async () => {
    const sample = await createTeam({ name: 'Les Mouettes', shortName: 'MOU', logoUri: null, color: '#0EA5E9' });
    await db.runAsync('UPDATE teams SET is_sample = 1 WHERE id = ?', [sample.id]);
    await createPlayer({ teamId: sample.id, firstName: null, lastName: 'Bernard', number: 4, position: null, photoUri: null, isActive: true });
    await addMatch('ms', sample.id, sample.id);
    expect(await removeLegacyTeams()).toBe(0);
    expect(ids('matches')).toEqual(['ms']);
    expect(await getPlayersByTeam(sample.id)).toHaveLength(1);
  });
});

describe('removeLegacyTeamsOnce', () => {
  it('runs once: a team created later under the same name stays', async () => {
    await createLegacyTeam(0);
    expect(await removeLegacyTeamsOnce()).toBe(1);
    expect(await AsyncStorage.getItem(LEGACY_TEAMS_REMOVED_KEY)).toBe('1');

    await createTeam({ name: 'France', shortName: null, logoUri: null, color: '#1D4ED8' });
    expect(await removeLegacyTeamsOnce()).toBe(0);
    expect(await getAllTeams()).toHaveLength(1);
  });
});

describe('no real name left in the app', () => {
  const ROOT = path.join(__dirname, '..');
  function files(dir: string): string[] {
    return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) return files(rel);
      return /\.(tsx?|json)$/.test(e.name) ? [rel] : [];
    });
  }
  const names = LEGACY_TEAMS.flatMap((t) => t.players.map((p) => p.lastName))
    // Too common as words to search for safely
    .filter((n) => !['Alan', 'Leal', 'Faure', 'Carle'].includes(n));

  it.each(['app', 'src'])('%s has none of the legacy players', (dir) => {
    const offenders = files(dir).filter((f) => {
      const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
      return names.some((n) => new RegExp(`\\b${n}\\b`).test(s));
    });
    expect(offenders).toEqual([]);
  });
});
