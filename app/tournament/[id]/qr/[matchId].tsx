import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { palette } from '../../../../src/theme/tokens';
import { getTournamentBundle, type TournamentBundle } from '../../../../src/services/tournamentService';
import { matchTitle } from '../../../../src/features/tournament/display';
import { encodeMatchQr, matchQrOf } from '../../../../src/features/tournament/matchQr';

/** Organiser: QR of an upcoming match, scanned by the referee to open a filled quick match. */
export default function TournamentMatchQrScreen() {
  const { id, matchId } = useLocalSearchParams<{ id: string; matchId: string }>();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [bundle, setBundle] = useState<TournamentBundle | null>(null);

  useEffect(() => {
    getTournamentBundle(id).then(setBundle);
  }, [id]);

  const match = bundle?.matches.find((m) => m.id === matchId) ?? null;
  const qr = bundle && match ? matchQrOf(bundle, match) : null;
  if (!bundle || !match || !qr) return <SafeAreaView style={styles.container} edges={['bottom']} />;

  const r = qr.rules;
  const size = Math.min(width - 80, 320);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{matchTitle(match, bundle, t)}</Text>
        <View style={styles.teams}>
          {[qr.home, qr.away].map((team, i) => (
            <View key={i} style={styles.teamRow}>
              <View style={[styles.dot, { backgroundColor: team.color }]} />
              <Text style={styles.teamName} numberOfLines={2}>{team.name}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.meta}>
          {t(`tournament.gameType.${qr.format}`)} · {t('tournament.score.rules', { sets: r.setsToWin, points: r.pointsPerSet })}
          {r.setsToWin > 1 && r.tieBreak ? t('tournament.score.rulesTieBreak', { points: r.pointsLastSet }) : ''}
          {t('tournament.qr.lead', { margin: r.winMargin })}
        </Text>

        {/* White background and margin: readable by the camera even on a dark screen */}
        <View style={styles.qrBox}>
          <QRCode value={encodeMatchQr(qr)} size={size} color="#000000" backgroundColor="#FFFFFF" ecl="M" />
        </View>
        <Text style={styles.scanWith}>{t('tournament.qr.scanWith')}</Text>
        <Text style={styles.hint}>{t('tournament.qr.hint')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 16, paddingBottom: 32, alignItems: 'center' },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', color: palette.textPrimary, textAlign: 'center' },
  teams: { marginTop: 12, gap: 6, alignSelf: 'stretch' },
  teamRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  teamName: { flexShrink: 1, fontSize: 16, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary },
  meta: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textSecondary, marginTop: 8, textAlign: 'center' },
  qrBox: { marginTop: 20, padding: 20, borderRadius: 16, backgroundColor: '#FFFFFF' },
  scanWith: { fontSize: 16, fontFamily: 'Inter_700Bold', color: palette.textPrimary, marginTop: 16, textAlign: 'center' },
  hint: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textSecondary, marginTop: 8, lineHeight: 20, textAlign: 'center' },
});
