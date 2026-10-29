import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;
let _initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  if (!_initPromise) {
    _initPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('volleymanager.db');
      await runMigrations(db);
      _db = db;
      return db;
    })();
  }
  return _initPromise;
}

export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
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

  if (version < 3) {
    await db.withExclusiveTransactionAsync(async () => {
      // v3: seeding moved to seedService.seedDefaultDataIfEmpty() called at app startup
      await db.execAsync('PRAGMA user_version = 3');
    });
  }

  if (version < 4) {
    await db.withExclusiveTransactionAsync(async () => {
      // Make first_name / last_name nullable + add UNIQUE(team_id, number)
      // Idempotent: inspect current schema before acting
      const colInfo = await db.getAllAsync<{ name: string; notnull: number }>(
        'PRAGMA table_info(players)'
      );

      if (colInfo.length === 0) {
        // players table missing entirely — create with new schema
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            first_name TEXT,
            last_name TEXT,
            number INTEGER NOT NULL,
            position TEXT CHECK(position IN ('setter','outside','opposite','middle','libero','universal')),
            photo_uri TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(team_id, number)
          )
        `);
        await db.execAsync('CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id)');
      } else {
        const firstNameNotnull = colInfo.find(c => c.name === 'first_name')?.notnull ?? 0;
        if (firstNameNotnull === 1) {
          // Columns are still NOT NULL — migrate via rename/recreate
          // Guard: if players_old already exists (interrupted prior run), skip rename
          const oldExists = await db.getFirstAsync<{ name: string }>(
            `SELECT name FROM sqlite_master WHERE type='table' AND name='players_old'`
          );
          if (!oldExists) {
            await db.execAsync('ALTER TABLE players RENAME TO players_old');
          }
          await db.execAsync(`
            CREATE TABLE IF NOT EXISTS players (
              id TEXT PRIMARY KEY,
              team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
              first_name TEXT,
              last_name TEXT,
              number INTEGER NOT NULL,
              position TEXT CHECK(position IN ('setter','outside','opposite','middle','libero','universal')),
              photo_uri TEXT,
              is_active INTEGER DEFAULT 1,
              created_at TEXT DEFAULT (datetime('now')),
              UNIQUE(team_id, number)
            )
          `);
          await db.execAsync(`
            INSERT OR IGNORE INTO players
              (id, team_id, first_name, last_name, number, position, photo_uri, is_active, created_at)
            SELECT
              id, team_id, first_name, last_name, number, position, photo_uri, is_active, created_at
            FROM players_old
          `);
          await db.execAsync('DROP TABLE players_old');
          await db.execAsync('CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id)');
        }
        // else: first_name already nullable — schema is already correct, just bump version
      }

      await db.execAsync('PRAGMA user_version = 4');
    });
  }

  if (version < 5) {
    await db.withExclusiveTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS substitution_pairs (
          id TEXT PRIMARY KEY,
          match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
          set_id TEXT NOT NULL REFERENCES sets(id),
          team_id TEXT NOT NULL REFERENCES teams(id),
          player_out_id TEXT NOT NULL REFERENCES players(id),
          player_in_id TEXT NOT NULL REFERENCES players(id),
          is_libero INTEGER DEFAULT 0,
          is_cancelled INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_sub_pairs_match ON substitution_pairs(match_id, set_id, team_id);
        PRAGMA user_version = 5;
      `);
    });
  }

  if (version < 6) {
    await db.withExclusiveTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE matches ADD COLUMN first_serve_team_id TEXT REFERENCES teams(id);
        PRAGMA user_version = 6;
      `);
    });
  }

  if (version < 7) {
    await db.withExclusiveTransactionAsync(async () => {
      // Remove duplicate team names — keep the oldest row (smallest rowid)
      await db.execAsync(`
        DELETE FROM teams
        WHERE rowid NOT IN (
          SELECT MIN(rowid) FROM teams GROUP BY name
        )
      `);
      // Unique index prevents future duplicates
      await db.execAsync(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_name_unique ON teams(name)'
      );
      await db.execAsync('PRAGMA user_version = 7');
    });
  }

  if (version < 8) {
    await db.withExclusiveTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE players ADD COLUMN license_number TEXT;
        PRAGMA user_version = 8;
      `);
    });
  }

  if (version < 9) {
    await db.withExclusiveTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE substitution_pairs ADD COLUMN is_exceptional INTEGER DEFAULT 0;
        PRAGMA user_version = 9;
      `);
    });
  }

  if (version < 10) {
    await db.withExclusiveTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE matches ADD COLUMN captain_home_id TEXT REFERENCES players(id);
        ALTER TABLE matches ADD COLUMN captain_away_id TEXT REFERENCES players(id);
        ALTER TABLE sets ADD COLUMN serving_team_id TEXT REFERENCES teams(id);
        PRAGMA user_version = 10;
      `);
    });
  }

  if (version < 11) {
    await db.withExclusiveTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE teams ADD COLUMN coach_name TEXT;
        ALTER TABLE teams ADD COLUMN is_ad_hoc INTEGER DEFAULT 0;
        DROP INDEX IF EXISTS idx_teams_name_unique;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_name_unique ON teams(name) WHERE is_ad_hoc = 0;
        PRAGMA user_version = 11;
      `);
    });
  }

  if (version < 12) {
    await db.withExclusiveTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE matches ADD COLUMN sides_swapped INTEGER DEFAULT 0;
        ALTER TABLE matches ADD COLUMN acting_captain_home_id TEXT REFERENCES players(id);
        ALTER TABLE matches ADD COLUMN acting_captain_away_id TEXT REFERENCES players(id);
        PRAGMA user_version = 12;
      `);
    });
  }

  if (version < 13) {
    await db.withExclusiveTransactionAsync(async () => {
      // Libero jersey colour chosen in the match setup (null: app default)
      await db.execAsync(`
        ALTER TABLE teams ADD COLUMN libero_color TEXT;
        PRAGMA user_version = 13;
      `);
    });
  }

  if (version < 14) {
    await db.withExclusiveTransactionAsync(async () => {
      // Tournament mode — results of refereed matches stay in matches/match_events
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS tournaments (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          date TEXT NOT NULL,
          location TEXT,
          game_type TEXT NOT NULL,
          format TEXT NOT NULL,
          rules_json TEXT NOT NULL,
          schedule_json TEXT NOT NULL,
          seed INTEGER NOT NULL,
          seeding TEXT NOT NULL,
          secret TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'live',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tournament_pools (
          id TEXT PRIMARY KEY,
          tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          position INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tournament_teams (
          id TEXT PRIMARY KEY,
          tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
          team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          seed_rank INTEGER,
          pool_id TEXT REFERENCES tournament_pools(id) ON DELETE SET NULL,
          position INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tournament_matches (
          id TEXT PRIMARY KEY,
          tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
          stage TEXT NOT NULL,
          pool_id TEXT REFERENCES tournament_pools(id) ON DELETE CASCADE,
          round INTEGER NOT NULL,
          bracket_slot INTEGER,
          label TEXT,
          home_id TEXT REFERENCES tournament_teams(id),
          away_id TEXT REFERENCES tournament_teams(id),
          home_source TEXT NOT NULL,
          away_source TEXT NOT NULL,
          slot INTEGER,
          court INTEGER,
          scheduled_at TEXT,
          status TEXT NOT NULL DEFAULT 'scheduled',
          sets_json TEXT,
          forfeit_id TEXT REFERENCES tournament_teams(id),
          winner_id TEXT REFERENCES tournament_teams(id),
          result_source TEXT,
          arbitrage_match_id TEXT REFERENCES matches(id) ON DELETE SET NULL,
          validated_at TEXT,
          position INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
        CREATE TABLE IF NOT EXISTS tournament_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        PRAGMA user_version = 14;
      `);
    });
  }

  if (version < 15) {
    await db.withExclusiveTransactionAsync(async () => {
      // "Brassage + niveaux": mixing round / level of pools and matches
      await db.execAsync(`
        ALTER TABLE tournament_pools ADD COLUMN phase INTEGER;
        ALTER TABLE tournament_pools ADD COLUMN level INTEGER;
        ALTER TABLE tournament_matches ADD COLUMN phase INTEGER;
        ALTER TABLE tournament_matches ADD COLUMN level INTEGER;
        PRAGMA user_version = 15;
      `);
    });
  }

  if (version < 16) {
    // 4×4 and 3×3 in the arbitrage mode: matches.format had a CHECK limited to
    // 6×6 and beach, which SQLite cannot alter — the table is rebuilt with the
    // same columns, in the same order, and every row copied. Foreign keys are
    // off during the swap so dropping the old table touches nothing else.
    const fk = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
    await db.execAsync('PRAGMA foreign_keys = OFF');
    try {
      await db.withExclusiveTransactionAsync(async () => {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS matches_v16 (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL DEFAULT (datetime('now')),
            format TEXT NOT NULL CHECK(format IN ('indoor_6v6','indoor_4v4','indoor_3v3','beach_2v2')),
            mode TEXT NOT NULL CHECK(mode IN ('competition','leisure')),
            team_home_id TEXT NOT NULL REFERENCES teams(id),
            team_away_id TEXT NOT NULL REFERENCES teams(id),
            status TEXT DEFAULT 'created' CHECK(status IN ('created','live','paused','finished')),
            config_json TEXT DEFAULT '{}',
            winner_team_id TEXT REFERENCES teams(id),
            created_at TEXT DEFAULT (datetime('now')),
            finished_at TEXT,
            first_serve_team_id TEXT REFERENCES teams(id),
            captain_home_id TEXT REFERENCES players(id),
            captain_away_id TEXT REFERENCES players(id),
            sides_swapped INTEGER DEFAULT 0,
            acting_captain_home_id TEXT REFERENCES players(id),
            acting_captain_away_id TEXT REFERENCES players(id)
          );
          INSERT INTO matches_v16 (${MATCH_COLUMNS}) SELECT ${MATCH_COLUMNS} FROM matches;
          DROP TABLE matches;
          ALTER TABLE matches_v16 RENAME TO matches;
          PRAGMA user_version = 16;
        `);
      });
    } finally {
      if (fk?.foreign_keys) await db.execAsync('PRAGMA foreign_keys = ON');
    }
  }
}

const MATCH_COLUMNS = [
  'id', 'date', 'format', 'mode', 'team_home_id', 'team_away_id', 'status', 'config_json', 'winner_team_id',
  'created_at', 'finished_at', 'first_serve_team_id', 'captain_home_id', 'captain_away_id', 'sides_swapped',
  'acting_captain_home_id', 'acting_captain_away_id',
].join(', ');

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10);
}
