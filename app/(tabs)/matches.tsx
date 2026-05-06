import { useEffect, useState, useCallback } from 'react';
import { FlatList, StyleSheet, Text, View, Pressable, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus, Calendar } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllMatches } from '../../src/services/matchService';
import { getAllTeams } from '../../src/services/teamService';
import type { Match } from '../../src/models/match';
import type { Team } from '../../src/models/team';
import { palette } from '../../src/theme/tokens';

export default function MatchesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [allMatches, allTeams] = await Promise.all([getAllMatches(), getAllTeams()]);
    setMatches(allMatches);
    const teamMap: Record<string, Team> = {};
    allTeams.forEach((t) => (teamMap[t.id] = t));
    setTeams(teamMap);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.accentPrimary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Calendar size={48} color={palette.textMuted} strokeWidth={1} />
            <Text style={styles.emptyTitle}>{t('history.noMatches')}</Text>
            <Text style={styles.emptyDesc}>{t('history.noMatchesDesc')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            homeTeam={teams[item.teamHomeId]}
            awayTeam={teams[item.teamAwayId]}
            onPress={() => {
              if (item.status === 'finished') {
                router.push(`/match/${item.id}/summary`);
              } else {
                router.push(`/match/${item.id}/referee`);
              }
            }}
          />
        )}
      />
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push('/match/new')}
        accessibilityLabel={t('match.new')}
        accessibilityRole="button"
      >
        <Plus size={26} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

function MatchCard({
  match,
  homeTeam,
  awayTeam,
  onPress,
}: {
  match: Match;
  homeTeam?: Team;
  awayTeam?: Team;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const date = new Date(match.date).toLocaleDateString();
  const isLive = match.status === 'live';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{date}</Text>
        {isLive && (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        )}
        <Text style={styles.cardFormat}>
          {match.format === 'indoor_6v6' ? t('match.indoor6v6') : t('match.beach2v2')}
        </Text>
      </View>
      <View style={styles.cardTeams}>
        <Text style={styles.teamName} numberOfLines={1}>
          {homeTeam?.name ?? '—'}
        </Text>
        <Text style={styles.vs}>{t('history.vs')}</Text>
        <Text style={[styles.teamName, styles.teamNameAway]} numberOfLines={1}>
          {awayTeam?.name ?? '—'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  list: { padding: 16, gap: 12, paddingBottom: 80 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },
  emptyDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textMuted },
  card: {
    backgroundColor: palette.backgroundSurface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
  },
  cardPressed: { opacity: 0.8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  cardDate: { fontSize: 12, fontFamily: 'Inter_400Regular', color: palette.textMuted, flex: 1 },
  cardFormat: { fontSize: 11, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  liveBadge: {
    backgroundColor: palette.accentPrimary + '30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeText: { fontSize: 10, fontFamily: 'Inter_700Bold', color: palette.accentPrimary },
  cardTeams: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textPrimary,
  },
  teamNameAway: { textAlign: 'right' },
  vs: { fontSize: 12, fontFamily: 'Inter_500Medium', color: palette.textMuted },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.accentPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },
});
