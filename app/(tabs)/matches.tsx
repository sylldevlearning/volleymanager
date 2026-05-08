import { useState, useCallback, useMemo } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View, Pressable, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect, Router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus, Calendar } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllMatches } from '../../src/services/matchService';
import { getAllTeams } from '../../src/services/teamService';
import type { Match } from '../../src/models/match';
import type { Team } from '../../src/models/team';
import { palette } from '../../src/theme/tokens';

type StatusFilter = 'all' | 'live' | 'finished';

export default function MatchesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterTeamId, setFilterTeamId] = useState<string | null>(null);

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

  const matchTeams = useMemo(() => {
    const ids = new Set<string>();
    matches.forEach((m) => { ids.add(m.teamHomeId); ids.add(m.teamAwayId); });
    return Array.from(ids)
      .map((id) => teams[id])
      .filter((t): t is Team => Boolean(t));
  }, [matches, teams]);

  const filteredMatches = useMemo(() => {
    let result = matches;
    if (filterStatus !== 'all') {
      result = result.filter((m) => m.status === filterStatus);
    }
    if (filterTeamId !== null) {
      result = result.filter(
        (m) => m.teamHomeId === filterTeamId || m.teamAwayId === filterTeamId
      );
    }
    return result;
  }, [matches, filterStatus, filterTeamId]);

  const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('history.statusAll') },
    { key: 'live', label: t('match.status.live') },
    { key: 'finished', label: t('match.status.finished') },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {STATUS_FILTERS.map(({ key, label }) => (
            <Pressable
              key={key}
              style={[styles.chip, filterStatus === key && styles.chipActive]}
              onPress={() => setFilterStatus(key)}
            >
              <Text style={[styles.chipText, filterStatus === key && styles.chipTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}

          {matchTeams.length > 0 && <View style={styles.chipDivider} />}

          <Pressable
            style={[styles.chip, filterTeamId === null && styles.chipTeamActive]}
            onPress={() => setFilterTeamId(null)}
          >
            <Text style={[styles.chipText, filterTeamId === null && styles.chipTextActive]}>
              {t('history.allTeams')}
            </Text>
          </Pressable>

          {matchTeams.map((team) => (
            <Pressable
              key={team.id}
              style={[styles.chip, filterTeamId === team.id && styles.chipActive]}
              onPress={() => setFilterTeamId(filterTeamId === team.id ? null : team.id)}
            >
              <View style={[styles.teamDot, { backgroundColor: team.color }]} />
              <Text style={[styles.chipText, filterTeamId === team.id && styles.chipTextActive]}>
                {team.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredMatches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={palette.accentPrimary}
          />
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
            router={router}
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
  router,
  onPress,
}: {
  match: Match;
  homeTeam?: Team;
  awayTeam?: Team;
  router: Router;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const date = new Date(match.date).toLocaleDateString();
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';

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
        <View style={styles.cardTeamLeft}>
          {homeTeam && <View style={[styles.teamColorBar, { backgroundColor: homeTeam.color }]} />}
          <Text style={styles.teamName} numberOfLines={1}>
            {homeTeam?.name ?? '—'}
          </Text>
        </View>
        <Text style={styles.vs}>{t('history.vs')}</Text>
        <View style={styles.cardTeamRight}>
          <Text style={[styles.teamName, styles.teamNameAway]} numberOfLines={1}>
            {awayTeam?.name ?? '—'}
          </Text>
          {awayTeam && (
            <View style={[styles.teamColorBar, { backgroundColor: awayTeam.color }]} />
          )}
        </View>
      </View>

      {/* Secondary action buttons */}
      {(isLive || isFinished) && (
        <View style={styles.cardActions}>
          {isLive && (
            <Pressable
              style={styles.actionBtn}
              onPress={() => router.push(`/match/${match.id}/coach` as never)}
              accessibilityRole="button"
              accessibilityLabel={t('match.coach')}
            >
              <Text style={styles.actionBtnText}>{t('match.coach')}</Text>
            </Pressable>
          )}
          {isFinished && (
            <Pressable
              style={styles.actionBtn}
              onPress={() => router.push(`/match/${match.id}/stats` as never)}
              accessibilityRole="button"
              accessibilityLabel={t('match.stats')}
            >
              <Text style={styles.actionBtnText}>{t('match.stats')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },

  filterBar: {
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
    backgroundColor: palette.backgroundSurface,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: palette.backgroundElevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: palette.accentPrimaryMuted,
    borderColor: palette.accentPrimary + '60',
  },
  chipTeamActive: {
    backgroundColor: palette.backgroundHover,
    borderColor: palette.backgroundElevated,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: palette.textSecondary,
  },
  chipTextActive: { color: palette.accentPrimary },
  chipDivider: {
    width: 1,
    height: 20,
    backgroundColor: palette.backgroundElevated,
    marginHorizontal: 2,
  },
  teamDot: { width: 7, height: 7, borderRadius: 3.5 },

  list: { padding: 16, gap: 12, paddingBottom: 80 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
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
  cardTeamLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTeamRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  teamColorBar: { width: 3, height: 18, borderRadius: 2 },
  teamName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textPrimary,
  },
  teamNameAway: { textAlign: 'right' },
  vs: { fontSize: 12, fontFamily: 'Inter_500Medium', color: palette.textMuted },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.backgroundElevated,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textSecondary,
  },
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
