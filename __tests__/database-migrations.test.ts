// Verifies that runMigrations is non-destructive when applied to a database
// that already has real data and sits at user_version = 8 (i.e. an existing
// user's install, before the v9/v10 migrations were introduced).
//
// expo-sqlite's native module cannot run under Jest (no device/emulator —
// `NativeDatabase is not a constructor` when required directly), so this uses
// a minimal in-memory fake that executes the REAL migration SQL strings from
// database.ts (PRAGMA user_version reads/writes, ALTER TABLE ADD COLUMN) against
// seeded rows. It intentionally throws on any statement shape it doesn't
// recognize, so if a future migration does something more invasive than an
// additive ALTER TABLE, this test fails loudly instead of silently passing.

import fs from 'fs';
import path from 'path';
import { runMigrations } from '../src/services/database';
import type * as SQLite from 'expo-sqlite';
import {
  V8_MATCH_ROW,
  V8_SET_ROW,
  V8_EVENT_ROW,
  V8_SUBSTITUTION_PAIR_ROW,
  V8_TEAM_ROW,
} from './fixtures/migrationFixtures';

type Row = Record<string, unknown>;

class FakeMigrationDb {
  userVersion: number;
  tables: Record<string, Row[]>;
  /** Kind of transaction and schema version it started from */
  transactions: string[] = [];

  constructor(userVersion: number, tables: Record<string, Row[]>) {
    this.userVersion = userVersion;
    this.tables = tables;
  }

  async getFirstAsync<T>(sql: string): Promise<T> {
    if (/PRAGMA user_version/i.test(sql)) {
      return { user_version: this.userVersion } as unknown as T;
    }
    if (/PRAGMA foreign_keys/i.test(sql)) {
      return { foreign_keys: 0 } as unknown as T;
    }
    throw new Error(`FakeMigrationDb.getFirstAsync: unsupported query for this test: "${sql}"`);
  }

  async getAllAsync(): Promise<unknown[]> {
    throw new Error('FakeMigrationDb.getAllAsync: not needed for v9/v10 — only earlier migrations use it');
  }

  async runAsync(): Promise<void> {
    throw new Error('FakeMigrationDb.runAsync: not needed for v9/v10 — they use execAsync only');
  }

  async execAsync(sql: string): Promise<void> {
    const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      const versionMatch = /^PRAGMA user_version\s*=\s*(\d+)/i.exec(stmt);
      if (versionMatch) {
        this.userVersion = Number(versionMatch[1]);
        continue;
      }
      const alterMatch = /^ALTER TABLE (\w+) ADD COLUMN (\w+)/i.exec(stmt);
      if (alterMatch) {
        const [, table, column] = alterMatch;
        const defaultMatch = /DEFAULT\s+(\S+)/i.exec(stmt);
        const defaultValue = defaultMatch
          ? (Number.isNaN(Number(defaultMatch[1])) ? defaultMatch[1] : Number(defaultMatch[1]))
          : null;
        for (const row of this.tables[table] ?? []) {
          row[column] = defaultValue;
        }
        continue;
      }
      if (/^PRAGMA foreign_keys/i.test(stmt)) continue;
      // v16 table rebuild: copy, drop, rename
      const copyMatch = /^INSERT INTO (\w+) \(([^)]+)\) SELECT ([\s\S]+) FROM (\w+)$/i.exec(stmt);
      if (copyMatch) {
        const [, target, cols] = copyMatch;
        const columns = cols.split(',').map((c) => c.trim());
        this.tables[target] = (this.tables[copyMatch[4]] ?? []).map((row) =>
          Object.fromEntries(columns.filter((c) => c in row).map((c) => [c, row[c]])));
        continue;
      }
      const dropMatch = /^DROP TABLE (\w+)$/i.exec(stmt);
      if (dropMatch) {
        delete this.tables[dropMatch[1]];
        continue;
      }
      const renameMatch = /^ALTER TABLE (\w+) RENAME TO (\w+)$/i.exec(stmt);
      if (renameMatch) {
        this.tables[renameMatch[2]] = this.tables[renameMatch[1]];
        delete this.tables[renameMatch[1]];
        continue;
      }
      // New empty tables (v14+) never touch an existing table
      const createMatch = /^CREATE TABLE IF NOT EXISTS (\w+)/i.exec(stmt);
      if (createMatch) {
        this.tables[createMatch[1]] ??= [];
        continue;
      }
      // Index statements don't affect row data in this simulation — just
      // confirm they're well-formed (DROP INDEX / CREATE [UNIQUE] INDEX).
      if (/^DROP INDEX/i.test(stmt) || /^CREATE (UNIQUE )?INDEX( IF NOT EXISTS)?/i.test(stmt)) {
        continue;
      }
      throw new Error(
        `FakeMigrationDb.execAsync: unsupported statement — this fake only models additive ` +
        `ALTER TABLE ADD COLUMN, PRAGMA user_version and index DDL for migrations v9+: "${stmt}"`,
      );
    }
  }

  async withExclusiveTransactionAsync(cb: () => Promise<void>): Promise<void> {
    this.transactions.push(`exclusive@${this.userVersion}`);
    await cb();
  }

  async withTransactionAsync(cb: () => Promise<void>): Promise<void> {
    this.transactions.push(`same-connection@${this.userVersion}`);
    await cb();
  }
}

test('migrating an existing v8 database to v16 preserves every pre-existing row intact', async () => {
  const tables: Record<string, Row[]> = {
    matches: [{ ...V8_MATCH_ROW }],
    sets: [{ ...V8_SET_ROW }],
    match_events: [{ ...V8_EVENT_ROW }],
    substitution_pairs: [{ ...V8_SUBSTITUTION_PAIR_ROW }],
    teams: [{ ...V8_TEAM_ROW }],
  };
  const db = new FakeMigrationDb(8, tables);

  await runMigrations(db as unknown as SQLite.SQLiteDatabase);

  expect(db.userVersion).toBe(16);

  // matches: every pre-existing field untouched, new columns added as null/0
  expect(tables.matches[0]).toEqual({
    ...V8_MATCH_ROW,
    captain_home_id: null,
    captain_away_id: null,
    sides_swapped: 0,
    acting_captain_home_id: null,
    acting_captain_away_id: null,
  });

  // sets: every pre-existing field untouched, new column added as null
  expect(tables.sets[0]).toEqual({
    ...V8_SET_ROW,
    serving_team_id: null,
  });

  // match_events: no migration since v8 touches this table — must be 100% unchanged
  expect(tables.match_events[0]).toEqual(V8_EVENT_ROW);

  // substitution_pairs: every pre-existing field untouched, new column defaults to 0
  expect(tables.substitution_pairs[0]).toEqual({
    ...V8_SUBSTITUTION_PAIR_ROW,
    is_exceptional: 0,
  });

  // teams: every pre-existing registered team keeps its name, gains coach_name = null
  // and is_ad_hoc = 0 (so it keeps showing up in the team library as before)
  expect(tables.teams[0]).toEqual({
    ...V8_TEAM_ROW,
    coach_name: null,
    is_ad_hoc: 0,
    libero_color: null,
  });
});

test('a database already at v16 is a no-op (idempotent)', async () => {
  const tables: Record<string, Row[]> = {
    matches: [{ ...V8_MATCH_ROW, captain_home_id: 'P5', captain_away_id: null, sides_swapped: 1, acting_captain_home_id: 'P6', acting_captain_away_id: null }],
    teams: [{ ...V8_TEAM_ROW, is_ad_hoc: 1, coach_name: 'Coach Dupont' }],
  };
  const db = new FakeMigrationDb(16, tables);

  await runMigrations(db as unknown as SQLite.SQLiteDatabase);

  expect(db.userVersion).toBe(16);
  // existing captain assignment, ad-hoc flag and referee state from before must not be clobbered by a re-run
  expect(tables.matches[0].captain_home_id).toBe('P5');
  expect(tables.matches[0].sides_swapped).toBe(1);
  expect(tables.matches[0].acting_captain_home_id).toBe('P6');
  expect(tables.teams[0].is_ad_hoc).toBe(1);
  expect(tables.teams[0].coach_name).toBe('Coach Dupont');
});

test('migrating an existing v11 database to v16 adds the referee-state columns', async () => {
  const tables: Record<string, Row[]> = {
    matches: [{ ...V8_MATCH_ROW, captain_home_id: 'P5', captain_away_id: null }],
  };
  const db = new FakeMigrationDb(11, tables);

  await runMigrations(db as unknown as SQLite.SQLiteDatabase);

  expect(db.userVersion).toBe(16);
  expect(tables.matches[0]).toEqual({
    ...V8_MATCH_ROW,
    captain_home_id: 'P5',
    captain_away_id: null,
    sides_swapped: 0,
    acting_captain_home_id: null,
    acting_captain_away_id: null,
  });
});

test('multiple pre-existing rows in the same table are all migrated', async () => {
  const tables: Record<string, Row[]> = {
    sets: [
      { ...V8_SET_ROW, id: 's1', set_number: 1 },
      { ...V8_SET_ROW, id: 's2', set_number: 2 },
      { ...V8_SET_ROW, id: 's3', set_number: 3 },
    ],
  };
  const db = new FakeMigrationDb(8, tables);

  await runMigrations(db as unknown as SQLite.SQLiteDatabase);

  expect(tables.sets).toHaveLength(3);
  for (const set of tables.sets) {
    expect(set.serving_team_id).toBeNull();
  }
  expect(tables.sets.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
});

test('migrating a v12 database to v16 adds the libero jersey colour to teams', async () => {
  const tables: Record<string, Row[]> = { teams: [{ ...V8_TEAM_ROW, is_ad_hoc: 1, coach_name: null }] };
  const db = new FakeMigrationDb(12, tables);

  await runMigrations(db as unknown as SQLite.SQLiteDatabase);

  expect(db.userVersion).toBe(16);
  expect(tables.teams[0]).toEqual({ ...V8_TEAM_ROW, is_ad_hoc: 1, coach_name: null, libero_color: null });
});

test('migrating a v13 database to v16 creates the empty tournament tables and changes nothing else', async () => {
  const tables: Record<string, Row[]> = { teams: [{ ...V8_TEAM_ROW, is_ad_hoc: 0, coach_name: null, libero_color: null }] };
  const before = JSON.stringify(tables.teams);
  const db = new FakeMigrationDb(13, tables);

  await runMigrations(db as unknown as SQLite.SQLiteDatabase);

  expect(db.userVersion).toBe(16);
  expect(JSON.stringify(tables.teams)).toBe(before);
  for (const t of ['tournaments', 'tournament_pools', 'tournament_teams', 'tournament_matches', 'tournament_templates']) {
    expect(tables[t]).toEqual([]);
  }
});

test('migrating a v14 database to v16 adds the mixing round and level to tournament pools and matches', async () => {
  const tables: Record<string, Row[]> = {
    tournament_pools: [{ id: 'p1', tournament_id: 't1', name: 'A', position: 0 }],
    tournament_matches: [{ id: 'm1', tournament_id: 't1', stage: 'pool', round: 1, status: 'validated' }],
  };
  const db = new FakeMigrationDb(14, tables);

  await runMigrations(db as unknown as SQLite.SQLiteDatabase);

  expect(db.userVersion).toBe(16);
  expect(tables.tournament_pools[0]).toEqual({ id: 'p1', tournament_id: 't1', name: 'A', position: 0, phase: null, level: null });
  expect(tables.tournament_matches[0]).toEqual({ id: 'm1', tournament_id: 't1', stage: 'pool', round: 1, status: 'validated', phase: null, level: null });
});

test('migrating a v15 database to v16 keeps every match (6×6 and beach) and allows 4×4 / 3×3', async () => {
  const full = {
    ...V8_MATCH_ROW, captain_home_id: 'P5', captain_away_id: null, sides_swapped: 1,
    acting_captain_home_id: null, acting_captain_away_id: 'P9',
  };
  const beach = { ...full, id: 'm2', format: 'beach_2v2', status: 'finished', winner_team_id: 't2' };
  const tables: Record<string, Row[]> = { matches: [{ ...full }, { ...beach }], sets: [{ ...V8_SET_ROW, serving_team_id: null }] };
  const db = new FakeMigrationDb(15, tables);

  await runMigrations(db as unknown as SQLite.SQLiteDatabase);

  expect(db.userVersion).toBe(16);
  expect(tables.matches).toEqual([full, beach]);
  expect(tables.matches_v16).toBeUndefined();
  expect(tables.sets).toEqual([{ ...V8_SET_ROW, serving_team_id: null }]);
});

test('the v16 matches table accepts the four formats', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../src/services/database.ts'), 'utf8');
  expect(sql).toContain("CHECK(format IN ('indoor_6v6','indoor_4v4','indoor_3v3','beach_2v2'))");
});

test('v14 to v16 run each in one transaction on the same connection (atomic: no half-applied migration)', async () => {
  // withExclusiveTransactionAsync opens a second connection: statements sent on `db`
  // were committed one by one, so an interrupted migration could not be run again
  const tables: Record<string, Row[]> = {
    matches: [{ ...V8_MATCH_ROW, captain_home_id: null, captain_away_id: null, sides_swapped: 0, acting_captain_home_id: null, acting_captain_away_id: null }],
    teams: [{ ...V8_TEAM_ROW, is_ad_hoc: 0, coach_name: null, libero_color: null }],
  };
  const db = new FakeMigrationDb(13, tables);
  await runMigrations(db as unknown as SQLite.SQLiteDatabase);
  expect(db.userVersion).toBe(16);
  expect(db.transactions).toEqual(['same-connection@13', 'same-connection@14', 'same-connection@15']);
});
