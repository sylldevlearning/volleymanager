import { create } from 'zustand';
import type { Match, MatchSet, MatchConfig } from '../models/match';
import type { MatchEvent } from '../models/event';
import { computeScore } from '../services/eventService';
import { isSetWon, isMatchWon, isLastSet, shouldChangeEndsBeach } from '../utils/volleyball-rules';

interface SetScore {
  home: number;
  away: number;
}

interface ScoringState {
  match: Match | null;
  currentSet: MatchSet | null;
  sets: MatchSet[];
  events: MatchEvent[];
  rotationHome: number[];
  rotationAway: number[];
  timeoutsHome: number;
  timeoutsAway: number;
  substitutionsHome: number;
  substitutionsAway: number;
  matchTimer: number;
  isTimerRunning: boolean;
  lastScoringTeam: 'home' | 'away' | null;
  showChangeEnds: boolean;

  // Derived (computed)
  scoreHome: number;
  scoreAway: number;
  setsHome: number;
  setsAway: number;
  setScores: SetScore[];
  servingTeam: 'home' | 'away';

  // Actions
  initMatch: (match: Match, firstSet: MatchSet) => void;
  addPointEvent: (team: 'home' | 'away', newEvent: MatchEvent) => void;
  undoPoint: (cancelledEventId: string) => void;
  endCurrentSet: (winnerTeam: 'home' | 'away', updatedSet: MatchSet) => void;
  startNewSet: (newSet: MatchSet) => void;
  requestTimeout: (team: 'home' | 'away') => void;
  requestSubstitution: (team: 'home' | 'away') => void;
  rotateTeam: (team: 'home' | 'away') => void;
  tickTimer: () => void;
  setTimerRunning: (running: boolean) => void;
  dismissChangeEnds: () => void;
  reset: () => void;
}

const INITIAL_ROTATION = [1, 2, 3, 4, 5, 6];

function computeServingTeam(events: MatchEvent[], initialServing: 'home' | 'away'): 'home' | 'away' {
  let serving = initialServing;
  for (const e of events) {
    if (e.isCancelled) continue;
    if (e.eventType === 'point_home') {
      serving = 'home';
    } else if (e.eventType === 'point_away') {
      serving = 'away';
    }
  }
  return serving;
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
  matchTimer: 0,
  isTimerRunning: false,
  lastScoringTeam: null,
  showChangeEnds: false,
  scoreHome: 0,
  scoreAway: 0,
  setsHome: 0,
  setsAway: 0,
  setScores: [],
  servingTeam: 'home',

  initMatch: (match, firstSet) => {
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
      matchTimer: 0,
      isTimerRunning: true,
      scoreHome: 0,
      scoreAway: 0,
      setsHome: 0,
      setsAway: 0,
      setScores: [],
      servingTeam: 'home',
      lastScoringTeam: null,
      showChangeEnds: false,
    });
  },

  addPointEvent: (team, newEvent) => {
    const state = get();
    const newEvents = [...state.events, newEvent];
    const { home, away } = computeScore(newEvents);

    const match = state.match!;
    const setNum = state.currentSet?.setNumber ?? 1;
    const lastSet = isLastSet(setNum, match.config);
    const setWonHome = isSetWon(home, away, match.config, lastSet);
    const setWonAway = isSetWon(away, home, match.config, lastSet);

    let showChangeEnds = false;
    if (match.format === 'beach_2v2') {
      showChangeEnds = shouldChangeEndsBeach(home, away, setNum, match.config);
    }

    // Side-out: if scoring team was previously receiving, rotate them
    const prevServing = state.servingTeam;
    const newServing = team;

    let rotationHome = state.rotationHome;
    let rotationAway = state.rotationAway;
    if (team === 'home' && prevServing === 'away') {
      rotationHome = rotationHome.map((p) => (p === 6 ? 1 : p + 1));
    } else if (team === 'away' && prevServing === 'home') {
      rotationAway = rotationAway.map((p) => (p === 6 ? 1 : p + 1));
    }

    set({
      events: newEvents,
      scoreHome: home,
      scoreAway: away,
      servingTeam: newServing,
      rotationHome,
      rotationAway,
      lastScoringTeam: team,
      showChangeEnds,
    });
  },

  undoPoint: (cancelledEventId) => {
    const state = get();
    const newEvents = state.events.map((e) =>
      e.id === cancelledEventId ? { ...e, isCancelled: true } : e
    );
    const { home, away } = computeScore(newEvents.filter((e) => !e.isCancelled));
    const serving = computeServingTeam(
      newEvents.filter((e) => !e.isCancelled),
      'home'
    );
    set({ events: newEvents, scoreHome: home, scoreAway: away, servingTeam: serving });
  },

  endCurrentSet: (winnerTeam, updatedSet) => {
    const state = get();
    const updatedSets = state.sets.map((s) =>
      s.id === updatedSet.id ? updatedSet : s
    );
    const setsHome = updatedSets.filter((s) => s.winnerTeamId === state.match?.teamHomeId).length;
    const setsAway = updatedSets.filter((s) => s.winnerTeamId === state.match?.teamAwayId).length;
    const setScores = updatedSets.map((s) => ({ home: s.scoreHome, away: s.scoreAway }));
    set({ sets: updatedSets, setsHome, setsAway, setScores, currentSet: updatedSet });
  },

  startNewSet: (newSet) => {
    set((state) => ({
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
      lastScoringTeam: null,
      showChangeEnds: false,
    }));
  },

  requestTimeout: (team) => {
    if (team === 'home') set((s) => ({ timeoutsHome: s.timeoutsHome + 1 }));
    else set((s) => ({ timeoutsAway: s.timeoutsAway + 1 }));
  },

  requestSubstitution: (team) => {
    if (team === 'home') set((s) => ({ substitutionsHome: s.substitutionsHome + 1 }));
    else set((s) => ({ substitutionsAway: s.substitutionsAway + 1 }));
  },

  rotateTeam: (team) => {
    if (team === 'home') {
      set((s) => ({ rotationHome: s.rotationHome.map((p) => (p === 6 ? 1 : p + 1)) }));
    } else {
      set((s) => ({ rotationAway: s.rotationAway.map((p) => (p === 6 ? 1 : p + 1)) }));
    }
  },

  tickTimer: () => set((s) => ({ matchTimer: s.matchTimer + 1 })),
  setTimerRunning: (running) => set({ isTimerRunning: running }),
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
    isTimerRunning: false,
    matchTimer: 0,
  }),
}));
