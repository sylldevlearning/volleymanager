import { File } from 'expo-file-system';
import { accessToken, discardToken } from './googleAccount';

/**
 * Google Drive REST API v3, limited to the app's hidden folder (appDataFolder,
 * drive.appdata scope). One file holds the backup: the whole SQLite database.
 * No server: the phone talks to Google directly over HTTPS.
 */
export const BACKUP_FILE_NAME = 'volleymanager-backup.db';
const MIME = 'application/x-sqlite3';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FIELDS = 'id,name,modifiedTime,size,appProperties';

/** Drive error (the body is never logged: it can quote the account) */
export class DriveError extends Error {
  constructor(readonly status: number, readonly reason?: string) {
    super(`Google Drive: HTTP ${status}${reason ? ` (${reason})` : ''}`);
    this.name = 'DriveError';
  }
}

export interface DriveBackupFile {
  id: string;
  name: string;
  modifiedTime: string; // ISO 8601
  size?: string;
  appProperties?: Record<string, string>;
}

interface RawResponse {
  status: number;
  text: string;
}

/** Network layer, replaced in the tests */
export interface DriveTransport {
  request(url: string, init: { method?: string; headers?: Record<string, string>; body?: string }): Promise<RawResponse>;
  upload(fileUri: string, url: string, init: { httpMethod: 'PATCH'; headers: Record<string, string> }): Promise<RawResponse>;
  download(url: string, destUri: string, headers: Record<string, string>): Promise<void>;
}

const nativeTransport: DriveTransport = {
  async request(url, init) {
    const response = await fetch(url, init);
    return { status: response.status, text: await response.text() };
  },
  async upload(fileUri, url, init) {
    const result = await new File(fileUri).upload(url, init);
    return { status: result.status, text: result.body };
  },
  async download(url, destUri, headers) {
    await File.downloadFileAsync(url, new File(destUri), { headers, idempotent: true });
  },
};

let transport = nativeTransport;

/** Tests: simulated network */
export function setDriveTransport(next: DriveTransport) {
  transport = next;
}

function reasonOf(text: string): string | undefined {
  try {
    const data = JSON.parse(text) as { error?: { errors?: { reason?: string }[] } };
    return data.error?.errors?.[0]?.reason;
  } catch {
    return undefined;
  }
}

/** Authenticated call; a refused token (401) is renewed once */
async function authed(send: (headers: Record<string, string>) => Promise<RawResponse>): Promise<RawResponse> {
  for (let attempt = 0; ; attempt++) {
    const token = await accessToken();
    const response = await send({ Authorization: `Bearer ${token}` });
    if (response.status === 401 && attempt === 0) {
      await discardToken(token);
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new DriveError(response.status, reasonOf(response.text));
    return response;
  }
}

const json = <T>(response: RawResponse) => JSON.parse(response.text) as T;

/** The backup in the hidden folder, or null */
export async function findBackup(): Promise<DriveBackupFile | null> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${BACKUP_FILE_NAME}' and trashed = false`,
    orderBy: 'modifiedTime desc',
    pageSize: '10',
    fields: `files(${FIELDS})`,
  });
  const response = await authed((headers) => transport.request(`${API}?${params}`, { headers }));
  return json<{ files?: DriveBackupFile[] }>(response).files?.[0] ?? null;
}

/**
 * Sends the database file: the same Drive file is replaced at every backup
 * (created the first time), with its schema version and date as properties.
 */
export async function uploadBackup(fileUri: string, appProperties: Record<string, string>): Promise<DriveBackupFile> {
  const existing = await findBackup();
  let id = existing?.id;
  if (!id) {
    const created = await authed((headers) =>
      transport.request(`${API}?fields=id`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ name: BACKUP_FILE_NAME, parents: ['appDataFolder'], mimeType: MIME, appProperties }),
      }),
    );
    id = json<{ id: string }>(created).id;
  }
  const fileId = encodeURIComponent(id);
  const uploaded = await authed((headers) =>
    transport.upload(fileUri, `${UPLOAD}/${fileId}?uploadType=media&fields=${FIELDS}`, {
      httpMethod: 'PATCH',
      headers: { ...headers, 'Content-Type': MIME },
    }),
  );
  if (!existing) return json<DriveBackupFile>(uploaded);
  const updated = await authed((headers) =>
    transport.request(`${API}/${fileId}?fields=${FIELDS}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ appProperties }),
    }),
  );
  return json<DriveBackupFile>(updated);
}

/** Downloads the backup content into destUri */
export async function downloadBackup(id: string, destUri: string): Promise<void> {
  const fileId = encodeURIComponent(id);
  // Metadata first: checks the file and renews a refused token before the download
  await authed((headers) => transport.request(`${API}/${fileId}?fields=id`, { headers }));
  const token = await accessToken();
  await transport.download(`${API}/${fileId}?alt=media`, destUri, { Authorization: `Bearer ${token}` });
}

export async function deleteBackup(id: string): Promise<void> {
  try {
    await authed((headers) => transport.request(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE', headers }));
  } catch (e) {
    if (e instanceof DriveError && e.status === 404) return; // already gone
    throw e;
  }
}
