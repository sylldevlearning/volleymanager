import { useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { formatClock, formatDate, uses12HourClock } from '../../i18n/format';
import { CalendarDays, ChevronDown, ChevronUp, Clock, Save, Shuffle, Users, X } from 'lucide-react-native';
import { palette } from '../../theme/tokens';
import { FormField, Stepper, ToggleRow } from '../ui/FormControls';
import { TeamLibrarySheet } from './TeamLibrarySheet';
import { poolName } from '../../features/tournament/engine/pools';
import { POINTS_PRESETS } from '../../features/tournament/engine/defaults';
import {
  addLibraryTeams,
  dateFromIso,
  dateFromTime,
  displayDate,
  displayName,
  duplicateTeamKeys,
  formatHint,
  moveTeam,
  previewTournament,
  removeTeam,
  renameTeam,
  resolvedBrassage,
  resolvedCourts,
  resolvedPools,
  setFormat,
  setGameType,
  setTeamCount,
  isoFromDate,
  timeFromDate,
  type TournamentPreview,
  type WizardState,
} from '../../features/tournament/wizard';
import type {
  PointsScale,
  SetRules,
  TiebreakerRule,
  TournamentFormat,
  TournamentGameType,
  TournamentTemplate,
} from '../../models/tournament';

const GAME_TYPES: TournamentGameType[] = ['indoor_6v6', 'indoor_4v4', 'indoor_3v3', 'beach_2v2'];
const FORMATS: TournamentFormat[] = ['round_robin', 'pools_knockout', 'knockout', 'brassage_levels'];

interface StepProps {
  state: WizardState;
  onChange: (state: WizardState) => void;
}

// ─── Small pieces ───────────────────────────────────────────────────────────

export function Chip({ label, active, onPress, onLongPress }: { label: string; active: boolean; onPress: () => void; onLongPress?: () => void }) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ChoiceCard({ title, description, active, onPress }: { title: string; description: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.choice, active && styles.choiceActive]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <View style={[styles.radio, active && styles.radioActive]}>{active && <View style={styles.radioDot} />}</View>
      <View style={styles.choiceText}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceDesc}>{description}</Text>
      </View>
    </Pressable>
  );
}

function IconButton({ icon, label, onPress, disabled }: { icon: ReactNode; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      style={[styles.iconButton, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon}
    </Pressable>
  );
}

function SecondaryButton({ icon, label, onPress, disabled }: { icon: ReactNode; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.secondary, pressed && styles.pressed, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      {icon}
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Native date / time picker. Android opens its dialog on press; iOS shows the
 * compact picker in place.
 */
export function PickerField({ mode, value, label, onPick }: { mode: 'date' | 'time'; value: Date; label: string; onPick: (date: Date) => void }) {
  const [open, setOpen] = useState(false);
  const Icon = mode === 'date' ? CalendarDays : Clock;

  const { i18n } = useTranslation();
  function handleChange(event: DateTimePickerEvent, picked?: Date) {
    setOpen(false);
    if (event.type === 'set' && picked) onPick(picked);
  }

  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker value={value} mode={mode} display="compact" themeVariant="dark"
        onChange={handleChange} accessibilityLabel={label} style={styles.iosPicker} />
    );
  }
  return (
    <>
      <Pressable style={[styles.input, styles.pickerButton]} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label}>
        <Text style={styles.pickerText}>{mode === 'date' ? formatDate(value, i18n.language) : formatClock(timeFromDate(value), i18n.language)}</Text>
        <Icon size={18} color={palette.textSecondary} />
      </Pressable>
      {open && <DateTimePicker value={value} mode={mode} is24Hour={!uses12HourClock(i18n.language)} onChange={handleChange} />}
    </>
  );
}

// ─── Step 1: details ───────────────────────────────────────────────────────

export function DetailsStep({
  state, onChange, templates, onApplyTemplate, onDeleteTemplate,
}: StepProps & {
  templates: TournamentTemplate[];
  onApplyTemplate: (template: TournamentTemplate) => void;
  onDeleteTemplate: (template: TournamentTemplate) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <View>
      {templates.length > 0 && (
        <FormField label={t('tournament.wizard.fromTemplate')}>
          <View style={styles.chips}>
            {templates.map((tpl) => (
              <Chip key={tpl.id} label={tpl.name} active={false} onPress={() => onApplyTemplate(tpl)} onLongPress={() => onDeleteTemplate(tpl)} />
            ))}
          </View>
        </FormField>
      )}

      <FormField label={t('tournament.wizard.name')} required>
        <TextInput
          style={styles.input}
          value={state.name}
          onChangeText={(name) => onChange({ ...state, name })}
          placeholder={t('tournament.wizard.namePlaceholder')}
          placeholderTextColor={palette.textMuted}
          maxLength={60}
        />
      </FormField>

      <FormField label={t('tournament.wizard.date')} required>
        <PickerField mode="date" value={dateFromIso(state.date)} label={t('tournament.wizard.date')}
          onPick={(date) => onChange({ ...state, date: isoFromDate(date) })} />
      </FormField>

      <FormField label={t('tournament.wizard.location')}>
        <TextInput
          style={styles.input}
          value={state.location}
          onChangeText={(location) => onChange({ ...state, location })}
          placeholder={t('tournament.wizard.locationPlaceholder')}
          placeholderTextColor={palette.textMuted}
          maxLength={80}
        />
      </FormField>

      <FormField label={t('tournament.wizard.gameType')}>
        <View style={styles.chips}>
          {GAME_TYPES.map((type) => (
            <Chip key={type} label={t(`tournament.gameType.${type}`)} active={state.gameType === type} onPress={() => onChange(setGameType(state, type))} />
          ))}
        </View>
      </FormField>
    </View>
  );
}

// ─── Step 2: format and rules ──────────────────────────────────────────────

function SetRulesEditor({ rules, onChange }: { rules: SetRules; onChange: (rules: SetRules) => void }) {
  const { t, i18n } = useTranslation();
  const hasDecidingSet = rules.setsToWin > 1;
  return (
    <View>
      <Stepper label={t('tournament.wizard.setsToWin')} value={rules.setsToWin} min={1} max={3}
        onChange={(setsToWin) => onChange({ ...rules, setsToWin })} />
      <Stepper label={t('tournament.wizard.pointsPerSet')} value={rules.pointsPerSet} min={5} max={50}
        onChange={(pointsPerSet) => onChange({ ...rules, pointsPerSet })} />
      {hasDecidingSet && (
        <ToggleRow label={t('tournament.wizard.tieBreak')} value={rules.tieBreak} onChange={(tieBreak) => onChange({ ...rules, tieBreak })} />
      )}
      {hasDecidingSet && rules.tieBreak && (
        <Stepper label={t('tournament.wizard.tieBreakPoints')} value={rules.pointsLastSet} min={5} max={50}
          onChange={(pointsLastSet) => onChange({ ...rules, pointsLastSet })} />
      )}
      <Stepper label={t('tournament.wizard.winMargin')} value={rules.winMargin} min={1} max={5}
        onChange={(winMargin) => onChange({ ...rules, winMargin })} />
    </View>
  );
}

const POINT_ROWS: (keyof PointsScale)[] = ['winClear', 'winTight', 'lossTight', 'lossClear', 'forfeitLoss'];
const samePoints = (a: PointsScale, b: PointsScale) => POINT_ROWS.every((k) => a[k] === b[k]);

export function FormatStep({ state, onChange }: StepProps) {
  const { t, i18n } = useTranslation();
  const [advanced, setAdvanced] = useState(false);

  function moveTiebreaker(rule: TiebreakerRule, delta: -1 | 1) {
    const list = [...state.tiebreakers];
    const i = list.indexOf(rule);
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    onChange({ ...state, tiebreakers: list });
  }

  return (
    <View>
      <FormField label={t('tournament.wizard.format')}>
        <View style={styles.choices}>
          {FORMATS.map((format) => (
            <ChoiceCard
              key={format}
              title={t(`tournament.format.${format}`)}
              description={t(`tournament.formatDesc.${format}`)}
              active={state.format === format}
              onPress={() => onChange(setFormat(state, format))}
            />
          ))}
        </View>
      </FormField>

      <FormField label={t('tournament.wizard.rules')}>
        <SetRulesEditor rules={state.match} onChange={(match) => onChange({ ...state, match })} />
      </FormField>

      <Pressable style={styles.advancedToggle} onPress={() => setAdvanced((v) => !v)} accessibilityRole="button">
        <Text style={styles.advancedText}>{advanced ? t('tournament.wizard.hideAdvanced') : t('tournament.wizard.showAdvanced')}</Text>
        {advanced ? <ChevronUp size={18} color={palette.info} /> : <ChevronDown size={18} color={palette.info} />}
      </Pressable>

      {advanced && (
        <View>
          {state.format !== 'round_robin' && (
            <FormField label={t('tournament.wizard.finalsTitle')}>
              <ToggleRow label={t('tournament.wizard.thirdPlace')} value={state.thirdPlace}
                onChange={(thirdPlace) => onChange({ ...state, thirdPlace })} />
              <ToggleRow label={t('tournament.wizard.finalsRules')} value={state.finalsMatch !== null}
                onChange={(on) => onChange({ ...state, finalsMatch: on ? { ...state.match } : null })} />
              {state.finalsMatch && (
                <SetRulesEditor rules={state.finalsMatch} onChange={(finalsMatch) => onChange({ ...state, finalsMatch })} />
              )}
            </FormField>
          )}

          {state.format !== 'knockout' && (
            <ToggleRow label={t('tournament.wizard.legs')} value={state.legs === 2}
              onChange={(on) => onChange({ ...state, legs: on ? 2 : 1 })} />
          )}

          {state.format !== 'knockout' && (
            <>
              <FormField label={t('tournament.wizard.points')}>
                <View style={[styles.chips, styles.presetChips]}>
                  <Chip label={t('tournament.wizard.pointsPresetSimple')} active={samePoints(state.points, POINTS_PRESETS.simple)}
                    onPress={() => onChange({ ...state, points: { ...POINTS_PRESETS.simple } })} />
                  <Chip label={t('tournament.wizard.pointsPresetFivb')} active={samePoints(state.points, POINTS_PRESETS.fivb)}
                    onPress={() => onChange({ ...state, points: { ...POINTS_PRESETS.fivb } })} />
                </View>
                {POINT_ROWS.map((key) => (
                  <Stepper key={key} label={t(`tournament.wizard.${key}`)} value={state.points[key]} min={-3} max={5}
                    onChange={(v) => onChange({ ...state, points: { ...state.points, [key]: v } })} />
                ))}
              </FormField>

              <FormField label={t('tournament.wizard.tiebreakers')}>
                {state.tiebreakers.map((rule, i) => (
                  <View key={rule} style={styles.orderRow}>
                    <Text style={styles.orderIndex}>{i + 1}</Text>
                    <Text style={styles.orderLabel}>{t(`tournament.tiebreaker.${rule}`)}</Text>
                    <IconButton icon={<ChevronUp size={18} color={palette.textPrimary} />} label={t('tournament.wizard.moveUp')}
                      onPress={() => moveTiebreaker(rule, -1)} disabled={i === 0} />
                    <IconButton icon={<ChevronDown size={18} color={palette.textPrimary} />} label={t('tournament.wizard.moveDown')}
                      onPress={() => moveTiebreaker(rule, 1)} disabled={i === state.tiebreakers.length - 1} />
                  </View>
                ))}
              </FormField>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Step 3: teams and planning ────────────────────────────────────────────

/** "3 poules de 4 et 1 poule de 3" */
function poolSizesText(pools: string[][], t: (key: string, opts?: Record<string, unknown>) => string): string {
  const bySize = new Map<number, number>();
  for (const p of pools) bySize.set(p.length, (bySize.get(p.length) ?? 0) + 1);
  return [...bySize.entries()]
    .sort(([a], [b]) => b - a)
    .map(([size, count]) => t('tournament.wizard.poolsOf', { count, size }))
    .join(t('tournament.wizard.and'));
}

/** "6 h 45", "40 min" — written by each language */
function durationText(minutes: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? t('tournament.wizard.durationMinutes', { m }) : t('tournament.wizard.durationHours', { h, m: String(m).padStart(2, '0') });
}

export function TeamsStep({ state, onChange }: StepProps) {
  const { t, i18n } = useTranslation();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const label = (k: number) => t('tournament.wizard.teamNumber', { n: k });
  const hint = formatHint(state);
  const seeded = state.seeding === 'seeded';
  const n = state.teams.length;
  const pools = resolvedPools(state);
  const brassage = resolvedBrassage(state);
  const duplicates = duplicateTeamKeys(state);

  // Team names do not change the estimate: no recomputing while typing
  const { format, match, finalsMatch, points, tiebreakers, thirdPlace, legs, courts, startTime, matchMinutes, restMinutes, seeding, seed } = state;
  const estimate = useMemo(
    () => previewTournament(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [format, match, finalsMatch, points, tiebreakers, thirdPlace, legs, state.pools, state.brassage, courts, startTime, matchMinutes, restMinutes, seeding, seed, n],
  );

  const setPools = (patch: Partial<typeof pools>) => onChange({ ...state, pools: { ...pools, ...patch } });

  return (
    <View>
      <Stepper label={t('tournament.wizard.teamCount')} value={n} min={2} max={64}
        onChange={(count) => onChange(setTeamCount(state, count, label))} />
      <Stepper label={t('tournament.wizard.courts')} value={resolvedCourts(state)} min={1} max={20}
        onChange={(c) => onChange({ ...state, courts: c })} />

      <View style={styles.estimate}>
        {estimate.errors.length > 0
          ? estimate.errors.map((code) => <Text key={code} style={styles.error}>• {t(`tournament.errors.${code}`)}</Text>)
          : (
            <>
              {estimate.pools.length > 0 && <Text style={styles.estimateStrong}>{poolSizesText(estimate.pools, t)}</Text>}
              <Text style={styles.estimateText}>
                {t('tournament.wizard.summaryMatches', { count: estimate.matchCount })} · {t('tournament.wizard.summaryEnd', { time: formatClock(estimate.endTime ?? '', i18n.language) })}
              </Text>
              <Text style={styles.estimateText}>{t('tournament.wizard.summaryDuration', { duration: durationText(estimate.durationMinutes ?? 0, t) })}</Text>
              {estimate.matchesPerTeam && (
                <Text style={styles.estimateText}>
                  {estimate.matchesPerTeam.min === estimate.matchesPerTeam.max
                    ? t('tournament.wizard.matchesPerTeam', { count: estimate.matchesPerTeam.min })
                    : t('tournament.wizard.matchesPerTeamRange', { min: estimate.matchesPerTeam.min, max: estimate.matchesPerTeam.max })}
                </Text>
              )}
            </>
          )}
      </View>

      {hint && (
        <View style={styles.hintBox}>
          <Text style={styles.hintBoxText}>{t(`tournament.wizard.hint_${hint}`, { count: n })}</Text>
          <Pressable onPress={() => onChange(setFormat(state, hint))} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.hintAction}>{t('tournament.wizard.applyHint')}</Text>
          </Pressable>
        </View>
      )}

      <FormField label={t('tournament.wizard.teams', { count: n })}>
        <SecondaryButton icon={<Users size={18} color={palette.textPrimary} />} label={t('tournament.wizard.fromLibrary')}
          onPress={() => setLibraryOpen(true)} />

        <ToggleRow label={t('tournament.wizard.seeding')} value={seeded}
          onChange={(on) => onChange({ ...state, seeding: on ? 'seeded' : 'random' })} />
        {seeded && <Text style={styles.hint}>{t('tournament.wizard.seedingHint')}</Text>}

        {state.teams.map((team, i) => {
          const duplicate = duplicates.has(team.key);
          return (
            <View key={team.key} style={[styles.teamRow, duplicate && styles.teamRowDuplicate]}>
              <View style={styles.teamLine}>
                {seeded && <Text style={styles.orderIndex}>{i + 1}</Text>}
                <View style={[styles.teamDot, { backgroundColor: team.color }]} />
                <TextInput
                  style={styles.teamNameInput}
                  value={team.name}
                  onChangeText={(name) => onChange(renameTeam(state, team.key, name))}
                  placeholder={team.fallbackName}
                  placeholderTextColor={palette.textMuted}
                  accessibilityLabel={t('tournament.wizard.teamNameLabel', { n: i + 1 })}
                  selectTextOnFocus
                  maxLength={40}
                />
                {seeded && (
                  <>
                    <IconButton icon={<ChevronUp size={18} color={palette.textPrimary} />} label={t('tournament.wizard.moveUp')}
                      onPress={() => onChange(moveTeam(state, team.key, -1))} disabled={i === 0} />
                    <IconButton icon={<ChevronDown size={18} color={palette.textPrimary} />} label={t('tournament.wizard.moveDown')}
                      onPress={() => onChange(moveTeam(state, team.key, 1))} disabled={i === n - 1} />
                  </>
                )}
                <IconButton icon={<X size={18} color={palette.textSecondary} />} label={t('tournament.wizard.removeTeam', { name: displayName(team) })}
                  onPress={() => onChange(removeTeam(state, team.key))} disabled={n <= 2} />
              </View>
              {duplicate && <Text style={styles.duplicateText}>{t('tournament.wizard.duplicateName')}</Text>}
            </View>
          );
        })}
      </FormField>

      {state.format === 'brassage_levels' && (
        <FormField label={`${t('tournament.wizard.brassage')}${state.brassage ? '' : ` · ${t('tournament.wizard.poolsAuto')}`}`}>
          <Stepper label={t('tournament.wizard.brassageRounds')} value={brassage.rounds} min={1} max={4}
            onChange={(rounds) => onChange({ ...state, brassage: { ...brassage, rounds } })} />
          <Stepper label={t('tournament.wizard.brassageLevels')} value={brassage.levels} min={1} max={Math.max(1, Math.min(4, Math.floor(n / 2)))}
            onChange={(levels) => onChange({ ...state, brassage: { ...brassage, levels } })} />
          <Text style={styles.hint}>{t('tournament.wizard.brassageHint')}</Text>
          {state.brassage && (
            <Pressable onPress={() => onChange({ ...state, brassage: null })} accessibilityRole="button" style={styles.linkRow}>
              <Text style={styles.hintAction}>{t('tournament.wizard.poolsReset')}</Text>
            </Pressable>
          )}
        </FormField>
      )}

      {state.format === 'pools_knockout' && (
        <FormField label={`${t('tournament.wizard.pools')}${state.pools ? '' : ` · ${t('tournament.wizard.poolsAuto')}`}`}>
          <Stepper label={t('tournament.wizard.poolCount')} value={pools.count} min={1} max={Math.max(1, Math.floor(n / 2))}
            onChange={(count) => setPools({ count, bestOthers: Math.min(pools.bestOthers, count) })} />
          <Stepper label={t('tournament.wizard.qualifiers')} value={pools.qualifiersPerPool} min={1} max={Math.max(1, Math.floor(n / pools.count))}
            onChange={(qualifiersPerPool) => setPools({ qualifiersPerPool })} />
          <Stepper label={t('tournament.wizard.bestOthers')} value={pools.bestOthers} min={0} max={pools.count}
            onChange={(bestOthers) => setPools({ bestOthers })} />
          {state.pools && (
            <Pressable onPress={() => onChange({ ...state, pools: null })} accessibilityRole="button" style={styles.linkRow}>
              <Text style={styles.hintAction}>{t('tournament.wizard.poolsReset')}</Text>
            </Pressable>
          )}
        </FormField>
      )}

      <FormField label={t('tournament.wizard.planning')}>
        <View style={styles.inlineField}>
          <Text style={styles.inlineLabel}>{t('tournament.wizard.startTime')}</Text>
          <PickerField mode="time" value={dateFromTime(state.startTime)} label={t('tournament.wizard.startTime')}
            onPick={(time) => onChange({ ...state, startTime: timeFromDate(time) })} />
        </View>
        <Stepper label={t('tournament.wizard.matchMinutes')} value={state.matchMinutes} min={10} max={120} step={5}
          onChange={(m) => onChange({ ...state, matchMinutes: m })} />
        <Stepper label={t('tournament.wizard.restMinutes')} value={state.restMinutes} min={0} max={60} step={5}
          onChange={(m) => onChange({ ...state, restMinutes: m })} />
        <Text style={styles.hint}>{t('tournament.wizard.restHint')}</Text>
      </FormField>

      <TeamLibrarySheet
        visible={libraryOpen}
        alreadyAdded={new Set(state.teams.map((team) => team.teamId).filter((id): id is string => id !== null))}
        onClose={() => setLibraryOpen(false)}
        onAdd={(teams) => {
          onChange(addLibraryTeams(state, teams, label));
          setLibraryOpen(false);
        }}
      />
    </View>
  );
}

// ─── Step 4: summary ───────────────────────────────────────────────────────

export function SummaryStep({
  state, preview, onRedraw, onSaveTemplate,
}: StepProps & {
  preview: TournamentPreview;
  onRedraw: () => void;
  onSaveTemplate: (name: string) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [templateName, setTemplateName] = useState('');
  const [saved, setSaved] = useState(false);
  const rules = state.match;

  async function save() {
    await onSaveTemplate(templateName);
    setSaved(true);
    setTemplateName('');
  }

  return (
    <View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{state.name.trim()}</Text>
        <Text style={styles.summaryLine}>{[state.date ? formatDate(state.date, i18n.language) : '', state.location.trim()].filter(Boolean).join(' · ')}</Text>
        <Text style={styles.summaryLine}>{t(`tournament.gameType.${state.gameType}`)} · {t(`tournament.format.${state.format}`)}</Text>
        <Text style={styles.summaryLine}>
          {t('tournament.wizard.summaryRules', { sets: rules.setsToWin, points: rules.pointsPerSet })}
          {rules.setsToWin > 1 && rules.tieBreak ? t('tournament.wizard.summaryTieBreak', { points: rules.pointsLastSet }) : ''}
        </Text>
        <Text style={styles.summaryLine}>
          {t('tournament.wizard.summaryTeams', { count: state.teams.length })} · {t('tournament.wizard.summaryCourts', { count: resolvedCourts(state), time: formatClock(state.startTime, i18n.language) })}
        </Text>
        {preview.errors.length === 0 && (
          <Text style={styles.summaryStrong}>
            {t('tournament.wizard.summaryMatches', { count: preview.matchCount })} · {t('tournament.wizard.summaryEnd', { time: formatClock(preview.endTime ?? '', i18n.language) })}
          </Text>
        )}
      </View>

      {preview.errors.map((code) => (
        <Text key={code} style={styles.error}>• {t(`tournament.errors.${code}`)}</Text>
      ))}

      {preview.pools.length > 0 && (
        <View style={styles.pools}>
          {preview.pools.map((names, i) => (
            <View key={i} style={styles.poolCard}>
              <Text style={styles.poolTitle}>{t('tournament.wizard.pool', { name: poolName(i) })}</Text>
              {names.map((name) => <Text key={name} style={styles.poolTeam} numberOfLines={1}>{name}</Text>)}
            </View>
          ))}
        </View>
      )}
      {preview.errors.length === 0 && preview.pools.length === 0 && (
        <Text style={styles.hint}>
          {state.format === 'round_robin'
            ? t('tournament.wizard.championship')
            : state.seeding === 'seeded' ? t('tournament.wizard.seededBracket') : t('tournament.wizard.bracketOnly')}
        </Text>
      )}

      {state.format !== 'round_robin' && preview.errors.length === 0 && (
        <SecondaryButton icon={<Shuffle size={18} color={palette.textPrimary} />} label={t('tournament.wizard.redraw')} onPress={onRedraw} />
      )}

      <FormField label={t('tournament.wizard.saveTemplate')}>
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, styles.addInput]}
            value={templateName}
            onChangeText={(text) => { setTemplateName(text); setSaved(false); }}
            placeholder={t('tournament.wizard.templateNamePlaceholder')}
            placeholderTextColor={palette.textMuted}
            accessibilityLabel={t('tournament.wizard.templateName')}
            maxLength={40}
          />
          <Pressable style={[styles.addButton, !templateName.trim() && styles.disabled]} onPress={save}
            disabled={!templateName.trim()} accessibilityRole="button" accessibilityLabel={t('tournament.wizard.saveTemplate')}>
            <Save size={20} color="#fff" />
          </Pressable>
        </View>
        {saved && <Text style={styles.success}>{t('tournament.wizard.templateSaved')}</Text>}
      </FormField>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, fontFamily: 'Inter_400Regular', color: palette.textPrimary,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  chipActive: { backgroundColor: palette.accentPrimary, borderColor: palette.accentPrimary },
  chipText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },
  chipTextActive: { color: '#fff' },
  hint: { fontSize: 13, fontFamily: 'Inter_400Regular', color: palette.textSecondary, lineHeight: 18, paddingVertical: 8 },
  choices: { gap: 8 },
  choice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 12,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  choiceActive: { borderColor: palette.accentPrimary },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: palette.textMuted,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  radioActive: { borderColor: palette.accentPrimary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.accentPrimary },
  choiceText: { flex: 1, gap: 3 },
  choiceTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary },
  choiceDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: palette.textSecondary, lineHeight: 18 },
  advancedToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginBottom: 12 },
  advancedText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: palette.info },
  orderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: palette.backgroundElevated,
  },
  orderIndex: { width: 22, fontSize: 14, fontFamily: 'Inter_700Bold', color: palette.textSecondary, textAlign: 'center' },
  orderLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.textPrimary },
  iconButton: {
    width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.8 },
  secondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12, marginVertical: 8,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  secondaryText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addInput: { flex: 1 },
  addButton: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: palette.accentPrimary,
    alignItems: 'center', justifyContent: 'center',
  },
  teamRow: {
    paddingVertical: 6, paddingHorizontal: 6, gap: 4, borderRadius: 10,
    borderWidth: 1, borderColor: 'transparent', marginBottom: 4,
  },
  teamRowDuplicate: { borderColor: palette.error, backgroundColor: 'rgba(248, 81, 73, 0.08)' },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  teamNameInput: {
    flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: palette.textPrimary,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: palette.backgroundSurface,
  },
  duplicateText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: palette.error, marginLeft: 22 },
  estimate: {
    padding: 14, borderRadius: 12, gap: 4, marginVertical: 16,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  estimateStrong: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary },
  estimateText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textSecondary },
  presetChips: { marginBottom: 8 },
  teamDot: { width: 12, height: 12, borderRadius: 6 },
  hintBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, marginBottom: 20,
    backgroundColor: 'rgba(88, 166, 255, 0.12)',
  },
  hintBoxText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: palette.textPrimary, lineHeight: 18 },
  hintAction: { fontSize: 14, fontFamily: 'Inter_700Bold', color: palette.info },
  linkRow: { paddingVertical: 12 },
  inlineField: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: palette.backgroundElevated,
  },
  inlineLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.textPrimary },
  pickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minWidth: 130 },
  pickerText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: palette.textPrimary },
  iosPicker: { alignSelf: 'flex-start' },
  summaryCard: {
    padding: 16, borderRadius: 16, gap: 4, marginBottom: 16,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  summaryTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: palette.textPrimary, marginBottom: 4 },
  summaryLine: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textSecondary, lineHeight: 20 },
  summaryStrong: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary, marginTop: 6 },
  error: { fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.error, lineHeight: 20, marginBottom: 4 },
  success: { fontSize: 13, fontFamily: 'Inter_500Medium', color: palette.success, marginTop: 8 },
  pools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  poolCard: {
    flexBasis: '47%', flexGrow: 1, padding: 12, borderRadius: 12, gap: 4,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  poolTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.textSecondary, textTransform: 'uppercase', marginBottom: 2 },
  poolTeam: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textPrimary },
});
