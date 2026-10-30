import { useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Minus, Plus } from 'lucide-react-native';
import { palette } from '../../src/theme/tokens';
import { PRESET_TEAM_COLORS } from '../../src/utils/constants';
import { LIBERO_COLOR_CHOICES, defaultLiberoColor, resolveLiberoColor } from '../../src/features/teams/liberoColor';
import { COMPACT_MAX_NUMBER, jerseyNumbers } from '../../src/features/teams/jerseyNumbers';
import { FormField, Stepper, ToggleRow } from '../../src/components/ui/FormControls';
import { InfoTooltip } from '../../src/components/ui/InfoTooltip';
import { DEFAULT_INDOOR_CONFIG } from '../../src/models/match';
import type { MatchConfig, MatchFormat } from '../../src/models/match';
import { FORMAT_PROFILES, applyPreset, defaultArbitrageConfig, isOfficial, presetOf } from '../../src/features/match/formatProfile';
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
  /** Libero jersey colour — distinct default, never the team's colour */
  liberoColor: string;
}

function emptyTeamState(color: string): TeamFormState {
  return {
    name: '', color, coachName: '', selected: [], names: {}, captainNumber: null, liberoNumbers: [],
    liberoColor: defaultLiberoColor(color),
  };
}

function toDraft(state: TeamFormState): AdHocTeamDraft {
  return {
    name: state.name,
    players: state.selected.map((n) => ({ number: n, name: state.names[n] ?? '' })),
    captainNumber: state.captainNumber,
    liberoNumbers: state.liberoNumbers,
    color: state.color,
    liberoColor: state.liberoColor,
  };
}

function toInput(state: TeamFormState): AdHocTeamInput {
  return {
    name: state.name.trim(),
    color: state.color,
    coachName: state.coachName.trim() || null,
    liberoColor: state.liberoNumbers.length > 0 ? state.liberoColor : null,
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
  const [format, setFormat] = useState<MatchFormat>('indoor_6v6');
  const [config, setConfig] = useState<MatchConfig>(DEFAULT_INDOOR_CONFIG);
  const hasLibero = FORMAT_PROFILES[format].hasLibero;

  function changeFormat(next: MatchFormat) {
    setFormat(next);
    setConfig(defaultArbitrageConfig(next));
    // No libero outside 6×6
    if (!FORMAT_PROFILES[next].hasLibero) {
      setHome((h) => ({ ...h, liberoNumbers: [] }));
      setAway((a) => ({ ...a, liberoNumbers: [] }));
    }
  }
  const [submitting, setSubmitting] = useState(false);

  function handleStart() {
    const homeErrors = validateAdHocTeam(toDraft(home), format);
    const awayErrors = validateAdHocTeam(toDraft(away), format);
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
        format,
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
      {/* What the format and the Leisure / Official rules change */}
      <Stack.Screen options={{ headerRight: () => <InfoTooltip textKey="help.arbitrageSetup" /> }} />
      <View style={styles.formatRow} accessibilityRole="radiogroup" accessibilityLabel={t('arbitrageSetup.format')}>
        {(['indoor_6v6', 'indoor_4v4', 'indoor_3v3', 'beach_2v2'] as MatchFormat[]).map((f) => (
          <Pressable
            key={f}
            style={[styles.formatChip, format === f && styles.formatChipActive]}
            onPress={() => changeFormat(f)}
            accessibilityRole="radio"
            accessibilityState={{ selected: format === f }}
          >
            <Text style={[styles.formatChipText, format === f && styles.formatChipTextActive]}>{t(`arbitrageSetup.formats.${f}`)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.tabBar}>
        <TabButton label={t('arbitrageSetup.tabHome')} active={tab === 'home'} color={home.color} onPress={() => setTab('home')} />
        <TabButton label={t('arbitrageSetup.tabAway')} active={tab === 'away'} color={away.color} onPress={() => setTab('away')} />
        <TabButton label={t('arbitrageSetup.tabRules')} active={tab === 'rules'} onPress={() => setTab('rules')} />
      </View>

      {tab === 'home' && <TeamTab state={home} otherColor={away.color} onChange={setHome} hasLibero={hasLibero} t={t} />}
      {tab === 'away' && <TeamTab state={away} otherColor={home.color} onChange={setAway} hasLibero={hasLibero} t={t} />}
      {tab === 'rules' && <RulesTab format={format} config={config} onChange={setConfig} t={t} />}

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
  state, otherColor, onChange, hasLibero, t,
}: { state: TeamFormState; otherColor: string; onChange: (s: TeamFormState) => void; hasLibero: boolean; t: (key: string, opts?: Record<string, unknown>) => string }) {
  // 0-20 first; already open when a bigger number is selected
  const [showAllNumbers, setShowAllNumbers] = useState(() => state.selected.some((n) => n > COMPACT_MAX_NUMBER));

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
                onPress={() => !isTaken && onChange({ ...state, color: c, liberoColor: resolveLiberoColor(state.liberoColor, c) })}
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
          {jerseyNumbers(showAllNumbers).map((n) => {
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
          <Pressable
            style={[styles.numberCell, styles.numberCellToggle]}
            onPress={() => setShowAllNumbers((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showAllNumbers ? t('arbitrageSetup.fewerNumbers') : t('arbitrageSetup.moreNumbers')}
          >
            {showAllNumbers
              ? <Minus size={18} color={palette.textPrimary} />
              : <Plus size={18} color={palette.textPrimary} />}
          </Pressable>
        </View>
      </FormField>

      <FormField label={t('arbitrageSetup.selectedPlayers')}>
        {state.selected.length === 0 ? (
          <Text style={styles.emptyHint}>{t('arbitrageSetup.noPlayersSelected')}</Text>
        ) : (
          state.selected.map((n) => {
            const isCaptain = state.captainNumber === n;
            const isLibero = state.liberoNumbers.includes(n);
            const liberoColor = isLibero ? state.liberoColor : undefined;
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
                {hasLibero && <Pressable
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
                </Pressable>}
              </View>
            );
          })
        )}
      </FormField>

      {state.liberoNumbers.length > 0 && (
        <FormField label={t('arbitrageSetup.liberoColor')}>
          <View style={styles.colorGrid}>
            {LIBERO_COLOR_CHOICES.map((c) => {
              // The libero must stand out from their own team
              const isTeamColor = c === state.color;
              return (
                <Pressable
                  key={c}
                  style={[
                    styles.colorSwatch, { backgroundColor: c },
                    state.liberoColor === c && styles.colorSwatchActive,
                    isTeamColor && styles.colorSwatchDisabled,
                  ]}
                  onPress={() => !isTeamColor && onChange({ ...state, liberoColor: c })}
                  disabled={isTeamColor}
                  accessibilityRole="radio"
                  accessibilityLabel={t('arbitrageSetup.liberoColor')}
                  accessibilityState={{ selected: state.liberoColor === c, disabled: isTeamColor }}
                />
              );
            })}
          </View>
          <Text style={styles.emptyHint}>{t('arbitrageSetup.liberoColorHint')}</Text>
        </FormField>
      )}
    </ScrollView>
  );
}

// ─── Rules tab ──────────────────────────────────────────────────────────────

function RulesTab({
  format, config, onChange, t,
}: { format: MatchFormat; config: MatchConfig; onChange: (c: MatchConfig) => void; t: (key: string, opts?: Record<string, unknown>) => string }) {
  function set<K extends keyof MatchConfig>(key: K, value: MatchConfig[K]) {
    onChange({ ...config, [key]: value });
  }
  const preset = presetOf(format);
  if (preset) return <SmallFormatRules format={format} config={config} onChange={onChange} labelKey={preset.labelKey} t={t} />;

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

// ─── Rules of the small formats (4×4, 3×3, 2×2) ────────────────────────────

function SmallFormatRules({
  format, config, onChange, labelKey, t,
}: {
  format: MatchFormat; config: MatchConfig; onChange: (c: MatchConfig) => void; labelKey: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const official = isOfficial(format, config);
  const set = (patch: Partial<MatchConfig>) => onChange({ ...config, ...patch });
  const subsAllowed = config.substitutionMode !== 'none';
  const switching = config.courtSwitch ?? null;

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.presetRow}>
        {(['leisure', 'official'] as const).map((p) => {
          const active = p === 'official' ? official : !official;
          return (
            <Pressable key={p} style={[styles.presetChip, active && styles.presetChipActive]}
              onPress={() => onChange(applyPreset(format, p, config))} accessibilityRole="radio" accessibilityState={{ selected: active }}>
              <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                {p === 'leisure' ? t('arbitrageSetup.presetLeisure') : t(labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Stepper label={t('arbitrageSetup.setsToWin')} value={config.setsToWin} min={1} max={3}
        onChange={(v) => set({ setsToWin: v })} />
      <Stepper label={t('arbitrageSetup.pointsPerSet')} value={config.pointsPerSet} min={5} max={30}
        onChange={(v) => set({ pointsPerSet: v })} />
      {config.setsToWin > 1 && (
        <Stepper label={t('arbitrageSetup.pointsLastSet')} value={config.pointsLastSet} min={5} max={30}
          onChange={(v) => set({ pointsLastSet: v })} />
      )}
      <ToggleRow label={t('arbitrageSetup.winMarginToggle')} value={config.winMargin >= 2}
        onChange={(on) => set({ winMargin: on ? 2 : 1 })} />

      <Stepper label={t('arbitrageSetup.timeoutsPerSet')} value={config.timeoutsPerSet ?? 0} min={0} max={4}
        onChange={(v) => set({ timeoutsPerSet: v })} />
      <Stepper label={`${t('arbitrageSetup.timeoutDuration')} (${t('arbitrageSetup.seconds')})`}
        value={config.timeoutDurationSec} min={10} max={120} step={5} onChange={(v) => set({ timeoutDurationSec: v })} />
      {format === 'beach_2v2' && (
        <ToggleRow label={t('arbitrageSetup.technicalTimeout')} value={config.technicalTimeout === true}
          onChange={(on) => set({ technicalTimeout: on })} />
      )}

      <ToggleRow label={t('arbitrageSetup.subsAllowed')} value={subsAllowed}
        onChange={(on) => set(on ? { substitutionMode: 'free', unlimitedSubstitutions: true } : { substitutionMode: 'none' })} />
      {subsAllowed && (
        <ToggleRow label={t('arbitrageSetup.subsUnlimited')} value={config.unlimitedSubstitutions}
          onChange={(on) => set({ unlimitedSubstitutions: on, substitutionsPerSet: on ? null : config.substitutionsPerSet ?? 4 })} />
      )}
      {subsAllowed && !config.unlimitedSubstitutions && (
        <Stepper label={t('arbitrageSetup.substitutionsPerSet')} value={config.substitutionsPerSet ?? 0} min={1} max={12}
          onChange={(v) => set({ substitutionsPerSet: v })} />
      )}
      {format === 'indoor_4v4' && subsAllowed && (
        <ToggleRow label={t('arbitrageSetup.m13Subs')} value={config.m13Substitutions === true}
          onChange={(on) => set({ m13Substitutions: on })} />
      )}
      {format !== 'beach_2v2' && (
        <ToggleRow label={t('arbitrageSetup.positionalFaults')} value={config.positionalFaults === true}
          onChange={(on) => set({ positionalFaults: on })} />
      )}

      <ToggleRow label={t('arbitrageSetup.courtSwitch')} value={switching !== null}
        onChange={(on) => set({ courtSwitch: on ? { every: 7, everyDecidingSet: 5 } : null })} />
      {switching && (
        <>
          <Stepper label={t('arbitrageSetup.courtSwitchEvery')} value={switching.every} min={3} max={15}
            onChange={(v) => set({ courtSwitch: { ...switching, every: v } })} />
          <Stepper label={t('arbitrageSetup.courtSwitchDeciding')} value={switching.everyDecidingSet} min={3} max={15}
            onChange={(v) => set({ courtSwitch: { ...switching, everyDecidingSet: v } })} />
        </>
      )}

      <ToggleRow label={t('arbitrageSetup.sanctionsEnabled')} value={config.sanctionsEnabled}
        onChange={(on) => set({ sanctionsEnabled: on })} />
      <Text style={styles.emptyHint}>{t('arbitrageSetup.noLibero')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },

  formatRow: { flexDirection: 'row', gap: 6, marginHorizontal: 16, marginTop: 8, marginBottom: 8 },
  formatChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  formatChipActive: { backgroundColor: palette.accentPrimary, borderColor: palette.accentPrimary },
  formatChipText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: palette.textSecondary },
  formatChipTextActive: { color: '#fff' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  presetChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  presetChipActive: { backgroundColor: palette.accentSecondary, borderColor: palette.accentSecondary },
  presetChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },
  presetChipTextActive: { color: '#fff' },
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

  numberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  numberCell: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  numberCellText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },
  numberCellToggle: { borderStyle: 'dashed', borderColor: palette.textMuted },
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

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: palette.backgroundElevated },
  startButton: { backgroundColor: palette.accentPrimary, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  startButtonPressed: { opacity: 0.85 },
  startButtonDisabled: { opacity: 0.5 },
  startButtonText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
});
