import type { Player } from '../../models/player';
import type { LiberoState } from '../../models/substitution';
import type { LineupEntry } from '../../services/lineupService';
import type { CourtMap } from '../../stores/scoringStore';

export function toLineupEntries(courtMap: CourtMap): LineupEntry[] {
  return Object.entries(courtMap).map(([pos, playerId]) => ({
    playerId, position: Number(pos) as LineupEntry['position'], isStarter: true, isLibero: false,
  }));
}

/** Fresh bench + libero state for a team's chosen starting six — same construction used whether this is the very first set or a lineup re-entered before a later one. */
export function buildLineupState(players: Player[], courtMap: CourtMap): { bench: Player[]; liberoState: LiberoState | null } {
  const liberoPlayer = players.find((p) => p.position === 'libero') ?? null;
  const assigned = new Set(Object.values(courtMap));
  const bench = players.filter((p) => !assigned.has(p.id));
  const liberoState: LiberoState | null = liberoPlayer
    ? { liberoId: liberoPlayer.id, isOnCourt: false, replacedPlayerId: null, replacedPosition: null }
    : null;
  return { bench, liberoState };
}

/** A saved starting lineup as a court map, or null when none was saved for that set. */
export function courtFromLineupRows(rows: { position: number; playerId: string }[]): CourtMap | null {
  if (rows.length === 0) return null;
  const court: CourtMap = {};
  for (const row of rows) court[row.position] = row.playerId;
  return court;
}
