import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable } from 'react-native';

import {
  getPlayerMatchStats,
  getPlayerSetStats,
  type PlayerMatchStats,
} from '../../../../src/services/statsService';
import { getMatchById } from '../../../../src/services/matchService';
import { getTeamById } from '../../../../src/services/teamService';
import { getPlayerById } from '../../../../src/services/playerService';
import type { Player } from '../../../../src/models/player';
import type { Team } from '../../../../src/models/team';
import { RadarChart } from '../../../../src/components/stats/RadarChart';
import { ProgressBar } from '../../../../src/components/charts/ProgressBar';
import { LineChart } from '../../../../src/components/charts/LineChart';
import { StatCard } from '../../../../src/components/charts/StatCard';
import { palette } from '../../../../src/theme/tokens';
import { getPlayerDisplayName } from '../../../../src/features/players/player-helpers';

export default function PlayerStatsScreen() {
  const { id: matchId, playerId } = useLocalSearchParams<{ id: string; playerId: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const [stats, setStats] = useState<PlayerMatchStats | null>(null);
  const [perSetStats, setPerSetStats] = useState<Map<number, PlayerMatchStats>>(new Map());
  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [matchDate, setMatchDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!matchId || !playerId) return;
      try {
        const [s, ss, p, m] = await Promise.all([
          getPlayerMatchStats(matchId, playerId),
          getPlayerSetStats(matchId, playerId),
          getPlayerById(playerId),
          getMatchById(matchId),
        ]);
        setStats(s);
        setPerSetStats(ss);
        setPlayer(p);
        if (m) {
          setMatchDate(new Date(m.date).toLocaleDateString());
          if (p) {
            const t2 = await getTeamById(p.teamId);
            setTeam(t2);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [matchId, playerId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accentPrimary} />
      </View>
    );
  }

  if (!stats || !player) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('stats.noData')}</Text>
      </View>
    );
  }

  const teamColor = team?.color ?? palette.accentSecondary;
  const displayName = getPlayerDisplayName(player);
  const position = player.position ? t(`player.positions.${player.position}`) : '';

  const radarMetrics = [
    { label: t('stats.categories.attack'), value: stats.attackEfficiency },
    { label: t('stats.categories.serve'), value: stats.serveEfficiency },
    { label: t('stats.categories.block'), value: stats.blockEfficiency },
    { label: t('stats.categories.reception'), value: stats.receptionPositive },
    { label: t('stats.categories.defense'), value: stats.defenseEfficiency },
    { label: t('stats.categories.setting'), value: stats.setEfficiency },
  ];
  const hasRadarData = radarMetrics.some((m) => m.value > 0);

  // Set progression data
  const setNumbers = Array.from(perSetStats.keys()).sort((a, b) => a - b);
  const lineData = setNumbers.map((n) => ({
    label: `S${n}`,
    value: perSetStats.get(n)?.attackEfficiency ?? 0,
  }));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <ArrowLeft size={22} color={palette.textSecondary} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.playerName}>#{player.number} {displayName}</Text>
          <Text style={styles.playerMeta}>
            {[position, team?.name, matchDate].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Summary row */}
        <View style={styles.summaryRow}>
          <StatCard
            label={t('stats.summary.points')}
            value={stats.totalPoints}
            accent={palette.success}
          />
          <StatCard
            label={t('stats.summary.faults')}
            value={stats.totalFaults}
            accent={palette.error}
          />
          <StatCard
            label={t('stats.summary.plusMinus')}
            value={stats.plusMinus >= 0 ? `+${stats.plusMinus}` : `${stats.plusMinus}`}
            accent={stats.plusMinus >= 0 ? palette.success : palette.error}
          />
        </View>

        {/* Radar */}
        {hasRadarData && (
          <View style={styles.section}>
            <SectionTitle title={t('stats.efficiency')} />
            <View style={styles.radarWrap}>
              <RadarChart metrics={radarMetrics} size={200} color={teamColor} />
            </View>
          </View>
        )}

        {/* Attack detail */}
        {stats.attackTotal > 0 && (
          <View style={styles.section}>
            <SectionTitle title={t('stats.categories.attack')} extra={`${stats.attackKill}/${stats.attackTotal}`} />
            <View style={styles.catBody}>
              <ProgressBar value={stats.attackEfficiency} showLabel={false} />
              <View style={styles.detailRow}>
                <DetailStat label={t('stats.attackStats.kills')} value={stats.attackKill} />
                <DetailStat label={t('stats.attackStats.faults')} value={stats.attackFault} />
                <DetailStat label={t('stats.attackStats.defended')} value={stats.attackDefended} />
              </View>
            </View>
          </View>
        )}

        {/* Serve detail */}
        {stats.serveTotal > 0 && (
          <View style={styles.section}>
            <SectionTitle title={t('stats.categories.serve')} extra={`${stats.serveAce}/${stats.serveTotal}`} />
            <View style={styles.catBody}>
              <ProgressBar value={stats.serveEfficiency} showLabel={false} />
              <View style={styles.detailRow}>
                <DetailStat label={t('stats.serveStats.aces')} value={stats.serveAce} />
                <DetailStat label={t('stats.serveStats.faults')} value={stats.serveFault} />
                <DetailStat label={t('stats.serveStats.inPlay')} value={stats.serveIn} />
              </View>
            </View>
          </View>
        )}

        {/* Block detail */}
        {stats.blockTotal > 0 && (
          <View style={styles.section}>
            <SectionTitle title={t('stats.categories.block')} extra={`${stats.blockKill}/${stats.blockTotal}`} />
            <View style={styles.catBody}>
              <ProgressBar value={stats.blockEfficiency} showLabel={false} />
              <View style={styles.detailRow}>
                <DetailStat label={t('stats.blockStats.kills')} value={stats.blockKill} />
                <DetailStat label={t('stats.blockStats.touches')} value={stats.blockTouch} />
                <DetailStat label={t('stats.blockStats.faults')} value={stats.blockFault} />
              </View>
            </View>
          </View>
        )}

        {/* Reception detail */}
        {stats.receptionTotal > 0 && (
          <View style={styles.section}>
            <SectionTitle title={t('stats.categories.reception')} extra={`${stats.receptionA + stats.receptionB}/${stats.receptionTotal}`} />
            <View style={styles.catBody}>
              <ProgressBar value={stats.receptionPositive} showLabel={false} />
              <View style={styles.detailRow}>
                <DetailStat label="A" value={stats.receptionA} />
                <DetailStat label="B" value={stats.receptionB} />
                <DetailStat label="C" value={stats.receptionC} />
                <DetailStat label="D" value={stats.receptionD} />
              </View>
            </View>
          </View>
        )}

        {/* Defense detail */}
        {stats.defenseTotal > 0 && (
          <View style={styles.section}>
            <SectionTitle title={t('stats.categories.defense')} extra={`${stats.defenseSuccess}/${stats.defenseTotal}`} />
            <View style={styles.catBody}>
              <ProgressBar value={stats.defenseEfficiency} showLabel={false} />
              <View style={styles.detailRow}>
                <DetailStat label={t('stats.defenseStats.success')} value={stats.defenseSuccess} />
                <DetailStat label={t('stats.defenseStats.faults')} value={stats.defenseFault} />
              </View>
            </View>
          </View>
        )}

        {/* Setting detail */}
        {stats.setTotal > 0 && (
          <View style={styles.section}>
            <SectionTitle title={t('stats.categories.setting')} extra={`${stats.setPerfect + stats.setGood}/${stats.setTotal}`} />
            <View style={styles.catBody}>
              <ProgressBar value={stats.setEfficiency} showLabel={false} />
              <View style={styles.detailRow}>
                <DetailStat label={t('stats.settingStats.perfect')} value={stats.setPerfect} />
                <DetailStat label={t('stats.settingStats.good')} value={stats.setGood} />
                <DetailStat label={t('stats.settingStats.bad')} value={stats.setBad} />
              </View>
            </View>
          </View>
        )}

        {/* Set progression */}
        {lineData.length >= 2 && (
          <View style={styles.section}>
            <SectionTitle title={t('stats.progression.bySet')} />
            <View style={styles.lineChartWrap}>
              <LineChart data={lineData} color={teamColor} height={110} />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title, extra }: { title: string; extra?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {extra && <Text style={styles.sectionExtra}>{extra}</Text>}
    </View>
  );
}

function DetailStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.detailStat}>
      <Text style={styles.detailValue}>{value}</Text>
      <Text style={styles.detailLabel}>{label}</Text>
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
  playerName: { fontSize: 17, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  playerMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', color: palette.textSecondary, marginTop: 2 },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  section: {
    backgroundColor: palette.backgroundSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionExtra: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: palette.textPrimary,
  },
  catBody: { padding: 14 },
  detailRow: { flexDirection: 'row', gap: 16, marginTop: 10, flexWrap: 'wrap' },
  detailStat: { alignItems: 'center', minWidth: 44 },
  detailValue: { fontSize: 18, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  detailLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', color: palette.textMuted, marginTop: 2 },
  radarWrap: { alignItems: 'center', paddingVertical: 12 },
  lineChartWrap: { paddingHorizontal: 4, paddingVertical: 8 },
  emptyText: { color: palette.textMuted, fontFamily: 'Inter_400Regular', textAlign: 'center', padding: 20 },
});
