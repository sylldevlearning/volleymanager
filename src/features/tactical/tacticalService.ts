import { getDb, generateId } from '../../services/database';
import type { TacticalPlay, PlayerPosition, Arrow } from '../../models/tactical';
import type { MatchFormat } from '../../models/match';
import { DEFAULT_PLAYS } from './defaultPlays';

function rowToPlay(row: Record<string, unknown>): TacticalPlay {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    format: row.format as MatchFormat,
    category: row.category as TacticalPlay['category'],
    positions: JSON.parse(row.positions_json as string) as PlayerPosition[],
    arrows: JSON.parse(row.arrows_json as string) as Arrow[],
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function seedDefaultPlays(): Promise<void> {
  const db = await getDb();
  for (const play of DEFAULT_PLAYS) {
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM tactical_plays WHERE id = ?',
      [play.id]
    );
    if (!existing) {
      await db.runAsync(
        `INSERT INTO tactical_plays (id, name, description, format, category, positions_json, arrows_json, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          play.id,
          play.name,
          play.description ?? null,
          play.format,
          play.category,
          JSON.stringify(play.positions),
          JSON.stringify(play.arrows),
          play.createdAt,
          play.updatedAt,
        ]
      );
    }
  }
}

export async function getAllPlays(format?: MatchFormat): Promise<TacticalPlay[]> {
  const db = await getDb();
  const rows = format
    ? await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM tactical_plays WHERE format = ? ORDER BY is_default DESC, name ASC',
        [format]
      )
    : await db.getAllAsync<Record<string, unknown>>(
        'SELECT * FROM tactical_plays ORDER BY is_default DESC, name ASC'
      );
  return rows.map(rowToPlay);
}

export async function savePlay(
  name: string,
  format: MatchFormat,
  category: TacticalPlay['category'],
  positions: PlayerPosition[],
  arrows: Arrow[],
  description?: string,
): Promise<TacticalPlay> {
  const db = await getDb();
  const id = generateId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO tactical_plays (id, name, description, format, category, positions_json, arrows_json, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [id, name, description ?? null, format, category, JSON.stringify(positions), JSON.stringify(arrows), now, now]
  );
  return {
    id, name, description, format, category, positions, arrows,
    isDefault: false, createdAt: now, updatedAt: now,
  };
}

export async function deletePlay(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM tactical_plays WHERE id = ? AND is_default = 0', [id]);
}
