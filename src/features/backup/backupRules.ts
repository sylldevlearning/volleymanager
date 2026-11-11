import { DriveError } from './driveApi';
import { NotSignedInError } from './googleAccount';

export interface BackupFacts {
  /** Result of PRAGMA integrity_check ('ok' when sound) */
  integrity: string;
  /** PRAGMA user_version of the backup */
  userVersion: number;
  /** The backup has the VolleyManager matches table */
  hasMatches: boolean;
}

export type BackupCheck = { ok: true } | { ok: false; reason: 'newer' | 'damaged' };

/**
 * Can this database replace the phone's? It must be sound, be a VolleyManager
 * database, and not come from a newer app (its schema would be unknown here).
 * Older ones are brought up to date by the migrations when reopened.
 */
export function checkBackup(facts: BackupFacts, appSchemaVersion: number): BackupCheck {
  if (facts.integrity !== 'ok' || facts.userVersion < 1 || !facts.hasMatches) return { ok: false, reason: 'damaged' };
  if (facts.userVersion > appSchemaVersion) return { ok: false, reason: 'newer' };
  return { ok: true };
}

/** Message shown after a failed backup action (keys of backup.errors) */
export type BackupErrorKey = 'offline' | 'signedOut' | 'full' | 'newer' | 'damaged' | 'restoreFailed' | 'connect' | 'generic';

export function backupErrorOf(e: unknown): BackupErrorKey {
  if (e instanceof NotSignedInError) return 'signedOut';
  if (e instanceof DriveError) return e.reason === 'storageQuotaExceeded' ? 'full' : 'generic';
  // fetch rejects with a TypeError when there is no network
  if (e instanceof TypeError) return 'offline';
  if (e && typeof e === 'object' && 'reason' in e) {
    const reason = (e as { reason: unknown }).reason;
    if (reason === 'newer' || reason === 'damaged') return reason;
    if (reason === 'failed') return 'restoreFailed';
  }
  return 'generic';
}

/** Short label for the logs: never a token, an e-mail or file content */
export function errorLabel(e: unknown): string {
  if (e instanceof DriveError) return `DriveError ${e.status}${e.reason ? ` ${e.reason}` : ''}`;
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 120);
  return 'unknown error';
}
