import type {
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
  defaultPoolRules,
  defaultSchedule,
  defaultSetRules,
  recommendFormat,
} from './engine/defaults';
import { generateTournament, validateSetup, type SetupError } from './engine/generate';
import { restSlotsFor, scheduleMatches, slotStart } from './engine/scheduler';
import type { GenerateInput } from './engine/types';

export type WizardStep = 1 | 2 | 3 | 4;

export interface WizardTeam {
  /** Local key — the tournament team id is created with the tournament */
  key: string;
  /** "Mes équipes" team, null when typed by name only */
  teamId: string | null;
  name: string;
  color: string;
}

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
  | 'team_name_required'
  | 'team_name_duplicate'
  | 'start_time_invalid'
  | SetupError;

const pad = (n: number) => String(n).padStart(2, '0');

export function initialWizardState(today: Date, seed: number): WizardState {
  const schedule = defaultSchedule('indoor_6v6', 0);
  return {
    name: '',
    date: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
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
    teams: [],
    seeding: 'random',
    courts: null,
    startTime: schedule.startTime,
    matchMinutes: schedule.matchMinutes,
    restMinutes: schedule.restMinutes,
    seed,
  };
}

export function setGameType(state: WizardState, gameType: TournamentGameType): WizardState {
  return {
    ...state,
    gameType,
    match: defaultSetRules(gameType),
    finalsMatch: state.finalsMatch ? defaultSetRules(gameType) : null,
    matchMinutes: defaultSchedule(gameType, state.teams.length).matchMinutes,
  };
}

export function setFormat(state: WizardState, format: TournamentFormat): WizardState {
  return { ...state, format, pools: null };
}

export function resolvedPools(state: WizardState): PoolRules {
  return state.pools ?? defaultPoolRules(state.teams.length);
}

export function resolvedCourts(state: WizardState): number {
  return state.courts ?? defaultSchedule(state.gameType, state.teams.length).courts;
}

let keyCounter = 0;
const newKey = () => `w${Date.now().toString(36)}${(keyCounter++).toString(36)}`;

export function addQuickTeam(state: WizardState, name: string): WizardState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  const color = PRESET_TEAM_COLORS[state.teams.length % PRESET_TEAM_COLORS.length];
  return { ...state, teams: [...state.teams, { key: newKey(), teamId: null, name: trimmed, color }] };
}

export function addLibraryTeams(state: WizardState, teams: { id: string; name: string; color: string }[]): WizardState {
  const already = new Set(state.teams.map((t) => t.teamId));
  const added = teams
    .filter((t) => !already.has(t.id))
    .map((t): WizardTeam => ({ key: newKey(), teamId: t.id, name: t.name, color: t.color }));
  return { ...state, teams: [...state.teams, ...added] };
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
    if (state.teams.some((t) => !t.name.trim())) errors.push('team_name_required');
    const names = state.teams.map((t) => t.name.trim().toLocaleLowerCase());
    if (new Set(names).size !== names.length) errors.push('team_name_duplicate');
    if (!isTime(state.startTime)) errors.push('start_time_invalid');
    errors.push(...validateSetup(engineInput(state)));
  }
  return errors;
}

/** Suggests a championship for few teams, pools beyond — never against a knockout chosen on purpose. */
export function formatHint(state: WizardState): TournamentFormat | null {
  const n = state.teams.length;
  if (n < 2 || state.format === 'knockout') return null;
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
}

/** What "Créer" will produce, with the current seed. */
export function previewTournament(state: WizardState): TournamentPreview {
  const input = engineInput(state);
  const errors = validateSetup(input);
  if (errors.length > 0) return { errors, pools: [], matchCount: 0, endTime: null };
  const schedule = toSchedule(state);
  const generated = generateTournament(input);
  const planned = scheduleMatches(generated.matches, { courts: schedule.courts, restSlots: restSlotsFor(schedule) });
  const names = new Map(state.teams.map((t) => [t.key, t.name]));
  const lastSlot = Math.max(...planned.map((m) => m.slot ?? 0));
  return {
    errors,
    pools: generated.pools.map((ids) => ids.map((id) => names.get(id)!)),
    matchCount: planned.length,
    endTime: slotStart(schedule, lastSlot + 1),
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
      name: t.name.trim(),
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
    rules: { ...toRules(state), pools: state.format === 'pools_knockout' ? state.pools : null },
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
    seeding: payload.seeding,
    courts: schedule.courts,
    startTime: schedule.startTime,
    matchMinutes: schedule.matchMinutes,
    restMinutes: schedule.restMinutes,
  };
}
