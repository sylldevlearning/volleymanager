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

import { runMigrations } from '../src/services/database';
import type * as SQLite from 'expo-sqlite';
import {
  V8_MATCH_ROW,
  V8_SET_ROW,
  V8_EVENT_ROW,
  V8_SUBSTITUTION_PAIR_ROW,
} from './fixtures/migrationFixtures';

type Row = Record<string, unknown>;

class FakeMigrationDb {
  userVersion: number;
  tables: Record<string, Row[]>;

  constructor(userVersion: number, tables: Record<string, Row[]>) {
    this.userVersion = userVersion;
    this.tables = tables;
  }

  async getFirstAsync<T>(sql: string): Promise<T> {
    if (/PRAGMA user_version/i.test(sql)) {
      return { user_version: this.userVersion } as unknown as T;
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
      throw new Error(
        `FakeMigrationDb.execAsync: unsupported statement — this fake only models additive ` +
        `ALTER TABLE ADD COLUMN and PRAGMA user_version for migrations v9+: "${stmt}"`,
      );
    }
  }

  async withExclusiveTransactionAsync(cb: () => Promise<void>): Promise<void> {
    await cb();
  }
}

test('migrating an existing v8 database to v10 preserves every pre-existing row intact', async () => {
  const tables: Record<string, Row[]> = {
    matches: [{ ...V8_MATCH_ROW }],
    sets: [{ ...V8_SET_ROW }],
    match_events: [{ ...V8_EVENT_ROW }],
    substitution_pairs: [{ ...V8_SUBSTITUTION_PAIR_ROW }],
  };
  const db = new FakeMigrationDb(8, tables);

  await runMigrations(db as unknown as SQLite.SQLiteDatabase);

  expect(db.userVersion).toBe(10);

  // matches: every pre-existing field untouched, new columns added as null
  expect(tables.matches[0]).toEqual({
    ...V8_MATCH_ROW,
    captain_home_id: null,
    captain_away_id: null,
  });

  // sets: every pre-existing field untouched, new column added as null
  expect(tables.sets[0]).toEqual({
    ...V8_SET_ROW,
    serving_team_id: null,
  });

  // match_events: v9/v10 never touch this table — must be 100% unchanged
  expect(tables.match_events[0]).toEqual(V8_EVENT_ROW);

  // substitution_pairs: every pre-existing field untouched, new column defaults to 0
  expect(tables.substitution_pairs[0]).toEqual({
    ...V8_SUBSTITUTION_PAIR_ROW,
    is_exceptional: 0,
  });
});

test('a database already at v10 is a no-op (idempotent)', async () => {
  const tables: Record<string, Row[]> = {
    matches: [{ ...V8_MATCH_ROW, captain_home_id: 'P5', captain_away_id: null }],
  };
  const db = new FakeMigrationDb(10, tables);

  await runMigrations(db as unknown as SQLite.SQLiteDatabase);

  expect(db.userVersion).toBe(10);
  // existing captain assignment from before must not be clobbered by a re-run
  expect(tables.matches[0].captain_home_id).toBe('P5');
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
