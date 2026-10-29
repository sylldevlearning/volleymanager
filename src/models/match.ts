/** 2×2 uses 'beach_2v2' (beach or gym) */
export type MatchFormat = 'indoor_6v6' | 'indoor_4v4' | 'indoor_3v3' | 'beach_2v2';
export type MatchMode = 'competition' | 'leisure';
export type MatchStatus = 'created' | 'live' | 'paused' | 'finished';

export interface MatchConfig {
  pointsPerSet: number;
  pointsLastSet: number;
  setsToWin: number;
  timeoutsPerSet: number | null;
  substitutionsPerSet: number | null;
  unlimitedTimeouts: boolean;
  unlimitedSubstitutions: boolean;
  /** Point lead required to win a set (FIVB = 2). */
  winMargin: number;
  timeoutDurationSec: number;
  breakBetweenSetsSec: number;
  sanctionsEnabled: boolean;
  // Small formats (4×4, 3×3, 2×2) — absent on 6×6 and older matches
  /** 'free': any bench player for any court player; 'none': no substitution; 'fivb' (default): 6×6 rules */
  substitutionMode?: 'fivb' | 'free' | 'none';
  /** FFVolley M13 4×4: the player leaving from I does not come back at II before a rotation; back only after one rally */
  m13Substitutions?: boolean;
  /** Fixed zones shown (the referee calls positional faults) instead of the service order only */
  positionalFaults?: boolean;
  /** Change of courts every N points (deciding set: M); null: between sets only. Absent: 6×6 rule */
  courtSwitch?: { every: number; everyDecidingSet: number } | null;
  /** Beach: 30 s technical time-out at 21 points in sets 1 and 2 */
  technicalTimeout?: boolean;
}

export const DEFAULT_INDOOR_CONFIG: MatchConfig = {
  pointsPerSet: 25,
  pointsLastSet: 15,
  setsToWin: 3,
  timeoutsPerSet: 2,
  substitutionsPerSet: 6,
  unlimitedTimeouts: false,
  unlimitedSubstitutions: false,
  winMargin: 2,
  timeoutDurationSec: 30,
  breakBetweenSetsSec: 180,
  sanctionsEnabled: true,
};

export const DEFAULT_BEACH_CONFIG: MatchConfig = {
  pointsPerSet: 21,
  pointsLastSet: 15,
  setsToWin: 2,
  timeoutsPerSet: 2,
  substitutionsPerSet: null,
  unlimitedTimeouts: false,
  unlimitedSubstitutions: true,
  winMargin: 2,
  timeoutDurationSec: 30,
  breakBetweenSetsSec: 60,
  sanctionsEnabled: true,
};

export const DEFAULT_LEISURE_CONFIG: MatchConfig = {
  pointsPerSet: 25,
  pointsLastSet: 15,
  setsToWin: 3,
  timeoutsPerSet: null,
  substitutionsPerSet: null,
  unlimitedTimeouts: true,
  unlimitedSubstitutions: true,
  winMargin: 2,
  timeoutDurationSec: 30,
  breakBetweenSetsSec: 180,
  sanctionsEnabled: false,
};

export interface Match {
  id: string;
  date: string;
  format: MatchFormat;
  mode: MatchMode;
  teamHomeId: string;
  teamAwayId: string;
  status: MatchStatus;
  config: MatchConfig;
  winnerTeamId: string | null;
  firstServeTeamId: string | null;
  captainHomeId: string | null;
  captainAwayId: string | null;
  /** Visual side (left/right) swap toggled by the referee — persisted so a resumed match redraws identically. */
  sidesSwapped: boolean;
  /** In-game acting captain stand-in while the registered captain is off court — persisted per side. */
  actingCaptainHomeId: string | null;
  actingCaptainAwayId: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface MatchSet {
  id: string;
  matchId: string;
  setNumber: number;
  scoreHome: number;
  scoreAway: number;
  winnerTeamId: string | null;
  /** Team serving at the start of this set — manually chosen for sets 1 & 5, auto-resolved otherwise. */
  servingTeamId: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export type MatchInput = Pick<Match, 'format' | 'mode' | 'teamHomeId' | 'teamAwayId' | 'config'> & {
  firstServeTeamId?: string | null;
};
