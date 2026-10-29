import type {
  SeedingMode,
  SetScore,
  TeamRef,
  TournamentFormat,
  TournamentMatchStatus,
  TournamentRules,
  TournamentStage,
} from '../../../models/tournament';

export interface EngineTeam {
  id: string;
  /** Seed (1 = best), null when not seeded. */
  seedRank: number | null;
  /** Registration order — last tie-breaker, after the seed. */
  position: number;
}

/** A tournament match as the engine sees it: no SQLite, no React. */
export interface EngineMatch {
  key: string;
  stage: TournamentStage;
  /** Pool index (0 = A) for pool matches, null otherwise. */
  pool: number | null;
  round: number;
  bracketSlot: number | null;
  label: string | null;
  homeRef: TeamRef;
  awayRef: TeamRef;
  homeId: string | null;
  awayId: string | null;
  status: TournamentMatchStatus;
  sets: SetScore[] | null;
  forfeitId: string | null;
  winnerId: string | null;
  /** Time slot (0 = start time), null while not scheduled. */
  slot: number | null;
  court: number | null;
}

export interface EngineContext {
  format: TournamentFormat;
  rules: TournamentRules;
  teams: EngineTeam[];
  /** Team ids by pool index. Empty without pools. */
  pools: string[][];
}

export interface GenerateInput {
  format: TournamentFormat;
  rules: TournamentRules;
  teams: EngineTeam[];
  seed: number;
  seeding: SeedingMode;
  /** Prepended to every match key (the service uses the tournament id). */
  keyPrefix?: string;
}

export interface Generated {
  pools: string[][];
  matches: EngineMatch[];
}
