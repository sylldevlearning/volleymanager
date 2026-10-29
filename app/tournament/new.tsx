import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette } from '../../src/theme/tokens';
import { InfoTooltip } from '../../src/components/ui/InfoTooltip';
import { DetailsStep, FormatStep, SummaryStep, TeamsStep } from '../../src/components/tournament/WizardSteps';
import {
  applyTemplate,
  initialWizardState,
  previewTournament,
  templatePayload,
  toCreateInput,
  validateStep,
  type WizardError,
  type WizardState,
  type WizardStep,
} from '../../src/features/tournament/wizard';
import {
  createTournament,
  deleteTemplate,
  getTemplates,
  saveTemplate,
} from '../../src/services/tournamentService';
import type { TournamentTemplate } from '../../src/models/tournament';

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export default function NewTournamentScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const [state, setState] = useState<WizardState>(() => initialWizardState(new Date(), newSeed()));
  const [step, setStep] = useState<WizardStep>(1);
  const [errors, setErrors] = useState<WizardError[]>([]);
  const [templates, setTemplates] = useState<TournamentTemplate[]>([]);
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const created = useRef(false);
  const dirty = state.name.trim() !== '' || state.teams.length > 0;

  useEffect(() => { getTemplates().then(setTemplates); }, []);

  // Leaving with something typed asks first
  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (created.current || !dirty) return;
    e.preventDefault();
    Alert.alert(t('tournament.wizard.leaveTitle'), t('tournament.wizard.leaveMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('tournament.wizard.leave'), style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
    ]);
  }), [navigation, dirty, t]);

  const preview = useMemo(() => (step === 4 ? previewTournament(state) : null), [step, state]);

  function update(next: WizardState) {
    setState(next);
    if (errors.length) setErrors([]);
  }

  function goTo(next: WizardStep) {
    setErrors([]);
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function handleNext() {
    const found = validateStep(state, step);
    if (found.length > 0) {
      setErrors(found);
      return;
    }
    if (step < 4) goTo((step + 1) as WizardStep);
    else handleCreate();
  }

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      await createTournament(toCreateInput(state));
      created.current = true;
      router.back();
    } catch (e) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setCreating(false);
    }
  }

  function handleApplyTemplate(template: TournamentTemplate) {
    update(applyTemplate(state, template.payload));
    Alert.alert(t('tournament.wizard.templateApplied', { name: template.name }));
  }

  function handleDeleteTemplate(template: TournamentTemplate) {
    Alert.alert(t('tournament.wizard.deleteTemplateTitle'), t('tournament.wizard.deleteTemplateMessage', { name: template.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteTemplate(template.id);
          setTemplates(await getTemplates());
        },
      },
    ]);
  }

  async function handleSaveTemplate(name: string) {
    await saveTemplate(name, templatePayload(state));
    setTemplates(await getTemplates());
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerRight: () => <InfoTooltip textKey="help.tournamentWizard" /> }} />
      <View style={styles.progress}>
        <View style={styles.progressBar}>
          {[1, 2, 3, 4].map((s) => <View key={s} style={[styles.progressSegment, s <= step && styles.progressSegmentDone]} />)}
        </View>
        <Text style={styles.progressText}>
          {t('tournament.wizard.stepOf', { step })} · {t(`tournament.wizard.step${step}`)}
        </Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <DetailsStep state={state} onChange={update} templates={templates}
              onApplyTemplate={handleApplyTemplate} onDeleteTemplate={handleDeleteTemplate} />
          )}
          {step === 2 && <FormatStep state={state} onChange={update} />}
          {step === 3 && <TeamsStep state={state} onChange={update} />}
          {step === 4 && preview && (
            <SummaryStep state={state} onChange={update} preview={preview}
              onRedraw={() => update({ ...state, seed: newSeed() })} onSaveTemplate={handleSaveTemplate} />
          )}
        </ScrollView>

        {errors.length > 0 && (
          <View style={styles.errors}>
            <Text style={styles.errorsTitle}>{t('tournament.wizard.fixErrors')}</Text>
            {errors.map((code) => <Text key={code} style={styles.errorText}>• {t(`tournament.errors.${code}`)}</Text>)}
          </View>
        )}

        <View style={styles.footer}>
          {step > 1 && (
            <Pressable style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
              onPress={() => goTo((step - 1) as WizardStep)} accessibilityRole="button">
              <Text style={styles.backText}>{t('common.back')}</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [styles.nextButton, pressed && styles.pressed, creating && styles.disabled]}
            onPress={handleNext}
            disabled={creating}
            accessibilityRole="button"
          >
            <Text style={styles.nextText}>
              {step < 4 ? t('common.next') : creating ? t('tournament.wizard.creating') : t('tournament.wizard.create')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  progress: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  progressBar: { flexDirection: 'row', gap: 6 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: palette.backgroundElevated },
  progressSegmentDone: { backgroundColor: palette.accentPrimary },
  progressText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },
  scroll: { padding: 16, paddingBottom: 32 },
  errors: { paddingHorizontal: 16, paddingVertical: 10, gap: 2, backgroundColor: 'rgba(248, 81, 73, 0.12)' },
  errorsTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.error, marginBottom: 2 },
  errorText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.textPrimary, lineHeight: 20 },
  footer: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: palette.backgroundElevated },
  backButton: {
    paddingVertical: 16, paddingHorizontal: 20, borderRadius: 14, alignItems: 'center',
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  backText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary },
  nextButton: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: palette.accentPrimary },
  nextText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
