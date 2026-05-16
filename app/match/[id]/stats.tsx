import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';

import { getMatchDashboard, type MatchDashboardData, type PlayerMatchStats } from '../../../src/services/statsService';
import { getMatchById, getSetsForMatch } from '../../../src/services/matchService';
import type { Match, MatchSet } from '../../../src/models/match';
import { MirrorBar } from '../../../src/components/charts/MirrorBar';
import { TopPerformerCard } from '../../../src/components/charts/TopPerformerCard';
import { StatCard } from '../../../src/components/charts/StatCard';
import { palette } from '../../../src/theme/tokens';
import { InfoTooltip } from '../../../src/components/ui/InfoTooltip';

export default function MatchStatsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<MatchDashboardData | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [sets, setSets] = useState<MatchSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const [d, m, s] = await Promise.all([
          getMatchDashboard(id),
          getMatchById(id),
          getSetsForMatch(id),
        ]);
        setDashboard(d);
        setMatch(m);
        setSets(s);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accentPrimary} />
      </View>
    );
  }

  if (!dashboard || !match) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('stats.noData')}</Text>
      </View>
    );
  }

  const { homeTeam, awayTeam, setBySetBreakdown, topPerformers } = dashboard;
  const hasData =
    homeTeam.players.some((p) => p.totalPoints > 0 || p.serveTotal > 0) ||
    awayTeam.players.some((p) => p.totalPoints > 0 || p.serveTotal > 0);

  const setsHome = sets.filter((s) => s.winnerTeamId === match.teamHomeId).length;
  const setsAway = sets.filter((s) => s.winnerTeamId === match.teamAwayId).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <ArrowLeft size={22} color={palette.textSecondary} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{t('stats.matchDashboard')}</Text>
          <Text style={styles.headerSubtitle}>
            {homeTeam.teamName} {setsHome} — {setsAway} {awayTeam.teamName}
          </Text>
        </View>
        <InfoTooltip textKey="help.stats" />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!hasData && (
          <View style={styles.section}>
            <Text style={styles.emptyText}>{t('stats.noData')}</Text>
          </View>
        )}

        {/* Team Comparison */}
        {hasData && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('stats.teamComparison')}</Text>
              <View style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: homeTeam.teamColor }]} />
                <Text style={styles.legendText}>{homeTeam.teamName}</Text>
                <View style={[styles.dot, { backgroundColor: awayTeam.teamColor }]} />
                <Text style={styles.legendText}>{awayTeam.teamName}</Text>
              </View>
            </View>

            <MirrorBar
              label={t('stats.categories.attack')}
              homeValue={homeTeam.totals.attackEfficiency}
              awayValue={awayTeam.totals.attackEfficiency}
              homeColor={homeTeam.teamColor}
              awayColor={awayTeam.teamColor}
            />
            <MirrorBar
              label={t('stats.categories.reception')}
              homeValue={homeTeam.totals.receptionPositive}
              awayValue={awayTeam.totals.receptionPositive}
              homeColor={homeTeam.teamColor}
              awayColor={awayTeam.teamColor}
            />
            <MirrorBar
              label={t('stats.categories.serve')}
              homeValue={homeTeam.totals.serveEfficiency}
              awayValue={awayTeam.totals.serveEfficiency}
              homeColor={homeTeam.teamColor}
              awayColor={awayTeam.teamColor}
            />
            <MirrorBar
              label={t('stats.categories.block')}
              homeValue={homeTeam.totals.blockEfficiency}
              awayValue={awayTeam.totals.blockEfficiency}
              homeColor={homeTeam.teamColor}
              awayColor={awayTeam.teamColor}
            />
            <MirrorBar
              label={t('stats.categories.defense')}
              homeValue={homeTeam.totals.defenseEfficiency}
              awayValue={awayTeam.totals.defenseEfficiency}
              homeColor={homeTeam.teamColor}
              awayColor={awayTeam.teamColor}
            />
          </View>
        )}

        {/* Points by type per set */}
        {setBySetBreakdown.length > 0 && hasData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('stats.pointsByType')}</Text>
            {setBySetBreakdown.map((s) => (
              <SetPointsRow
                key={s.setNumber}
                setBreakdown={s}
                homeColor={homeTeam.teamColor}
                awayColor={awayTeam.teamColor}
              />
            ))}
            <View style={styles.pointTypeLegend}>
              {[
                { label: t('stats.pointTypes.attack'), color: palette.accentPrimary },
                { label: t('stats.pointTypes.block'), color: palette.info },
                { label: t('stats.pointTypes.ace'), color: palette.success },
                { label: t('stats.pointTypes.opponentFault'), color: palette.textMuted },
              ].map(({ label, color }) => (
                <View key={label} style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Text style={styles.legendText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Top Performers */}
        {hasData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('stats.topPerformers')}</Text>
            {topPerformers.bestAttacker && (
              <TopPerformerCard
                category={t('stats.topPerformer.bestAttacker')}
                playerName={topPerformers.bestAttacker.player.playerName || `#${topPerformers.bestAttacker.player.playerNumber}`}
                playerNumber={topPerformers.bestAttacker.player.playerNumber}
                value={`${topPerformers.bestAttacker.value}%`}
              />
            )}
            {topPerformers.bestServer && (
              <TopPerformerCard
                category={t('stats.topPerformer.bestServer')}
                playerName={topPerformers.bestServer.player.playerName || `#${topPerformers.bestServer.player.playerNumber}`}
                playerNumber={topPerformers.bestServer.player.playerNumber}
                value={`${topPerformers.bestServer.value} ace${topPerformers.bestServer.value > 1 ? 's' : ''}`}
              />
            )}
            {topPerformers.bestReceiver && (
              <TopPerformerCard
                category={t('stats.topPerformer.bestReceiver')}
                playerName={topPerformers.bestReceiver.player.playerName || `#${topPerformers.bestReceiver.player.playerNumber}`}
                playerNumber={topPerformers.bestReceiver.player.playerNumber}
                value={`${topPerformers.bestReceiver.value}%`}
              />
            )}
            {topPerformers.bestBlocker && (
              <TopPerformerCard
                category={t('stats.topPerformer.bestBlocker')}
                playerName={topPerformers.bestBlocker.player.playerName || `#${topPerformers.bestBlocker.player.playerNumber}`}
                playerNumber={topPerformers.bestBlocker.player.playerNumber}
                value={`${topPerformers.bestBlocker.value} pt${topPerformers.bestBlocker.value > 1 ? 's' : ''}`}
              />
            )}
            {!topPerformers.bestAttacker && !topPerformers.bestServer && !topPerformers.bestReceiver && !topPerformers.bestBlocker && (
              <Text style={styles.emptyText}>{t('stats.noData')}</Text>
            )}
          </View>
        )}

        {/* Player lists */}
        {[homeTeam, awayTeam].map((team) => (
          <View key={team.teamId} style={styles.section}>
            <Text style={styles.sectionTitle}>{team.teamName}</Text>
            {team.players.length === 0 ? (
              <Text style={[styles.emptyText, { padding: 14 }]}>{t('stats.noData')}</Text>
            ) : (
              team.players.map((p) => (
                <PlayerRow
                  key={p.playerId}
                  player={p}
                  teamColor={team.teamColor}
                  onPress={() =>
                    router.push(`/match/${id}/player-stats/${p.playerId}` as never)
                  }
                />
              ))
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SetPointsRow({
  setBreakdown,
  homeColor,
  awayColor,
}: {
  setBreakdown: MatchDashboardData['setBySetBreakdown'][0];
  homeColor: string;
  awayColor: string;
}) {
  const hp = setBreakdown.homePoints;
  const ap = setBreakdown.awayPoints;
  const homeTotal = hp.attack + hp.block + hp.ace + hp.opponentFault;
  const awayTotal = ap.attack + ap.block + ap.ace + ap.opponentFault;

  if (homeTotal === 0 && awayTotal === 0) return null;

  return (
    <View style={styles.setRow}>
      <Text style={styles.setLabel}>S{setBreakdown.setNumber}</Text>
      <View style={styles.setBarWrap}>
        <SegmentedBar
          segments={[
            { value: hp.attack, color: palette.accentPrimary },
            { value: hp.block, color: palette.info },
            { value: hp.ace, color: palette.success },
            { value: hp.opponentFault, color: palette.textMuted },
          ]}
          total={Math.max(homeTotal, awayTotal, 1)}
          side="home"
          teamColor={homeColor}
        />
        <Text style={styles.setTotal}>{homeTotal}</Text>
        <Text style={styles.setTotal}>{awayTotal}</Text>
        <SegmentedBar
          segments={[
            { value: ap.attack, color: palette.accentPrimary },
            { value: ap.block, color: palette.info },
            { value: ap.ace, color: palette.success },
            { value: ap.opponentFault, color: palette.textMuted },
          ]}
          total={Math.max(homeTotal, awayTotal, 1)}
          side="away"
          teamColor={awayColor}
        />
      </View>
    </View>
  );
}

function SegmentedBar({
  segments,
  total,
  side,
}: {
  segments: { value: number; color: string }[];
  total: number;
  side: 'home' | 'away';
  teamColor: string;
}) {
  return (
    <View style={[styles.segBar, side === 'home' ? styles.segBarHome : styles.segBarAway]}>
      {segments.map((seg, i) => {
        if (seg.value === 0) return null;
        const w = (seg.value / total) * 100;
        return (
          <View
            key={i}
            style={{ width: `${w}%`, height: '100%', backgroundColor: seg.color, opacity: 0.85 }}
          />
        );
      })}
    </View>
  );
}

function PlayerRow({
  player,
  teamColor,
  onPress,
}: {
  player: PlayerMatchStats;
  teamColor: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      style={({ pressed }) => [styles.playerRow, pressed && styles.playerRowPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[styles.teamStripe, { backgroundColor: teamColor }]} />
      <View style={styles.playerNum}>
        <Text style={styles.playerNumText}>#{player.playerNumber}</Text>
      </View>
      <Text style={styles.playerName} numberOfLines={1}>
        {player.playerName || `#${player.playerNumber}`}
      </Text>
      <View style={styles.playerStats}>
        <StatCell label={t('stats.summary.points')} value={player.totalPoints} />
        <StatCell label={t('stats.summary.faults')} value={player.totalFaults} />
        <StatCell label={t('stats.summary.efficiency')} value={player.attackEfficiency} suffix="%" />
      </View>
    </Pressable>
  );
}

function StatCell({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}{suffix}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  headerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  headerSubtitle: { fontSize: 12, fontFamily: 'Inter_400Regular', color: palette.textSecondary, marginTop: 2 },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    padding: 14,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 10, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  dot: { width: 8, height: 8, borderRadius: 4 },
  emptyText: {
    color: palette.textMuted,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    padding: 20,
  },
  // Set breakdown
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  setLabel: {
    width: 20,
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: palette.textSecondary,
  },
  setBarWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  setTotal: { fontSize: 12, fontFamily: 'Inter_700Bold', color: palette.textPrimary, width: 20, textAlign: 'center' },
  segBar: {
    flex: 1,
    height: 16,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: palette.backgroundElevated,
  },
  segBarHome: { flexDirection: 'row-reverse' },
  segBarAway: { flexDirection: 'row' },
  pointTypeLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 12,
    justifyContent: 'center',
  },
  // Player row
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  playerRowPressed: { opacity: 0.7 },
  teamStripe: { width: 3, height: 20, borderRadius: 2 },
  playerNum: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerNumText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  playerName: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.textPrimary },
  playerStats: { flexDirection: 'row', gap: 8 },
  statCell: { alignItems: 'center', minWidth: 36 },
  statValue: { fontSize: 15, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  statLabel: { fontSize: 9, fontFamily: 'Inter_400Regular', color: palette.textMuted, textTransform: 'uppercase' },
});
