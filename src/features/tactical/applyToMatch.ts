import type { MatchConfig } from '../../models/match';
import type { MatchEvent } from '../../models/event';
import type { SubstitutionPair } from '../../models/substitution';
import {
  validateRegularSubstitution,
  validateLiberoSubstitution,
  validateLiberoExit,
  checkLiberoNotAlreadyActive,
  checkLiberoRallySinceLastReplacement,
  type RuleResult,
} from '../../utils/rulesValidator';
import type { Match, MatchSet } from '../../models/match';
import type { Player } from '../../models/player';
import type { LiberoState } from '../../models/substitution';
import type { PlayerPosition } from '../../models/tactical';
import type { CourtMap } from '../../stores/scoringStore';
import {
  effectiveCourt,
  computeBoardSubstitutions,
  positionsToLineup,
  lineupDiffers,
  type BenchMove,
  type BoardSubstitution,
  type LineupResult,
  type MatchTeamState,
} from './matchDiff';

/** Everything rulesValidator needs about one team, as the substitution sheet passes it */
export interface TeamRulesContext {
  side: 'home' | 'away';
  team: MatchTeamState;
  pairs: SubstitutionPair[];
  subsUsed: number;
  config: MatchConfig;
  isTeamServing: boolean;
  setEvents: MatchEvent[];
  sanctionEventsForSet: MatchEvent[];
  sanctionEventsForMatch: MatchEvent[];
}

export interface CheckedSubstitution extends BoardSubstitution {
  outNumber: number;
  inNumber: number;
  /** rulesValidator message, null when legal */
  error: string | null;
}

export interface BoardCheckResult {
  ok: boolean;
  items: CheckedSubstitution[];
}

/**
 * Validates the board's substitutions for one team, in order, each one against
 * the match as it will be after the previous ones (quota, return to the same
 * place, libero rules) — same rules and messages as the substitution sheet.
 * All or nothing: ok is false as soon as one is refused.
 */
export function checkBoardSubstitutions(subs: BoardSubstitution[], ctx: TeamRulesContext): BoardCheckResult {
  const { players } = ctx.team;
  const byId = new Map(players.map((p) => [p.id, p]));
  let court = effectiveCourt(ctx.team);
  let libero = ctx.team.libero;
  let pairs = ctx.pairs;
  let subsUsed = ctx.subsUsed;
  let events = ctx.setEvents;
  const subType = ctx.side === 'home' ? 'substitution_home' : 'substitution_away';

  const items = subs.map((sub, i): CheckedSubstitution => {
    const playerOut = byId.get(sub.playerOutId);
    const playerIn = byId.get(sub.playerInId);
    const item = { ...sub, outNumber: playerOut?.number ?? 0, inNumber: playerIn?.number ?? 0, error: null };
    if (!playerOut || !playerIn) return item;

    const isLiberoExit = libero?.isOnCourt === true && sub.playerOutId === libero.liberoId;
    const isLiberoEntry = !isLiberoExit && playerIn.position === 'libero';
    let result: RuleResult;

    if (isLiberoExit) {
      const replacedNumber = byId.get(libero!.replacedPlayerId ?? '')?.number ?? 0;
      result = firstFailure(
        validateLiberoExit(libero!, sub.playerInId, replacedNumber),
        checkLiberoRallySinceLastReplacement(events, ctx.side),
      );
    } else if (isLiberoEntry) {
      const activeNumber = libero ? byId.get(libero.liberoId)?.number ?? 0 : 0;
      result = firstFailure(
        checkLiberoNotAlreadyActive(sub.playerInId, activeNumber, libero),
        validateLiberoSubstitution(sub.position, ctx.isTeamServing),
        checkLiberoRallySinceLastReplacement(events, ctx.side),
      );
    } else {
      result = validateRegularSubstitution({
        playerOut,
        playerIn,
        allPlayers: players,
        pairs,
        subsUsed,
        config: ctx.config,
        onCourtPlayerIds: Object.values(court),
        sanctionEventsForSet: ctx.sanctionEventsForSet,
        sanctionEventsForMatch: ctx.sanctionEventsForMatch,
      });
    }
    if (!result.ok) return { ...item, error: result.message };

    // The next ones are checked against the match after this one
    court = { ...court, [sub.position]: sub.playerInId };
    if (isLiberoExit || isLiberoEntry) {
      libero = isLiberoExit
        ? { ...libero!, isOnCourt: false, replacedPlayerId: null, replacedPosition: null }
        : { liberoId: sub.playerInId, isOnCourt: true, replacedPlayerId: sub.playerOutId, replacedPosition: sub.position };
      events = [...events, {
        id: `board-${i}`, matchId: '', setId: '', eventType: subType, playerId: sub.playerInId, teamId: null,
        timestamp: '', details: { isLibero: true }, isCancelled: false,
      } as MatchEvent];
    } else {
      pairs = [...pairs, {
        id: `board-${i}`, matchId: '', setId: '', teamId: '', playerOutId: sub.playerOutId, playerInId: sub.playerInId,
        isLibero: false, isExceptional: false, isCancelled: false,
      }];
      subsUsed += 1;
    }
    return item;
  });

  return { ok: items.every((i) => i.error === null), items };
}

function firstFailure(...results: RuleResult[]): RuleResult {
  return results.find((r) => !r.ok) ?? { ok: true };
}

/**
 * What the board may change in the match right now:
 * - before_first_point: the set has no rally yet (between two sets) → starting lineup
 * - in_set: substitutions only, never position moves
 * - set_over / none: nothing
 */
export type MatchPhase = 'before_first_point' | 'in_set' | 'set_over' | 'none';

export function matchPhase(currentSet: MatchSet | null, setEvents: MatchEvent[]): MatchPhase {
  if (!currentSet) return 'none';
  if (currentSet.winnerTeamId) return 'set_over';
  const happened = setEvents.some((e) => !e.isCancelled && e.eventType !== 'undo');
  return happened ? 'in_set' : 'before_first_point';
}

export type TeamLineupPlan =
  | { status: 'unchanged' }
  | { status: 'changed'; court: CourtMap }
  | { status: 'error'; error: Exclude<LineupResult, { ok: true }> };

export type ApplyPlan =
  | { kind: 'none' }
  | { kind: 'substitutions'; ok: boolean; home: BoardCheckResult; away: BoardCheckResult }
  | { kind: 'lineup'; ok: boolean; home: TeamLineupPlan; away: TeamLineupPlan };

export interface ApplyInput {
  positions: PlayerPosition[];
  benchMoves: BenchMove[];
  phase: MatchPhase;
  home: TeamRulesContext;
  away: TeamRulesContext;
}

function teamLineupPlan(positions: PlayerPosition[], ctx: TeamRulesContext): TeamLineupPlan {
  const isHome = ctx.side === 'home';
  const lineup = positionsToLineup(positions, isHome, ctx.team.players);
  const matchCourt = effectiveCourt(ctx.team);
  if (lineup.ok) return lineupDiffers(lineup.court, matchCourt) ? { status: 'changed', court: lineup.court } : { status: 'unchanged' };
  if (lineup.code === 'lineup_no_roster') return { status: 'unchanged' };

  // Players placed off the zones (a drawn play) only matter when the players changed
  const ids = new Set(ctx.team.players.map((p) => p.id));
  const onBoard = positions.filter((p) => !p.isBall && p.isHome === isHome && ids.has(p.playerId)).map((p) => p.playerId);
  const inMatch = Object.values(matchCourt);
  const samePlayers = onBoard.length === inMatch.length && onBoard.every((id) => inMatch.includes(id));
  return samePlayers ? { status: 'unchanged' } : { status: 'error', error: lineup };
}

/** The recap shown before applying the board to the match (and whether there is anything to apply). */
export function planBoardApply(input: ApplyInput): ApplyPlan {
  if (input.phase === 'in_set') {
    const check = (ctx: TeamRulesContext) =>
      checkBoardSubstitutions(computeBoardSubstitutions(input.positions, input.benchMoves, ctx.side === 'home', ctx.team), ctx);
    const home = check(input.home);
    const away = check(input.away);
    if (home.items.length === 0 && away.items.length === 0) return { kind: 'none' };
    return { kind: 'substitutions', ok: home.ok && away.ok, home, away };
  }
  if (input.phase === 'before_first_point') {
    const home = teamLineupPlan(input.positions, input.home);
    const away = teamLineupPlan(input.positions, input.away);
    if (home.status === 'unchanged' && away.status === 'unchanged') return { kind: 'none' };
    return { kind: 'lineup', ok: home.status !== 'error' && away.status !== 'error', home, away };
  }
  return { kind: 'none' };
}

/** The live scoring store fields the rules need — the same ones the substitution sheet receives. */
export interface LiveMatchState {
  match: Pick<Match, 'config'> | null;
  onCourtHome: CourtMap;
  onCourtAway: CourtMap;
  liberoHome: LiberoState | null;
  liberoAway: LiberoState | null;
  pairsHome: SubstitutionPair[];
  pairsAway: SubstitutionPair[];
  substitutionsHome: number;
  substitutionsAway: number;
  servingTeam: 'home' | 'away';
  events: MatchEvent[];
}

export function rulesContextFromStore(state: LiveMatchState, side: 'home' | 'away', roster: Player[]): TeamRulesContext {
  const isHome = side === 'home';
  return {
    side,
    team: {
      court: isHome ? state.onCourtHome : state.onCourtAway,
      libero: isHome ? state.liberoHome : state.liberoAway,
      players: roster,
    },
    pairs: isHome ? state.pairsHome : state.pairsAway,
    subsUsed: isHome ? state.substitutionsHome : state.substitutionsAway,
    config: state.match!.config,
    isTeamServing: state.servingTeam === side,
    setEvents: state.events,
    // The quick match screen has no sanctions
    sanctionEventsForSet: [],
    sanctionEventsForMatch: [],
  };
}
