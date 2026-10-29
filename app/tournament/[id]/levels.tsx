import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette } from '../../../src/theme/tokens';
import { getTournamentBundle, type TournamentBundle } from '../../../src/services/tournamentService';
import { levelsSummary } from '../../../src/features/tournament/phases';

/**
 * "Répartition des niveaux" at the end of the mixing: one colour per level
 * (gold, silver, bronze), big names to read from a distance. Rebuilt from the
 * results each time it is shown, so a correction is reflected.
 */
export default function TournamentLevelsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [bundle, setBundle] = useState<TournamentBundle | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    getTournamentBundle(id).then((b) => { if (active) setBundle(b); });
    return () => { active = false; };
  }, [id]));

  const levels = bundle ? levelsSummary(bundle, t) : null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {bundle && (
        <ScrollView contentContainerStyle={styles.scroll}>
          {!levels && <Text style={styles.hint}>{t('tournament.levels.pending')}</Text>}
          {levels?.map((level) => (
            <View key={level.level} style={[styles.card, { borderColor: level.color }]}>
              <View style={[styles.header, { backgroundColor: level.color }]}>
                <Text style={styles.levelName}>{level.name}</Text>
                <Text style={styles.count}>{t('tournament.levels.count', { count: level.teams.length })}</Text>
              </View>
              {level.teams.map((team, i) => (
                <View key={team} style={styles.row}>
                  <Text style={[styles.place, { color: level.color }]}>{i + 1}</Text>
                  <Text style={styles.team} numberOfLines={1} adjustsFontSizeToFit>{team}</Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 16, gap: 16, paddingBottom: 32 },
  hint: { fontSize: 16, fontFamily: 'Inter_400Regular', color: palette.textSecondary, lineHeight: 24, textAlign: 'center', paddingVertical: 40 },
  card: { borderRadius: 16, borderWidth: 2, overflow: 'hidden', backgroundColor: palette.backgroundSurface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  levelName: { fontSize: 24, fontFamily: 'Inter_900Black', color: '#0D1117' },
  count: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#0D1117' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: palette.backgroundElevated,
  },
  place: { width: 30, fontSize: 20, fontFamily: 'Inter_900Black', textAlign: 'center' },
  team: { flex: 1, fontSize: 22, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
});
