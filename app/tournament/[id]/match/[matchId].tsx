import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatClock } from '../../../../src/i18n/format';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircleCheck, Flag, Minus, Plus, QrCode } from 'lucide-react-native';
import { palette } from '../../../../src/theme/tokens';
import {
  getTournamentBundle,
  recordTournamentResult,
  type TournamentBundle,
  type TournamentResultInput,
} from '../../../../src/services/tournamentService';
import { evaluateScore, rulesForStage, type ScoreError } from '../../../../src/features/tournament/engine/results';
import { matchTitle, scoreErrorText, sideName } from '../../../../src/features/tournament/display';
import { justFinished, resultRoute } from '../../../../src/features/tournament/phases';
import { showFinished } from '../../../../src/components/tournament/showFinished';
import { matchQrOf } from '../../../../src/features/tournament/matchQr';
import type { SetScore, TournamentTeam } from '../../../../src/models/tournament';

type Row = [string, string];

/** Set rows as typed → scores ('' or not a number makes the score invalid). */
function parseRows(rows: Row[]): SetScore[] {
  return rows
    .filter(([h, a]) => h.trim() !== '' || a.trim() !== '')
    .map(([h, a]): SetScore => [h.trim() === '' ? NaN : Number(h), a.trim() === '' ? NaN : Number(a)]);
}

export default function TournamentMatchScreen() {
  const { id, matchId } = useLocalSearchParams<{ id: string; matchId: string }>();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [bundle, setBundle] = useState<TournamentBundle | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<ScoreError[]>([]);
  const [saving, setSaving] = useState(false);

  const match = bundle?.matches.find((m) => m.id === matchId) ?? null;
  const rules = bundle && match ? rulesForStage(bundle.tournament.rules, match.stage) : null;

  useEffect(() => {
    getTournamentBundle(id).then((b) => {
      setBundle(b);
      const m = b?.matches.find((x) => x.id === matchId);
      if (!b || !m) return;
      const r = rulesForStage(b.tournament.rules, m.stage);
      setRows(m.sets && !m.forfeitId
        ? m.sets.map(([h, a]): Row => [String(h), String(a)])
        : Array.from({ length: r.setsToWin }, (): Row => ['', '']));
    });
  }, [id, matchId]);

  const sets = useMemo(() => parseRows(rows), [rows]);
  const evaluation = useMemo(() => (rules ? evaluateScore(sets, rules) : null), [sets, rules]);

  if (!bundle || !match || !rules) return <SafeAreaView style={styles.container} edges={['bottom']} />;

  const teamOf = (teamId: string | null) => bundle.teams.find((x) => x.id === teamId) ?? null;
  const home = teamOf(match.homeId);
  const away = teamOf(match.awayId);
  const maxSets = rules.setsToWin * 2 - 1;
  const winner = evaluation?.ok ? (evaluation.summary.winner === 'home' ? home : away) : null;
  const isCorrection = match.status === 'validated';

  function setCell(i: number, side: 0 | 1, text: string) {
    setErrors([]);
    setRows((prev) => prev.map((row, k) => (k === i ? (side === 0 ? [text, row[1]] : [row[0], text]) : row)));
  }

  async function submit(input: Omit<TournamentResultInput, 'source'>) {
    if (saving) return;
    setSaving(true);
    try {
      const outcome = await recordTournamentResult(id, matchId, { ...input, source: 'manual' });
      if (outcome.ok) {
        // Last result of a mixing round: show the end of the round (or the levels after the last one)
        const next = resultRoute(id, bundle!, outcome.bundle, matchId);
        // Teams with nothing left to play can leave: say so first
        showFinished(justFinished(bundle!, outcome.bundle), t, () => {
          if (next) router.replace(next);
          else router.back();
        });
        return;
      }
      if (outcome.reason === 'invalid_score') {
        setErrors(outcome.errors);
      } else if (outcome.reason === 'blocked') {
        const titles = outcome.blockedBy
          .map((key) => bundle!.matches.find((m) => m.id === key))
          .filter((m) => m !== undefined)
          .map((m) => matchTitle(m!, bundle!, t));
        Alert.alert(t('tournament.score.blockedTitle'), t('tournament.score.blockedMessage', { matches: titles.join(', ') }));
      } else {
        Alert.alert(t('common.error'), t('tournament.score.teamsUnknown'));
      }
    } finally {
      setSaving(false);
    }
  }

  function handleValidate() {
    const result = { sets, forfeitId: null };
    if (!evaluation?.ok) {
      setErrors(evaluation && !evaluation.ok ? evaluation.errors : []);
      return;
    }
    if (!isCorrection) {
      submit(result);
      return;
    }
    Alert.alert(t('tournament.score.correctTitle'), t('tournament.score.correctMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('tournament.score.correct'), onPress: () => submit(result) },
    ]);
  }

  function handleForfeit(team: TournamentTeam) {
    Alert.alert(
      t('tournament.score.forfeitTitle', { team: team.name }),
      t('tournament.score.forfeitMessage', { team: team.name, score: `0-${rules!.setsToWin}` }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('tournament.score.forfeitOf', { team: team.name }), style: 'destructive', onPress: () => submit({ sets: [], forfeitId: team.id }) },
      ],
    );
  }

  const time = match.scheduledAt ? formatClock(match.scheduledAt.slice(11, 16), i18n.language) : undefined;
  const forfeitTeam = teamOf(match.forfeitId);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{matchTitle(match, bundle, t)}</Text>
          {time && match.court !== null && <Text style={styles.meta}>{t('tournament.score.scheduled', { time, court: match.court })}</Text>}
          <Text style={styles.meta}>
            {t('tournament.score.rules', { sets: rules.setsToWin, points: rules.pointsPerSet })}
            {rules.setsToWin > 1 && rules.tieBreak ? t('tournament.score.rulesTieBreak', { points: rules.pointsLastSet }) : ''}
          </Text>

          {/* Upcoming match with both teams known: the referee scans it to open a filled quick match */}
          {matchQrOf(bundle, match) && (
            <Pressable
              style={({ pressed }) => [styles.qrButton, pressed && styles.pressed]}
              onPress={() => router.push(`/tournament/${id}/qr/${matchId}`)}
              accessibilityRole="button"
            >
              <QrCode size={18} color={palette.textPrimary} />
              <Text style={styles.smallButtonText}>{t('tournament.qr.button')}</Text>
            </Pressable>
          )}

          {isCorrection && (
            <View style={styles.validated}>
              <CircleCheck size={18} color={palette.success} />
              <Text style={styles.validatedText}>
                {forfeitTeam ? t('tournament.score.forfeitResult', { team: forfeitTeam.name }) : t('tournament.score.validated')}
              </Text>
            </View>
          )}

          {!home || !away ? (
            <View style={styles.unknownBox}>
              <Text style={styles.teamsLine}>
                {sideName(match, 'home', bundle, t, i18n.language)} – {sideName(match, 'away', bundle, t, i18n.language)}
              </Text>
              <Text style={styles.hint}>{t('tournament.score.teamsUnknown')}</Text>
            </View>
          ) : (
            <>
              <View style={styles.headerRow}>
                <View style={styles.setLabel} />
                {[home, away].map((team) => (
                  <View key={team.id} style={styles.teamHead}>
                    <View style={[styles.dot, { backgroundColor: team.color }]} />
                    <Text style={styles.teamName} numberOfLines={2}>{team.name}</Text>
                  </View>
                ))}
              </View>

              {rows.map((row, i) => (
                <View key={i} style={styles.setRow}>
                  <Text style={styles.setLabel}>{t('tournament.score.set', { n: i + 1 })}</Text>
                  {[0, 1].map((side) => (
                    <TextInput
                      key={side}
                      style={styles.scoreInput}
                      value={row[side]}
                      onChangeText={(text) => setCell(i, side as 0 | 1, text.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="0"
                      placeholderTextColor={palette.textMuted}
                      accessibilityLabel={`${t('tournament.score.set', { n: i + 1 })} ${side === 0 ? home.name : away.name}`}
                    />
                  ))}
                </View>
              ))}

              <View style={styles.setActions}>
                {rows.length < maxSets && (
                  <Pressable style={styles.smallButton} onPress={() => setRows((r) => [...r, ['', '']])} accessibilityRole="button">
                    <Plus size={16} color={palette.textPrimary} />
                    <Text style={styles.smallButtonText}>{t('tournament.score.addSet')}</Text>
                  </Pressable>
                )}
                {rows.length > 1 && (
                  <Pressable style={styles.smallButton} onPress={() => setRows((r) => r.slice(0, -1))} accessibilityRole="button">
                    <Minus size={16} color={palette.textPrimary} />
                    <Text style={styles.smallButtonText}>{t('tournament.score.removeSet')}</Text>
                  </Pressable>
                )}
              </View>

              {winner && <Text style={styles.winner}>{t('tournament.score.winner', { team: winner.name })}</Text>}
              {errors.map((e, k) => <Text key={k} style={styles.error}>• {scoreErrorText(e, rules, t)}</Text>)}

              <View style={styles.forfeits}>
                {[home, away].map((team) => (
                  <Pressable key={team.id} style={styles.forfeitButton} onPress={() => handleForfeit(team)} accessibilityRole="button">
                    <Flag size={16} color={palette.warning} />
                    <Text style={styles.forfeitText} numberOfLines={1}>{t('tournament.score.forfeitOf', { team: team.name })}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        {home && away && (
          <View style={styles.footer}>
            <Pressable
              style={({ pressed }) => [styles.validate, pressed && styles.pressed, saving && styles.disabled]}
              onPress={handleValidate}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.validateText}>{isCorrection ? t('tournament.score.correct') : t('tournament.score.validate')}</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  meta: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textSecondary, marginTop: 4 },
  validated: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderRadius: 10,
    backgroundColor: 'rgba(46, 160, 67, 0.12)',
  },
  validatedText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: palette.success },
  unknownBox: { marginTop: 20, gap: 8 },
  teamsLine: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary },
  hint: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textSecondary, lineHeight: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 24, marginBottom: 8 },
  teamHead: { flex: 1, alignItems: 'center', gap: 6 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  teamName: { fontSize: 15, fontFamily: 'Inter_700Bold', color: palette.textPrimary, textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  setLabel: { width: 52, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },
  scoreInput: {
    flex: 1, height: 56, borderRadius: 12, textAlign: 'center',
    fontSize: 24, fontFamily: 'Inter_700Bold', color: palette.textPrimary,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  setActions: { flexDirection: 'row', gap: 8, marginTop: 4, marginLeft: 64 },
  smallButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  qrButton: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, marginTop: 12,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  smallButtonText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary },
  winner: { fontSize: 16, fontFamily: 'Inter_700Bold', color: palette.success, marginTop: 16 },
  error: { fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.error, marginTop: 8, lineHeight: 20 },
  forfeits: { flexDirection: 'row', gap: 8, marginTop: 28 },
  forfeitButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  forfeitText: { flexShrink: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: palette.warning },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: palette.backgroundElevated },
  validate: { backgroundColor: palette.accentPrimary, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  validateText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
