import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, BarChart2 } from 'lucide-react-native';

import { getMatchById, getSetsForMatch } from '../../../src/services/matchService';
import { getTeamById } from '../../../src/services/teamService';
import { getPlayerStatsForMatch } from '../../../src/services/statsService';
import { getPlayersByTeam } from '../../../src/services/playerService';
import type { Match, MatchSet } from '../../../src/models/match';
import type { Team } from '../../../src/models/team';
import type { Player } from '../../../src/models/player';
import type { PlayerStats } from '../../../src/models/stats';
import {
  serveEfficiency,
  attackEfficiency,
  receptionEfficiency,
  servePositiveRate,
  attackPositiveRate,
  blockPositiveRate,
  receptionPositiveRate,
  defensePositiveRate,
} from '../../../src/models/stats';
import { getPlayerDisplayName } from '../../../src/features/players/player-helpers';
import { RadarChart } from '../../../src/components/stats/RadarChart';
import { BarChart } from '../../../src/components/stats/BarChart';
import { palette } from '../../../src/theme/tokens';

export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const [match, setMatch] = useState<Match | null>(null);
  const [sets, setSets] = useState<MatchSet[]>([]);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<PlayerStats[]>([]);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const [m, s] = await Promise.all([getMatchById(id), getSetsForMatch(id)]);
      if (!m) return;
      setMatch(m);
      setSets(s);

      const [home, away, ps, homePlayers, awayPlayers] = await Promise.all([
        getTeamById(m.teamHomeId),
        getTeamById(m.teamAwayId),
        getPlayerStatsForMatch(id),
        getPlayersByTeam(m.teamHomeId),
        getPlayersByTeam(m.teamAwayId),
      ]);
      setHomeTeam(home);
      setAwayTeam(away);
      setStats(ps);
      setPlayers([...homePlayers, ...awayPlayers]);
    }
    load();
  }, [id]);

  if (!match || !homeTeam || !awayTeam) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  const setsHome = sets.filter((s) => s.winnerTeamId === match.teamHomeId).length;
  const setsAway = sets.filter((s) => s.winnerTeamId === match.teamAwayId).length;
  const winner = match.winnerTeamId === match.teamHomeId ? homeTeam : awayTeam;

  const homePlayerIds = new Set(
    players.filter((p) => p.teamId === match.teamHomeId).map((p) => p.id)
  );

  function sumStat(ps: PlayerStats[], key: keyof PlayerStats): number {
    return ps.reduce((acc, s) => acc + (s[key] as number), 0);
  }

  const homeStats = stats.filter((ps) => homePlayerIds.has(ps.playerId));
  const awayStats = stats.filter((ps) => !homePlayerIds.has(ps.playerId));
  const showTeamComparison = homeStats.length > 0 || awayStats.length > 0;

  const teamBarData = showTeamComparison
    ? [
        { label: t('stats.serveAce'), value: sumStat(homeStats, 'serveAce'), color: homeTeam.color },
        { label: t('stats.serveAce'), value: sumStat(awayStats, 'serveAce'), color: palette.teamAway },
        { label: '', value: 0, color: 'transparent' },
        { label: t('stats.attackKill'), value: sumStat(homeStats, 'attackKill'), color: homeTeam.color },
        { label: t('stats.attackKill'), value: sumStat(awayStats, 'attackKill'), color: palette.teamAway },
        { label: '', value: 0, color: 'transparent' },
        { label: t('stats.blockKill'), value: sumStat(homeStats, 'blockKill'), color: homeTeam.color },
        { label: t('stats.blockKill'), value: sumStat(awayStats, 'blockKill'), color: palette.teamAway },
      ]
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {winner && (
          <View style={styles.winnerBanner}>
            <Trophy size={28} color={palette.warning} />
            <Text style={styles.winnerLabel}>{t('match.winner')}</Text>
            <Text style={styles.winnerName}>{winner.name}</Text>
          </View>
        )}

        <View style={styles.scoreCard}>
          <TeamScore name={homeTeam.name} color={homeTeam.color} sets={setsHome} />
          <Text style={styles.vs}>-</Text>
          <TeamScore name={awayTeam.name} color={palette.teamAway} sets={setsAway} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('match.sets')}</Text>
          {sets.map((set) => (
            <View key={set.id} style={styles.setRow}>
              <Text style={styles.setNum}>Set {set.setNumber}</Text>
              <Text style={styles.setScore}>{set.scoreHome} — {set.scoreAway}</Text>
            </View>
          ))}
        </View>

        {showTeamComparison && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t('stats.title')}</Text>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: homeTeam.color }]} />
                <Text style={styles.legendText}>{homeTeam.name}</Text>
                <View style={[styles.legendDot, { backgroundColor: palette.teamAway }]} />
                <Text style={styles.legendText}>{awayTeam.name}</Text>
              </View>
            </View>
            <View style={styles.barChartWrap}>
              <BarChart data={teamBarData} height={120} />
            </View>
            <View style={styles.barLabelRow}>
              <Text style={styles.barGroupLabel}>{t('stats.serve')}</Text>
              <Text style={styles.barGroupLabel}>{t('stats.attack')}</Text>
              <Text style={styles.barGroupLabel}>{t('stats.block')}</Text>
            </View>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.statsDetailBtn, pressed && { opacity: 0.75 }]}
          onPress={() => router.push(`/match/${id}/stats` as never)}
          accessibilityRole="button"
        >
          <BarChart2 size={18} color={palette.accentSecondary} />
          <Text style={styles.statsDetailBtnText}>{t('stats.detailed')}</Text>
        </Pressable>

        {stats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('stats.title')} — {t('player.position')}</Text>
            {stats.map((ps) => {
              const player = players.find((p) => p.id === ps.playerId);
              if (!player) return null;
              const isHome = homePlayerIds.has(ps.playerId);
              const teamColor = isHome ? homeTeam.color : palette.teamAway;
              return (
                <PlayerStatCard
                  key={ps.playerId}
                  player={player}
                  stats={ps}
                  teamColor={teamColor}
                />
              );
            })}
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.backToMenuBtn, pressed && { opacity: 0.75 }]}
          onPress={() => router.replace('/')}
          accessibilityRole="button"
        >
          <Text style={styles.backToMenuText}>🏠  {t('summary.backToMenu')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function TeamScore({ name, color, sets }: { name: string; color: string; sets: number }) {
  return (
    <View style={styles.teamScore}>
      <Text style={styles.teamScoreName} numberOfLines={2}>{name}</Text>
      <Text style={[styles.teamScoreSets, { color }]}>{sets}</Text>
    </View>
  );
}

function PlayerStatCard({
  player,
  stats,
  teamColor,
}: {
  player: Player;
  stats: PlayerStats;
  teamColor: string;
}) {
  const { t } = useTranslation();
  const serveEff = serveEfficiency(stats);
  const attackEff = attackEfficiency(stats);
  const receptionEff = receptionEfficiency(stats);
  const totalAces = stats.serveAce;
  const totalKills = stats.attackKill + stats.blockKill;

  const radarMetrics = [
    { label: t('stats.serve'), value: servePositiveRate(stats) },
    { label: t('stats.attack'), value: attackPositiveRate(stats) },
    { label: t('stats.block'), value: blockPositiveRate(stats) },
    { label: t('stats.reception'), value: receptionPositiveRate(stats) },
    { label: t('stats.defense'), value: defensePositiveRate(stats) },
  ];

  const hasData = radarMetrics.some((m) => m.value > 0);

  return (
    <View style={styles.playerCard}>
      <View style={styles.playerCardHeader}>
        <View style={[styles.playerTeamBar, { backgroundColor: teamColor }]} />
        <Text style={styles.playerStatName}>
          #{player.number} {getPlayerDisplayName(player)}
        </Text>
      </View>

      <View style={styles.playerCardBody}>
        {hasData && (
          <View style={styles.radarWrap}>
            <RadarChart metrics={radarMetrics} size={148} color={teamColor} />
          </View>
        )}

        <View style={styles.statGrid}>
          <StatCell label="Ace" value={totalAces} />
          <StatCell label="Kill" value={totalKills} />
          <StatCell label="Srv%" value={serveEff} suffix="%" />
          <StatCell label="Atk%" value={attackEff} suffix="%" />
          <StatCell label="Rec%" value={receptionEff} suffix="%" />
        </View>
      </View>
    </View>
  );
}

function StatCell({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statCellValue}>{value}{suffix}</Text>
      <Text style={styles.statCellLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.background,
  },
  loadingText: { color: palette.textSecondary, fontFamily: 'Inter_400Regular' },
  scroll: { padding: 20, gap: 16 },
  winnerBanner: {
    backgroundColor: palette.warning + '15',
    borderWidth: 1,
    borderColor: palette.warning + '40',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  winnerLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  winnerName: { fontSize: 22, fontFamily: 'Inter_700Bold', color: palette.warning },
  scoreCard: {
    backgroundColor: palette.backgroundSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  teamScore: { flex: 1, alignItems: 'center', gap: 6 },
  teamScoreName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textSecondary,
    textAlign: 'center',
  },
  teamScoreSets: { fontSize: 52, fontFamily: 'Inter_900Black', lineHeight: 56 },
  vs: { fontSize: 20, fontFamily: 'Inter_500Medium', color: palette.textMuted, marginHorizontal: 8 },
  section: {
    backgroundColor: palette.backgroundSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
    paddingRight: 14,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  barChartWrap: { paddingHorizontal: 8, paddingTop: 8 },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  barGroupLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  setNum: { fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  setScore: { fontSize: 16, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  playerCard: {
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  playerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  playerTeamBar: { width: 3, height: 20, borderRadius: 2 },
  playerStatName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary },
  playerCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 12,
  },
  radarWrap: { alignItems: 'center', justifyContent: 'center' },
  statGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell: { minWidth: 48, alignItems: 'center' },
  statCellValue: { fontSize: 18, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  statCellLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: palette.textMuted,
    marginTop: 2,
  },
  statsDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.backgroundSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.accentSecondary + '40',
    paddingVertical: 14,
  },
  statsDetailBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: palette.accentSecondary,
  },
  backToMenuBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.backgroundSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    paddingVertical: 18,
    marginTop: 8,
  },
  backToMenuText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: palette.textPrimary,
  },
});
