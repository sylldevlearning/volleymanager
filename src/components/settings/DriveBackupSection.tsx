import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CloudUpload, Cloud, History, LogOut, Trash2 } from 'lucide-react-native';
import { palette } from '../../theme/tokens';
import { useThemedStyles, useAccent, type AccentTheme } from '../../theme/useAccent';
import { useDriveBackup } from '../../features/backup/useDriveBackup';

/** Settings › Google Drive backup (Android only, optional). */
export function DriveBackupSection() {
  const { t } = useTranslation();
  const accent = useAccent();
  const styles = useThemedStyles(makeStyles);
  const drive = useDriveBackup();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('backup.title')}</Text>
      <View style={styles.card}>
        {!drive.account ? (
          <View style={styles.body}>
            <Text style={styles.text}>{t('backup.intro')}</Text>
            <Pressable
              style={({ pressed }) => [styles.primary, (pressed || drive.busy) && styles.dimmed]}
              onPress={drive.connect}
              disabled={drive.busy}
              accessibilityRole="button"
            >
              {drive.busy
                ? <ActivityIndicator color={accent.onFill} size="small" />
                : <Cloud size={18} color={accent.onFill} />}
              <Text style={styles.primaryText}>{t('backup.connect')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.body}>
              <Text style={styles.text} numberOfLines={1}>{t('backup.account', { email: drive.account })}</Text>
              <Text style={styles.muted}>
                {drive.backup === undefined
                  ? t('backup.checking')
                  : drive.lastBackupLabel
                    ? t('backup.lastBackup', { date: drive.lastBackupLabel })
                    : t('backup.noBackup')}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.primary, (pressed || drive.busy) && styles.dimmed]}
                onPress={drive.backupNow}
                disabled={drive.busy}
                accessibilityRole="button"
              >
                {drive.busy
                  ? <ActivityIndicator color={accent.onFill} size="small" />
                  : <CloudUpload size={18} color={accent.onFill} />}
                <Text style={styles.primaryText}>{t('backup.backupNow')}</Text>
              </Pressable>
              <Text style={styles.note}>{t('backup.notIncluded')}</Text>
            </View>
            {!!drive.backup && (
              <>
                <View style={styles.divider} />
                <Row icon={<History size={20} color={accent.color} />} label={t('backup.restore')} onPress={drive.restore} disabled={drive.busy} />
                <View style={styles.divider} />
                <Row
                  icon={<Trash2 size={20} color={palette.error} />}
                  label={t('backup.deleteOnline')}
                  labelColor={palette.error}
                  onPress={drive.deleteOnline}
                  disabled={drive.busy}
                />
              </>
            )}
            <View style={styles.divider} />
            <Row icon={<LogOut size={20} color={palette.textMuted} />} label={t('backup.disconnect')} onPress={drive.disconnect} disabled={drive.busy} />
          </>
        )}
      </View>
    </View>
  );
}

function Row({ icon, label, labelColor, onPress, disabled }: {
  icon: React.ReactNode;
  label: string;
  labelColor?: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && styles.dimmed]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      {icon}
      <Text style={[styles.rowLabel, labelColor ? { color: labelColor } : null]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (a: AccentTheme) => StyleSheet.create({
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: palette.backgroundSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    overflow: 'hidden',
  },
  body: { padding: 14, gap: 10 },
  text: { fontSize: 15, fontFamily: 'Inter_400Regular', color: palette.textPrimary },
  muted: { fontSize: 13, fontFamily: 'Inter_400Regular', color: palette.textSecondary },
  note: { fontSize: 12, fontFamily: 'Inter_400Regular', color: palette.textSecondary },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: a.fill,
    marginTop: 4,
  },
  primaryText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: a.onFill },
  dimmed: { opacity: 0.6 },
  divider: { height: 1, backgroundColor: palette.backgroundElevated, marginLeft: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowPressed: { backgroundColor: palette.backgroundElevated },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: palette.textPrimary },
});
