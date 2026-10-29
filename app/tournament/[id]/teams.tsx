import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette } from '../../../src/theme/tokens';
import { getTournamentBundle, renameTournamentTeam } from '../../../src/services/tournamentService';
import type { TournamentTeam } from '../../../src/models/tournament';

/** Rename the teams of a tournament — saved when leaving the field. */
export default function TournamentTeamsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, 'empty' | 'duplicate'>>({});
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    getTournamentBundle(id).then((b) => {
      if (!b) return;
      setTeams(b.teams);
      setDrafts(Object.fromEntries(b.teams.map((x) => [x.id, x.name])));
    });
  }, [id]);

  async function save(team: TournamentTeam) {
    const name = drafts[team.id] ?? '';
    if (name.trim() === team.name) {
      setErrors(({ [team.id]: _, ...rest }) => rest);
      return;
    }
    const outcome = await renameTournamentTeam(id, team.id, name);
    if (outcome.ok) {
      setTeams((list) => list.map((x) => (x.id === team.id ? { ...x, name: name.trim() } : x)));
      setErrors(({ [team.id]: _, ...rest }) => rest);
      setSaved(team.id);
    } else {
      setErrors((e) => ({ ...e, [team.id]: outcome.reason }));
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={teams}
        keyExtractor={(x) => x.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<Text style={styles.hint}>{t('tournament.teamsScreen.hint')}</Text>}
        renderItem={({ item }) => (
          <View style={[styles.row, errors[item.id] && styles.rowError]}>
            <View style={styles.line}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <TextInput
                style={styles.input}
                value={drafts[item.id] ?? ''}
                onChangeText={(text) => { setDrafts((d) => ({ ...d, [item.id]: text })); setSaved(null); }}
                onEndEditing={() => save(item)}
                onSubmitEditing={() => save(item)}
                returnKeyType="done"
                maxLength={40}
              />
            </View>
            {errors[item.id] === 'empty' && <Text style={styles.error}>{t('tournament.teamsScreen.empty')}</Text>}
            {errors[item.id] === 'duplicate' && <Text style={styles.error}>{t('tournament.teamsScreen.duplicate')}</Text>}
            {saved === item.id && !errors[item.id] && <Text style={styles.saved}>{t('tournament.teamsScreen.saved')}</Text>}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  list: { padding: 16, gap: 8 },
  hint: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textSecondary, lineHeight: 20, marginBottom: 8 },
  row: { padding: 8, borderRadius: 12, borderWidth: 1, borderColor: palette.backgroundElevated, backgroundColor: palette.backgroundSurface, gap: 4 },
  rowError: { borderColor: palette.error },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: palette.textPrimary, paddingVertical: 8 },
  error: { fontSize: 12, fontFamily: 'Inter_500Medium', color: palette.error, marginLeft: 24 },
  saved: { fontSize: 12, fontFamily: 'Inter_500Medium', color: palette.success, marginLeft: 24 },
});
