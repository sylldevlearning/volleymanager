import * as SQLite from 'expo-sqlite';
import { File } from 'expo-file-system';
import { DB_NAME, SCHEMA_VERSION, closeDb, getDb } from './database';
import { checkBackup } from '../features/backup/backupRules';

/**
 * Local side of the Google Drive backup: a copy of the whole SQLite file is
 * sent, and a downloaded copy replaces the phone's database. All files sit
 * next to the database (SQLite.defaultDatabaseDirectory).
 */
export const SNAPSHOT_NAME = 'vm-backup.db';
export const RESTORE_NAME = 'vm-restore.db';
const PREVIOUS_NAME = 'volleymanager.before-restore.db';

export class RestoreError extends Error {
  constructor(readonly reason: 'newer' | 'damaged' | 'failed') {
    super(`Restore refused: ${reason}`);
    this.name = 'RestoreError';
  }
}

function dirUri(): string {
  const dir = String(SQLite.defaultDatabaseDirectory).replace(/\/+$/, '');
  return dir.startsWith('file:') ? dir : `file://${dir}`;
}

/** file:// URI of a file in the database folder */
export function dbFileUri(name: string): string {
  return `${dirUri()}/${name}`;
}

const fileAt = (name: string) => new File(dbFileUri(name));

function deleteIfExists(name: string) {
  const file = fileAt(name);
  if (file.exists) file.delete();
}

/**
 * Consistent copy of the database (pending WAL pages included) for the
 * upload; returns its URI. The caller deletes it afterwards.
 */
export async function createSnapshot(): Promise<string> {
  const db = await getDb();
  deleteIfExists(SNAPSHOT_NAME); // VACUUM INTO refuses an existing file
  const folder = db.databasePath.replace(/\/[^/]+$/, '');
  await db.runAsync('VACUUM INTO ?', [`${folder}/${SNAPSHOT_NAME}`]);
  return dbFileUri(SNAPSHOT_NAME);
}

export function deleteSnapshot() {
  deleteIfExists(SNAPSHOT_NAME);
}

async function inspect(name: string) {
  let check: SQLite.SQLiteDatabase | null = null;
  try {
    check = await SQLite.openDatabaseAsync(name);
    const integrity = await check.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    const version = await check.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const matches = await check.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'matches'",
    );
    return checkBackup(
      {
        integrity: integrity?.integrity_check ?? '',
        userVersion: version?.user_version ?? 0,
        hasMatches: (matches?.n ?? 0) > 0,
      },
      SCHEMA_VERSION,
    );
  } catch {
    return { ok: false as const, reason: 'damaged' as const };
  } finally {
    await check?.closeAsync().catch(() => {});
  }
}

function swapIn(source: string) {
  for (const suffix of ['-wal', '-shm', '-journal']) deleteIfExists(DB_NAME + suffix);
  fileAt(source).copy(fileAt(DB_NAME));
}

/**
 * Replaces the phone's database with the downloaded backup at `uri`
 * (RESTORE_NAME in the database folder). Refused before anything changes if
 * the backup is damaged or newer. The current database is kept as a copy and
 * put back if the restored one cannot be opened (migrations included).
 */
export async function restoreFromFile(uri: string): Promise<void> {
  const name = uri.split('/').pop()!;
  try {
    const check = await inspect(name);
    if (!check.ok) throw new RestoreError(check.reason);

    await closeDb();
    fileAt(DB_NAME).copy(fileAt(PREVIOUS_NAME));
    swapIn(name);
    try {
      await getDb(); // reopens and runs the migrations (older backups)
    } catch {
      await closeDb();
      swapIn(PREVIOUS_NAME);
      await getDb();
      throw new RestoreError('failed');
    }
  } finally {
    deleteIfExists(name);
  }
}
