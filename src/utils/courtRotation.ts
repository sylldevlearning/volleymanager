import type { Player } from '../models/player';
import type { LiberoState } from '../models/substitution';
import type { MatchEvent } from '../models/event';
import { predictLiberoAutoExit } from './substitutionRules';

export type CourtMap = Record<number, string>;

/** Returned when a side-out rotation forces the active libero off the court. */
export interface LiberoAutoExit {
  side: 'home' | 'away';
  liberoId: string;
  replacedPlayerId: string;
  position: number;
}

export interface SideCourtState {
  onCourt: CourtMap;
  rotation: number[];
  libero: LiberoState | null;
}

/** Side-out rotation: each player moves one slot clockwise (P2→P1, …, P1→P6). */
export function rotateCourt(court: CourtMap): CourtMap {
  const rotated: CourtMap = {};
  for (const [posStr, playerId] of Object.entries(court)) {
    const pos = Number(posStr);
    rotated[pos === 1 ? 6 : pos - 1] = playerId;
  }
  return rotated;
}

/**
 * Applies a side-out rotation (+ libero auto-exit check) to ONE side — the
 * side that just won the rally and gained the serve. Single source of truth
 * shared by the live scoring store and the DB-replay reconstruction, so the
 * two can never drift apart.
 */
export function rotateSideOnSideOut(
  side: 'home' | 'away',
  state: SideCourtState,
): { state: SideCourtState; autoExit: LiberoAutoExit | null } {
  const rotation = state.rotation.map((p) => (p === 6 ? 1 : p + 1));
  let onCourt = rotateCourt(state.onCourt);
  let libero = state.libero;
  let autoExit: LiberoAutoExit | null = null;

  if (libero?.isOnCourt) {
    const { mustExit, newPosition } = predictLiberoAutoExit(libero);
    if (mustExit && newPosition) {
      onCourt = { ...onCourt, [newPosition]: libero.replacedPlayerId! };
      autoExit = {
        side,
        liberoId: libero.liberoId,
        replacedPlayerId: libero.replacedPlayerId!,
        position: newPosition,
      };
      libero = { ...libero, isOnCourt: false, replacedPlayerId: null, replacedPosition: null };
    } else if (newPosition) {
      libero = { ...libero, replacedPosition: newPosition };
    }
  }

  return { state: { onCourt, rotation, libero }, autoExit };
}

export interface CourtReplayResult {
  onCourtHome: CourtMap;
  onCourtAway: CourtMap;
  rotationHome: number[];
  rotationAway: number[];
  liberoHome: LiberoState | null;
  liberoAway: LiberoState | null;
  benchHome: Player[];
  benchAway: Player[];
}

/**
 * Pure replay of a set's chronological, non-cancelled events onto a starting
 * court — used to resume a live match from persisted state without any
 * in-memory history. Mirrors exactly what the live store does one event at a
 * time (addPointEvent / applySubstitution / applyLiberoExit), so a sequence
 * played live and the same sequence replayed from the DB always agree.
 */
export function replayCourtState(opts: {
  startingOnCourtHome: CourtMap;
  startingOnCourtAway: CourtMap;
  homeRoster: Player[];
  awayRoster: Player[];
  events: MatchEvent[];
  initialServingTeam: 'home' | 'away';
}): CourtReplayResult {
  let onCourtHome = { ...opts.startingOnCourtHome };
  let onCourtAway = { ...opts.startingOnCourtAway };
  let rotationHome = [1, 2, 3, 4, 5, 6];
  let rotationAway = [1, 2, 3, 4, 5, 6];

  const homeLiberoId = opts.homeRoster.find((p) => p.position === 'libero')?.id ?? null;
  const awayLiberoId = opts.awayRoster.find((p) => p.position === 'libero')?.id ?? null;
  let liberoHome: LiberoState | null = homeLiberoId
    ? { liberoId: homeLiberoId, isOnCourt: false, replacedPlayerId: null, replacedPosition: null }
    : null;
  let liberoAway: LiberoState | null = awayLiberoId
    ? { liberoId: awayLiberoId, isOnCourt: false, replacedPlayerId: null, replacedPosition: null }
    : null;

  let benchHome = opts.homeRoster.filter((p) => !Object.values(onCourtHome).includes(p.id));
  let benchAway = opts.awayRoster.filter((p) => !Object.values(onCourtAway).includes(p.id));

  let serving = opts.initialServingTeam;

  for (const event of opts.events) {
    if (event.eventType === 'point_home' || event.eventType === 'point_away') {
      const team = event.eventType === 'point_home' ? 'home' : 'away';
      if (team === 'home' && serving === 'away') {
        const result = rotateSideOnSideOut('home', { onCourt: onCourtHome, rotation: rotationHome, libero: liberoHome });
        onCourtHome = result.state.onCourt;
        rotationHome = result.state.rotation;
        liberoHome = result.state.libero;
      } else if (team === 'away' && serving === 'home') {
        const result = rotateSideOnSideOut('away', { onCourt: onCourtAway, rotation: rotationAway, libero: liberoAway });
        onCourtAway = result.state.onCourt;
        rotationAway = result.state.rotation;
        liberoAway = result.state.libero;
      }
      serving = team;
    } else if (event.eventType === 'substitution_home' || event.eventType === 'substitution_away') {
      const side: 'home' | 'away' = event.eventType === 'substitution_home' ? 'home' : 'away';
      const details = event.details as { playerOutId?: string; position?: number; isLibero?: boolean; isExceptional?: boolean };
      const playerInId = event.playerId;
      if (!playerInId || details.position === undefined || !details.playerOutId) continue;
      const liberoId = side === 'home' ? homeLiberoId : awayLiberoId;
      // A substitution event with isLibero=true represents EITHER the libero
      // entering (playerOutId = the starter they replace) OR the libero
      // exiting — manually or auto-forced by rotation (playerOutId = the
      // libero's own id, playerInId = the original player returning).
      const isLiberoExit = !!details.isLibero && details.playerOutId === liberoId;
      // A regular substitute's partner sits on the bench (they may return); not an injured player
      const roster = side === 'home' ? opts.homeRoster : opts.awayRoster;
      const benchedOut = !details.isLibero && !details.isExceptional
        ? roster.find((p) => p.id === details.playerOutId)
        : undefined;

      if (side === 'home') {
        onCourtHome = { ...onCourtHome, [details.position]: playerInId };
        benchHome = benchHome.filter((p) => p.id !== playerInId);
        if (benchedOut && !benchHome.some((p) => p.id === benchedOut.id)) benchHome = [...benchHome, benchedOut];
        if (isLiberoExit) {
          liberoHome = liberoHome ? { ...liberoHome, isOnCourt: false, replacedPlayerId: null, replacedPosition: null } : liberoHome;
          const liberoPlayer = opts.homeRoster.find((p) => p.id === liberoId);
          if (liberoPlayer && !benchHome.some((p) => p.id === liberoPlayer.id)) benchHome = [...benchHome, liberoPlayer];
        } else if (details.isLibero) {
          liberoHome = liberoHome
            ? { ...liberoHome, isOnCourt: true, replacedPlayerId: details.playerOutId, replacedPosition: details.position }
            : liberoHome;
        }
      } else {
        onCourtAway = { ...onCourtAway, [details.position]: playerInId };
        benchAway = benchAway.filter((p) => p.id !== playerInId);
        if (benchedOut && !benchAway.some((p) => p.id === benchedOut.id)) benchAway = [...benchAway, benchedOut];
        if (isLiberoExit) {
          liberoAway = liberoAway ? { ...liberoAway, isOnCourt: false, replacedPlayerId: null, replacedPosition: null } : liberoAway;
          const liberoPlayer = opts.awayRoster.find((p) => p.id === liberoId);
          if (liberoPlayer && !benchAway.some((p) => p.id === liberoPlayer.id)) benchAway = [...benchAway, liberoPlayer];
        } else if (details.isLibero) {
          liberoAway = liberoAway
            ? { ...liberoAway, isOnCourt: true, replacedPlayerId: details.playerOutId, replacedPosition: details.position }
            : liberoAway;
        }
      }
    }
  }

  return { onCourtHome, onCourtAway, rotationHome, rotationAway, liberoHome, liberoAway, benchHome, benchAway };
}
