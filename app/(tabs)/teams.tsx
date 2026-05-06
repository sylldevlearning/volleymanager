import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus, Users, ChevronRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllTeams } from '../../src/services/teamService';
import { getPlayersByTeam } from '../../src/services/playerService';
import type { Team } from '../../src/models/team';
import { palette } from '../../src/theme/tokens';

interface TeamWithCount {
  team: Team;
  playerCount: number;
}

export default function TeamsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [teams, setTeams] = useState<TeamWithCount[]>([]);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        const allTeams = await getAllTeams();
        const withCounts = await Promise.all(
          allTeams.map(async (team) => {
            const players = await getPlayersByTeam(team.id);
            return { team, playerCount: players.length };
          })
        );
        setTeams(withCounts);
      }
      load();
    }, [])
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={teams}
        keyExtractor={(item) => item.team.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Users size={48} color={palette.textMuted} strokeWidth={1} />
            <Text style={styles.emptyTitle}>{t('team.noTeams')}</Text>
            <Text style={styles.emptyDesc}>{t('team.createFirst')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push(`/team/${item.team.id}`)}
            accessibilityRole="button"
            accessibilityLabel={item.team.name}
          >
            <View style={[styles.colorDot, { backgroundColor: item.team.color }]} />
            <View style={styles.cardContent}>
              <Text style={styles.teamName}>{item.team.name}</Text>
              <Text style={styles.playerCount}>
                {t('team.playerCount', { count: item.playerCount })}
              </Text>
            </View>
            <ChevronRight size={18} color={palette.textMuted} />
          </Pressable>
        )}
      />
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push('/team/new')}
        accessibilityLabel={t('team.new')}
        accessibilityRole="button"
      >
        <Plus size={26} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  list: { padding: 16, gap: 10, paddingBottom: 80 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },
  emptyDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textMuted },
  card: {
    backgroundColor: palette.backgroundSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
  },
  cardPressed: { opacity: 0.8 },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  cardContent: { flex: 1 },
  teamName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary },
  playerCount: { fontSize: 13, fontFamily: 'Inter_400Regular', color: palette.textSecondary, marginTop: 2 },
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
    elevation: 8,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },
});
