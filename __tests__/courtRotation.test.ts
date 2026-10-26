import { rotateSideOnSideOut, replayCourtState } from '../src/utils/courtRotation';
import type { Player } from '../src/models/player';
import type { MatchEvent } from '../src/models/event';
import type { LiberoState } from '../src/models/substitution';

function player(id: string, number: number, position: Player['position'] = null): Player {
  return { id, teamId: 't1', firstName: null, lastName: `P${number}`, number, position, photoUri: null, isActive: true, createdAt: '2026-01-01' };
}

function point(id: string, eventType: 'point_home' | 'point_away', timestamp: string): MatchEvent {
  return { id, matchId: 'm1', setId: 's1', eventType, playerId: null, teamId: null, timestamp, details: {}, isCancelled: false };
}

function subEvent(opts: {
  id: string;
  side: 'home' | 'away';
  timestamp: string;
  playerInId: string;
  playerOutId: string;
  position: number;
  isLibero: boolean;
}): MatchEvent {
  return {
    id: opts.id, matchId: 'm1', setId: 's1',
    eventType: opts.side === 'home' ? 'substitution_home' : 'substitution_away',
    playerId: opts.playerInId, teamId: null, timestamp: opts.timestamp,
    details: { playerOutId: opts.playerOutId, position: opts.position, isLibero: opts.isLibero },
    isCancelled: false,
  };
}

describe('rotateSideOnSideOut', () => {
  it('rotates every position one slot clockwise (P2→P1, …, P1→P6)', () => {
    const onCourt = { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e', 6: 'f' };
    const { state } = rotateSideOnSideOut('home', { onCourt, rotation: [1, 2, 3, 4, 5, 6], libero: null });
    expect(state.onCourt).toEqual({ 6: 'a', 1: 'b', 2: 'c', 3: 'd', 4: 'e', 5: 'f' });
  });

  it('forces the libero off when their slot rotates into the front row, restoring the original player', () => {
    const onCourt = { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e', 6: 'lib' };
    const libero: LiberoState = { liberoId: 'lib', isOnCourt: true, replacedPlayerId: 'f', replacedPosition: 6 };
    const { state, autoExit } = rotateSideOnSideOut('home', { onCourt, rotation: [1, 2, 3, 4, 5, 6], libero });

    // position 6 rotates to 5 (still back row) — no exit yet
    expect(autoExit).toBeNull();
    expect(state.libero).toEqual({ liberoId: 'lib', isOnCourt: true, replacedPlayerId: 'f', replacedPosition: 5 });
  });

  it('auto-exits the libero exactly when their rotated slot reaches the front row', () => {
    const onCourt = { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'lib', 6: 'f' };
    const libero: LiberoState = { liberoId: 'lib', isOnCourt: true, replacedPlayerId: 'e', replacedPosition: 5 };
    const { state, autoExit } = rotateSideOnSideOut('home', { onCourt, rotation: [1, 2, 3, 4, 5, 6], libero });

    // position 5 rotates to 4 (front row) — must exit, original player 'e' returns
    expect(autoExit).toEqual({ side: 'home', liberoId: 'lib', replacedPlayerId: 'e', position: 4 });
    expect(state.onCourt[4]).toBe('e');
    expect(state.libero).toEqual({ liberoId: 'lib', isOnCourt: false, replacedPlayerId: null, replacedPosition: null });
  });
});

describe('replayCourtState', () => {
  const home = [player('h1', 1), player('h2', 2), player('h3', 3), player('h4', 4), player('h5', 5), player('h6', 6), player('h7', 7, 'libero')];
  const away = [player('a1', 11), player('a2', 12), player('a3', 13), player('a4', 14), player('a5', 15), player('a6', 16), player('a7', 17, 'libero')];
  const startingOnCourtHome = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' };
  const startingOnCourtAway = { 1: 'a1', 2: 'a2', 3: 'a3', 4: 'a4', 5: 'a5', 6: 'a6' };

  it('with no events, returns the starting lineup untouched and the libero on the bench', () => {
    const result = replayCourtState({
      startingOnCourtHome, startingOnCourtAway, homeRoster: home, awayRoster: away,
      events: [], initialServingTeam: 'home',
    });
    expect(result.onCourtHome).toEqual(startingOnCourtHome);
    expect(result.onCourtAway).toEqual(startingOnCourtAway);
    expect(result.liberoHome).toEqual({ liberoId: 'h7', isOnCourt: false, replacedPlayerId: null, replacedPosition: null });
    expect(result.benchHome.map((p) => p.id)).toEqual(['h7']);
  });

  it('rotates the team that just won a side-out, leaves the other team untouched', () => {
    const events = [point('e1', 'point_home', 't1')]; // home scores while away was serving → home rotates
    const result = replayCourtState({
      startingOnCourtHome, startingOnCourtAway, homeRoster: home, awayRoster: away,
      events, initialServingTeam: 'away',
    });
    expect(result.onCourtHome).toEqual({ 6: 'h1', 1: 'h2', 2: 'h3', 3: 'h4', 4: 'h5', 5: 'h6' });
    expect(result.onCourtAway).toEqual(startingOnCourtAway);
  });

  it('does not rotate the team that already had the serve', () => {
    const events = [point('e1', 'point_home', 't1')]; // home scores while home was already serving
    const result = replayCourtState({
      startingOnCourtHome, startingOnCourtAway, homeRoster: home, awayRoster: away,
      events, initialServingTeam: 'home',
    });
    expect(result.onCourtHome).toEqual(startingOnCourtHome);
  });

  it('replays a manual (non-libero) substitution onto the court and off the bench', () => {
    const rosterWithReserve = [...home, player('h8', 8)];
    const events = [
      subEvent({ id: 'e1', side: 'home', timestamp: 't1', playerInId: 'h8', playerOutId: 'h3', position: 3, isLibero: false }),
    ];
    const result = replayCourtState({
      startingOnCourtHome, startingOnCourtAway, homeRoster: rosterWithReserve, awayRoster: away,
      events, initialServingTeam: 'home',
    });
    expect(result.onCourtHome[3]).toBe('h8');
    expect(result.benchHome.map((p) => p.id)).not.toContain('h8');
  });

  it('puts the starter who left back on the bench, so they can return', () => {
    const rosterWithReserve = [...home, player('h8', 8)];
    const events = [
      subEvent({ id: 'e1', side: 'home', timestamp: 't1', playerInId: 'h8', playerOutId: 'h3', position: 3, isLibero: false }),
    ];
    const result = replayCourtState({
      startingOnCourtHome, startingOnCourtAway, homeRoster: rosterWithReserve, awayRoster: away,
      events, initialServingTeam: 'home',
    });
    expect(result.benchHome.map((p) => p.id)).toContain('h3');
  });

  it('keeps a player out after an exceptional (injury) substitution', () => {
    const rosterWithReserve = [...home, player('h8', 8)];
    const event = subEvent({ id: 'e1', side: 'home', timestamp: 't1', playerInId: 'h8', playerOutId: 'h3', position: 3, isLibero: false });
    const events = [{ ...event, details: { ...event.details, isExceptional: true } }];
    const result = replayCourtState({
      startingOnCourtHome, startingOnCourtAway, homeRoster: rosterWithReserve, awayRoster: away,
      events, initialServingTeam: 'home',
    });
    expect(result.benchHome.map((p) => p.id)).not.toContain('h3');
  });

  it('replays the libero ENTERING for a back-row starter', () => {
    const events = [
      subEvent({ id: 'e1', side: 'home', timestamp: 't1', playerInId: 'h7', playerOutId: 'h6', position: 6, isLibero: true }),
    ];
    const result = replayCourtState({
      startingOnCourtHome, startingOnCourtAway, homeRoster: home, awayRoster: away,
      events, initialServingTeam: 'home',
    });
    expect(result.onCourtHome[6]).toBe('h7');
    expect(result.liberoHome).toEqual({ liberoId: 'h7', isOnCourt: true, replacedPlayerId: 'h6', replacedPosition: 6 });
  });

  it('replays a manual libero EXIT (playerOutId is the libero) distinctly from an entry', () => {
    const events = [
      subEvent({ id: 'e1', side: 'home', timestamp: 't1', playerInId: 'h7', playerOutId: 'h6', position: 6, isLibero: true }),
      subEvent({ id: 'e2', side: 'home', timestamp: 't2', playerInId: 'h6', playerOutId: 'h7', position: 6, isLibero: true }),
    ];
    const result = replayCourtState({
      startingOnCourtHome, startingOnCourtAway, homeRoster: home, awayRoster: away,
      events, initialServingTeam: 'home',
    });
    expect(result.onCourtHome[6]).toBe('h6');
    expect(result.liberoHome).toEqual({ liberoId: 'h7', isOnCourt: false, replacedPlayerId: null, replacedPosition: null });
    expect(result.benchHome.map((p) => p.id)).toContain('h7');
  });

  it('replays a rotation-forced libero auto-exit followed by its persisted substitution event, ending with the libero back on the bench', () => {
    // libero enters at position 6 replacing h6.
    const enter = subEvent({ id: 'e1', side: 'home', timestamp: 't1', playerInId: 'h7', playerOutId: 'h6', position: 6, isLibero: true });
    // Home side-out #1 (away was serving): libero's slot rotates 6→5 — still back row, no exit yet.
    const p1 = point('e2', 'point_home', 't2');
    // Away regains the serve momentarily so the next home point is a fresh side-out.
    const p2 = point('e3', 'point_away', 't3');
    // Home side-out #2: libero's slot rotates 5→4 — front row, so the live app's
    // rotation logic (addPointEvent / rotateSideOnSideOut) auto-exits the libero
    // right here, restoring h6 at position 4.
    const p3 = point('e4', 'point_home', 't4');
    // The live app always persists a matching substitution event immediately after
    // the auto-exit (see arbitrage.tsx's handlePoint) — this is what the replay
    // relies on to also move the libero back onto the bench.
    const autoExitSub = subEvent({ id: 'e5', side: 'home', timestamp: 't5', playerInId: 'h6', playerOutId: 'h7', position: 4, isLibero: true });

    const result = replayCourtState({
      startingOnCourtHome, startingOnCourtAway, homeRoster: home, awayRoster: away,
      events: [enter, p1, p2, p3, autoExitSub], initialServingTeam: 'away',
    });

    expect(result.onCourtHome[4]).toBe('h6');
    expect(result.liberoHome).toEqual({ liberoId: 'h7', isOnCourt: false, replacedPlayerId: null, replacedPosition: null });
    expect(result.benchHome.map((p) => p.id)).toContain('h7');
    expect(Object.values(result.onCourtHome)).not.toContain('h7');
  });
});
