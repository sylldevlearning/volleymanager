import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';

import { getPlayerCareerStats, type PlayerCareerStats } from '../../../src/services/statsService';
import { RadarChart } from '../../../src/components/stats/RadarChart';
import { LineChart } from '../../../src/components/charts/LineChart';
import { StatCard } from '../../../src/components/charts/StatCard';
import { palette } from '../../../src/theme/tokens';

type EvolutionKey = 'attack' | 'reception' | 'serve' | 'defense';

export default function PlayerCareerScreen() {
  const { id: playerId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const [career, setCareer] = useState<PlayerCareerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<EvolutionKey>('attack');

  useEffect(() => {
    async function load() {
      if (!playerId) return;
      try {
        const c = await getPlayerCareerStats(playerId);
        setCareer(c);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [playerId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accentPrimary} />
      </View>
    );
  }

  if (!career || career.matchCount === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
            <ArrowLeft size={22} color={palette.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>{career?.playerName ?? t('stats.career.title')}</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>{t('stats.noMatches')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const avg = career.averages;

  const radarMetrics = [
    { label: t('stats.categories.attack'), value: avg.attackEfficiency },
    { label: t('stats.categories.serve'), value: avg.serveEfficiency },
    { label: t('stats.categories.block'), value: avg.blockEfficiency },
    { label: t('stats.categories.reception'), value: avg.receptionPositive },
    { label: t('stats.categories.defense'), value: avg.defenseEfficiency },
    { label: t('stats.categories.setting'), value: avg.setEfficiency },
  ];
  const hasRadarData = radarMetrics.some((m) => m.value > 0);

  const evolutionKeys: { key: EvolutionKey; label: string }[] = [
    { key: 'attack', label: t('stats.categories.attack') },
    { key: 'reception', label: t('stats.categories.reception') },
    { key: 'serve', label: t('stats.categories.serve') },
    { key: 'defense', label: t('stats.categories.defense') },
  ];

  function getEvolutionValue(h: PlayerCareerStats['history'][0], key: EvolutionKey): number {
    switch (key) {
      case 'attack': return h.stats.attackEfficiency;
      case 'reception': return h.stats.receptionPositive;
      case 'serve': return h.stats.serveEfficiency;
      case 'defense': return h.stats.defenseEfficiency;
    }
  }

  const lineData = career.history.slice().reverse().map((h) => ({
    label: new Date(h.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    value: getEvolutionValue(h, activeKey),
  }));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <ArrowLeft size={22} color={palette.textSecondary} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{career.playerName}</Text>
          <Text style={styles.headerSub}>
            {t('stats.career.matchesPlayed', { count: career.matchCount })}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Average summary */}
        <View style={styles.summaryRow}>
          <StatCard label={t('stats.attackStats.kills')} value={avg.attackKill} />
          <StatCard label={t('stats.serveStats.aces')} value={avg.serveAce} />
          <StatCard label={t('stats.summary.plusMinus')} value={avg.plusMinus >= 0 ? `+${avg.plusMinus}` : `${avg.plusMinus}`} />
        </View>

        {/* Radar */}
        {hasRadarData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('stats.career.averages')}</Text>
            <View style={styles.radarWrap}>
              <RadarChart metrics={radarMetrics} size={200} color={palette.accentSecondary} />
            </View>
          </View>
        )}

        {/* Evolution line chart */}
        {lineData.length >= 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('stats.career.evolution')}</Text>
            <View style={styles.toggleRow}>
              {evolutionKeys.map(({ key, label }) => (
                <Pressable
                  key={key}
                  style={[styles.toggleChip, activeKey === key && styles.toggleChipActive]}
                  onPress={() => setActiveKey(key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: activeKey === key }}
                >
                  <Text style={[styles.toggleLabel, activeKey === key && styles.toggleLabelActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.lineWrap}>
              <LineChart data={lineData} color={palette.accentSecondary} height={120} />
            </View>
          </View>
        )}

        {/* Records */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('stats.career.records')}</Text>
          <RecordRow
            label={t('stats.career.mostKills')}
            value={career.records.mostKills.value}
            date={career.records.mostKills.matchDate}
          />
          <RecordRow
            label={t('stats.career.mostAces')}
            value={career.records.mostAces.value}
            date={career.records.mostAces.matchDate}
          />
          <RecordRow
            label={t('stats.career.bestEfficiency')}
            value={career.records.bestEfficiency.value}
            suffix="%"
            date={career.records.bestEfficiency.matchDate}
          />
          <RecordRow
            label={t('stats.career.worstMatch')}
            value={career.records.worstEfficiency.value}
            suffix="%"
            date={career.records.worstEfficiency.matchDate}
          />
        </View>

        {/* Match history */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('stats.career.matchHistory')}</Text>
          {career.history.map((h) => (
            <Pressable
              key={h.matchId}
              style={({ pressed }) => [styles.historyRow, pressed && styles.historyRowPressed]}
              onPress={() => router.push(`/match/${h.matchId}/stats` as never)}
              accessibilityRole="button"
            >
              <View style={styles.historyLeft}>
                <Text style={styles.historyDate}>
                  {new Date(h.date).toLocaleDateString()}
                </Text>
                <Text style={styles.historyOpponent} numberOfLines={1}>
                  vs {h.opponentName}
                </Text>
              </View>
              <View style={styles.historyRight}>
                <Text style={styles.historyPoints}>{h.stats.totalPoints} pts</Text>
                <Text style={styles.historyEff}>{h.stats.attackEfficiency}%</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RecordRow({
  label,
  value,
  suffix = '',
  date,
}: {
  label: string;
  value: number;
  suffix?: string;
  date: string;
}) {
  return (
    <View style={styles.recordRow}>
      <Text style={styles.recordLabel}>{label}</Text>
      <View style={styles.recordRight}>
        <Text style={styles.recordValue}>{value}{suffix}</Text>
        {date && (
          <Text style={styles.recordDate}>{new Date(date).toLocaleDateString()}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: palette.textSecondary, marginTop: 2 },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  section: {
    backgroundColor: palette.backgroundSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  radarWrap: { alignItems: 'center', paddingVertical: 12 },
  toggleRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  toggleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: palette.backgroundElevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toggleChipActive: {
    borderColor: palette.accentSecondary,
    backgroundColor: `${palette.accentSecondary}20`,
  },
  toggleLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  toggleLabelActive: { color: palette.accentSecondary },
  lineWrap: { paddingHorizontal: 4, paddingVertical: 8 },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  recordLabel: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', color: palette.textSecondary },
  recordRight: { alignItems: 'flex-end', gap: 2 },
  recordValue: { fontSize: 16, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  recordDate: { fontSize: 10, fontFamily: 'Inter_400Regular', color: palette.textMuted },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  historyRowPressed: { opacity: 0.7 },
  historyLeft: { gap: 2 },
  historyDate: { fontSize: 12, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  historyOpponent: { fontSize: 12, fontFamily: 'Inter_400Regular', color: palette.textSecondary },
  historyRight: { alignItems: 'flex-end', gap: 2 },
  historyPoints: { fontSize: 14, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  historyEff: { fontSize: 12, fontFamily: 'Inter_500Medium', color: palette.textMuted },
  emptyText: { color: palette.textMuted, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
