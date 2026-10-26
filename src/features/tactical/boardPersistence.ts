import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MatchFormat } from '../../models/match';
import { useTacticalStore, type BoardSnapshot } from './tacticalStore';

/** One save per match — the tactical board opened from that match */
const KEY_PREFIX = '@volleymanager/tactical_board/';
const SAVE_VERSION = 1;

interface SavedMatchBoard {
  version: number;
  board: BoardSnapshot;
  format: MatchFormat;
  /** True while the coach has not edited the board: it keeps following the match */
  syncedWithMatch: boolean;
}

export type OpenMatchBoardResult =
  | { restored: false }
  | { restored: true; syncedWithMatch: boolean; format: MatchFormat };

function keyFor(matchId: string): string {
  return KEY_PREFIX + matchId;
}

/** Saves the current tactical store state as the board of this match. */
export async function saveMatchBoard(
  matchId: string,
  meta: { syncedWithMatch: boolean; format: MatchFormat },
): Promise<void> {
  const saved: SavedMatchBoard = {
    version: SAVE_VERSION,
    board: useTacticalStore.getState().getSnapshot(),
    ...meta,
  };
  await AsyncStorage.setItem(keyFor(matchId), JSON.stringify(saved));
}

/** Restores this match's saved board into the tactical store, if there is one. */
export async function openMatchBoard(matchId: string): Promise<OpenMatchBoardResult> {
  let saved: SavedMatchBoard;
  try {
    const raw = await AsyncStorage.getItem(keyFor(matchId));
    if (!raw) return { restored: false };
    saved = JSON.parse(raw) as SavedMatchBoard;
  } catch {
    return { restored: false };
  }
  if (saved?.version !== SAVE_VERSION || !saved.board) return { restored: false };

  useTacticalStore.getState().restoreSnapshot(saved.board);
  return { restored: true, syncedWithMatch: saved.syncedWithMatch, format: saved.format };
}

export async function deleteMatchBoard(matchId: string): Promise<void> {
  await AsyncStorage.removeItem(keyFor(matchId));
}

export async function deleteAllMatchBoards(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const boardKeys = keys.filter((k) => k.startsWith(KEY_PREFIX));
  if (boardKeys.length > 0) await AsyncStorage.multiRemove(boardKeys);
}
