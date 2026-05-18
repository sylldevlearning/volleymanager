import { create } from 'zustand';
import type { Match, MatchSet } from '../models/match';
import type { MatchEvent } from '../models/event';
import type { Player } from '../models/player';
import type { SubstitutionPair, LiberoState } from '../models/substitution';
import { computeScore } from '../services/eventService';
import { isSetWon, isMatchWon, isLastSet, shouldChangeEndsBeach } from '../utils/volleyball-rules';
import { liberoMustExit } from '../utils/substitutionRules';

interface SetScore {
  home: number;
  away: number;
}

/** position (1-6) → playerId */
export type CourtMap = Record<number, string>;

interface ScoringState {
  match: Match | null;
  currentSet: MatchSet | null;
  sets: MatchSet[];
  events: MatchEvent[];
  rotationHome: number[];
  rotationAway: number[];
  timeoutsHome: number;
  timeoutsAway: number;
  /** Count of normal (non-libero) subs used this set */
  substitutionsHome: number;
  substitutionsAway: number;
  lastScoringTeam: 'home' | 'away' | null;
  showChangeEnds: boolean;

  // Court state (position → playerId)
  onCourtHome: CourtMap;
  onCourtAway: CourtMap;
  benchHome: Player[];
  benchAway: Player[];
  liberoHome: LiberoState | null;
  liberoAway: LiberoState | null;
  // Active pairs for reciprocity checks
  pairsHome: SubstitutionPair[];
  pairsAway: SubstitutionPair[];

  // Derived (computed)
  scoreHome: number;
  scoreAway: number;
  setsHome: number;
  setsAway: number;
  setScores: SetScore[];
  servingTeam: 'home' | 'away';
  /** Serving team at the start of the current set — used to recompute after undo */
  initialServingTeam: 'home' | 'away';

  // Actions
  initMatch: (match: Match, firstSet: MatchSet) => void;
  initLineup: (
    side: 'home' | 'away',
    onCourt: CourtMap,
    bench: Player[],
    libero: LiberoState | null,
  ) => void;
  addPointEvent: (team: 'home' | 'away', newEvent: MatchEvent) => void;
  undoPoint: (cancelledEventId: string) => void;
  removePoint: (team: 'home' | 'away', cancelledEventId: string) => void;
  endCurrentSet: (winnerTeam: 'home' | 'away', updatedSet: MatchSet) => void;
  startNewSet: (newSet: MatchSet) => void;
  requestTimeout: (team: 'home' | 'away') => void;
  cancelTimeout: (team: 'home' | 'away') => void;
  addCorrectionEvent: (team: 'home' | 'away', newEvent: MatchEvent) => void;
  applySubstitution: (
    side: 'home' | 'away',
    playerOutId: string,
    playerInId: string,
    position: number,
    isLibero: boolean,
    pair: SubstitutionPair,
  ) => void;
  applyLiberoExit: (side: 'home' | 'away') => void;
  rotateTeam: (team: 'home' | 'away') => void;
  dismissChangeEnds: () => void;
  reset: () => void;
}

const INITIAL_ROTATION = [1, 2, 3, 4, 5, 6];
const EMPTY_COURT: CourtMap = {};

/**
 * Determines which team serves at the start of a given set.
 * Set 1 = firstServeTeam, set 2 = other team, set 3 = firstServeTeam, etc.
 * Defaults to home team when firstServeTeamId is not set.
 */
function resolveInitialServing(match: Match, setNumber: number): 'home' | 'away' {
  const firstServeIsHome =
    !match.firstServeTeamId || match.firstServeTeamId === match.teamHomeId;
  const isFirstServeTurn = setNumber % 2 === 1;
  if (isFirstServeTurn) return firstServeIsHome ? 'home' : 'away';
  return firstServeIsHome ? 'away' : 'home';
}

function computeServingTeam(events: MatchEvent[], initialServing: 'home' | 'away'): 'home' | 'away' {
  let serving = initialServing;
  for (const e of events) {
    if (e.isCancelled) continue;
    if (e.eventType === 'point_home') serving = 'home';
    else if (e.eventType === 'point_away') serving = 'away';
  }
  return serving;
}

/**
 * Side-out rotation: each player moves one slot clockwise (P2→P1, P3→P2, …, P1→P6).
 * Creates a new object so Zustand / React detect the reference change.
 */
function rotateCourt(court: CourtMap): CourtMap {
  const rotated: CourtMap = {};
  for (const [posStr, playerId] of Object.entries(court)) {
    const pos = Number(posStr);
    const newPos = pos === 1 ? 6 : pos - 1;
    rotated[newPos] = playerId;
  }
  return rotated;
}

function applySubOnMap(
  court: CourtMap,
  bench: Player[],
  playerOutId: string,
  playerInId: string,
  position: number,
): { court: CourtMap; bench: Player[] } {
  const newCourt = { ...court };
  newCourt[position] = playerInId;
  // Move playerOut to bench, remove playerIn from bench
  const playerOut = Object.entries(court).find(([, id]) => id === playerOutId);
  const playerOutOnBench = bench.find((p) => p.id === playerOutId);
  const newBench = bench.filter((p) => p.id !== playerInId);
  if (playerOut && !playerOutOnBench) {
    // playerOut was on court — they go to bench as a ghost (we only have id, not full Player)
    // We track the CourtMap, bench array stores Player objects
    // On sub out, we add a placeholder if needed (UI shows the player's slot as empty on court)
  }
  return { court: newCourt, bench: newBench };
}

export const useScoringStore = create<ScoringState>()((set, get) => ({
  match: null,
  currentSet: null,
  sets: [],
  events: [],
  rotationHome: [...INITIAL_ROTATION],
  rotationAway: [...INITIAL_ROTATION],
  timeoutsHome: 0,
  timeoutsAway: 0,
  substitutionsHome: 0,
  substitutionsAway: 0,
  lastScoringTeam: null,
  showChangeEnds: false,
  onCourtHome: EMPTY_COURT,
  onCourtAway: EMPTY_COURT,
  benchHome: [],
  benchAway: [],
  liberoHome: null,
  liberoAway: null,
  pairsHome: [],
  pairsAway: [],
  scoreHome: 0,
  scoreAway: 0,
  setsHome: 0,
  setsAway: 0,
  setScores: [],
  servingTeam: 'home',
  initialServingTeam: 'home',

  initMatch: (match, firstSet) => {
    const initialServing = resolveInitialServing(match, firstSet.setNumber);
    set({
      match,
      currentSet: firstSet,
      sets: [firstSet],
      events: [],
      rotationHome: [...INITIAL_ROTATION],
      rotationAway: [...INITIAL_ROTATION],
      timeoutsHome: 0,
      timeoutsAway: 0,
      substitutionsHome: 0,
      substitutionsAway: 0,
      scoreHome: 0,
      scoreAway: 0,
      setsHome: 0,
      setsAway: 0,
      setScores: [],
      servingTeam: initialServing,
      initialServingTeam: initialServing,
      lastScoringTeam: null,
      showChangeEnds: false,
      onCourtHome: EMPTY_COURT,
      onCourtAway: EMPTY_COURT,
      benchHome: [],
      benchAway: [],
      liberoHome: null,
      liberoAway: null,
      pairsHome: [],
      pairsAway: [],
    });
  },

  initLineup: (side, onCourt, bench, libero) => {
    if (side === 'home') {
      set({ onCourtHome: onCourt, benchHome: bench, liberoHome: libero });
    } else {
      set({ onCourtAway: onCourt, benchAway: bench, liberoAway: libero });
    }
  },

  addPointEvent: (team, newEvent) => {
    const state = get();
    const newEvents = [...state.events, newEvent];
    const { home, away } = computeScore(newEvents);

    const match = state.match!;
    const setNum = state.currentSet?.setNumber ?? 1;
    const lastSet = isLastSet(setNum, match.config);

    let showChangeEnds = false;
    if (match.format === 'beach_2v2') {
      showChangeEnds = shouldChangeEndsBeach(home, away, setNum, match.config);
    }

    const prevServing = state.servingTeam;
    const newServing = team;

    let rotationHome = state.rotationHome;
    let rotationAway = state.rotationAway;
    let onCourtHome = state.onCourtHome;
    let onCourtAway = state.onCourtAway;
    let liberoHome = state.liberoHome;
    let liberoAway = state.liberoAway;

    if (team === 'home' && prevServing === 'away') {
      // Side-out: home team rotates
      rotationHome = rotationHome.map((p) => (p === 6 ? 1 : p + 1));
      onCourtHome = rotateCourt(state.onCourtHome);

      // Libero: track new position or auto-exit into front row
      if (liberoHome?.isOnCourt && liberoHome.replacedPosition) {
        const newLiberoPos = liberoHome.replacedPosition === 1 ? 6 : liberoHome.replacedPosition - 1;
        if (liberoMustExit(newLiberoPos)) {
          // Restore original player at the rotated slot and clear libero state
          onCourtHome = { ...onCourtHome, [newLiberoPos]: liberoHome.replacedPlayerId! };
          liberoHome = { ...liberoHome, isOnCourt: false, replacedPlayerId: null, replacedPosition: null };
        } else {
          liberoHome = { ...liberoHome, replacedPosition: newLiberoPos };
        }
      }
    } else if (team === 'away' && prevServing === 'home') {
      // Side-out: away team rotates
      rotationAway = rotationAway.map((p) => (p === 6 ? 1 : p + 1));
      onCourtAway = rotateCourt(state.onCourtAway);

      if (liberoAway?.isOnCourt && liberoAway.replacedPosition) {
        const newLiberoPos = liberoAway.replacedPosition === 1 ? 6 : liberoAway.replacedPosition - 1;
        if (liberoMustExit(newLiberoPos)) {
          onCourtAway = { ...onCourtAway, [newLiberoPos]: liberoAway.replacedPlayerId! };
          liberoAway = { ...liberoAway, isOnCourt: false, replacedPlayerId: null, replacedPosition: null };
        } else {
          liberoAway = { ...liberoAway, replacedPosition: newLiberoPos };
        }
      }
    }

    set({
      events: newEvents,
      scoreHome: home,
      scoreAway: away,
      servingTeam: newServing,
      rotationHome,
      rotationAway,
      onCourtHome,
      onCourtAway,
      lastScoringTeam: team,
      showChangeEnds,
      liberoHome,
      liberoAway,
    });
  },

  undoPoint: (cancelledEventId) => {
    const state = get();
    const newEvents = state.events.map((e) =>
      e.id === cancelledEventId ? { ...e, isCancelled: true } : e
    );
    const active = newEvents.filter((e) => !e.isCancelled);
    const { home, away } = computeScore(active);
    const serving = computeServingTeam(active, state.initialServingTeam);
    set({ events: newEvents, scoreHome: home, scoreAway: away, servingTeam: serving });
  },

  removePoint: (team, cancelledEventId) => {
    const state = get();
    const newEvents = state.events.map((e) =>
      e.id === cancelledEventId ? { ...e, isCancelled: true } : e
    );
    const active = newEvents.filter((e) => !e.isCancelled);
    const { home, away } = computeScore(active);
    const serving = computeServingTeam(active, state.initialServingTeam);
    set({ events: newEvents, scoreHome: home, scoreAway: away, servingTeam: serving });
  },

  endCurrentSet: (winnerTeam, updatedSet) => {
    const state = get();
    const updatedSets = state.sets.map((s) => (s.id === updatedSet.id ? updatedSet : s));
    const setsHome = updatedSets.filter((s) => s.winnerTeamId === state.match?.teamHomeId).length;
    const setsAway = updatedSets.filter((s) => s.winnerTeamId === state.match?.teamAwayId).length;
    const setScores = updatedSets.map((s) => ({ home: s.scoreHome, away: s.scoreAway }));
    set({ sets: updatedSets, setsHome, setsAway, setScores, currentSet: updatedSet });
  },

  startNewSet: (newSet) => {
    set((state) => {
      const initialServing = resolveInitialServing(state.match!, newSet.setNumber);
      return {
        currentSet: newSet,
        sets: [...state.sets, newSet],
        events: [],
        scoreHome: 0,
        scoreAway: 0,
        timeoutsHome: 0,
        timeoutsAway: 0,
        substitutionsHome: 0,
        substitutionsAway: 0,
        rotationHome: [...INITIAL_ROTATION],
        rotationAway: [...INITIAL_ROTATION],
        servingTeam: initialServing,
        initialServingTeam: initialServing,
        lastScoringTeam: null,
        showChangeEnds: false,
        pairsHome: [],
        pairsAway: [],
        liberoHome: state.liberoHome ? { ...state.liberoHome, isOnCourt: false, replacedPlayerId: null, replacedPosition: null } : null,
        liberoAway: state.liberoAway ? { ...state.liberoAway, isOnCourt: false, replacedPlayerId: null, replacedPosition: null } : null,
      };
    });
  },

  requestTimeout: (team) => {
    if (team === 'home') set((s) => ({ timeoutsHome: s.timeoutsHome + 1 }));
    else set((s) => ({ timeoutsAway: s.timeoutsAway + 1 }));
  },

  cancelTimeout: (team) => {
    if (team === 'home') set((s) => ({ timeoutsHome: Math.max(0, s.timeoutsHome - 1) }));
    else set((s) => ({ timeoutsAway: Math.max(0, s.timeoutsAway - 1) }));
  },

  addCorrectionEvent: (team, newEvent) => {
    const state = get();
    const newEvents = [...state.events, newEvent];
    const active = newEvents.filter((e) => !e.isCancelled);
    const { home, away } = computeScore(active);
    const serving = computeServingTeam(active, state.initialServingTeam);
    set({ events: newEvents, scoreHome: home, scoreAway: away, servingTeam: serving });
  },

  applySubstitution: (side, playerOutId, playerInId, position, isLibero, pair) => {
    set((state) => {
      if (side === 'home') {
        const newCourt = { ...state.onCourtHome, [position]: playerInId };
        const newBench = state.benchHome.filter((p) => p.id !== playerInId);
        const pairsHome = [...state.pairsHome, pair];
        const liberoHome = isLibero
          ? { ...state.liberoHome!, isOnCourt: true, replacedPlayerId: playerOutId, replacedPosition: position }
          : state.liberoHome;
        return {
          onCourtHome: newCourt,
          benchHome: newBench,
          pairsHome,
          liberoHome,
          substitutionsHome: isLibero ? state.substitutionsHome : state.substitutionsHome + 1,
        };
      } else {
        const newCourt = { ...state.onCourtAway, [position]: playerInId };
        const newBench = state.benchAway.filter((p) => p.id !== playerInId);
        const pairsAway = [...state.pairsAway, pair];
        const liberoAway = isLibero
          ? { ...state.liberoAway!, isOnCourt: true, replacedPlayerId: playerOutId, replacedPosition: position }
          : state.liberoAway;
        return {
          onCourtAway: newCourt,
          benchAway: newBench,
          pairsAway,
          liberoAway,
          substitutionsAway: isLibero ? state.substitutionsAway : state.substitutionsAway + 1,
        };
      }
    });
  },

  applyLiberoExit: (side) => {
    set((state) => {
      if (side === 'home') {
        const libero = state.liberoHome;
        if (!libero?.isOnCourt || !libero.replacedPlayerId || !libero.replacedPosition) return {};
        const newCourt = { ...state.onCourtHome, [libero.replacedPosition]: libero.replacedPlayerId };
        return {
          onCourtHome: newCourt,
          liberoHome: { ...libero, isOnCourt: false, replacedPlayerId: null, replacedPosition: null },
        };
      } else {
        const libero = state.liberoAway;
        if (!libero?.isOnCourt || !libero.replacedPlayerId || !libero.replacedPosition) return {};
        const newCourt = { ...state.onCourtAway, [libero.replacedPosition]: libero.replacedPlayerId };
        return {
          onCourtAway: newCourt,
          liberoAway: { ...libero, isOnCourt: false, replacedPlayerId: null, replacedPosition: null },
        };
      }
    });
  },

  rotateTeam: (team) => {
    if (team === 'home') {
      set((s) => ({ rotationHome: s.rotationHome.map((p) => (p === 6 ? 1 : p + 1)) }));
    } else {
      set((s) => ({ rotationAway: s.rotationAway.map((p) => (p === 6 ? 1 : p + 1)) }));
    }
  },

  dismissChangeEnds: () => set({ showChangeEnds: false }),
  reset: () => set({
    match: null,
    currentSet: null,
    sets: [],
    events: [],
    scoreHome: 0,
    scoreAway: 0,
    setsHome: 0,
    setsAway: 0,
    setScores: [],
    servingTeam: 'home',
    onCourtHome: EMPTY_COURT,
    onCourtAway: EMPTY_COURT,
    benchHome: [],
    benchAway: [],
    liberoHome: null,
    liberoAway: null,
    pairsHome: [],
    pairsAway: [],
  }),
}));
