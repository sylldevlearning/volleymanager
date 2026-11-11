import {
  GoogleSignin,
  isCancelledResponse,
  isErrorWithCode,
  isNoSavedCredentialFoundResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

/**
 * Google account for the optional Drive backup (taken from DoFirst).
 *
 * Only the drive.appdata scope is asked: the app sees its own hidden folder
 * of the user's Drive (appDataFolder), never the user's files. Tokens stay in
 * the library (native Google Sign-In): the app never stores or logs them.
 */
export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

/** Android only: no iOS OAuth client is configured */
export const isDriveAvailable = () => Platform.OS === 'android';

/** Access refused or withdrawn: the user must sign in again */
export class NotSignedInError extends Error {}

let configured = false;
function configure() {
  if (configured) return;
  GoogleSignin.configure({ scopes: [DRIVE_APPDATA_SCOPE] });
  configured = true;
}

/** Google sign-in window; the account e-mail, or null when the user cancels */
export async function signIn(): Promise<string | null> {
  configure();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  try {
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return null;
    // Scope unticked on the consent screen: no Drive access
    const scopes = response.data.scopes ?? [];
    if (scopes.length > 0 && !scopes.includes(DRIVE_APPDATA_SCOPE)) {
      await GoogleSignin.signOut().catch(() => {});
      throw new NotSignedInError('drive.appdata refused');
    }
    return response.data.user.email;
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) {
      return null;
    }
    throw e;
  }
}

/** Session restored without a window (after the app restarts) */
async function ensureSignedIn(): Promise<void> {
  configure();
  if (GoogleSignin.getCurrentUser()) return;
  const response = await GoogleSignin.signInSilently();
  if (isNoSavedCredentialFoundResponse(response)) throw new NotSignedInError('no Google session');
}

/** Current access token (renewed by the library when needed) */
export async function accessToken(): Promise<string> {
  try {
    await ensureSignedIn();
    return (await GoogleSignin.getTokens()).accessToken;
  } catch (e) {
    if (e instanceof NotSignedInError) throw e;
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_REQUIRED) throw new NotSignedInError('session expired');
    throw e;
  }
}

/** Token refused by Drive (401): dropped from the cache so the next one is fresh */
export async function discardToken(token: string): Promise<void> {
  await GoogleSignin.clearCachedAccessToken(token).catch(() => {});
}

/** Sign-out: the library forgets the account and its tokens */
export async function signOut(): Promise<void> {
  configure();
  await GoogleSignin.signOut();
}
