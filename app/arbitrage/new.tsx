import { useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Minus, Plus } from 'lucide-react-native';
import { palette } from '../../src/theme/tokens';
import { PRESET_TEAM_COLORS, LIBERO_PRESET_COLORS } from '../../src/utils/constants';
import { DEFAULT_INDOOR_CONFIG } from '../../src/models/match';
import type { MatchConfig } from '../../src/models/match';
import { validateAdHocTeam, validateAdHocRules, type AdHocTeamDraft } from '../../src/utils/adHocSetupValidation';
import { createAdHocMatch } from '../../src/services/adHocMatchService';
import type { AdHocTeamInput } from '../../src/services/adHocMatchService';

type Tab = 'home' | 'away' | 'rules';

interface TeamFormState {
  name: string;
  color: string;
  coachName: string;
  selected: number[];
  names: Record<number, string>;
  captainNumber: number | null;
  liberoNumbers: number[];
}

function emptyTeamState(color: string): TeamFormState {
  return { name: '', color, coachName: '', selected: [], names: {}, captainNumber: null, liberoNumbers: [] };
}

/** First preset libero color that differs from the team's own jersey color. */
function pickLiberoColor(teamColor: string, index: number): string {
  const candidates = LIBERO_PRESET_COLORS.filter((c) => c !== teamColor);
  return candidates[index % candidates.length] ?? LIBERO_PRESET_COLORS[index % LIBERO_PRESET_COLORS.length];
}

function toDraft(state: TeamFormState): AdHocTeamDraft {
  return {
    name: state.name,
    players: state.selected.map((n) => ({ number: n, name: state.names[n] ?? '' })),
    captainNumber: state.captainNumber,
    liberoNumbers: state.liberoNumbers,
  };
}

function toInput(state: TeamFormState): AdHocTeamInput {
  return {
    name: state.name.trim(),
    color: state.color,
    coachName: state.coachName.trim() || null,
    players: state.selected.map((n) => ({
      number: n,
      name: state.names[n]?.trim() || undefined,
      isLibero: state.liberoNumbers.includes(n),
    })),
    captainNumber: state.captainNumber,
  };
}

export default function ArbitrageSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('home');
  const [home, setHome] = useState<TeamFormState>(() => emptyTeamState(PRESET_TEAM_COLORS[0]));
  const [away, setAway] = useState<TeamFormState>(() => emptyTeamState(PRESET_TEAM_COLORS[1]));
  const [config, setConfig] = useState<MatchConfig>(DEFAULT_INDOOR_CONFIG);
  const [submitting, setSubmitting] = useState(false);

  function handleStart() {
    const homeErrors = validateAdHocTeam(toDraft(home));
    const awayErrors = validateAdHocTeam(toDraft(away));
    const rulesErrors = validateAdHocRules(config);

    if (homeErrors.length || awayErrors.length || rulesErrors.length) {
      const sections: string[] = [];
      if (homeErrors.length) sections.push(`${t('arbitrageSetup.tabHome')} :\n` + homeErrors.map((e) => `• ${e}`).join('\n'));
      if (awayErrors.length) sections.push(`${t('arbitrageSetup.tabAway')} :\n` + awayErrors.map((e) => `• ${e}`).join('\n'));
      if (rulesErrors.length) sections.push(`${t('arbitrageSetup.tabRules')} :\n` + rulesErrors.map((e) => `• ${e}`).join('\n'));
      Alert.alert(t('arbitrageSetup.fixErrors'), sections.join('\n\n'));
      if (homeErrors.length) setTab('home');
      else if (awayErrors.length) setTab('away');
      else setTab('rules');
      return;
    }

    Alert.alert(t('arbitrageSetup.confirmStart'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('arbitrageSetup.startMatch'), onPress: submit },
    ]);
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const match = await createAdHocMatch({
        format: 'indoor_6v6',
        mode: 'competition',
        config,
        home: toInput(home),
        away: toInput(away),
      });
      router.replace(`/match/${match.id}/arbitrage`);
    } catch (e) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.tabBar}>
        <TabButton label={t('arbitrageSetup.tabHome')} active={tab === 'home'} color={home.color} onPress={() => setTab('home')} />
        <TabButton label={t('arbitrageSetup.tabAway')} active={tab === 'away'} color={away.color} onPress={() => setTab('away')} />
        <TabButton label={t('arbitrageSetup.tabRules')} active={tab === 'rules'} onPress={() => setTab('rules')} />
      </View>

      {tab === 'home' && <TeamTab state={home} otherColor={away.color} onChange={setHome} t={t} />}
      {tab === 'away' && <TeamTab state={away} otherColor={home.color} onChange={setAway} t={t} />}
      {tab === 'rules' && <RulesTab config={config} onChange={setConfig} t={t} />}

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed, submitting && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={submitting}
          accessibilityRole="button"
        >
          <Text style={styles.startButtonText}>
            {submitting ? t('common.loading') : t('arbitrageSetup.startMatch')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function TabButton({
  label, active, color, onPress,
}: { label: string; active: boolean; color?: string; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.tabButton, active && styles.tabButtonActive]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      {color && <View style={[styles.tabDot, { backgroundColor: color }]} />}
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

// ─── Team tab ───────────────────────────────────────────────────────────────

function TeamTab({
  state, otherColor, onChange, t,
}: { state: TeamFormState; otherColor: string; onChange: (s: TeamFormState) => void; t: (key: string, opts?: Record<string, unknown>) => string }) {
  function toggleNumber(n: number) {
    if (state.selected.includes(n)) {
      onChange({
        ...state,
        selected: state.selected.filter((x) => x !== n),
        captainNumber: state.captainNumber === n ? null : state.captainNumber,
        liberoNumbers: state.liberoNumbers.filter((x) => x !== n),
      });
    } else {
      onChange({ ...state, selected: [...state.selected, n].sort((a, b) => a - b) });
    }
  }

  function setName(n: number, name: string) {
    onChange({ ...state, names: { ...state.names, [n]: name } });
  }

  function toggleCaptain(n: number) {
    const next = state.captainNumber === n ? null : n;
    onChange({
      ...state,
      captainNumber: next,
      liberoNumbers: next !== null ? state.liberoNumbers.filter((x) => x !== next) : state.liberoNumbers,
    });
  }

  function toggleLibero(n: number) {
    if (state.liberoNumbers.includes(n)) {
      onChange({ ...state, liberoNumbers: state.liberoNumbers.filter((x) => x !== n) });
    } else if (state.liberoNumbers.length < 2 && n !== state.captainNumber) {
      onChange({ ...state, liberoNumbers: [...state.liberoNumbers, n] });
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <FormField label={t('arbitrageSetup.teamName')} required>
        <TextInput
          style={styles.input}
          value={state.name}
          onChangeText={(name) => onChange({ ...state, name })}
          placeholder={t('arbitrageSetup.teamNamePlaceholder')}
          placeholderTextColor={palette.textMuted}
          maxLength={40}
        />
      </FormField>

      <FormField label={t('arbitrageSetup.jerseyColor')}>
        <View style={styles.colorGrid}>
          {PRESET_TEAM_COLORS.map((c) => {
            const isTaken = c === otherColor;
            return (
              <Pressable
                key={c}
                style={[
                  styles.colorSwatch, { backgroundColor: c },
                  state.color === c && styles.colorSwatchActive,
                  isTaken && styles.colorSwatchDisabled,
                ]}
                onPress={() => !isTaken && onChange({ ...state, color: c })}
                disabled={isTaken}
                accessibilityRole="radio"
                accessibilityState={{ selected: state.color === c, disabled: isTaken }}
              />
            );
          })}
        </View>
      </FormField>

      <FormField label={t('arbitrageSetup.coachName')}>
        <TextInput
          style={styles.input}
          value={state.coachName}
          onChangeText={(coachName) => onChange({ ...state, coachName })}
          placeholder={t('arbitrageSetup.coachNamePlaceholder')}
          placeholderTextColor={palette.textMuted}
          maxLength={40}
        />
      </FormField>

      <FormField label={t('arbitrageSetup.selectNumbers')}>
        <View style={styles.numberGrid}>
          {Array.from({ length: 100 }, (_, n) => n).map((n) => {
            const isSelected = state.selected.includes(n);
            return (
              <Pressable
                key={n}
                style={[styles.numberCell, isSelected && { backgroundColor: state.color, borderColor: state.color }]}
                onPress={() => toggleNumber(n)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
              >
                <Text style={[styles.numberCellText, isSelected && styles.numberCellTextActive]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
      </FormField>

      <FormField label={t('arbitrageSetup.selectedPlayers')}>
        {state.selected.length === 0 ? (
          <Text style={styles.emptyHint}>{t('arbitrageSetup.noPlayersSelected')}</Text>
        ) : (
          state.selected.map((n) => {
            const isCaptain = state.captainNumber === n;
            const liberoIndex = state.liberoNumbers.indexOf(n);
            const isLibero = liberoIndex !== -1;
            const liberoColor = isLibero ? pickLiberoColor(state.color, liberoIndex) : undefined;
            return (
              <View key={n} style={styles.playerRow}>
                <View style={[styles.playerNumBadge, { borderColor: state.color }]}>
                  <Text style={[styles.playerNumText, { color: state.color }]}>{n}</Text>
                </View>
                <TextInput
                  style={styles.playerNameInput}
                  value={state.names[n] ?? ''}
                  onChangeText={(name) => setName(n, name)}
                  placeholder={t('arbitrageSetup.playerNamePlaceholder')}
                  placeholderTextColor={palette.textMuted}
                  maxLength={30}
                />
                <Pressable
                  style={[styles.tagBtn, isCaptain && styles.tagBtnCaptainActive]}
                  onPress={() => toggleCaptain(n)}
                  accessibilityRole="button"
                  accessibilityLabel={t('arbitrageSetup.captain')}
                  accessibilityState={{ selected: isCaptain }}
                >
                  <Text style={[styles.tagBtnText, isCaptain && styles.tagBtnTextActive]}>C</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.tagBtn,
                    isLibero && { backgroundColor: liberoColor, borderColor: liberoColor },
                    (!isLibero && (state.liberoNumbers.length >= 2 || isCaptain)) && styles.tagBtnDisabled,
                  ]}
                  onPress={() => toggleLibero(n)}
                  disabled={!isLibero && (state.liberoNumbers.length >= 2 || isCaptain)}
                  accessibilityRole="button"
                  accessibilityLabel={t('arbitrageSetup.libero')}
                  accessibilityState={{ selected: isLibero }}
                >
                  <Text style={[styles.tagBtnText, isLibero && styles.tagBtnTextActive]}>L</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </FormField>
    </ScrollView>
  );
}

// ─── Rules tab ──────────────────────────────────────────────────────────────

function RulesTab({
  config, onChange, t,
}: { config: MatchConfig; onChange: (c: MatchConfig) => void; t: (key: string, opts?: Record<string, unknown>) => string }) {
  function set<K extends keyof MatchConfig>(key: K, value: MatchConfig[K]) {
    onChange({ ...config, [key]: value });
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.rulesPreset}>{t('arbitrageSetup.rulesPreset')}</Text>

      <Stepper label={t('arbitrageSetup.setsToWin')} value={config.setsToWin} min={1} max={5}
        onChange={(v) => set('setsToWin', v)} />
      <Stepper label={t('arbitrageSetup.pointsPerSet')} value={config.pointsPerSet} min={1} max={50} step={5}
        onChange={(v) => set('pointsPerSet', v)} />
      <Stepper label={t('arbitrageSetup.pointsLastSet')} value={config.pointsLastSet} min={1} max={50} step={5}
        onChange={(v) => set('pointsLastSet', v)} />

      <ToggleRow
        label={t('arbitrageSetup.winMarginToggle')}
        value={config.winMargin >= 2}
        onChange={(on) => set('winMargin', on ? 2 : 1)}
      />

      <Stepper label={t('arbitrageSetup.timeoutsPerSet')} value={config.timeoutsPerSet ?? 0} min={0} max={10}
        onChange={(v) => set('timeoutsPerSet', v)} />
      <Stepper label={`${t('arbitrageSetup.timeoutDuration')} (${t('arbitrageSetup.seconds')})`}
        value={config.timeoutDurationSec} min={10} max={120} step={5}
        onChange={(v) => set('timeoutDurationSec', v)} />
      <Stepper label={`${t('arbitrageSetup.breakBetweenSets')} (${t('arbitrageSetup.seconds')})`}
        value={config.breakBetweenSetsSec} min={0} max={600} step={30}
        onChange={(v) => set('breakBetweenSetsSec', v)} />
      <Stepper label={t('arbitrageSetup.substitutionsPerSet')} value={config.substitutionsPerSet ?? 0} min={0} max={12}
        onChange={(v) => set('substitutionsPerSet', v)} />

      <ToggleRow
        label={t('arbitrageSetup.sanctionsEnabled')}
        value={config.sanctionsEnabled}
        onChange={(on) => set('sanctionsEnabled', on)}
      />
    </ScrollView>
  );
}

function Stepper({
  label, value, onChange, min = 0, max = 99, step = 1,
}: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          style={[styles.stepperBtn, value <= min && styles.stepperBtnDisabled]}
          onPress={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          accessibilityRole="button"
        >
          <Minus size={16} color={value <= min ? palette.textMuted : palette.textPrimary} />
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable
          style={[styles.stepperBtn, value >= max && styles.stepperBtnDisabled]}
          onPress={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          accessibilityRole="button"
        >
          <Plus size={16} color={value >= max ? palette.textMuted : palette.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={[styles.toggleTrack, value && styles.toggleTrackActive]}>
        <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
      </View>
    </Pressable>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: palette.backgroundSurface,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabButtonActive: { backgroundColor: palette.backgroundElevated },
  tabButtonText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  tabButtonTextActive: { color: palette.textPrimary, fontFamily: 'Inter_700Bold' },
  tabDot: { width: 8, height: 8, borderRadius: 4 },

  scroll: { padding: 20, paddingBottom: 40 },
  field: { marginBottom: 20 },
  fieldLabel: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary,
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  required: { color: palette.accentPrimary },
  input: {
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: palette.textPrimary,
  },
  colorGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  colorSwatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: palette.textPrimary, transform: [{ scale: 1.1 }] },
  colorSwatchDisabled: { opacity: 0.25 },

  numberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  numberCell: {
    width: 30, height: 30, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  numberCellText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },
  numberCellTextActive: { color: '#fff' },

  emptyHint: { fontSize: 13, fontFamily: 'Inter_400Regular', color: palette.textMuted, paddingVertical: 8 },
  playerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.backgroundElevated,
  },
  playerNumBadge: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  playerNumText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  playerNameInput: {
    flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textPrimary,
    paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: palette.backgroundSurface, borderRadius: 8,
  },
  tagBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  tagBtnCaptainActive: { backgroundColor: palette.accentPrimary, borderColor: palette.accentPrimary },
  tagBtnDisabled: { opacity: 0.35 },
  tagBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.textSecondary },
  tagBtnTextActive: { color: '#fff' },

  rulesPreset: {
    fontSize: 12, fontFamily: 'Inter_500Medium', color: palette.textMuted,
    marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  stepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.backgroundElevated,
  },
  stepperLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.textPrimary, paddingRight: 12 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  stepperBtnDisabled: { opacity: 0.4 },
  stepperValue: { fontSize: 15, fontFamily: 'Inter_700Bold', color: palette.textPrimary, minWidth: 32, textAlign: 'center' },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.backgroundElevated,
  },
  toggleTrack: {
    width: 44, height: 26, borderRadius: 13, backgroundColor: palette.backgroundElevated,
    padding: 3, justifyContent: 'center',
  },
  toggleTrackActive: { backgroundColor: palette.accentPrimary },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: 'flex-start' },
  toggleThumbActive: { alignSelf: 'flex-end' },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: palette.backgroundElevated },
  startButton: { backgroundColor: palette.accentPrimary, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  startButtonPressed: { opacity: 0.85 },
  startButtonDisabled: { opacity: 0.5 },
  startButtonText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
});
