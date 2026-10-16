import type { MatchConfig } from '../models/match';

export interface AdHocPlayerDraft {
  number: number;
  name: string;
}

export interface AdHocTeamDraft {
  name: string;
  /** Only the CHECKED numbers (0-99 grid). */
  players: AdHocPlayerDraft[];
  captainNumber: number | null;
  /** 0 to 2 registered liberos. */
  liberoNumbers: number[];
}

const MIN_PLAYERS = 6;
const MAX_LIBEROS = 2;

export function validateAdHocTeam(draft: AdHocTeamDraft): string[] {
  const errors: string[] = [];
  const selectedNumbers = new Set(draft.players.map((p) => p.number));

  if (draft.name.trim().length < 2) {
    errors.push("Le nom de l'équipe doit contenir au moins 2 lettres.");
  }

  if (draft.players.length < MIN_PLAYERS) {
    errors.push(`Il faut au moins ${MIN_PLAYERS} joueurs sélectionnés.`);
  }

  if (draft.captainNumber === null) {
    if (draft.players.length > 0) errors.push('Choisissez un capitaine.');
  } else if (!selectedNumbers.has(draft.captainNumber)) {
    errors.push('Le capitaine doit être un joueur sélectionné.');
  }

  if (draft.liberoNumbers.length > MAX_LIBEROS) {
    errors.push(`Maximum ${MAX_LIBEROS} libéros.`);
  }
  if (draft.liberoNumbers.some((n) => !selectedNumbers.has(n))) {
    errors.push('Le libéro doit être un joueur sélectionné.');
  }
  // FIVB rule: the libero cannot be designated as team captain.
  if (draft.captainNumber !== null && draft.liberoNumbers.includes(draft.captainNumber)) {
    errors.push('Le libéro ne peut pas être capitaine.');
  }

  return errors;
}

export function validateAdHocRules(config: Partial<MatchConfig>): string[] {
  const errors: string[] = [];
  if ((config.pointsPerSet ?? 0) < 1) errors.push('Points par set invalide.');
  if ((config.pointsLastSet ?? 0) < 1) errors.push('Points dernier set invalide.');
  if ((config.setsToWin ?? 0) < 1) errors.push('Nombre de sets gagnants invalide.');
  return errors;
}
