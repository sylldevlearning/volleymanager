import { act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTacticalStore } from '../src/features/tactical/tacticalStore';
import {
  saveMatchBoard,
  openMatchBoard,
  deleteMatchBoard,
  deleteAllMatchBoards,
} from '../src/features/tactical/boardPersistence';
import { deleteMatch, deleteAllMatches } from '../src/services/matchService';
import type { PlayerPosition } from '../src/models/tactical';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockDb = { runAsync: jest.fn().mockResolvedValue(undefined) };
jest.mock('../src/services/database', () => ({
  generateId: () => `mock-id-${Math.random().toString(36).slice(2, 8)}`,
  getDb: jest.fn(() => Promise.resolve(mockDb)),
}));

const token = (id: string, x: number, y: number, number: number, isHome = true): PlayerPosition => ({
  playerId: id, x, y, teamId: isHome ? 'home' : 'away', number, label: String(number), isHome,
});
const ball: PlayerPosition = {
  playerId: 'ball', x: 0.5, y: 0.5, teamId: '', number: 0, label: '🏐', isHome: false, isBall: true,
};

/** What the board shows right after a match sync: 1 on court, 7 on the bench */
function syncedBoard() {
  const s = useTacticalStore.getState();
  s.setPositions([token('p1', 0.8, 0.8, 1), ball]);
  s.setBench([{ playerId: 'p7', teamId: 'home', number: 7, label: '7', isHome: true }], []);
}

/** Coach edits: drag, rename, bench swap, arrow, step */
function editBoard() {
  const s = useTacticalStore.getState();
  s.movePlayer('p1', 0.3, 0.6);
  s.updatePlayerInfo('p1', { number: 11, label: '11' });
  s.swapWithBench('p7', 'p1');
  s.addArrow({ type: 'solid', fromX: 0, fromY: 0, toX: 10, toY: 10, color: '#fff', thickness: 'thin' });
  s.advanceGroup();
}

/** App killed: the in-memory store is gone */
function simulateAppRestart() {
  useTacticalStore.getState().resetBoard();
}

beforeEach(async () => {
  await AsyncStorage.clear();
  act(() => useTacticalStore.getState().resetBoard());
});

describe('tactical board opened from a match — persistence', () => {
  it('reproduces the bug: edits survive closing the board and restarting the app', async () => {
    act(() => { syncedBoard(); editBoard(); });
    await saveMatchBoard('m1', { syncedWithMatch: false, format: 'indoor_6v6' });

    act(simulateAppRestart);
    const opened = await openMatchBoard('m1');

    const s = useTacticalStore.getState();
    expect(opened).toEqual({ restored: true, syncedWithMatch: false, format: 'indoor_6v6' });
    expect(s.positions.find((p) => p.playerId === 'p7')).toMatchObject({ x: 0.3, y: 0.6 });
    expect(s.benchHome).toEqual([expect.objectContaining({ playerId: 'p1', number: 11 })]);
    expect(s.arrows).toHaveLength(1);
    expect(s.drawingOrder).toHaveLength(1);
    expect(s.currentGroup).toBe(2);
  });

  it('keeps one board per match', async () => {
    act(() => { syncedBoard(); editBoard(); });
    await saveMatchBoard('m1', { syncedWithMatch: false, format: 'indoor_6v6' });

    act(simulateAppRestart);
    expect(await openMatchBoard('m2')).toEqual({ restored: false });
    expect(useTacticalStore.getState().positions).toEqual([]);
  });

  it('remembers that an untouched board keeps following the match', async () => {
    act(syncedBoard);
    await saveMatchBoard('m1', { syncedWithMatch: true, format: 'indoor_6v6' });
    act(simulateAppRestart);
    expect(await openMatchBoard('m1')).toMatchObject({ restored: true, syncedWithMatch: true });
  });

  it('restores the step history', async () => {
    act(() => {
      syncedBoard();
      useTacticalStore.getState().addHistorySnapshot({
        group: 1, positionsBefore: [], positionsAfter: [], drawings: [], freehandDrawings: [],
      });
    });
    await saveMatchBoard('m1', { syncedWithMatch: false, format: 'indoor_6v6' });
    act(simulateAppRestart);
    await openMatchBoard('m1');
    expect(useTacticalStore.getState().history).toHaveLength(1);
  });

  it('ignores a corrupted save', async () => {
    await AsyncStorage.setItem('@volleymanager/tactical_board/m1', '{oops');
    expect(await openMatchBoard('m1')).toEqual({ restored: false });
  });
});

describe('tactical board save — deleted with its match', () => {
  async function savedFor(matchId: string) {
    act(syncedBoard);
    await saveMatchBoard(matchId, { syncedWithMatch: false, format: 'indoor_6v6' });
  }

  it('deleteMatchBoard removes only that match', async () => {
    await savedFor('m1');
    await savedFor('m2');
    await deleteMatchBoard('m1');
    expect(await openMatchBoard('m1')).toEqual({ restored: false });
    expect(await openMatchBoard('m2')).toMatchObject({ restored: true });
  });

  it('deleteMatch also deletes the board save', async () => {
    await savedFor('m1');
    await deleteMatch('m1');
    expect(await openMatchBoard('m1')).toEqual({ restored: false });
  });

  it('deleteAllMatches deletes every board save but not the saved plays', async () => {
    await AsyncStorage.setItem('@volleymanager/tactical_plays', '[]');
    await savedFor('m1');
    await savedFor('m2');
    await deleteAllMatches();
    expect(await openMatchBoard('m1')).toEqual({ restored: false });
    expect(await openMatchBoard('m2')).toEqual({ restored: false });
    expect(await AsyncStorage.getItem('@volleymanager/tactical_plays')).toBe('[]');
  });

  it('deleteAllMatchBoards is safe when nothing is saved', async () => {
    await expect(deleteAllMatchBoards()).resolves.toBeUndefined();
  });
});
