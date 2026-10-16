import { getMatchById, getSetsForMatch } from './matchService';
import { getEventsForSet, computeScore, computeTimeoutsUsed } from './eventService';
import { getPlayersByTeam } from './playerService';
import { getLineupForSet } from './lineupService';
import { getPairsForSet } from './substitutionService';
import { determineInitialServing, computeServingTeam, type CourtMap } from '../stores/scoringStore';
import { replayCourtState } from '../utils/courtRotation';
import { countNormalSubs } from '../utils/substitutionRules';
import type { Match, MatchSet } from '../models/match';
import type { MatchEvent } from '../models/event';
import type { Player } from '../models/player';
import type { LiberoState, SubstitutionPair } from '../models/substitution';

export interface ReconstructedLiveMatch {
  match: Match;
  currentSet: MatchSet;
  sets: MatchSet[];
  events: MatchEvent[];
  onCourtHome: CourtMap;
  onCourtAway: CourtMap;
  benchHome: Player[];
  benchAway: Player[];
  liberoHome: LiberoState | null;
  liberoAway: LiberoState | null;
  rotationHome: number[];
  rotationAway: number[];
  pairsHome: SubstitutionPair[];
  pairsAway: SubstitutionPair[];
  scoreHome: number;
  scoreAway: number;
  setsHome: number;
  setsAway: number;
  setScores: { home: number; away: number }[];
  servingTeam: 'home' | 'away';
  initialServingTeam: 'home' | 'away';
  timeoutsHome: number;
  timeoutsAway: number;
  substitutionsHome: number;
  substitutionsAway: number;
  sidesSwapped: boolean;
  actingCaptainHomeId: string | null;
  actingCaptainAwayId: string | null;
}

/**
 * Rebuilds everything the live arbitrage screen needs to resume a match
 * exactly where the referee left off — score, rotation, on-court lineup,
 * libero/captain state, timeouts, substitutions and the referee's own
 * side-swap/acting-captain choices — purely from what's persisted in the DB.
 * No in-memory history is required, so this works after the app was fully
 * closed and reopened.
 */
export async function reconstructLiveState(matchId: string): Promise<ReconstructedLiveMatch | null> {
  const match = await getMatchById(matchId);
  if (!match) return null;

  const sets = await getSetsForMatch(matchId);
  const currentSet = sets.find((s) => !s.finishedAt) ?? sets[sets.length - 1];
  if (!currentSet) return null;

  const [homeRoster, awayRoster] = await Promise.all([
    getPlayersByTeam(match.teamHomeId),
    getPlayersByTeam(match.teamAwayId),
  ]);

  const [homeLineupRows, awayLineupRows] = await Promise.all([
    getLineupForSet(matchId, currentSet.id, match.teamHomeId),
    getLineupForSet(matchId, currentSet.id, match.teamAwayId),
  ]);
  const startingOnCourtHome: CourtMap = {};
  for (const row of homeLineupRows) startingOnCourtHome[row.position] = row.playerId;
  const startingOnCourtAway: CourtMap = {};
  for (const row of awayLineupRows) startingOnCourtAway[row.position] = row.playerId;

  const setEvents = await getEventsForSet(matchId, currentSet.id);
  const initialServingTeam = determineInitialServing(match, currentSet);

  const courtState = replayCourtState({
    startingOnCourtHome,
    startingOnCourtAway,
    homeRoster,
    awayRoster,
    events: setEvents,
    initialServingTeam,
  });

  const { home: scoreHome, away: scoreAway } = computeScore(setEvents);
  const servingTeam = computeServingTeam(setEvents, initialServingTeam);
  const timeoutsHome = computeTimeoutsUsed(setEvents, match.teamHomeId);
  const timeoutsAway = computeTimeoutsUsed(setEvents, match.teamAwayId);

  const [pairsHome, pairsAway] = await Promise.all([
    getPairsForSet(matchId, currentSet.id, match.teamHomeId),
    getPairsForSet(matchId, currentSet.id, match.teamAwayId),
  ]);
  const substitutionsHome = countNormalSubs(pairsHome);
  const substitutionsAway = countNormalSubs(pairsAway);

  const setsHome = sets.filter((s) => s.winnerTeamId === match.teamHomeId).length;
  const setsAway = sets.filter((s) => s.winnerTeamId === match.teamAwayId).length;
  const setScores = sets.map((s) => ({ home: s.scoreHome, away: s.scoreAway }));

  return {
    match,
    currentSet,
    sets,
    events: setEvents,
    onCourtHome: courtState.onCourtHome,
    onCourtAway: courtState.onCourtAway,
    benchHome: courtState.benchHome,
    benchAway: courtState.benchAway,
    liberoHome: courtState.liberoHome,
    liberoAway: courtState.liberoAway,
    rotationHome: courtState.rotationHome,
    rotationAway: courtState.rotationAway,
    pairsHome,
    pairsAway,
    scoreHome,
    scoreAway,
    setsHome,
    setsAway,
    setScores,
    servingTeam,
    initialServingTeam,
    timeoutsHome,
    timeoutsAway,
    substitutionsHome,
    substitutionsAway,
    sidesSwapped: match.sidesSwapped,
    actingCaptainHomeId: match.actingCaptainHomeId,
    actingCaptainAwayId: match.actingCaptainAwayId,
  };
}
