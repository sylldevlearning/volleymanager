import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId } from '../../services/database';
import type { TacticalPlay, PlayerPosition, Arrow } from '../../models/tactical';
import type { MatchFormat } from '../../models/match';
import { DEFAULT_PLAYS } from './defaultPlays';

const STORAGE_KEY = '@volleymanager/tactical_plays';

async function readCustomPlays(): Promise<TacticalPlay[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TacticalPlay[];
  } catch {
    return [];
  }
}

async function writeCustomPlays(plays: TacticalPlay[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plays));
}

// No-op: defaults live in-memory, no DB needed
export async function seedDefaultPlays(): Promise<void> {}

export async function getAllPlays(format?: MatchFormat): Promise<TacticalPlay[]> {
  const custom = await readCustomPlays();
  const all = [
    ...DEFAULT_PLAYS,
    ...custom,
  ];
  const filtered = format ? all.filter((p) => p.format === format || !format) : all;
  return filtered.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function getCustomPlaysOnly(): Promise<TacticalPlay[]> {
  return readCustomPlays();
}

export async function savePlay(
  name: string,
  format: MatchFormat,
  category: TacticalPlay['category'],
  positions: PlayerPosition[],
  arrows: Arrow[],
  description?: string,
): Promise<TacticalPlay> {
  const custom = await readCustomPlays();
  const id = generateId();
  const now = new Date().toISOString();
  const play: TacticalPlay = {
    id,
    name: name.trim(),
    description,
    format,
    category,
    positions,
    arrows,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  await writeCustomPlays([...custom, play]);
  return play;
}

export async function updatePlay(
  id: string,
  positions: PlayerPosition[],
  arrows: Arrow[],
  name?: string,
): Promise<void> {
  const custom = await readCustomPlays();
  const now = new Date().toISOString();
  const updated = custom.map((p) =>
    p.id === id
      ? { ...p, positions, arrows, name: name ?? p.name, updatedAt: now }
      : p
  );
  await writeCustomPlays(updated);
}

export async function deletePlay(id: string): Promise<void> {
  const custom = await readCustomPlays();
  await writeCustomPlays(custom.filter((p) => p.id !== id));
}
