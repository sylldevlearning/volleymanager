export interface SubstitutionPair {
  id: string;
  matchId: string;
  setId: string;
  teamId: string;
  /** The starter (or libero-replaced player) who went to the bench */
  playerOutId: string;
  /** The reserve (or libero) who entered */
  playerInId: string;
  /** True for libero swaps — these don't consume a substitution slot */
  isLibero: boolean;
  isCancelled: boolean;
}

export interface OnCourtPlayer {
  playerId: string;
  position: 1 | 2 | 3 | 4 | 5 | 6;
  isLibero: boolean;
  /** Only set when this slot is temporarily occupied by the libero */
  originalPlayerId: string | null;
}

export interface LiberoState {
  liberoId: string;
  isOnCourt: boolean;
  replacedPlayerId: string | null;
  replacedPosition: number | null;
}

export type SubstitutionErrorCode =
  | 'max_reached'
  | 'reciprocity_violation'
  | 'not_eligible'
  | 'libero_front_row'
  | 'beach_no_sub';

export interface SubstitutionResult {
  ok: true;
  isLibero: boolean;
}

export interface SubstitutionError {
  ok: false;
  error: SubstitutionErrorCode;
  errorData?: Record<string, string>;
}

export type SubstitutionOutcome = SubstitutionResult | SubstitutionError;
