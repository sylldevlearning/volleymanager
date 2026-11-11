/**
 * Local side of the Google Drive backup: snapshot of the SQLite file and
 * restoration (checks, swap, migrations, rollback). Files and SQLite are
 * simulated in memory.
 */
const mockFiles = new Map<string, string>();
const mockLog: string[] = [];

jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: string[]) {
      this.uri = parts.join('/');
    }
    get exists() { return mockFiles.has(this.uri); }
    get name() { return this.uri.split('/').pop(); }
    delete() {
      if (!mockFiles.has(this.uri)) throw new Error('missing');
      mockFiles.delete(this.uri);
      mockLog.push(`delete ${this.name}`);
    }
    copy(dest: File) {
      if (!mockFiles.has(this.uri)) throw new Error(`missing ${this.uri}`);
      mockFiles.set(dest.uri, mockFiles.get(this.uri)!);
      mockLog.push(`copy ${this.name} -> ${dest.name}`);
    }
  }
  return { File };
});

type FakeDbInfo = { integrity: string; userVersion: number; tables: readonly string[] };
const mockDbInfo = new Map<string, FakeDbInfo>();

jest.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: 'file:///data/SQLite',
  openDatabaseAsync: jest.fn(async (name: string) => {
    const content = mockFiles.get(`file:///data/SQLite/${name}`);
    const info = content ? mockDbInfo.get(content) : undefined;
    return {
      getFirstAsync: async (sql: string) => {
        if (!info) throw new Error('file is not a database');
        if (/integrity_check/.test(sql)) return { integrity_check: info.integrity };
        if (/user_version/.test(sql)) return { user_version: info.userVersion };
        return { n: info.tables.includes('matches') ? 1 : 0 };
      },
      closeAsync: async () => { mockLog.push(`close-check ${name}`); },
    };
  }),
}));

const mockMainDb = {
  databasePath: '/data/SQLite/volleymanager.db',
  runAsync: jest.fn(async (sql: string, params: string[]) => {
    mockLog.push(`${sql} ${params.join(',')}`);
    mockFiles.set(`file://${params[0]}`, mockFiles.get('file:///data/SQLite/volleymanager.db')!);
  }),
};
const mockReopen = jest.fn(async () => mockMainDb);

jest.mock('../src/services/database', () => ({
  DB_NAME: 'volleymanager.db',
  SCHEMA_VERSION: 16,
  getDb: jest.fn(async () => {
    mockLog.push('open');
    return mockReopen();
  }),
  closeDb: jest.fn(async () => { mockLog.push('close'); }),
}));

import { checkBackup } from '../src/features/backup/backupRules';
import {
  RestoreError,
  createSnapshot,
  dbFileUri,
  restoreFromFile,
} from '../src/services/backupService';

const DIR = 'file:///data/SQLite';
const good: FakeDbInfo = { integrity: 'ok', userVersion: 15, tables: ['teams', 'matches'] };

beforeEach(() => {
  mockFiles.clear();
  mockDbInfo.clear();
  mockLog.length = 0;
  mockReopen.mockClear();
  mockReopen.mockImplementation(async () => mockMainDb);
  mockFiles.set(`${DIR}/volleymanager.db`, 'phone-data');
  mockDbInfo.set('phone-data', { integrity: 'ok', userVersion: 16, tables: ['matches'] });
});

describe('checkBackup', () => {
  it('a VolleyManager database of this version or older is accepted', () => {
    expect(checkBackup({ integrity: 'ok', userVersion: 16, hasMatches: true }, 16)).toEqual({ ok: true });
    expect(checkBackup({ integrity: 'ok', userVersion: 9, hasMatches: true }, 16)).toEqual({ ok: true });
  });

  it('refused: newer app, damaged file, not a VolleyManager database', () => {
    expect(checkBackup({ integrity: 'ok', userVersion: 17, hasMatches: true }, 16)).toEqual({ ok: false, reason: 'newer' });
    expect(checkBackup({ integrity: 'row 3 missing', userVersion: 16, hasMatches: true }, 16)).toEqual({ ok: false, reason: 'damaged' });
    expect(checkBackup({ integrity: 'ok', userVersion: 0, hasMatches: false }, 16)).toEqual({ ok: false, reason: 'damaged' });
    expect(checkBackup({ integrity: 'ok', userVersion: 16, hasMatches: false }, 16)).toEqual({ ok: false, reason: 'damaged' });
  });
});

describe('createSnapshot', () => {
  it('copies the whole database (WAL included) with VACUUM INTO, next to it', async () => {
    mockFiles.set(`${DIR}/vm-backup.db`, 'old snapshot');
    const uri = await createSnapshot();
    expect(uri).toBe(`${DIR}/vm-backup.db`);
    expect(mockLog).toEqual([
      'open',
      'delete vm-backup.db',
      'VACUUM INTO ? /data/SQLite/vm-backup.db',
    ]);
    expect(mockFiles.get(uri)).toBe('phone-data');
  });
});

describe('restoreFromFile', () => {
  beforeEach(() => {
    mockFiles.set(`${DIR}/vm-restore.db`, 'backup-data');
    mockDbInfo.set('backup-data', good);
  });

  it('checks the backup, then closes, keeps a copy, swaps and reopens (migrations)', async () => {
    await restoreFromFile(dbFileUri('vm-restore.db'));
    expect(mockLog).toEqual([
      'close-check vm-restore.db',
      'close',
      'copy volleymanager.db -> volleymanager.before-restore.db',
      'copy vm-restore.db -> volleymanager.db',
      'open',
      'delete vm-restore.db',
    ]);
    expect(mockFiles.get(`${DIR}/volleymanager.db`)).toBe('backup-data');
    expect(mockFiles.get(`${DIR}/volleymanager.before-restore.db`)).toBe('phone-data');
  });

  it('stale WAL files of the old database are removed before the swap', async () => {
    mockFiles.set(`${DIR}/volleymanager.db-wal`, 'wal');
    mockFiles.set(`${DIR}/volleymanager.db-shm`, 'shm');
    await restoreFromFile(dbFileUri('vm-restore.db'));
    expect(mockFiles.has(`${DIR}/volleymanager.db-wal`)).toBe(false);
    expect(mockFiles.has(`${DIR}/volleymanager.db-shm`)).toBe(false);
    expect(mockLog.indexOf('delete volleymanager.db-wal')).toBeLessThan(mockLog.indexOf('copy vm-restore.db -> volleymanager.db'));
  });

  it.each([
    ['newer', { integrity: 'ok', userVersion: 17, tables: ['matches'] }],
    ['damaged', { integrity: 'corrupt', userVersion: 16, tables: ['matches'] }],
  ] as const)('a %s backup is refused and the phone data is not touched', async (reason, info) => {
    mockDbInfo.set('backup-data', info);
    const error = await restoreFromFile(dbFileUri('vm-restore.db')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RestoreError);
    expect(error).toMatchObject({ reason });
    expect(mockLog).not.toContain('close');
    expect(mockFiles.get(`${DIR}/volleymanager.db`)).toBe('phone-data');
  });

  it('a file that is not a database is refused as damaged', async () => {
    mockFiles.set(`${DIR}/vm-restore.db`, 'garbage');
    await expect(restoreFromFile(dbFileUri('vm-restore.db'))).rejects.toMatchObject({ reason: 'damaged' });
    expect(mockFiles.get(`${DIR}/volleymanager.db`)).toBe('phone-data');
  });

  it('if the restored database cannot be opened, the previous data is put back', async () => {
    mockReopen
      .mockImplementationOnce(async () => { throw new Error('migration failed'); })
      .mockImplementation(async () => mockMainDb);
    await expect(restoreFromFile(dbFileUri('vm-restore.db'))).rejects.toMatchObject({ reason: 'failed' });
    expect(mockFiles.get(`${DIR}/volleymanager.db`)).toBe('phone-data');
    expect(mockLog.slice(-4)).toEqual([
      'close',
      'copy volleymanager.before-restore.db -> volleymanager.db',
      'open',
      'delete vm-restore.db',
    ]);
  });
});
