import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { useScoringStore } from '../../stores/scoringStore';
import { SCHEMA_VERSION } from '../../services/database';
import {
  RESTORE_NAME,
  createSnapshot,
  dbFileUri,
  deleteSnapshot,
  restoreFromFile,
} from '../../services/backupService';
import { formatDate } from '../../i18n/format';
import { backupErrorOf, errorLabel, type BackupErrorKey } from './backupRules';
import { deleteBackup, downloadBackup, findBackup, uploadBackup, type DriveBackupFile } from './driveApi';
import { signIn, signOut } from './googleAccount';

/**
 * Settings › Google Drive backup: sign-in, back up now, restore (confirmed),
 * delete the online backup (confirmed), sign-out. Nothing runs without a tap.
 */
export function useDriveBackup() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const account = useSettingsStore((s) => s.driveAccount);
  const setAccount = useSettingsStore((s) => s.setDriveAccount);
  /** undefined: not known yet; null: no backup online */
  const [backup, setBackup] = useState<DriveBackupFile | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const when = (b: DriveBackupFile) => formatDate(b.appProperties?.savedAt ?? b.modifiedTime, i18n.language, 'dateTime');

  const showError = useCallback((key: BackupErrorKey) => {
    Alert.alert(t('backup.title'), t(`backup.errors.${key}`));
  }, [t]);

  const fail = useCallback((e: unknown, fallback?: BackupErrorKey) => {
    console.warn('Drive backup:', errorLabel(e));
    const key = backupErrorOf(e);
    if (key === 'signedOut') {
      setAccount(null);
      setBackup(undefined);
    }
    showError(key === 'generic' && fallback ? fallback : key);
  }, [setAccount, showError]);

  const run = useCallback(async (work: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  // Online backup of the signed-in account (quietly: no message if offline)
  useEffect(() => {
    if (!account) return;
    let active = true;
    findBackup()
      .then((found) => { if (active) setBackup(found); })
      .catch((e: unknown) => {
        if (!active) return;
        console.warn('Drive backup:', errorLabel(e));
        if (backupErrorOf(e) === 'signedOut') setAccount(null);
      });
    return () => { active = false; };
  }, [account, setAccount]);

  const connect = () => run(async () => {
    let email: string | null;
    try {
      email = await signIn();
    } catch (e) {
      console.warn('Google sign-in:', errorLabel(e));
      showError(backupErrorOf(e) === 'signedOut' ? 'signedOut' : 'connect');
      return;
    }
    if (email) {
      setBackup(undefined);
      setAccount(email);
    }
  });

  const backupNow = () => run(async () => {
    try {
      const uri = await createSnapshot();
      try {
        const saved = await uploadBackup(uri, {
          schemaVersion: String(SCHEMA_VERSION),
          savedAt: new Date().toISOString(),
        });
        setBackup(saved);
      } finally {
        deleteSnapshot();
      }
      Alert.alert(t('backup.doneTitle'), t('backup.doneBody'));
    } catch (e) {
      fail(e);
    }
  });

  const restore = () => {
    if (!backup) return;
    Alert.alert(t('backup.restoreConfirmTitle'), t('backup.restoreConfirmBody', { date: when(backup) }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('backup.restore'),
        style: 'destructive',
        onPress: () => void run(async () => {
          try {
            const uri = dbFileUri(RESTORE_NAME);
            await downloadBackup(backup.id, uri);
            await restoreFromFile(uri);
          } catch (e) {
            fail(e);
            return;
          }
          // Nothing from the previous data stays in memory
          useScoringStore.getState().reset();
          Alert.alert(t('backup.restoreDoneTitle'), t('backup.restoreDoneBody'));
          router.replace('/');
        }),
      },
    ]);
  };

  const deleteOnline = () => {
    if (!backup) return;
    Alert.alert(t('backup.deleteConfirmTitle'), t('backup.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => void run(async () => {
          try {
            await deleteBackup(backup.id);
          } catch (e) {
            fail(e);
            return;
          }
          setBackup(null);
          Alert.alert(t('backup.title'), t('backup.deletedBody'));
        }),
      },
    ]);
  };

  const disconnect = () => run(async () => {
    await signOut().catch((e: unknown) => console.warn('Google sign-out:', errorLabel(e)));
    setAccount(null);
    setBackup(undefined);
  });

  return {
    account,
    backup,
    lastBackupLabel: backup ? when(backup) : null,
    busy,
    connect,
    backupNow,
    restore,
    deleteOnline,
    disconnect,
  };
}
