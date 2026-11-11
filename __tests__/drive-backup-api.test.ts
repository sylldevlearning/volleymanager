jest.mock('../src/features/backup/googleAccount', () => ({
  accessToken: jest.fn(async () => 'token-1'),
  discardToken: jest.fn(async () => undefined),
  NotSignedInError: class NotSignedInError extends Error {},
}));

import { accessToken, discardToken } from '../src/features/backup/googleAccount';
import {
  BACKUP_FILE_NAME,
  DriveError,
  deleteBackup,
  downloadBackup,
  findBackup,
  setDriveTransport,
  uploadBackup,
  type DriveTransport,
} from '../src/features/backup/driveApi';
import { backupErrorOf } from '../src/features/backup/backupRules';

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };

function fakeTransport(responses: { status: number; body?: unknown }[]) {
  const calls: Call[] = [];
  const uploads: (Call & { fileUri: string })[] = [];
  const downloads: { url: string; destUri: string; headers: Record<string, string> }[] = [];
  const next = () => {
    const r = responses.shift() ?? { status: 200, body: {} };
    return { status: r.status, text: typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? {}) };
  };
  const transport: DriveTransport = {
    async request(url, init) {
      calls.push({ url, method: init.method ?? 'GET', headers: init.headers ?? {}, body: init.body });
      return next();
    },
    async upload(fileUri, url, init) {
      uploads.push({ url, method: init.httpMethod, headers: init.headers, fileUri });
      return next();
    },
    async download(url, destUri, headers) {
      downloads.push({ url, destUri, headers });
    },
  };
  return { transport, calls, uploads, downloads };
}

const backupMeta = {
  id: 'file-1',
  name: BACKUP_FILE_NAME,
  modifiedTime: '2026-11-11T10:00:00.000Z',
  size: '2048',
  appProperties: { schemaVersion: '16', savedAt: '2026-11-11T10:00:00.000Z' },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('findBackup', () => {
  it('looks only in the hidden app folder, for the backup file', async () => {
    const t = fakeTransport([{ status: 200, body: { files: [backupMeta] } }]);
    setDriveTransport(t.transport);
    await expect(findBackup()).resolves.toEqual(backupMeta);
    const url = new URL(t.calls[0].url);
    expect(url.searchParams.get('spaces')).toBe('appDataFolder');
    expect(url.searchParams.get('q')).toBe(`name = '${BACKUP_FILE_NAME}' and trashed = false`);
    expect(t.calls[0].headers.Authorization).toBe('Bearer token-1');
  });

  it('null when there is no backup yet', async () => {
    const t = fakeTransport([{ status: 200, body: { files: [] } }]);
    setDriveTransport(t.transport);
    await expect(findBackup()).resolves.toBeNull();
  });

  it('a refused token (401) is renewed once', async () => {
    (accessToken as jest.Mock).mockResolvedValueOnce('old').mockResolvedValueOnce('new');
    const t = fakeTransport([{ status: 401 }, { status: 200, body: { files: [] } }]);
    setDriveTransport(t.transport);
    await findBackup();
    expect(discardToken).toHaveBeenCalledWith('old');
    expect(t.calls[1].headers.Authorization).toBe('Bearer new');
  });

  it('other HTTP errors become a DriveError with the status and reason', async () => {
    const t = fakeTransport([{ status: 403, body: { error: { errors: [{ reason: 'storageQuotaExceeded' }] } } }]);
    setDriveTransport(t.transport);
    const error = await findBackup().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DriveError);
    expect(error).toMatchObject({ status: 403, reason: 'storageQuotaExceeded' });
  });
});

describe('uploadBackup', () => {
  const props = { schemaVersion: '16', savedAt: '2026-11-11T10:00:00.000Z' };

  it('first backup: creates the file in the hidden folder, then sends the content', async () => {
    const t = fakeTransport([
      { status: 200, body: { files: [] } },
      { status: 200, body: { id: 'new-id' } },
      { status: 200, body: { ...backupMeta, id: 'new-id' } },
    ]);
    setDriveTransport(t.transport);
    const saved = await uploadBackup('file:///db/vm-backup.db', props);

    expect(t.calls[1].method).toBe('POST');
    expect(JSON.parse(t.calls[1].body!)).toEqual({
      name: BACKUP_FILE_NAME,
      parents: ['appDataFolder'],
      mimeType: 'application/x-sqlite3',
      appProperties: props,
    });
    expect(t.uploads).toHaveLength(1);
    expect(t.uploads[0]).toMatchObject({ method: 'PATCH', fileUri: 'file:///db/vm-backup.db' });
    expect(t.uploads[0].url).toContain('/upload/drive/v3/files/new-id?uploadType=media');
    expect(t.uploads[0].headers['Content-Type']).toBe('application/x-sqlite3');
    expect(saved.id).toBe('new-id');
  });

  it('next backups replace the content and the properties of the same file', async () => {
    const t = fakeTransport([
      { status: 200, body: { files: [backupMeta] } },
      { status: 200, body: backupMeta },
      { status: 200, body: backupMeta },
    ]);
    setDriveTransport(t.transport);
    await uploadBackup('file:///db/vm-backup.db', props);
    expect(t.uploads[0].url).toContain('/files/file-1?uploadType=media');
    expect(t.calls[1]).toMatchObject({ method: 'PATCH' });
    expect(t.calls[1].url).toContain('/drive/v3/files/file-1?');
    expect(JSON.parse(t.calls[1].body!)).toEqual({ appProperties: props });
    expect(t.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('a failed content upload is an error', async () => {
    const t = fakeTransport([{ status: 200, body: { files: [backupMeta] } }, { status: 500 }]);
    setDriveTransport(t.transport);
    await expect(uploadBackup('file:///db/vm-backup.db', props)).rejects.toBeInstanceOf(DriveError);
  });
});

describe('downloadBackup and deleteBackup', () => {
  it('downloads the content with a fresh token', async () => {
    const t = fakeTransport([{ status: 200, body: backupMeta }]);
    setDriveTransport(t.transport);
    await downloadBackup('file-1', 'file:///db/vm-restore.db');
    expect(t.downloads[0]).toMatchObject({
      url: expect.stringContaining('/drive/v3/files/file-1?alt=media'),
      destUri: 'file:///db/vm-restore.db',
      headers: { Authorization: 'Bearer token-1' },
    });
  });

  it('deletes the file; already gone (404) is fine', async () => {
    const t = fakeTransport([{ status: 204, body: '' }, { status: 404 }]);
    setDriveTransport(t.transport);
    await deleteBackup('file-1');
    await deleteBackup('file-1');
    expect(t.calls.map((c) => c.method)).toEqual(['DELETE', 'DELETE']);
  });
});

describe('backupErrorOf', () => {
  it('maps failures to a message key', () => {
    expect(backupErrorOf(new DriveError(403, 'storageQuotaExceeded'))).toBe('full');
    expect(backupErrorOf(new TypeError('Network request failed'))).toBe('offline');
    expect(backupErrorOf(new DriveError(500))).toBe('generic');
    expect(backupErrorOf(new Error('?'))).toBe('generic');
  });
});
