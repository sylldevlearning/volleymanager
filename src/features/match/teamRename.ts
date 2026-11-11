import type { Match } from '../../models/match';

/** Longest team name accepted when renaming a quick match team */
export const TEAM_NAME_MAX_LENGTH = 30;

/** Trimmed name with single spaces, or null when empty or too long */
export function normalizeTeamName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length === 0 || name.length > TEAM_NAME_MAX_LENGTH) return null;
  return name;
}

/**
 * Team names can be changed on quick matches only (Quick match button or a
 * tournament match QR), until the match is over. Quick matches created before
 * 1.2.0 have no `quickMatch` flag and keep their names.
 */
export function canRenameTeams(match: Match): boolean {
  return match.config.quickMatch === true && match.status !== 'finished';
}
