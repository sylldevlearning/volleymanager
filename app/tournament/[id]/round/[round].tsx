import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, CircleCheck } from 'lucide-react-native';
import { palette } from '../../../../src/theme/tokens';
import { getTournamentBundle, type TournamentBundle } from '../../../../src/services/tournamentService';
import { roundSummary } from '../../../../src/features/tournament/phases';

/**
 * "Tour N terminé": ranking of the mixing round and the pools of the next one.
 * Rebuilt from the results each time it is shown, so a correction is reflected.
 */
export default function TournamentRoundScreen() {
  const { id, round } = useLocalSearchParams<{ id: string; round: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const [bundle, setBundle] = useState<TournamentBundle | null>(null);
  const n = Number(round);

  useFocusEffect(useCallback(() => {
    let active = true;
    getTournamentBundle(id).then((b) => { if (active) setBundle(b); });
    return () => { active = false; };
  }, [id]));

  const summary = bundle ? roundSummary(bundle, n, t) : null;
  const inRound = bundle?.matches.filter((m) => m.phase === n) ?? [];
  const done = inRound.filter((m) => m.status === 'validated').length;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: summary?.complete ? t('tournament.round.titleDone', { n }) : t('tournament.round.titleLive', { n }) }} />
      {bundle && summary && (
        <ScrollView contentContainerStyle={styles.scroll}>
          {summary.complete ? (
            <View style={styles.banner}>
              <CircleCheck size={22} color={palette.success} />
              <Text style={styles.bannerText}>{t('tournament.round.titleDone', { n })}</Text>
            </View>
          ) : (
            <Text style={styles.hint}>{t('tournament.round.notDone', { done, total: inRound.length })}</Text>
          )}

          {summary.ranking.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('tournament.round.ranking', { n })}</Text>
              {summary.ranking.map((r) => (
                <View key={r.teamId} style={styles.row}>
                  <Text style={styles.rank}>{r.rank}</Text>
                  <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.pool}>{r.pool}</Text>
                </View>
              ))}
            </View>
          )}

          {summary.next?.kind === 'round' && (
            <>
              <Text style={styles.sectionTitle}>{t('tournament.round.nextPools', { n: summary.next.round })}</Text>
              <View style={styles.pools}>
                {summary.next.pools.map((p) => (
                  <View key={p.title} style={styles.poolCard}>
                    <Text style={styles.poolTitle}>{p.title}</Text>
                    {p.teams.map((team) => <Text key={team} style={styles.poolTeam} numberOfLines={1}>{team}</Text>)}
                  </View>
                ))}
              </View>
            </>
          )}

          {summary.next?.kind === 'levels' && (
            <Pressable style={({ pressed }) => [styles.link, pressed && styles.pressed]}
              onPress={() => router.push(`/tournament/${id}/levels`)} accessibilityRole="button">
              <Text style={styles.linkText}>{t('tournament.round.toLevels')}</Text>
              <ChevronRight size={18} color={palette.textPrimary} />
            </Pressable>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 16, gap: 12, paddingBottom: 32 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(46, 160, 67, 0.12)',
  },
  bannerText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: palette.success },
  hint: { fontSize: 15, fontFamily: 'Inter_400Regular', color: palette.textSecondary, lineHeight: 22 },
  card: {
    backgroundColor: palette.backgroundSurface, borderRadius: 14, borderWidth: 1,
    borderColor: palette.backgroundElevated, padding: 12,
  },
  cardTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: palette.textPrimary, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: 1, borderTopColor: palette.backgroundElevated },
  rank: { width: 28, fontSize: 16, fontFamily: 'Inter_700Bold', color: palette.textPrimary, textAlign: 'center' },
  name: { flex: 1, fontSize: 16, fontFamily: 'Inter_500Medium', color: palette.textPrimary },
  pool: { fontSize: 13, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: palette.textPrimary, marginTop: 6 },
  pools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  poolCard: {
    flexBasis: '47%', flexGrow: 1, padding: 12, borderRadius: 12, gap: 4,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  poolTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.textSecondary, textTransform: 'uppercase', marginBottom: 2 },
  poolTeam: { fontSize: 15, fontFamily: 'Inter_500Medium', color: palette.textPrimary },
  link: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 14,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: '#D4AF37',
  },
  linkText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  pressed: { opacity: 0.85 },
});
