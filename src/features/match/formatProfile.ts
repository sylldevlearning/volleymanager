import { DEFAULT_INDOOR_CONFIG, type MatchConfig, type MatchFormat } from '../../models/match';
import { isLastSet, shouldChangeEndsIndoor } from '../../utils/volleyball-rules';

export interface FormatProfile {
  /** Players on court */
  courtSize: 6 | 4 | 3 | 2;
  hasLibero: boolean;
  maxRoster: number;
}

/** What each format puts on court — 6×6 is the reference, unchanged. */
export const FORMAT_PROFILES: Record<MatchFormat, FormatProfile> = {
  indoor_6v6: { courtSize: 6, hasLibero: true, maxRoster: 14 },
  // FFVolley M13: 4 players + 4 substitutes at most
  indoor_4v4: { courtSize: 4, hasLibero: false, maxRoster: 8 },
  indoor_3v3: { courtSize: 3, hasLibero: false, maxRoster: 6 },
  beach_2v2: { courtSize: 2, hasLibero: false, maxRoster: 4 },
};

export const SMALL_FORMATS: MatchFormat[] = ['indoor_4v4', 'indoor_3v3', 'beach_2v2'];

export function courtSize(format: MatchFormat): number {
  return FORMAT_PROFILES[format].courtSize;
}

/** Leisure rules: free unlimited substitutions, no positional faults, 1 time-out of 30 s per set. */
const LEISURE_RULES: Pick<MatchConfig,
  'substitutionMode' | 'unlimitedSubstitutions' | 'substitutionsPerSet' | 'm13Substitutions' | 'positionalFaults'
  | 'timeoutsPerSet' | 'unlimitedTimeouts' | 'timeoutDurationSec' | 'technicalTimeout'> = {
  substitutionMode: 'free',
  unlimitedSubstitutions: true,
  substitutionsPerSet: null,
  m13Substitutions: false,
  positionalFaults: false,
  timeoutsPerSet: 1,
  unlimitedTimeouts: false,
  timeoutDurationSec: 30,
  technicalTimeout: false,
};

/** Sets as in the tournament defaults: 4×4 and 2×2 two sets of 21 (tie-break 15), 3×3 one set of 21. */
const LEISURE_CONFIGS: Record<Exclude<MatchFormat, 'indoor_6v6'>, MatchConfig> = {
  indoor_4v4: {
    ...DEFAULT_INDOOR_CONFIG, ...LEISURE_RULES,
    setsToWin: 2, pointsPerSet: 21, pointsLastSet: 15, breakBetweenSetsSec: 120, courtSwitch: null,
  },
  indoor_3v3: {
    ...DEFAULT_INDOOR_CONFIG, ...LEISURE_RULES,
    setsToWin: 1, pointsPerSet: 21, pointsLastSet: 15, breakBetweenSetsSec: 60, courtSwitch: null,
  },
  beach_2v2: {
    ...DEFAULT_INDOOR_CONFIG, ...LEISURE_RULES,
    setsToWin: 2, pointsPerSet: 21, pointsLastSet: 15, breakBetweenSetsSec: 60,
    courtSwitch: { every: 7, everyDecidingSet: 5 },
  },
};

export function defaultArbitrageConfig(format: MatchFormat): MatchConfig {
  return format === 'indoor_6v6' ? DEFAULT_INDOOR_CONFIG : { ...LEISURE_CONFIGS[format] };
}

export interface FormatPreset {
  labelKey: string;
  /** Only the rules the official text sets */
  official: Partial<MatchConfig>;
}

const PRESETS: Record<Exclude<MatchFormat, 'indoor_6v6'>, FormatPreset> = {
  // FFVolley, réglementation particulière M13 (4×4): points per set not set by the text
  indoor_4v4: {
    labelKey: 'arbitrageSetup.presetM13',
    official: {
      substitutionMode: 'free', unlimitedSubstitutions: false, substitutionsPerSet: 4, m13Substitutions: true,
      timeoutsPerSet: 2, unlimitedTimeouts: false, timeoutDurationSec: 30, positionalFaults: true,
    },
  },
  // FIVB snow volleyball 2021-2024 (the closest official 3-a-side text)
  indoor_3v3: {
    labelKey: 'arbitrageSetup.presetSnow',
    official: {
      substitutionMode: 'fivb', unlimitedSubstitutions: false, substitutionsPerSet: 2, m13Substitutions: false,
      timeoutsPerSet: 1, unlimitedTimeouts: false, timeoutDurationSec: 30, positionalFaults: false,
      courtSwitch: { every: 5, everyDecidingSet: 5 }, setsToWin: 2, pointsPerSet: 15, pointsLastSet: 15, winMargin: 2,
    },
  },
  // FIVB beach volleyball
  beach_2v2: {
    labelKey: 'arbitrageSetup.presetBeach',
    official: {
      substitutionMode: 'none', unlimitedSubstitutions: false, substitutionsPerSet: 0,
      timeoutsPerSet: 1, unlimitedTimeouts: false, timeoutDurationSec: 30, technicalTimeout: true,
      courtSwitch: { every: 7, everyDecidingSet: 5 }, setsToWin: 2, pointsPerSet: 21, pointsLastSet: 15, winMargin: 2,
    },
  },
};

export function presetOf(format: MatchFormat): FormatPreset | null {
  return format === 'indoor_6v6' ? null : PRESETS[format];
}

/** "Loisir" restores the leisure rules; "Officiel" applies the official text on top of the current setup. */
export function applyPreset(format: MatchFormat, preset: 'leisure' | 'official', config: MatchConfig): MatchConfig {
  if (format === 'indoor_6v6') return config;
  if (preset === 'leisure') return defaultArbitrageConfig(format);
  return { ...config, ...PRESETS[format].official };
}

/** Whether the official preset is the one in use. */
export function isOfficial(format: MatchFormat, config: MatchConfig): boolean {
  const preset = presetOf(format);
  if (!preset) return false;
  return Object.entries(preset.official).every(([k, v]) => JSON.stringify(config[k as keyof MatchConfig]) === JSON.stringify(v));
}

export function substitutionsAllowed(format: MatchFormat, config: MatchConfig): boolean {
  if (config.substitutionMode === 'none') return false;
  // Beach matches saved before the small formats: no substitution, as before
  if (format === 'beach_2v2' && config.substitutionMode === undefined) return false;
  return true;
}

/** Change of courts after this point? 6×6 keeps its rule (8 points in the deciding set). */
export function shouldSwitchCourts(format: MatchFormat, scoreHome: number, scoreAway: number, setNumber: number, config: MatchConfig): boolean {
  if (config.courtSwitch) {
    const total = scoreHome + scoreAway;
    const every = isLastSet(setNumber, config) ? config.courtSwitch.everyDecidingSet : config.courtSwitch.every;
    return total > 0 && every > 0 && total % every === 0;
  }
  if (format === 'indoor_6v6') return shouldChangeEndsIndoor(scoreHome, scoreAway, setNumber, config);
  return false;
}

/** Beach technical time-out: when the two scores add up to 21, outside the deciding set. */
export function isTechnicalTimeout(scoreHome: number, scoreAway: number, setNumber: number, config: MatchConfig): boolean {
  return config.technicalTimeout === true && !isLastSet(setNumber, config) && scoreHome + scoreAway === 21;
}
