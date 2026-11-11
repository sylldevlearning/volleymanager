import { createTeam, updateTeam } from './teamService';
import { createMatch, getMatchById } from './matchService';
import { DEFAULT_INDOOR_CONFIG, type Match } from '../models/match';
import { canRenameTeams, normalizeTeamName } from '../features/match/teamRename';

/** "Match rapide" on the home screen: two default teams, 6×6, straight to scoring. */
export async function createQuickMatch(): Promise<Match> {
  const [home, away] = await Promise.all([
    createTeam({ name: 'France', shortName: 'FRA', logoUri: null, color: '#1D4ED8' }),
    createTeam({ name: 'Brésil', shortName: 'BRA', logoUri: null, color: '#F59E0B' }),
  ]);
  return createMatch({
    format: 'indoor_6v6',
    mode: 'leisure',
    teamHomeId: home.id,
    teamAwayId: away.id,
    config: { ...DEFAULT_INDOOR_CONFIG, quickMatch: true },
  });
}

/**
 * Renames one team of a quick match. The short name is cleared so the
 * scoreboard label follows the new name. Returns the saved name, or null when
 * the name is invalid or the match cannot be renamed.
 */
export async function renameQuickMatchTeam(
  matchId: string,
  side: 'home' | 'away',
  rawName: string,
): Promise<string | null> {
  const name = normalizeTeamName(rawName);
  if (name === null) return null;
  const match = await getMatchById(matchId);
  if (!match || !canRenameTeams(match)) return null;
  await updateTeam(side === 'home' ? match.teamHomeId : match.teamAwayId, { name, shortName: null });
  return name;
}
