import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('volleymanager.db');
  await runMigrations(_db);
  return _db;
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const current = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = current?.user_version ?? 0;

  if (version < 1) {
    await db.withExclusiveTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS teams (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          short_name TEXT,
          logo_uri TEXT,
          color TEXT DEFAULT '#1D4ED8',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS players (
          id TEXT PRIMARY KEY,
          team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          number INTEGER NOT NULL,
          position TEXT CHECK(position IN ('setter','outside','opposite','middle','libero','universal')),
          photo_uri TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS matches (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL DEFAULT (datetime('now')),
          format TEXT NOT NULL CHECK(format IN ('indoor_6v6','beach_2v2')),
          mode TEXT NOT NULL CHECK(mode IN ('competition','leisure')),
          team_home_id TEXT NOT NULL REFERENCES teams(id),
          team_away_id TEXT NOT NULL REFERENCES teams(id),
          status TEXT DEFAULT 'created' CHECK(status IN ('created','live','paused','finished')),
          config_json TEXT DEFAULT '{}',
          winner_team_id TEXT REFERENCES teams(id),
          created_at TEXT DEFAULT (datetime('now')),
          finished_at TEXT
        );

        CREATE TABLE IF NOT EXISTS sets (
          id TEXT PRIMARY KEY,
          match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
          set_number INTEGER NOT NULL,
          score_home INTEGER DEFAULT 0,
          score_away INTEGER DEFAULT 0,
          winner_team_id TEXT REFERENCES teams(id),
          started_at TEXT DEFAULT (datetime('now')),
          finished_at TEXT
        );

        CREATE TABLE IF NOT EXISTS match_events (
          id TEXT PRIMARY KEY,
          match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
          set_id TEXT NOT NULL REFERENCES sets(id),
          event_type TEXT NOT NULL,
          player_id TEXT REFERENCES players(id),
          team_id TEXT REFERENCES teams(id),
          timestamp TEXT DEFAULT (datetime('now','localtime')),
          details_json TEXT DEFAULT '{}',
          is_cancelled INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS lineups (
          id TEXT PRIMARY KEY,
          match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
          set_id TEXT NOT NULL REFERENCES sets(id),
          team_id TEXT NOT NULL REFERENCES teams(id),
          player_id TEXT NOT NULL REFERENCES players(id),
          position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 6),
          is_starter INTEGER DEFAULT 1,
          is_libero INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_events_match ON match_events(match_id);
        CREATE INDEX IF NOT EXISTS idx_events_set ON match_events(set_id);
        CREATE INDEX IF NOT EXISTS idx_events_player ON match_events(player_id);
        CREATE INDEX IF NOT EXISTS idx_lineups_match ON lineups(match_id, set_id, team_id);
        CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);

        PRAGMA user_version = 1;
      `);
    });
  }

  if (version < 2) {
    await db.withExclusiveTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS tactical_plays (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          format TEXT NOT NULL CHECK(format IN ('indoor_6v6','beach_2v2')),
          category TEXT DEFAULT 'custom' CHECK(category IN ('reception','attack','defense','coverage','serve','custom')),
          positions_json TEXT NOT NULL DEFAULT '[]',
          arrows_json TEXT NOT NULL DEFAULT '[]',
          is_default INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_plays_format ON tactical_plays(format);
        CREATE INDEX IF NOT EXISTS idx_plays_category ON tactical_plays(category);

        PRAGMA user_version = 2;
      `);
    });
  }
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10);
}
