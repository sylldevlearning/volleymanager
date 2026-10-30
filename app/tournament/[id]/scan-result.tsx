import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleAlert, TriangleAlert } from 'lucide-react-native';
import { palette } from '../../../src/theme/tokens';
import { QrScanner } from '../../../src/components/qr/QrScanner';
import { getTournamentBundle, recordTournamentResult, type TournamentBundle } from '../../../src/services/tournamentService';
import { checkResultQr, decodeResultQr, type ResultCheckError, type ResultQr, type ResultQrError } from '../../../src/features/tournament/matchQr';
import { evaluateScore, rulesForStage } from '../../../src/features/tournament/engine/results';
import { matchTitle, scoreErrorText, scoreText } from '../../../src/features/tournament/display';
import { justFinished, resultRoute } from '../../../src/features/tournament/phases';
import { showFinished } from '../../../src/components/tournament/showFinished';

/** Organiser: scans the referee's result QR, checks it, then records it like a typed score. */
export default function ScanResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const [bundle, setBundle] = useState<TournamentBundle | null>(null);
  const [result, setResult] = useState<ResultQr | null>(null);
  const [error, setError] = useState<ResultQrError | ResultCheckError | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getTournamentBundle(id).then(setBundle);
  }, [id]);

  const check = useMemo(() => (bundle && result ? checkResultQr(bundle, result) : null), [bundle, result]);
  const shownError = error ?? (check && !check.ok ? check.reason : null);
  const ready = check?.ok ? check : null;
  const rules = bundle && ready ? rulesForStage(bundle.tournament.rules, ready.match.stage) : null;
  const evaluation = ready && rules && result ? evaluateScore(result.sets, rules) : null;

  function handleScan(data: string) {
    const decoded = decodeResultQr(data);
    if (decoded.ok) setResult(decoded.result);
    else setError(decoded.reason);
  }

  function rescan() {
    setResult(null);
    setError(null);
  }

  async function save() {
    if (!bundle || !ready || !result || saving) return;
    setSaving(true);
    try {
      // Same path as a typed score: validation, bracket update, blocked corrections
      const outcome = await recordTournamentResult(id, ready.match.id, { sets: result.sets, forfeitId: null, source: 'qr' });
      if (outcome.ok) {
        const next = resultRoute(id, bundle, outcome.bundle, ready.match.id);
        // Teams with nothing left to play can leave: say so first
        showFinished(justFinished(bundle, outcome.bundle), t, () => {
          if (next) router.replace(next);
          else router.back();
        });
        return;
      }
      if (outcome.reason === 'blocked') {
        const titles = outcome.blockedBy
          .map((key) => bundle.matches.find((m) => m.id === key))
          .filter((m) => m !== undefined)
          .map((m) => matchTitle(m!, bundle, t));
        Alert.alert(t('tournament.score.blockedTitle'), t('tournament.score.blockedMessage', { matches: titles.join(', ') }));
      } else if (outcome.reason === 'invalid_score') {
        Alert.alert(t('common.error'), outcome.errors.map((e) => scoreErrorText(e, rules!, t)).join('\n'));
      } else {
        Alert.alert(t('common.error'), t('tournament.score.teamsUnknown'));
      }
    } finally {
      setSaving(false);
    }
  }

  function handleValidate() {
    if (!ready) return;
    if (!ready.alreadyPlayed) {
      save();
      return;
    }
    Alert.alert(
      t('scanResult.replaceTitle'),
      t('scanResult.replaceMessage', { score: scoreText(ready.match, t) ?? '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('scanResult.replace'), style: 'destructive', onPress: save },
      ],
    );
  }

  if (!bundle) return <SafeAreaView style={styles.container} edges={['bottom']} />;

  if (!result && !error) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <QrScanner aim={t('scanResult.aim')} onScan={handleScan} active />
      </SafeAreaView>
    );
  }

  const winner = evaluation?.ok && ready ? (evaluation.summary.winner === 'home' ? ready.home : ready.away) : null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {shownError && (
          <View style={styles.errorBox}>
            <CircleAlert size={22} color={palette.error} />
            <Text style={styles.errorText}>{t(`scanResult.errors.${shownError}`)}</Text>
          </View>
        )}

        {ready && result && (
          <View style={styles.card}>
            <Text style={styles.title}>{matchTitle(ready.match, bundle, t)}</Text>
            <View style={styles.headerRow}>
              <View style={styles.setLabel} />
              {[ready.home, ready.away].map((team) => (
                <View key={team.id} style={styles.teamHead}>
                  <View style={[styles.dot, { backgroundColor: team.color }]} />
                  <Text style={styles.teamName} numberOfLines={2}>{team.name}</Text>
                </View>
              ))}
            </View>
            {result.sets.map(([h, a], i) => (
              <View key={i} style={styles.setRow}>
                <Text style={styles.setLabel}>{t('tournament.score.set', { n: i + 1 })}</Text>
                <Text style={styles.setScore}>{h}</Text>
                <Text style={styles.setScore}>{a}</Text>
              </View>
            ))}
            {winner && <Text style={styles.winner}>{t('tournament.score.winner', { team: winner.name })}</Text>}
            {evaluation && !evaluation.ok && evaluation.errors.map((e, k) => (
              <Text key={k} style={styles.error}>• {scoreErrorText(e, rules!, t)}</Text>
            ))}
          </View>
        )}

        {ready && (ready.sameResult ? (
          <Text style={styles.info}>{t('scanResult.same')}</Text>
        ) : (
          <View style={styles.warning}>
            <TriangleAlert size={20} color={palette.warning} />
            <Text style={styles.warningText}>
              {t('scanResult.checkWarning')}
              {ready.alreadyPlayed ? `\n${t('scanResult.alreadyPlayed', { score: scoreText(ready.match, t) ?? '' })}` : ''}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {ready && !ready.sameResult && evaluation?.ok && (
          <Pressable
            style={({ pressed }) => [styles.primary, pressed && styles.pressed, saving && styles.disabled]}
            onPress={handleValidate}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryText}>{ready.alreadyPlayed ? t('scanResult.replace') : t('scanResult.validate')}</Text>}
          </Pressable>
        )}
        <Pressable style={({ pressed }) => [styles.secondary, pressed && styles.pressed]} onPress={rescan} accessibilityRole="button">
          <Text style={styles.secondaryText}>{t('scan.rescan')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 16, gap: 16 },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12,
    backgroundColor: 'rgba(230, 57, 70, 0.12)',
  },
  errorText: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: palette.textPrimary, lineHeight: 21 },
  card: {
    padding: 16, borderRadius: 16,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 16, marginBottom: 8 },
  teamHead: { flex: 1, alignItems: 'center', gap: 6 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  teamName: { fontSize: 15, fontFamily: 'Inter_700Bold', color: palette.textPrimary, textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  setLabel: { width: 52, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },
  setScore: { flex: 1, fontSize: 22, fontFamily: 'Inter_700Bold', color: palette.textPrimary, textAlign: 'center' },
  winner: { fontSize: 16, fontFamily: 'Inter_700Bold', color: palette.success, marginTop: 12 },
  error: { fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.error, marginTop: 8, lineHeight: 20 },
  warning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  warningText: { flex: 1, fontSize: 15, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary, lineHeight: 21 },
  info: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: palette.success, textAlign: 'center' },
  footer: { padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: palette.backgroundElevated },
  primary: { backgroundColor: palette.accentPrimary, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  primaryText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  secondary: { paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: palette.backgroundElevated },
  secondaryText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
