import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { Text } from '../../../src/components/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, BarChart2 } from 'lucide-react-native';

import { getMatchById, getSetsForMatch } from '../../../src/services/matchService';
import { getTeamById } from '../../../src/services/teamService';
import { getPlayerStatsForMatch } from '../../../src/services/statsService';
import { computeScore, getEventsForSet } from '../../../src/services/eventService';
import { summarizeMatch } from '../../../src/features/match/matchSummary';
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
import { GroupedBarChart } from '../../../src/components/stats/GroupedBarChart';
import { palette } from '../../../src/theme/tokens';
import { useInterstitialAd } from '../../../src/components/ads/useInterstitialAd';
import { maybeRequestReview } from '../../../src/features/review/reviewPrompt';
import { encodeResultQr, resultQrOf } from '../../../src/features/tournament/matchQr';
import { ResultQrCard } from '../../../src/components/qr/ResultQrCard';
import { useThemedStyles, useAppTheme, type AppTheme } from '../../../src/theme/useAppTheme';

export default function SummaryScreen() {
  const colors = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { id, justFinished } = useLocalSearchParams<{ id: string; justFinished?: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const [match, setMatch] = useState<Match | null>(null);
  const [sets, setSets] = useState<MatchSet[]>([]);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [liveScores, setLiveScores] = useState<Record<string, { home: number; away: number }>>({});

  const { show } = useInterstitialAd();
  const hasShownAd = useRef(false);
  useEffect(() => {
    if (!hasShownAd.current) {
      hasShownAd.current = true;
      show();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Positive moment: a match was just won (not a history visit). Small delay so the
  // summary is on screen before Google's dialog; it decides itself whether to show.
  useEffect(() => {
    if (justFinished !== '1') return;
    const timer = setTimeout(() => { maybeRequestReview(); }, 1500);
    return () => clearTimeout(timer);
  }, [justFinished]);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const [m, s] = await Promise.all([getMatchById(id), getSetsForMatch(id)]);
      if (!m) return;
      setMatch(m);
      setSets(s);
      // Sets without a winner (match stopped mid-set): their points come from the events
      const live: Record<string, { home: number; away: number }> = {};
      for (const set of s.filter((x) => !x.winnerTeamId)) {
        live[set.id] = computeScore(await getEventsForSet(id, set.id));
      }
      setLiveScores(live);

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

  const summary = summarizeMatch(match, sets, liveScores);
  const { setsHome, setsAway } = summary;
  const winner = summary.winnerTeamId === match.teamHomeId ? homeTeam
    : summary.winnerTeamId === match.teamAwayId ? awayTeam : null;
  // Quick match started from a tournament match QR: the organiser scans its result
  const resultQr = resultQrOf(match, homeTeam.name, awayTeam.name, sets);

  const homePlayerIds = new Set(
    players.filter((p) => p.teamId === match.teamHomeId).map((p) => p.id)
  );

  function sumStat(ps: PlayerStats[], key: keyof PlayerStats): number {
    return ps.reduce((acc, s) => acc + (s[key] as number), 0);
  }

  // Players with at least one recorded action (substitutions alone give empty stats)
  const recorded = stats.filter(hasRecordedStats);
  const homeStats = recorded.filter((ps) => homePlayerIds.has(ps.playerId));
  const awayStats = recorded.filter((ps) => !homePlayerIds.has(ps.playerId));

  const teamGroups = [
    { label: t('stats.serve'), key: 'serveAce' as const },
    { label: t('stats.attack'), key: 'attackKill' as const },
    { label: t('stats.block'), key: 'blockKill' as const },
  ].map(({ label, key }) => ({
    label,
    bars: [
      { value: sumStat(homeStats, key), color: homeTeam.color },
      { value: sumStat(awayStats, key), color: palette.teamAway },
    ],
  }));
  const hasTeamChart = teamGroups.some((g) => g.bars.some((b) => b.value > 0));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {winner && (
          <View style={styles.winnerBanner}>
            <Trophy size={28} color={colors.warning} />
            <Text style={styles.winnerLabel}>{t('match.winner')}</Text>
            <Text style={styles.winnerName}>{winner.name}</Text>
          </View>
        )}
        {summary.stopped && (
          <View style={styles.stoppedBanner}>
            <Text style={styles.stoppedTitle}>{t('summary.stopped')}</Text>
            <Text style={styles.stoppedHint}>{t('summary.stoppedHint')}</Text>
          </View>
        )}

        <View style={styles.scoreCard}>
          <TeamScore name={homeTeam.name} color={homeTeam.color} sets={setsHome} />
          <Text style={styles.vs}>-</Text>
          <TeamScore name={awayTeam.name} color={palette.teamAway} sets={setsAway} />
        </View>

        {resultQr && <ResultQrCard value={encodeResultQr(resultQr)} result={resultQr} />}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('match.sets')}</Text>
          {summary.sets.map((set) => (
            <View key={set.id} style={styles.setRow}>
              <Text style={styles.setNum}>
                {t(set.stopped ? 'summary.setStopped' : 'summary.setNumber', { n: set.setNumber })}
              </Text>
              <Text style={styles.setScore}>{set.scoreHome} — {set.scoreAway}</Text>
            </View>
          ))}
        </View>

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
          {hasTeamChart ? (
            <View style={styles.barChartWrap}>
              <GroupedBarChart groups={teamGroups} />
            </View>
          ) : (
            <Text style={styles.noStats}>{t('summary.noStats')}</Text>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [styles.statsDetailBtn, pressed && { opacity: 0.75 }]}
          onPress={() => router.push(`/match/${id}/stats` as never)}
          accessibilityRole="button"
        >
          <BarChart2 size={18} color={colors.accentSecondary} />
          <Text style={styles.statsDetailBtnText}>{t('stats.detailed')}</Text>
        </Pressable>

        {recorded.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('stats.title')} — {t('player.position')}</Text>
            {recorded.map((ps) => {
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
  const styles = useThemedStyles(makeStyles);
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
  const styles = useThemedStyles(makeStyles);
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
          <StatCell label={t('stats.short.aces')} value={totalAces} />
          <StatCell label={t('stats.short.points')} value={totalKills} />
          <StatCell label={t('stats.short.serve')} value={serveEff} suffix="%" />
          <StatCell label={t('stats.short.attack')} value={attackEff} suffix="%" />
          <StatCell label={t('stats.short.reception')} value={receptionEff} suffix="%" />
        </View>
      </View>
    </View>
  );
}

/** At least one counted action (any numeric total above 0). */
function hasRecordedStats(ps: PlayerStats): boolean {
  return Object.entries(ps).some(([k, v]) => k !== 'playerId' && typeof v === 'number' && v > 0);
}

function StatCell({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.statCell}>
      <Text style={styles.statCellValue}>{value}{suffix}</Text>
      <Text style={styles.statCellLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: a.background },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: a.background,
  },
  loadingText: { color: a.textSecondary, fontFamily: 'Inter_400Regular' },
  scroll: { padding: 20, gap: 16 },
  winnerBanner: {
    backgroundColor: a.warning + '15',
    borderWidth: 1,
    borderColor: a.warning + '40',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  winnerLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: a.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  winnerName: { fontSize: 22, fontFamily: 'Inter_700Bold', color: a.warning },
  scoreCard: {
    backgroundColor: a.backgroundSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: a.backgroundElevated,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  teamScore: { flex: 1, alignItems: 'center', gap: 6 },
  teamScoreName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: a.textSecondary,
    textAlign: 'center',
  },
  teamScoreSets: { fontSize: 52, fontFamily: 'Inter_900Black', lineHeight: 56 },
  vs: { fontSize: 20, fontFamily: 'Inter_500Medium', color: a.textMuted, marginHorizontal: 8 },
  section: {
    backgroundColor: a.backgroundSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: a.backgroundElevated,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: a.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: a.backgroundElevated,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: a.backgroundElevated,
    paddingRight: 14,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: a.textSecondary },
  barChartWrap: { paddingHorizontal: 8, paddingTop: 8 },
  noStats: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: a.textMuted,
    padding: 14,
  },
  stoppedBanner: {
    backgroundColor: a.backgroundSurface,
    borderWidth: 1,
    borderColor: a.backgroundElevated,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  stoppedTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: a.textPrimary },
  stoppedHint: { fontSize: 13, fontFamily: 'Inter_400Regular', color: a.textSecondary, textAlign: 'center' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: a.backgroundElevated,
  },
  setNum: { fontSize: 14, fontFamily: 'Inter_500Medium', color: a.textSecondary },
  setScore: { fontSize: 16, fontFamily: 'Inter_700Bold', color: a.textPrimary },
  playerCard: {
    borderBottomWidth: 1,
    borderBottomColor: a.backgroundElevated,
  },
  playerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  playerTeamBar: { width: 3, height: 20, borderRadius: 2 },
  playerStatName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: a.textPrimary },
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
  statCellValue: { fontSize: 18, fontFamily: 'Inter_700Bold', color: a.textPrimary },
  statCellLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: a.textMuted,
    marginTop: 2,
  },
  statsDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: a.backgroundSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: a.accentSecondary + '40',
    paddingVertical: 14,
  },
  statsDetailBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: a.accentSecondary,
  },
  backToMenuBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: a.backgroundSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: a.backgroundElevated,
    paddingVertical: 18,
    marginTop: 8,
  },
  backToMenuText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: a.textPrimary,
  },
});
