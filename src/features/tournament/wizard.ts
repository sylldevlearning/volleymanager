import type {
  BrassageRules,
  PointsScale,
  PoolRules,
  SeedingMode,
  SetRules,
  TiebreakerRule,
  TournamentFormat,
  TournamentGameType,
  TournamentRules,
  TournamentSchedule,
  TournamentTemplate,
} from '../../models/tournament';
import type { CreateTournamentInput } from '../../services/tournamentService';
import { PRESET_TEAM_COLORS } from '../../utils/constants';
import {
  DEFAULT_POINTS,
  DEFAULT_TIEBREAKERS,
  defaultBrassageRules,
  defaultFormat,
  defaultPoolRules,
  defaultSchedule,
  defaultSetRules,
  recommendFormat,
} from './engine/defaults';
import { generateTournament, validateSetup, type SetupError } from './engine/generate';
import { restSlotsFor, scheduleMatches, slotStart } from './engine/scheduler';
import { matchCountRange } from './engine/simulate';
import type { GenerateInput } from './engine/types';

export type WizardStep = 1 | 2 | 3 | 4;

export interface WizardTeam {
  /** Local key — the tournament team id is created with the tournament */
  key: string;
  /** "Mes équipes" team, null otherwise */
  teamId: string | null;
  /** As typed — may be empty */
  name: string;
  /** "Équipe N": shown and used while the name is empty */
  fallbackName: string;
  /** N of "Équipe N" (also picks the colour) */
  number: number;
  color: string;
}

export const DEFAULT_TEAM_COUNT = 8;

/** Localised "Équipe N" */
export type TeamLabel = (n: number) => string;

export interface WizardState {
  name: string;
  /** 'YYYY-MM-DD' */
  date: string;
  location: string;
  gameType: TournamentGameType;
  format: TournamentFormat;
  match: SetRules;
  finalsMatch: SetRules | null;
  points: PointsScale;
  tiebreakers: TiebreakerRule[];
  thirdPlace: boolean;
  legs: 1 | 2;
  /** null: automatic, from the number of teams */
  pools: PoolRules | null;
  /** Brassage + niveaux — null: automatic, from the number of teams */
  brassage: BrassageRules | null;
  teams: WizardTeam[];
  /** 'seeded': the order of the list is the seed order */
  seeding: SeedingMode;
  /** null: automatic, from the number of teams */
  courts: number | null;
  startTime: string;
  matchMinutes: number;
  restMinutes: number;
  seed: number;
}

export type WizardError =
  | 'name_required'
  | 'date_invalid'
  | 'tie_break_too_long'
  | 'team_name_duplicate'
  | 'start_time_invalid'
  | SetupError;

const pad = (n: number) => String(n).padStart(2, '0');

export function initialWizardState(today: Date, seed: number, label: TeamLabel): WizardState {
  const schedule = defaultSchedule('indoor_6v6', DEFAULT_TEAM_COUNT);
  const empty: WizardState = {
    name: '',
    date: isoFromDate(today),
    location: '',
    gameType: 'indoor_6v6',
    format: 'pools_knockout',
    match: defaultSetRules('indoor_6v6'),
    finalsMatch: null,
    points: { ...DEFAULT_POINTS },
    tiebreakers: [...DEFAULT_TIEBREAKERS],
    thirdPlace: true,
    legs: 1,
    pools: null,
    brassage: null,
    teams: [],
    seeding: 'random',
    courts: null,
    startTime: schedule.startTime,
    matchMinutes: schedule.matchMinutes,
    restMinutes: schedule.restMinutes,
    seed,
  };
  return setTeamCount(empty, DEFAULT_TEAM_COUNT, label);
}

export function setGameType(state: WizardState, gameType: TournamentGameType): WizardState {
  return {
    ...state,
    gameType,
    // Leisure formats mix the teams then play by levels; 6×6 plays pools + finals
    format: defaultFormat(gameType),
    pools: null,
    brassage: null,
    match: defaultSetRules(gameType),
    finalsMatch: state.finalsMatch ? defaultSetRules(gameType) : null,
    matchMinutes: defaultSchedule(gameType, state.teams.length).matchMinutes,
  };
}

export function setFormat(state: WizardState, format: TournamentFormat): WizardState {
  return { ...state, format, pools: null, brassage: null };
}

export function resolvedBrassage(state: WizardState): BrassageRules {
  return state.brassage ?? defaultBrassageRules(state.teams.length);
}

export function resolvedPools(state: WizardState): PoolRules {
  return state.pools ?? defaultPoolRules(state.teams.length);
}

export function resolvedCourts(state: WizardState): number {
  return state.courts ?? defaultSchedule(state.gameType, state.teams.length).courts;
}

let keyCounter = 0;
const newKey = () => `w${Date.now().toString(36)}${(keyCounter++).toString(36)}`;

export function displayName(team: WizardTeam): string {
  return team.name.trim() || team.fallbackName;
}

function newTeam(label: TeamLabel, used: Set<number>): WizardTeam {
  let number = 1;
  while (used.has(number)) number++;
  used.add(number);
  return {
    key: newKey(), teamId: null, name: label(number), fallbackName: label(number), number,
    color: PRESET_TEAM_COLORS[(number - 1) % PRESET_TEAM_COLORS.length],
  };
}

/** Adds "Équipe N" teams at the end, or removes from the end (2 teams at least). */
export function setTeamCount(state: WizardState, count: number, label: TeamLabel): WizardState {
  const target = Math.max(2, count);
  if (target <= state.teams.length) return { ...state, teams: state.teams.slice(0, target) };
  const used = new Set(state.teams.map((t) => t.number));
  const teams = [...state.teams];
  while (teams.length < target) teams.push(newTeam(label, used));
  return { ...state, teams };
}

export function renameTeam(state: WizardState, key: string, name: string): WizardState {
  return { ...state, teams: state.teams.map((t) => (t.key === key ? { ...t, name } : t)) };
}

/** "Mes équipes" teams take the places still unnamed, then are added at the end. */
export function addLibraryTeams(state: WizardState, library: { id: string; name: string; color: string }[], label: TeamLabel): WizardState {
  const already = new Set(state.teams.map((t) => t.teamId));
  const queue = library.filter((t) => !already.has(t.id));
  const fill = (slot: WizardTeam, team: { id: string; name: string; color: string }): WizardTeam =>
    ({ ...slot, teamId: team.id, name: team.name, color: team.color });
  const teams = state.teams.map((slot) => {
    const untouched = slot.teamId === null && slot.name === slot.fallbackName;
    return untouched && queue.length > 0 ? fill(slot, queue.shift()!) : slot;
  });
  const used = new Set(teams.map((t) => t.number));
  for (const team of queue) teams.push(fill(newTeam(label, used), team));
  return { ...state, teams };
}

/** Keys of every team whose name is used more than once. */
export function duplicateTeamKeys(state: WizardState): Set<string> {
  const byName = new Map<string, string[]>();
  for (const t of state.teams) {
    const n = displayName(t).toLocaleLowerCase();
    byName.set(n, [...(byName.get(n) ?? []), t.key]);
  }
  return new Set([...byName.values()].filter((keys) => keys.length > 1).flat());
}

export function removeTeam(state: WizardState, key: string): WizardState {
  return { ...state, teams: state.teams.filter((t) => t.key !== key) };
}

export function moveTeam(state: WizardState, key: string, delta: -1 | 1): WizardState {
  const i = state.teams.findIndex((t) => t.key === key);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= state.teams.length) return state;
  const teams = [...state.teams];
  [teams[i], teams[j]] = [teams[j], teams[i]];
  return { ...state, teams };
}

/** 'DD/MM/YYYY' → 'YYYY-MM-DD', null when not a real date. */
export function parseDisplayDate(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function displayDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Native picker values (Date, local time) ↔ stored strings

export function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isoFromDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateFromTime(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function timeFromDate(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const isTime = (text: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(text);

export function toRules(state: WizardState): TournamentRules {
  return {
    match: state.match,
    finalsMatch: state.finalsMatch,
    points: state.points,
    tiebreakers: state.tiebreakers,
    pools: state.format === 'pools_knockout' ? resolvedPools(state) : null,
    knockout: { thirdPlace: state.thirdPlace },
    roundRobinLegs: state.legs,
    brassage: state.format === 'brassage_levels' ? resolvedBrassage(state) : null,
  };
}

export function toSchedule(state: WizardState): TournamentSchedule {
  return {
    courts: resolvedCourts(state),
    startTime: state.startTime,
    matchMinutes: state.matchMinutes,
    restMinutes: state.restMinutes,
  };
}

function engineInput(state: WizardState): GenerateInput {
  return {
    format: state.format,
    rules: toRules(state),
    teams: state.teams.map((t, i) => ({ id: t.key, seedRank: state.seeding === 'seeded' ? i + 1 : null, position: i })),
    seed: state.seed,
    seeding: state.seeding,
  };
}

export function validateStep(state: WizardState, step: WizardStep): WizardError[] {
  const errors: WizardError[] = [];
  if (step === 1 || step === 4) {
    if (!state.name.trim()) errors.push('name_required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(state.date) || parseDisplayDate(displayDate(state.date)) !== state.date) {
      errors.push('date_invalid');
    }
  }
  if (step === 2 || step === 4) {
    for (const rules of [state.match, state.finalsMatch]) {
      if (rules?.tieBreak && rules.setsToWin > 1 && rules.pointsLastSet > rules.pointsPerSet) {
        errors.push('tie_break_too_long');
        break;
      }
    }
  }
  if (step === 3 || step === 4) {
    if (duplicateTeamKeys(state).size > 0) errors.push('team_name_duplicate');
    if (!isTime(state.startTime)) errors.push('start_time_invalid');
    errors.push(...validateSetup(engineInput(state)));
  }
  return errors;
}

/** Suggests a championship for few teams, pools beyond — never against a knockout chosen on purpose. */
export function formatHint(state: WizardState): TournamentFormat | null {
  const n = state.teams.length;
  if (n < 2 || state.format === 'knockout') return null;
  if (state.format === 'brassage_levels') return n < 6 ? 'round_robin' : null;
  const recommended = recommendFormat(n);
  return recommended === state.format ? null : recommended;
}

export interface TournamentPreview {
  errors: SetupError[];
  /** Team names by pool */
  pools: string[][];
  matchCount: number;
  /** 'HH:MM' end of the last slot */
  endTime: string | null;
  /** From the start time to the end of the last slot */
  durationMinutes: number | null;
  /** Fewest / most matches a team plays */
  matchesPerTeam: { min: number; max: number } | null;
}

/** What "Créer" will produce, with the current seed. */
export function previewTournament(state: WizardState): TournamentPreview {
  const input = engineInput(state);
  const errors = validateSetup(input);
  if (errors.length > 0) return { errors, pools: [], matchCount: 0, endTime: null, durationMinutes: null, matchesPerTeam: null };
  const schedule = toSchedule(state);
  const generated = generateTournament(input);
  const planned = scheduleMatches(generated.matches, { courts: schedule.courts, restSlots: restSlotsFor(schedule) });
  const names = new Map(state.teams.map((t) => [t.key, displayName(t)]));
  const lastSlot = Math.max(...planned.map((m) => m.slot ?? 0));
  const ctx = { format: input.format, rules: input.rules, teams: input.teams, pools: generated.pools };
  return {
    errors,
    // Pools known now (later rounds depend on the results)
    pools: generated.pools.filter((ids) => ids.length > 0).map((ids) => ids.map((id) => names.get(id)!)),
    matchCount: planned.length,
    endTime: slotStart(schedule, lastSlot + 1),
    durationMinutes: (lastSlot + 1) * schedule.matchMinutes,
    matchesPerTeam: matchCountRange(ctx, planned),
  };
}

export function toCreateInput(state: WizardState): CreateTournamentInput {
  return {
    name: state.name.trim(),
    date: state.date,
    location: state.location.trim() || null,
    gameType: state.gameType,
    format: state.format,
    rules: toRules(state),
    schedule: toSchedule(state),
    seeding: state.seeding,
    seed: state.seed,
    teams: state.teams.map((t, i) => ({
      teamId: t.teamId,
      name: displayName(t),
      color: t.color,
      seedRank: state.seeding === 'seeded' ? i + 1 : null,
    })),
  };
}

/**
 * Rules and planning settings, without the teams. Automatic pools stay
 * automatic (`rules.pools` null) so the template fits any number of teams.
 */
export function templatePayload(state: WizardState): TournamentTemplate['payload'] {
  return {
    gameType: state.gameType,
    format: state.format,
    rules: {
      ...toRules(state),
      pools: state.format === 'pools_knockout' ? state.pools : null,
      brassage: state.format === 'brassage_levels' ? state.brassage : null,
    },
    schedule: toSchedule(state),
    seeding: state.seeding,
  };
}

export function applyTemplate(state: WizardState, payload: TournamentTemplate['payload']): WizardState {
  const { rules, schedule } = payload;
  return {
    ...state,
    gameType: payload.gameType,
    format: payload.format,
    match: rules.match,
    finalsMatch: rules.finalsMatch,
    points: rules.points,
    tiebreakers: rules.tiebreakers,
    thirdPlace: rules.knockout.thirdPlace,
    legs: rules.roundRobinLegs,
    pools: rules.pools,
    brassage: rules.brassage ?? null,
    seeding: payload.seeding,
    courts: schedule.courts,
    startTime: schedule.startTime,
    matchMinutes: schedule.matchMinutes,
    restMinutes: schedule.restMinutes,
  };
}
