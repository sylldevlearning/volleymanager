import type { PlayerPosition } from '../../models/tactical';
import type { Player } from '../../models/player';
import type { LiberoState } from '../../models/substitution';
import type { CourtMap } from '../../stores/scoringStore';
import { HOME_POSITION_COORDS, AWAY_POSITION_COORDS } from './positionUtils';

/** Bench actions done on the board, in order — tells who replaced whom */
export type BenchMove =
  | { type: 'swap'; inId: string; outId: string }
  | { type: 'out'; outId: string }
  | { type: 'in'; inId: string; x: number; y: number };

/** One team as the match currently has it */
export interface MatchTeamState {
  court: CourtMap;
  libero: LiberoState | null;
  players: Player[];
}

/** "playerInId enters for playerOutId" at the match zone `position` */
export interface BoardSubstitution {
  isHome: boolean;
  playerOutId: string;
  playerInId: string;
  position: number;
  isLibero: boolean;
}

export type LineupResult =
  | { ok: true; court: CourtMap }
  | { ok: false; code: 'lineup_no_roster' }
  | { ok: false; code: 'lineup_count'; params: { count: number } }
  | { ok: false; code: 'lineup_libero'; params: { number: number } }
  | { ok: false; code: 'lineup_same_zone'; params: { zone: string; first: number; second: number } };

const ZONES = [1, 2, 3, 4, 5, 6] as const;
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

function zoneCoords(isHome: boolean) {
  return isHome ? HOME_POSITION_COORDS : AWAY_POSITION_COORDS;
}

/** Who stands in each zone: the libero replaces the player whose slot they took. */
export function effectiveCourt(team: MatchTeamState): CourtMap {
  const court: CourtMap = { ...team.court };
  const { libero } = team;
  if (libero?.isOnCourt && libero.replacedPosition != null) court[libero.replacedPosition] = libero.liberoId;
  return court;
}

/** The team's tokens that are real roster players (numbered tokens of a quick match are ignored). */
function rosterTokens(positions: PlayerPosition[], isHome: boolean, players: Player[]): PlayerPosition[] {
  const ids = new Set(players.map((p) => p.id));
  return positions.filter((p) => !p.isBall && p.isHome === isHome && ids.has(p.playerId));
}

function isLiberoPlayer(id: string, team: MatchTeamState): boolean {
  return team.libero?.liberoId === id || team.players.find((p) => p.id === id)?.position === 'libero';
}

/**
 * Substitutions the board asks for, compared with the match court.
 * Pairing follows the bench swaps (chains collapse, round trips cancel); players
 * who left and entered separately are paired by the zone the entering one stands in.
 * Position moves alone never produce a substitution.
 */
export function computeBoardSubstitutions(
  positions: PlayerPosition[],
  moves: BenchMove[],
  isHome: boolean,
  team: MatchTeamState,
): BoardSubstitution[] {
  const original = effectiveCourt(team);
  const tokens = rosterTokens(positions, isHome, team.players);
  const onBoard = new Set(tokens.map((p) => p.playerId));
  const inMatch = new Set(Object.values(original));
  const leaving = new Set([...inMatch].filter((id) => !onBoard.has(id)));
  const entering = new Set([...onBoard].filter((id) => !inMatch.has(id)));

  // Replay the bench swaps on the match zones
  const slots: Record<number, string | null> = { ...original };
  const lastMove: Record<number, number> = {};
  moves.forEach((move, i) => {
    const outId = move.type === 'in' ? null : move.outId;
    if (!outId) return;
    const pos = ZONES.find((z) => slots[z] === outId);
    if (pos === undefined) return;
    slots[pos] = move.type === 'swap' ? move.inId : null;
    lastMove[pos] = i;
  });

  const pairs: (BoardSubstitution & { order: number })[] = [];
  const make = (pos: number, outId: string, inId: string, order: number) => {
    pairs.push({
      isHome, playerOutId: outId, playerInId: inId, position: pos,
      isLibero: isLiberoPlayer(outId, team) || isLiberoPlayer(inId, team),
      order,
    });
    leaving.delete(outId);
    entering.delete(inId);
  };

  for (const pos of ZONES) {
    const outId = original[pos];
    const inId = slots[pos];
    if (outId && inId && leaving.has(outId) && entering.has(inId)) make(pos, outId, inId, lastMove[pos]);
  }

  // Leftovers: closest (entering token, vacated zone) first
  const coords = zoneCoords(isHome);
  const candidates: { pos: number; outId: string; inId: string; dist: number }[] = [];
  for (const pos of ZONES) {
    const outId = original[pos];
    if (!outId || !leaving.has(outId)) continue;
    for (const token of tokens) {
      if (!entering.has(token.playerId)) continue;
      const c = coords[pos];
      candidates.push({ pos, outId, inId: token.playerId, dist: Math.hypot(token.x - c.x, token.y - c.y) });
    }
  }
  candidates.sort((a, b) => a.dist - b.dist);
  for (const c of candidates) {
    if (leaving.has(c.outId) && entering.has(c.inId)) make(c.pos, c.outId, c.inId, Infinity);
  }

  return pairs
    .sort((a, b) => a.order - b.order || a.position - b.position)
    .map(({ order: _order, ...sub }) => sub);
}

/** Board positions read as a starting lineup: each player in the nearest zone I–VI. */
export function positionsToLineup(positions: PlayerPosition[], isHome: boolean, players: Player[]): LineupResult {
  const tokens = rosterTokens(positions, isHome, players);
  if (tokens.length === 0) return { ok: false, code: 'lineup_no_roster' };
  if (tokens.length !== ZONES.length) return { ok: false, code: 'lineup_count', params: { count: tokens.length } };

  const byId = new Map(players.map((p) => [p.id, p]));
  const libero = tokens.find((t) => byId.get(t.playerId)?.position === 'libero');
  if (libero) return { ok: false, code: 'lineup_libero', params: { number: byId.get(libero.playerId)!.number } };

  const coords = zoneCoords(isHome);
  const court: CourtMap = {};
  for (const token of tokens) {
    let zone: number = ZONES[0];
    let best = Infinity;
    for (const z of ZONES) {
      const d = Math.hypot(token.x - coords[z].x, token.y - coords[z].y);
      if (d < best) { best = d; zone = z; }
    }
    const taken = court[zone];
    if (taken) {
      return {
        ok: false,
        code: 'lineup_same_zone',
        params: { zone: ROMAN[zone], first: byId.get(taken)!.number, second: byId.get(token.playerId)!.number },
      };
    }
    court[zone] = token.playerId;
  }
  return { ok: true, court };
}

export function lineupDiffers(a: CourtMap, b: CourtMap): boolean {
  return ZONES.some((z) => a[z] !== b[z]);
}
