/**
 * No real person's name in the app: the two teams created at first launch up
 * to 1.2.3 (real national-team players) are removed from phones, but only
 * when they were never changed nor used in a match or a tournament.
 */
import fs from 'fs';
import path from 'path';
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
import { removeUntouchedLegacyTeams, rosterFingerprint, LEGACY_SEED_TEAMS } from '../src/services/legacySeedCleanup';

const mockGetDb = getDb as jest.Mock;
let db: FakeSqlDb;

beforeEach(() => {
  mockIdCounter = 0;
  db = new FakeSqlDb();
  mockGetDb.mockResolvedValue(db);
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

describe('removeUntouchedLegacyTeams', () => {
  it('removes both teams and their players when untouched and unused', async () => {
    await createLegacyTeam(0);
    await createLegacyTeam(1);
    const kept = await createTeam({ name: 'Mon club', shortName: null, logoUri: null, color: '#123456' });
    await createPlayer({ teamId: kept.id, firstName: null, lastName: 'Martin', number: 3, position: null, photoUri: null, isActive: true });

    expect(await removeUntouchedLegacyTeams()).toBe(2);

    expect((await getAllTeams()).map((t) => t.name)).toEqual(['Mon club']);
    expect(db.tables.get('players')!.map((p) => p.team_id)).toEqual([kept.id]);
  });

  it('keeps a team used in a match', async () => {
    const { team } = await createLegacyTeam(0);
    await db.runAsync('INSERT INTO matches (id, team_home_id, team_away_id) VALUES (?, ?, ?)', ['m1', 'x', team.id]);
    expect(await removeUntouchedLegacyTeams()).toBe(0);
    expect(await getAllTeams()).toHaveLength(1);
  });

  it('keeps a team used in a tournament', async () => {
    const { team } = await createLegacyTeam(1);
    await db.runAsync('INSERT INTO tournament_teams (id, team_id) VALUES (?, ?)', ['tt1', team.id]);
    expect(await removeUntouchedLegacyTeams()).toBe(0);
  });

  it('keeps a team whose details were edited', async () => {
    const { team } = await createLegacyTeam(0);
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValueOnce('2030-01-01T00:00:00.000Z');
    await updateTeam(team.id, { color: '#1D4ED8' });
    expect(await removeUntouchedLegacyTeams()).toBe(0);
  });

  it('keeps a team whose roster was changed', async () => {
    const { team, players } = await createLegacyTeam(1);
    await updatePlayer(players[0].id, { lastName: 'Durand' });
    expect(await removeUntouchedLegacyTeams()).toBe(0);
    expect(await getPlayersByTeam(team.id)).toHaveLength(13);
  });

  it('keeps a team with an added player', async () => {
    const { team } = await createLegacyTeam(0);
    await createPlayer({ teamId: team.id, firstName: null, lastName: 'Petit', number: 30, position: null, photoUri: null, isActive: true });
    expect(await removeUntouchedLegacyTeams()).toBe(0);
  });

  it('keeps a team that only shares the name', async () => {
    await createTeam({ name: 'France', shortName: 'FRA', logoUri: null, color: '#1D4ED8' });
    expect(await removeUntouchedLegacyTeams()).toBe(0);
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
