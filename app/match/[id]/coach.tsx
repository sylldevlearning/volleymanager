import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, BarChart2 } from 'lucide-react-native';

import { getMatchById, getSetsForMatch, createSet, updateMatchStatus } from '../../../src/services/matchService';
import { getPlayersByTeam } from '../../../src/services/playerService';
import { getTeamById } from '../../../src/services/teamService';
import { addEvent, getEventsForMatch } from '../../../src/services/eventService';
import { computePlayerStats } from '../../../src/services/statsService';
import type { Match } from '../../../src/models/match';
import type { Player } from '../../../src/models/player';
import type { Team } from '../../../src/models/team';
import type { StatEventType, MatchEvent } from '../../../src/models/event';
import type { PlayerStats } from '../../../src/models/stats';
import { StatButton } from '../../../src/components/stats/StatButton';
import { useResponsive } from '../../../src/hooks/useResponsive';
import { palette } from '../../../src/theme/tokens';

interface StatAction {
  type: StatEventType;
  label: string;
  emoji: string;
  variant: 'success' | 'error' | 'warning' | 'neutral';
}

const STAT_CATEGORIES: Array<{ title: string; key: string; actions: StatAction[] }> = [
  {
    title: 'Service',
    key: 'serve',
    actions: [
      { type: 'serve_ace', label: 'Ace', emoji: '🎯', variant: 'success' },
      { type: 'serve_fault', label: 'Faute', emoji: '❌', variant: 'error' },
      { type: 'serve_in', label: 'En jeu', emoji: '➡️', variant: 'neutral' },
    ],
  },
  {
    title: 'Attaque',
    key: 'attack',
    actions: [
      { type: 'attack_kill', label: 'Point', emoji: '💥', variant: 'success' },
      { type: 'attack_fault', label: 'Faute', emoji: '❌', variant: 'error' },
      { type: 'attack_defended', label: 'Défendue', emoji: '🛡️', variant: 'warning' },
    ],
  },
  {
    title: 'Block',
    key: 'block',
    actions: [
      { type: 'block_kill', label: 'Point', emoji: '✋', variant: 'success' },
      { type: 'block_touch', label: 'Touche', emoji: '🤚', variant: 'warning' },
      { type: 'block_fault', label: 'Faute', emoji: '❌', variant: 'error' },
    ],
  },
  {
    title: 'Réception',
    key: 'reception',
    actions: [
      { type: 'reception_a', label: 'Parfaite', emoji: '🟢', variant: 'success' },
      { type: 'reception_b', label: 'Positive', emoji: '🟡', variant: 'warning' },
      { type: 'reception_c', label: 'Négative', emoji: '🟠', variant: 'warning' },
      { type: 'reception_d', label: 'Faute', emoji: '🔴', variant: 'error' },
    ],
  },
  {
    title: 'Défense',
    key: 'defense',
    actions: [
      { type: 'defense_success', label: 'Réussie', emoji: '✅', variant: 'success' },
      { type: 'defense_fault', label: 'Faute', emoji: '❌', variant: 'error' },
    ],
  },
  {
    title: 'Passe',
    key: 'set',
    actions: [
      { type: 'set_perfect', label: 'Parfaite', emoji: '⭐', variant: 'success' },
      { type: 'set_good', label: 'Bonne', emoji: '👍', variant: 'neutral' },
      { type: 'set_bad', label: 'Mauvaise', emoji: '👎', variant: 'error' },
    ],
  },
];

export default function CoachScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const [match, setMatch] = useState<Match | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStats[]>([]);
  const [currentSetId, setCurrentSetId] = useState<string>('');
  const [eventsBuffer, setEventsBuffer] = useState<MatchEvent[]>([]);
  const { isSmall, isTablet } = useResponsive();

  useEffect(() => {
    async function load() {
      if (!id) return;
      const m = await getMatchById(id);
      if (!m) return;
      setMatch(m);

      const [tm, p] = await Promise.all([
        getTeamById(m.teamHomeId),
        getPlayersByTeam(m.teamHomeId),
      ]);
      setTeam(tm);
      setPlayers(p);
      if (p.length > 0) setSelectedPlayer(p[0]);

      const [existingEvents, sets] = await Promise.all([
        getEventsForMatch(id),
        getSetsForMatch(id),
      ]);
      setEventsBuffer(existingEvents);
      setStats(computePlayerStats(existingEvents));

      if (sets.length === 0) {
        // Match not yet started via referee mode — auto-create set 1 so coach can record stats
        const newSet = await createSet(m.id, 1);
        await updateMatchStatus(m.id, 'live');
        setCurrentSetId(newSet.id);
      } else {
        const activeSet = sets.find((set) => !set.finishedAt) ?? sets[sets.length - 1];
        if (activeSet) setCurrentSetId(activeSet.id);
      }
    }
    load();
  }, [id]);

  const handleStat = useCallback(async (action: StatAction) => {
    if (!match || !selectedPlayer || !currentSetId) return;

    const newEvent = await addEvent({
      matchId: match.id,
      setId: currentSetId,
      eventType: action.type,
      playerId: selectedPlayer.id,
      teamId: match.teamHomeId,
      details: {},
    });

    setEventsBuffer((prev) => {
      const updated = [...prev, newEvent];
      setStats(computePlayerStats(updated));
      return updated;
    });
  }, [match, selectedPlayer, currentSetId]);

  const getPlayerStats = (playerId: string): PlayerStats | undefined =>
    stats.find((s) => s.playerId === playerId);

  if (!match || !team) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <ArrowLeft size={22} color={palette.textSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{team.name}</Text>
          <Text style={styles.headerSubtitle}>{t('stats.title')}</Text>
        </View>
        <Pressable
          onPress={() => router.push(`/match/${id}/stats` as never)}
          style={styles.statsBtn}
          accessibilityRole="button"
          accessibilityLabel={t('stats.matchDashboard')}
        >
          <BarChart2 size={20} color={palette.accentSecondary} />
        </Pressable>
      </View>

      {/* Player selector */}
      <FlatList
        horizontal
        data={players}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.playerList}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const isSelected = selectedPlayer?.id === item.id;
          const isLibero = item.position === 'libero';
          const chipBorder = isLibero ? palette.libero : (isSelected ? palette.accentPrimary : 'transparent');
          const chipBg = isLibero ? palette.libero + '20' : (isSelected ? palette.accentPrimaryMuted : palette.backgroundSurface);
          return (
            <Pressable
              style={[styles.playerChip, { borderColor: chipBorder, backgroundColor: chipBg }]}
              onPress={() => setSelectedPlayer(item)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${item.firstName ?? ''} ${item.lastName ?? ''}`}
            >
              <Text style={[styles.playerChipNum, { color: isLibero ? palette.libero : isSelected ? palette.accentPrimary : palette.textMuted }]}>
                {isLibero ? '⚡' : ''}#{item.number}
              </Text>
              <Text style={[styles.playerChipName, isSelected && styles.playerChipNameActive]} numberOfLines={1}>
                {item.lastName ?? item.firstName ?? `#${item.number}`}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* Stat categories */}
      <ScrollView contentContainerStyle={[styles.statsScroll, isTablet && styles.statsScrollTablet]}>
        {STAT_CATEGORIES.map((category) => {
          const playerStats = selectedPlayer ? getPlayerStats(selectedPlayer.id) : null;
          return (
            <View key={category.key} style={styles.category}>
              <Text style={styles.categoryTitle}>{category.title}</Text>
              <View style={styles.categoryActions}>
                {category.actions.map((action) => {
                  const count = playerStats
                    ? (playerStats[action.type.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) as keyof PlayerStats] as number) ?? 0
                    : 0;
                  return (
                    <StatButton
                      key={action.type}
                      label={action.label}
                      emoji={action.emoji}
                      variant={action.variant}
                      count={typeof count === 'number' ? count : 0}
                      onPress={() => handleStat(action)}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  loading: { flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: palette.textSecondary, fontFamily: 'Inter_400Regular' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
    gap: 10,
  },
  backBtn: { padding: 4 },
  statsBtn: { padding: 8 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  headerSubtitle: { fontSize: 13, fontFamily: 'Inter_400Regular', color: palette.textSecondary },
  playerList: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  playerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    minWidth: 70,
    alignItems: 'center',
  },
  playerChipActive: { borderColor: palette.accentPrimary, backgroundColor: palette.accentPrimaryMuted },
  playerChipNum: { fontSize: 12, fontFamily: 'Inter_700Bold', color: palette.textMuted },
  playerChipNumActive: { color: palette.accentPrimary },
  playerChipName: { fontSize: 13, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  playerChipNameActive: { color: palette.textPrimary },
  statsScroll: { padding: 16, gap: 16 },
  statsScrollTablet: { paddingHorizontal: 32 },
  category: {
    backgroundColor: palette.backgroundSurface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
  },
  categoryTitle: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  categoryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
