import { createAdHocTeam } from './teamService';
import { createPlayer } from './playerService';
import { createMatch, setMatchCaptains } from './matchService';
import type { Match, MatchConfig, MatchFormat, MatchMode } from '../models/match';

export interface AdHocPlayerInput {
  number: number;
  name?: string;
  isLibero?: boolean;
}

export interface AdHocTeamInput {
  name: string;
  color: string;
  coachName?: string | null;
  players: AdHocPlayerInput[];
  captainNumber: number | null;
}

export interface CreateAdHocMatchInput {
  format: MatchFormat;
  mode: MatchMode;
  config: MatchConfig;
  home: AdHocTeamInput;
  away: AdHocTeamInput;
}

async function createAdHocSide(input: AdHocTeamInput) {
  const team = await createAdHocTeam({
    name: input.name,
    shortName: null,
    logoUri: null,
    color: input.color,
    coachName: input.coachName ?? null,
  });

  const players = await Promise.all(
    input.players.map((p) => createPlayer({
      teamId: team.id,
      firstName: null,
      lastName: p.name?.trim() || null,
      number: p.number,
      position: p.isLibero ? 'libero' : null,
      photoUri: null,
      isActive: true,
    })),
  );

  const captain = input.captainNumber !== null
    ? players.find((p) => p.number === input.captainNumber) ?? null
    : null;

  return { team, players, captainId: captain?.id ?? null };
}

/**
 * Creates two ad-hoc teams (hidden from the team library) with their players
 * for a single standalone arbitrage match, then the match itself. Nothing
 * here is added to the user's registered teams.
 */
export async function createAdHocMatch(input: CreateAdHocMatchInput): Promise<Match> {
  const home = await createAdHocSide(input.home);
  const away = await createAdHocSide(input.away);

  const match = await createMatch({
    format: input.format,
    mode: input.mode,
    teamHomeId: home.team.id,
    teamAwayId: away.team.id,
    config: input.config,
  });

  if (home.captainId || away.captainId) {
    await setMatchCaptains(match.id, home.captainId, away.captainId);
  }

  return match;
}
