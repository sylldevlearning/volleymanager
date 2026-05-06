import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy } from 'lucide-react-native';

import { getMatchById, getSetsForMatch } from '../../../src/services/matchService';
import { getTeamById } from '../../../src/services/teamService';
import { getPlayerStatsForMatch } from '../../../src/services/statsService';
import { getPlayersByTeam } from '../../../src/services/playerService';
import type { Match, MatchSet } from '../../../src/models/match';
import type { Team } from '../../../src/models/team';
import type { Player } from '../../../src/models/player';
import type { PlayerStats } from '../../../src/models/stats';
import { serveEfficiency, attackEfficiency, receptionEfficiency } from '../../../src/models/stats';
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

      const [home, away, ps, playerList] = await Promise.all([
        getTeamById(m.teamHomeId),
        getTeamById(m.teamAwayId),
        getPlayerStatsForMatch(id),
        getPlayersByTeam(m.teamHomeId),
      ]);
      setHomeTeam(home);
      setAwayTeam(away);
      setStats(ps);
      setPlayers(playerList);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Winner banner */}
        {winner && (
          <View style={styles.winnerBanner}>
            <Trophy size={28} color={palette.warning} />
            <Text style={styles.winnerLabel}>{t('match.winner')}</Text>
            <Text style={styles.winnerName}>{winner.name}</Text>
          </View>
        )}

        {/* Final score */}
        <View style={styles.scoreCard}>
          <TeamScore name={homeTeam.name} color={homeTeam.color} sets={setsHome} />
          <Text style={styles.vs}>-</Text>
          <TeamScore name={awayTeam.name} color={palette.teamAway} sets={setsAway} />
        </View>

        {/* Sets detail */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('match.sets')}</Text>
          {sets.map((set) => (
            <View key={set.id} style={styles.setRow}>
              <Text style={styles.setNum}>Set {set.setNumber}</Text>
              <Text style={styles.setScore}>{set.scoreHome} — {set.scoreAway}</Text>
            </View>
          ))}
        </View>

        {/* Player stats */}
        {stats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('stats.title')}</Text>
            {stats.map((ps) => {
              const player = players.find((p) => p.id === ps.playerId);
              if (!player) return null;
              return (
                <PlayerStatRow key={ps.playerId} player={player} stats={ps} />
              );
            })}
          </View>
        )}
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

function PlayerStatRow({ player, stats }: { player: Player; stats: PlayerStats }) {
  const serveEff = serveEfficiency(stats);
  const attackEff = attackEfficiency(stats);
  const receptionEff = receptionEfficiency(stats);
  const totalAces = stats.serveAce;
  const totalKills = stats.attackKill + stats.blockKill;

  return (
    <View style={styles.playerStatRow}>
      <View style={styles.playerStatHeader}>
        <Text style={styles.playerStatName}>
          #{player.number} {player.firstName} {player.lastName}
        </Text>
      </View>
      <View style={styles.statGrid}>
        <StatCell label="Ace" value={totalAces} />
        <StatCell label="Kill" value={totalKills} />
        <StatCell label="Srv%" value={serveEff} suffix="%" />
        <StatCell label="Atk%" value={attackEff} suffix="%" />
        <StatCell label="Rec%" value={receptionEff} suffix="%" />
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background },
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
  winnerLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: palette.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
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
  teamScoreName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary, textAlign: 'center' },
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
  playerStatRow: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  playerStatHeader: { marginBottom: 8 },
  playerStatName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary },
  statGrid: { flexDirection: 'row', gap: 8 },
  statCell: { flex: 1, alignItems: 'center' },
  statCellValue: { fontSize: 16, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  statCellLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', color: palette.textMuted, marginTop: 2 },
});
