import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../src/components/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stepper } from '../../../src/components/ui/FormControls';
import { PickerField } from '../../../src/components/tournament/WizardSteps';
import { getTournamentBundle, rescheduleTournament } from '../../../src/services/tournamentService';
import { dateFromTime, timeFromDate } from '../../../src/features/tournament/wizard';
import type { TournamentSchedule } from '../../../src/models/tournament';
import { useThemedStyles, type AppTheme } from '../../../src/theme/useAppTheme';

/** Courts and times changed during the day: matches still to play are placed again. */
export default function TournamentScheduleScreen() {
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const [schedule, setSchedule] = useState<TournamentSchedule | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getTournamentBundle(id).then((b) => setSchedule(b?.tournament.schedule ?? null));
  }, [id]);

  if (!schedule) return <SafeAreaView style={styles.container} edges={['bottom']} />;

  async function apply() {
    if (saving || !schedule) return;
    setSaving(true);
    try {
      await rescheduleTournament(id, schedule);
      router.back();
    } catch (e) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.hint}>{t('tournament.scheduleScreen.hint')}</Text>
        <Stepper label={t('tournament.wizard.courts')} value={schedule.courts} min={1} max={20}
          onChange={(courts) => setSchedule({ ...schedule, courts })} />
        <View style={styles.inline}>
          <Text style={styles.label}>{t('tournament.wizard.startTime')}</Text>
          <PickerField mode="time" value={dateFromTime(schedule.startTime)} label={t('tournament.wizard.startTime')}
            onPick={(time) => setSchedule({ ...schedule, startTime: timeFromDate(time) })} />
        </View>
        <Stepper label={t('tournament.wizard.matchMinutes')} value={schedule.matchMinutes} min={10} max={120} step={5}
          onChange={(matchMinutes) => setSchedule({ ...schedule, matchMinutes })} />
        <Stepper label={t('tournament.wizard.restMinutes')} value={schedule.restMinutes} min={0} max={60} step={5}
          onChange={(restMinutes) => setSchedule({ ...schedule, restMinutes })} />
      </ScrollView>
      <View style={styles.footer}>
        <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed, saving && styles.disabled]}
          onPress={apply} disabled={saving} accessibilityRole="button">
          <Text style={styles.buttonText}>{t('tournament.scheduleScreen.apply')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: a.background },
  scroll: { padding: 16 },
  hint: { fontSize: 14, fontFamily: 'Inter_400Regular', color: a.textSecondary, lineHeight: 20, marginBottom: 12 },
  inline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: a.backgroundElevated,
  },
  label: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: a.textPrimary },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: a.backgroundElevated },
  button: { backgroundColor: a.fill, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  buttonText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: a.onFill },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
