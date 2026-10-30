import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleAlert } from 'lucide-react-native';
import { palette } from '../src/theme/tokens';
import { decodeMatchQr, type MatchQr, type MatchQrError } from '../src/features/tournament/matchQr';
import { createMatchFromQr } from '../src/services/qrMatchService';
import { QrScanner } from '../src/components/qr/QrScanner';

/** Referee: reads the "QR du match" of a tournament and opens a filled quick match. */
export default function ScanMatchQrScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [scanned, setScanned] = useState<MatchQr | null>(null);
  const [error, setError] = useState<MatchQrError | null>(null);
  const [starting, setStarting] = useState(false);

  function handleScan(data: string) {
    const decoded = decodeMatchQr(data);
    if (decoded.ok) setScanned(decoded.qr);
    else setError(decoded.reason);
  }

  function rescan() {
    setScanned(null);
    setError(null);
  }

  async function start() {
    if (!scanned || starting) return;
    setStarting(true);
    try {
      const match = await createMatchFromQr(scanned);
      router.replace(`/match/${match.id}/referee`);
    } catch {
      Alert.alert(t('common.error'), t('common.actionFailed'));
    } finally {
      setStarting(false);
    }
  }

  const r = scanned?.rules;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {!scanned && !error ? (
        <QrScanner aim={t('scan.aim')} onScan={handleScan} active={!scanned && !error} />
      ) : (
        <View style={[styles.flex, styles.result]}>
          {error && (
            <View style={styles.errorBox}>
              <CircleAlert size={22} color={palette.error} />
              <Text style={styles.errorText}>{t(`scan.errors.${error}`)}</Text>
            </View>
          )}
          {scanned && r && (
            <View style={styles.card}>
              <Text style={styles.format}>{t(`tournament.gameType.${scanned.format}`)}</Text>
              {[scanned.home, scanned.away].map((team, i) => (
                <View key={i} style={styles.teamRow}>
                  <View style={[styles.dot, { backgroundColor: team.color }]} />
                  <Text style={styles.teamName} numberOfLines={2}>{team.name}</Text>
                </View>
              ))}
              <Text style={styles.text}>
                {t('tournament.score.rules', { sets: r.setsToWin, points: r.pointsPerSet })}
                {r.setsToWin > 1 && r.tieBreak ? t('tournament.score.rulesTieBreak', { points: r.pointsLastSet }) : ''}
                {t('tournament.qr.lead', { margin: r.winMargin })}
              </Text>
            </View>
          )}
          <View style={styles.actions}>
            {scanned && (
              <Pressable
                style={({ pressed }) => [styles.primary, pressed && styles.pressed, starting && styles.disabled]}
                onPress={start}
                disabled={starting}
                accessibilityRole="button"
              >
                {starting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t('scan.start')}</Text>}
              </Pressable>
            )}
            <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={rescan} accessibilityRole="button">
              <Text style={styles.secondaryText}>{t('scan.rescan')}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  result: { padding: 16, justifyContent: 'center', gap: 16 },
  text: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textSecondary, lineHeight: 20, textAlign: 'center' },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12,
    backgroundColor: 'rgba(230, 57, 70, 0.12)',
  },
  errorText: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: palette.textPrimary, lineHeight: 21 },
  card: {
    padding: 16, borderRadius: 16, gap: 12,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  format: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary, textTransform: 'uppercase' },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  teamName: { flex: 1, fontSize: 18, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  actions: { gap: 10 },
  primary: { backgroundColor: palette.accentPrimary, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 14, alignItems: 'center', alignSelf: 'stretch' },
  primaryText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  secondary: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: palette.backgroundElevated },
  secondaryText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
