import type { Player } from '../models/player';
import type { MatchConfig } from '../models/match';
import type { SubstitutionPair, LiberoState } from '../models/substitution';
import type { MatchEvent } from '../models/event';
import { isBackRow, canLiberoEnter } from './substitutionRules';
import { isPlayerExpelled, isPlayerDisqualified } from './sanctionRules';

export type RuleCode =
  | 'sub_quota_reached'
  | 'sub_starter_already_returned'
  | 'sub_wrong_return'
  | 'sub_reserve_already_used'
  | 'sub_player_on_court'
  | 'sub_player_expelled'
  | 'sub_player_disqualified'
  | 'sub_libero_not_allowed'
  | 'libero_front_row'
  | 'libero_cannot_serve'
  | 'libero_rally_required'
  | 'libero_other_active'
  | 'libero_wrong_return'
  | 'timeout_quota_reached'
  | 'sub_m13_rally_required'
  | 'sub_m13_server_to_2';

export interface RuleViolation {
  ok: false;
  code: RuleCode;
  /** Ready-to-display French message (FFVolley wording). The UI may instead use t(code, params) for i18n. */
  message: string;
  params?: Record<string, string | number>;
  /** True when "Remplacement exceptionnel" (injury) should be offered as a bypass. */
  allowExceptional?: boolean;
}
export interface RuleOk {
  ok: true;
}
export type RuleResult = RuleOk | RuleViolation;

function violation(
  code: RuleCode,
  message: string,
  params?: Record<string, string | number>,
  allowExceptional?: boolean,
): RuleViolation {
  return { ok: false, code, message, params, allowExceptional };
}

function numberOf(playerId: string, players: Player[]): number | string {
  return players.find((p) => p.id === playerId)?.number ?? '?';
}

export interface RegularSubstitutionContext {
  playerOut: Player;
  playerIn: Player;
  /** Full roster for this team — used to resolve jersey numbers of third parties referenced by pair history. */
  allPlayers: Player[];
  /** Substitution pairs for this set + team (any cancellation state — filtered internally). */
  pairs: SubstitutionPair[];
  subsUsed: number;
  config: MatchConfig;
  onCourtPlayerIds: string[];
  sanctionEventsForSet: MatchEvent[];
  sanctionEventsForMatch: MatchEvent[];
}

/**
 * Strict FIVB/FFVolley validation for a regular (non-libero) substitution.
 * Every violation returns a ready-to-display French message.
 */
export function validateRegularSubstitution(ctx: RegularSubstitutionContext): RuleResult {
  const { playerOut, playerIn, allPlayers } = ctx;
  const pairs = ctx.pairs.filter((p) => !p.isCancelled);

  if (playerOut.position === 'libero' || playerIn.position === 'libero') {
    return violation('sub_libero_not_allowed', 'Le libéro ne peut pas participer à un remplacement régulier.');
  }

  if (isPlayerDisqualified(playerIn.id, ctx.sanctionEventsForMatch)) {
    return violation(
      'sub_player_disqualified',
      `Le n°${playerIn.number} est disqualifié pour le match.`,
      { number: playerIn.number },
    );
  }
  if (isPlayerExpelled(playerIn.id, ctx.sanctionEventsForSet)) {
    return violation(
      'sub_player_expelled',
      `Le n°${playerIn.number} est expulsé pour ce set.`,
      { number: playerIn.number },
    );
  }
  if (ctx.onCourtPlayerIds.includes(playerIn.id)) {
    return violation(
      'sub_player_on_court',
      `Le n°${playerIn.number} est déjà sur le terrain.`,
      { number: playerIn.number },
    );
  }

  if (!ctx.config.unlimitedSubstitutions) {
    const max = ctx.config.substitutionsPerSet ?? 6;
    if (ctx.subsUsed >= max) {
      return violation(
        'sub_quota_reached',
        `${max} remplacements déjà effectués dans ce set.`,
        { max },
        true,
      );
    }
  }

  // playerOut already entered this set earlier — either as the original reserve
  // (still owes a reciprocal return) or as a starter who already completed a full cycle.
  const enteredEarlier = pairs.find((p) => p.playerInId === playerOut.id);
  if (enteredEarlier) {
    const wasOriginallyAStarterWhoLeft = pairs.some((p) => p.playerOutId === playerOut.id);
    if (wasOriginallyAStarterWhoLeft) {
      return violation(
        'sub_starter_already_returned',
        `Le n°${playerOut.number} est déjà sorti et revenu dans ce set.`,
        { number: playerOut.number },
      );
    }
    const requiredPartnerId = enteredEarlier.playerOutId;
    if (playerIn.id !== requiredPartnerId) {
      const requiredNumber = numberOf(requiredPartnerId, allPlayers);
      return violation(
        'sub_reserve_already_used',
        `Le n°${playerOut.number} est déjà entré dans ce set, il ne peut être remplacé que par le n°${requiredNumber}.`,
        { reserveNumber: playerOut.number, starterNumber: requiredNumber },
        true,
      );
    }
  }

  // playerIn was a starter who left earlier this set — can only return via the exact
  // reserve who replaced them.
  const leftEarlier = pairs.find((p) => p.playerOutId === playerIn.id);
  if (leftEarlier) {
    const requiredPartnerId = leftEarlier.playerInId;
    if (playerOut.id !== requiredPartnerId) {
      const requiredNumber = numberOf(requiredPartnerId, allPlayers);
      return violation(
        'sub_wrong_return',
        `Le n°${playerIn.number} ne peut revenir qu'à la place du n°${requiredNumber}.`,
        { returningNumber: playerIn.number, requiredNumber },
        true,
      );
    }
  }

  return { ok: true };
}

export interface FreeSubstitutionContext {
  playerOut: Player;
  playerIn: Player;
  /** Place on court where the substitute enters */
  position: number;
  allPlayers: Player[];
  subsUsed: number;
  config: MatchConfig;
  onCourtPlayerIds: string[];
  /** This set's events, in order — for the M13 limits */
  setEvents: MatchEvent[];
  side: 'home' | 'away';
  sanctionEventsForSet: MatchEvent[];
  sanctionEventsForMatch: MatchEvent[];
}

/** Did `side` win back the serve (and rotate) after event `from`? */
function rotatedSince(events: MatchEvent[], side: 'home' | 'away', from: number): boolean {
  const own = `point_${side}`;
  const isPoint = (e: MatchEvent) => e.eventType === 'point_home' || e.eventType === 'point_away';
  let serving: string | null = null;
  for (let i = from - 1; i >= 0; i--) {
    if (isPoint(events[i])) { serving = events[i].eventType; break; }
  }
  for (let i = from + 1; i < events.length; i++) {
    if (!isPoint(events[i])) continue;
    if (events[i].eventType === own && serving !== null && serving !== own) return true;
    serving = events[i].eventType;
  }
  return false;
}

/**
 * Small formats (4×4, 3×3, 2×2): any bench player may replace any court
 * player, with an optional quota. With the FFVolley M13 limits (4×4): a
 * player who left only comes back after at least one rally, and the player who
 * left from position I does not come back at II before the team rotates (he
 * would serve twice in a row).
 */
export function validateFreeSubstitution(ctx: FreeSubstitutionContext): RuleResult {
  const { playerIn } = ctx;
  if (isPlayerDisqualified(playerIn.id, ctx.sanctionEventsForMatch)) {
    return violation('sub_player_disqualified', `Le n°${playerIn.number} est disqualifié pour le match.`, { number: playerIn.number });
  }
  if (isPlayerExpelled(playerIn.id, ctx.sanctionEventsForSet)) {
    return violation('sub_player_expelled', `Le n°${playerIn.number} est expulsé pour ce set.`, { number: playerIn.number });
  }
  if (ctx.onCourtPlayerIds.includes(playerIn.id)) {
    return violation('sub_player_on_court', `Le n°${playerIn.number} est déjà sur le terrain.`, { number: playerIn.number });
  }
  if (!ctx.config.unlimitedSubstitutions) {
    const max = ctx.config.substitutionsPerSet ?? 0;
    if (ctx.subsUsed >= max) {
      return violation('sub_quota_reached', `${max} remplacements déjà effectués dans ce set.`, { max });
    }
  }
  if (ctx.config.m13Substitutions) {
    const events = ctx.setEvents.filter((e) => !e.isCancelled);
    const subType = `substitution_${ctx.side}`;
    let lastExit = -1;
    events.forEach((e, i) => {
      if (e.eventType === subType && (e.details as { playerOutId?: string })?.playerOutId === playerIn.id) lastExit = i;
    });
    if (lastExit >= 0) {
      const rallyAfter = events.slice(lastExit + 1).some((e) => e.eventType === 'point_home' || e.eventType === 'point_away');
      if (!rallyAfter) {
        return violation('sub_m13_rally_required', `Le n°${playerIn.number} ne peut revenir qu'après au moins un échange.`, { number: playerIn.number });
      }
      const leftFrom = (events[lastExit].details as { position?: number })?.position;
      if (leftFrom === 1 && ctx.position === 2 && !rotatedSince(events, ctx.side, lastExit)) {
        return violation('sub_m13_server_to_2', `Le n°${playerIn.number} vient de servir : il ne peut pas entrer en position 2.`, { number: playerIn.number });
      }
    }
  }
  return { ok: true };
}

/**
 * Libero entry: back row only (I, V, VI). Never consumes the substitution quota.
 * Additionally, a libero can never occupy position I (the server's slot) while
 * their team is serving — a libero is not allowed to serve.
 */
export function validateLiberoSubstitution(position: number, isTeamServing = false): RuleResult {
  if (!isBackRow(position)) {
    return violation('libero_front_row', 'Le libéro ne peut pas entrer en zone avant.');
  }
  if (position === 1 && isTeamServing) {
    return violation('libero_cannot_serve', 'Le libéro ne peut pas servir.');
  }
  return { ok: true };
}

/**
 * FIVB rule: at least one rally (a point played) must occur between two libero
 * replacements for the same team. Scans this set's events for the last libero
 * substitution and checks whether a point has been scored since.
 */
export function checkLiberoRallySinceLastReplacement(
  events: MatchEvent[],
  side: 'home' | 'away',
): RuleResult {
  const subType = side === 'home' ? 'substitution_home' : 'substitution_away';
  const pointTypes = new Set(['point_home', 'point_away']);
  const active = events.filter((e) => !e.isCancelled);

  let lastLiberoSubIndex = -1;
  active.forEach((e, i) => {
    if (e.eventType === subType && e.details?.isLibero) lastLiberoSubIndex = i;
  });
  if (lastLiberoSubIndex === -1) return { ok: true };

  const hasRallyAfter = active.slice(lastLiberoSubIndex + 1).some((e) => pointTypes.has(e.eventType));
  if (!hasRallyAfter) {
    return violation(
      'libero_rally_required',
      'Il doit y avoir au moins un échange de jeu entre deux remplacements de libéro.',
    );
  }
  return { ok: true };
}

/**
 * Only one registered libero may be on court at a time — blocks bringing in
 * a libero while a DIFFERENT one is already active (no direct L1<->L2 swap).
 */
export function checkLiberoNotAlreadyActive(
  enteringLiberoId: string,
  /** Jersey number of the libero CURRENTLY on court (used in the message if blocked). */
  activeLiberoNumber: number,
  activeLibero: LiberoState | null,
): RuleResult {
  if (canLiberoEnter(enteringLiberoId, activeLibero)) return { ok: true };
  return violation(
    'libero_other_active',
    `Le libéro n°${activeLiberoNumber} est déjà sur le terrain.`,
    { number: activeLiberoNumber },
  );
}

/** The libero leaves the court only for the player they replaced. */
export function validateLiberoExit(
  libero: LiberoState,
  playerInId: string,
  /** Jersey number of the player the libero replaced (used in the message if blocked). */
  replacedNumber: number,
): RuleResult {
  if (libero.replacedPlayerId === playerInId) return { ok: true };
  return violation(
    'libero_wrong_return',
    `Le libéro ne peut sortir que pour le n°${replacedNumber}, qu'il avait remplacé.`,
    { number: replacedNumber },
  );
}

export function validateTimeoutRequest(used: number, config: MatchConfig, teamName: string): RuleResult {
  if (config.unlimitedTimeouts) return { ok: true };
  const max = config.timeoutsPerSet ?? 2;
  if (used >= max) {
    return violation(
      'timeout_quota_reached',
      `Plus de temps mort disponible pour ${teamName} dans ce set.`,
      { teamName },
    );
  }
  return { ok: true };
}

/**
 * Determines whether an "exceptional substitution" (injury, outside the quota)
 * should be offered for `playerOut` — only when NO legal regular substitution
 * exists for any bench candidate.
 */
export function getExceptionalSubstitutionEligibility(
  playerOut: Player,
  benchCandidates: Player[],
  ctx: Omit<RegularSubstitutionContext, 'playerOut' | 'playerIn'>,
): { eligible: boolean } {
  const anyLegalOption = benchCandidates.some(
    (candidate) => validateRegularSubstitution({ ...ctx, playerOut, playerIn: candidate }).ok,
  );
  return { eligible: !anyLegalOption };
}
