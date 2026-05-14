export type MatchFormat = 'indoor_6v6' | 'beach_2v2';
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
}

export const DEFAULT_INDOOR_CONFIG: MatchConfig = {
  pointsPerSet: 25,
  pointsLastSet: 15,
  setsToWin: 3,
  timeoutsPerSet: 2,
  substitutionsPerSet: 6,
  unlimitedTimeouts: false,
  unlimitedSubstitutions: false,
};

export const DEFAULT_BEACH_CONFIG: MatchConfig = {
  pointsPerSet: 21,
  pointsLastSet: 15,
  setsToWin: 2,
  timeoutsPerSet: 2,
  substitutionsPerSet: null,
  unlimitedTimeouts: false,
  unlimitedSubstitutions: true,
};

export const DEFAULT_LEISURE_CONFIG: MatchConfig = {
  pointsPerSet: 25,
  pointsLastSet: 15,
  setsToWin: 3,
  timeoutsPerSet: null,
  substitutionsPerSet: null,
  unlimitedTimeouts: true,
  unlimitedSubstitutions: true,
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
  startedAt: string;
  finishedAt: string | null;
}

export type MatchInput = Pick<Match, 'format' | 'mode' | 'teamHomeId' | 'teamAwayId' | 'config'> & {
  firstServeTeamId?: string | null;
};
