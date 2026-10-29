import type { MatchConfig } from './match';

export type TournamentGameType = 'indoor_6v6' | 'indoor_4v4' | 'indoor_3v3' | 'beach_2v2';
export type TournamentFormat = 'round_robin' | 'pools_knockout' | 'knockout';
export type SeedingMode = 'random' | 'seeded';
export type TournamentStatus = 'live' | 'finished';
export type TournamentStage = 'league' | 'pool' | 'knockout' | 'placement';
export type TournamentMatchStatus = 'scheduled' | 'live' | 'validated';
export type ResultSource = 'manual' | 'qr' | 'arbitrage';
export type TiebreakerRule = 'setQuotient' | 'pointQuotient' | 'headToHead';

/** Set rules of a tournament match — same field names as MatchConfig. */
export type SetRules = Pick<MatchConfig, 'setsToWin' | 'pointsPerSet' | 'pointsLastSet' | 'winMargin'> & {
  /** The deciding set is played to pointsLastSet; otherwise to pointsPerSet. */
  tieBreak: boolean;
};

/** Ranking points. "Tight" = decided in the deciding set (3-2, 2-1). */
export interface PointsScale {
  winClear: number;
  winTight: number;
  lossTight: number;
  lossClear: number;
  forfeitLoss: number;
}

export interface PoolRules {
  count: number;
  qualifiersPerPool: number;
  /** Extra qualifiers: the best teams ranked just after the direct qualifiers. */
  bestOthers: number;
}

export interface TournamentRules {
  match: SetRules;
  /** Different rules in the final phase (null: same as `match`). */
  finalsMatch: SetRules | null;
  points: PointsScale;
  /** Applied in this order after the ranking points. */
  tiebreakers: TiebreakerRule[];
  pools: PoolRules | null;
  knockout: { thirdPlace: boolean };
  roundRobinLegs: 1 | 2;
}

export interface TournamentSchedule {
  courts: number;
  /** 'HH:MM' */
  startTime: string;
  /** One slot: estimated match duration, changeover included. */
  matchMinutes: number;
  /** Wished rest between two matches of the same team. */
  restMinutes: number;
}

/** Where a team of a match comes from, while it is not known yet. */
export type TeamRef =
  | { type: 'team'; id: string }
  | { type: 'poolRank'; pool: number; rank: number }
  /** The `index`-th best team among those ranked `rank` in their pool. */
  | { type: 'bestOf'; rank: number; index: number }
  | { type: 'winner'; match: string }
  | { type: 'loser'; match: string };

export type SetScore = [number, number];

export interface Tournament {
  id: string;
  name: string;
  date: string;
  location: string | null;
  gameType: TournamentGameType;
  format: TournamentFormat;
  rules: TournamentRules;
  schedule: TournamentSchedule;
  seed: number;
  seeding: SeedingMode;
  secret: string;
  status: TournamentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentPool {
  id: string;
  tournamentId: string;
  name: string;
  position: number;
}

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  /** Linked "Mes équipes" team; null for a team typed by name only. */
  teamId: string | null;
  name: string;
  color: string;
  seedRank: number | null;
  poolId: string | null;
  /** Registration order */
  position: number;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  stage: TournamentStage;
  poolId: string | null;
  round: number;
  bracketSlot: number | null;
  /** 'ko:<teams in round>:<n>' or 'third' — translated by the UI. */
  label: string | null;
  homeId: string | null;
  awayId: string | null;
  /** Where the team comes from (a team for pool matches) */
  homeSource: TeamRef;
  awaySource: TeamRef;
  /** Planning slot (0 = start time) */
  slot: number | null;
  court: number | null;
  /** 'YYYY-MM-DDTHH:MM', set when the match is placed */
  scheduledAt: string | null;
  status: TournamentMatchStatus;
  sets: SetScore[] | null;
  forfeitId: string | null;
  winnerId: string | null;
  resultSource: ResultSource | null;
  arbitrageMatchId: string | null;
  validatedAt: string | null;
  updatedAt: string;
}

export interface TournamentTemplate {
  id: string;
  name: string;
  payload: Pick<Tournament, 'gameType' | 'format' | 'rules' | 'schedule' | 'seeding'>;
  createdAt: string;
}
