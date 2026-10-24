import { act } from '@testing-library/react-native';
import {
  buildDefaultBench,
  benchFromPlayers,
  swapWithBench,
  sendToBench,
  enterFromBench,
  findTokenAt,
  MAX_ON_COURT,
  type BenchBoard,
} from '../src/features/tactical/benchUtils';
import { useTacticalStore } from '../src/features/tactical/tacticalStore';
import type { PlayerPosition, TacticalPlay } from '../src/models/tactical';
import type { Player } from '../src/models/player';

jest.mock('../src/services/database', () => ({
  generateId: () => `mock-id-${Math.random().toString(36).slice(2, 8)}`,
  getDb: jest.fn(),
}));

const pos = (id: string, x: number, y: number, isHome = true, number = 1): PlayerPosition => ({
  playerId: id,
  x,
  y,
  teamId: isHome ? 'home' : 'away',
  number,
  label: String(number),
  isHome,
});

const ball: PlayerPosition = {
  playerId: 'ball', x: 0.5, y: 0.5, teamId: '', number: 0, label: '🏐', isHome: false, isBall: true,
};

const player = (id: string, number: number, position: Player['position'] = null): Player => ({
  id,
  teamId: 'home',
  firstName: null,
  lastName: `P${number}`,
  number,
  position,
  photoUri: null,
  isActive: true,
  createdAt: '',
});

function board(): BenchBoard {
  return {
    positions: [pos('h1', 0.2, 0.8, true, 1), pos('h2', 0.8, 0.8, true, 2), pos('a1', 0.5, 0.2, false, 1), ball],
    benchHome: buildDefaultBench('home', true),
    benchAway: buildDefaultBench('away', false),
  };
}

describe('buildDefaultBench', () => {
  it('creates substitutes numbered 7 to 12 with synthetic ids', () => {
    const bench = buildDefaultBench('home', true);
    expect(bench.map((b) => b.number)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(bench.every((b) => b.playerId.startsWith('home_') && b.isHome && b.teamId === 'home')).toBe(true);
    expect(new Set(bench.map((b) => b.playerId)).size).toBe(6);
  });

  it('uses the away prefix for the away team', () => {
    const bench = buildDefaultBench('away', false);
    expect(bench.every((b) => b.playerId.startsWith('away_') && !b.isHome)).toBe(true);
  });
});

describe('benchFromPlayers', () => {
  it('maps players and flags the libero', () => {
    const bench = benchFromPlayers([player('p7', 7), player('l', 10, 'libero')], 'home', true);
    expect(bench).toEqual([
      expect.objectContaining({ playerId: 'p7', number: 7, lastName: 'P7', isHome: true, isLibero: false }),
      expect.objectContaining({ playerId: 'l', number: 10, isLibero: true }),
    ]);
  });
});

describe('swapWithBench', () => {
  it('puts the bench player at the exact spot of the court player and benches the latter', () => {
    const b = board();
    const incoming = b.benchHome[0];
    const next = swapWithBench(b, incoming.playerId, 'h1');
    const entered = next.positions.find((p) => p.playerId === incoming.playerId);
    expect(entered).toEqual(expect.objectContaining({ x: 0.2, y: 0.8, number: 7, isHome: true }));
    expect(next.positions.find((p) => p.playerId === 'h1')).toBeUndefined();
    expect(next.benchHome[0]).toEqual(expect.objectContaining({ playerId: 'h1', number: 1 }));
    expect(next.benchHome.find((p) => p.playerId === incoming.playerId)).toBeUndefined();
    expect(next.benchHome).toHaveLength(6);
  });

  it('refuses to swap with a player of the other team', () => {
    const b = board();
    expect(swapWithBench(b, b.benchHome[0].playerId, 'a1')).toBe(b);
  });

  it('refuses to swap with the ball', () => {
    const b = board();
    expect(swapWithBench(b, b.benchHome[0].playerId, 'ball')).toBe(b);
  });

  it('swaps on the away side too', () => {
    const b = board();
    const next = swapWithBench(b, b.benchAway[0].playerId, 'a1');
    expect(next.benchAway[0].playerId).toBe('a1');
    expect(next.positions.find((p) => p.playerId === b.benchAway[0].playerId)?.isHome).toBe(false);
  });
});

describe('sendToBench', () => {
  it('removes the player from the court and appends them to their bench', () => {
    const b = board();
    const next = sendToBench(b, 'h2');
    expect(next.positions.find((p) => p.playerId === 'h2')).toBeUndefined();
    expect(next.benchHome[next.benchHome.length - 1]).toEqual(expect.objectContaining({ playerId: 'h2', number: 2 }));
    expect(next.benchAway).toBe(b.benchAway);
  });

  it('never benches the ball', () => {
    const b = board();
    expect(sendToBench(b, 'ball')).toBe(b);
  });

  it('is a no-op for an unknown player', () => {
    const b = board();
    expect(sendToBench(b, 'nobody')).toBe(b);
  });
});

describe('enterFromBench', () => {
  it('places the bench player at the drop point when the team has room', () => {
    const b = board();
    const id = b.benchHome[1].playerId;
    const next = enterFromBench(b, id, 0.4, 0.7, MAX_ON_COURT.indoor_6v6);
    expect(next.positions.find((p) => p.playerId === id)).toEqual(expect.objectContaining({ x: 0.4, y: 0.7 }));
    expect(next.benchHome.find((p) => p.playerId === id)).toBeUndefined();
  });

  it('refuses when the team is already full', () => {
    const b = board();
    expect(enterFromBench(b, b.benchHome[0].playerId, 0.4, 0.7, 2)).toBe(b);
  });

  it('ignores the other team when counting players on court', () => {
    const b = board();
    const next = enterFromBench(b, b.benchAway[0].playerId, 0.4, 0.3, 2);
    expect(next).not.toBe(b);
  });
});

describe('findTokenAt', () => {
  const positions = [pos('h1', 0.5, 0.75, true), pos('a1', 0.5, 0.25, false), ball];

  it('finds the same-team token within the radius (pixel space)', () => {
    // court 200 × 400 → h1 at (100, 300)
    expect(findTokenAt(positions, 110, 310, 200, 400, 28, true)?.playerId).toBe('h1');
  });

  it('returns null outside the radius', () => {
    expect(findTokenAt(positions, 150, 300, 200, 400, 28, true)).toBeNull();
  });

  it('ignores tokens of the other team and the ball', () => {
    expect(findTokenAt(positions, 100, 100, 200, 400, 28, true)).toBeNull();
    expect(findTokenAt(positions, 100, 200, 200, 400, 28, false)).toBeNull();
  });
});

describe('tacticalStore bench actions', () => {
  beforeEach(() => {
    act(() => {
      useTacticalStore.getState().resetBoard();
      const b = board();
      useTacticalStore.getState().setPositions(b.positions);
      useTacticalStore.getState().setBench(b.benchHome, b.benchAway);
    });
  });

  it('resetBoard empties the bench', () => {
    act(() => useTacticalStore.getState().resetBoard());
    expect(useTacticalStore.getState().benchHome).toEqual([]);
    expect(useTacticalStore.getState().benchAway).toEqual([]);
  });

  it('swapWithBench / sendToBench / enterFromBench update positions and bench', () => {
    const firstSub = useTacticalStore.getState().benchHome[0].playerId;
    act(() => useTacticalStore.getState().swapWithBench(firstSub, 'h1'));
    expect(useTacticalStore.getState().positions.some((p) => p.playerId === firstSub)).toBe(true);

    act(() => useTacticalStore.getState().sendToBench(firstSub));
    expect(useTacticalStore.getState().positions.some((p) => p.playerId === firstSub)).toBe(false);
    expect(useTacticalStore.getState().benchHome.some((p) => p.playerId === firstSub)).toBe(true);

    act(() => useTacticalStore.getState().enterFromBench(firstSub, 0.3, 0.9));
    expect(useTacticalStore.getState().positions.find((p) => p.playerId === firstSub))
      .toEqual(expect.objectContaining({ x: 0.3, y: 0.9 }));
  });

  it('updatePlayerInfo also edits a bench player', () => {
    const sub = useTacticalStore.getState().benchAway[0].playerId;
    act(() => useTacticalStore.getState().updatePlayerInfo(sub, { number: 21, label: '21' }));
    expect(useTacticalStore.getState().benchAway[0]).toEqual(expect.objectContaining({ number: 21, label: '21' }));
  });

  it('loadPlay removes from the bench any player present in the play', () => {
    const sub = useTacticalStore.getState().benchHome[0];
    const play: TacticalPlay = {
      id: 'p', name: 'P', format: 'indoor_6v6', category: 'custom',
      positions: [{ ...sub, x: 0.5, y: 0.8 }],
      arrows: [], isDefault: false, createdAt: '', updatedAt: '',
    };
    act(() => useTacticalStore.getState().loadPlay(play));
    expect(useTacticalStore.getState().benchHome.some((p) => p.playerId === sub.playerId)).toBe(false);
    expect(useTacticalStore.getState().benchHome).toHaveLength(5);
  });
});
