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
import { effectiveCourt, type BoardSubstitution, type MatchTeamState } from './matchDiff';

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
