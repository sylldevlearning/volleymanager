import type { PlayerPosition } from '../../models/tactical';

/** Touch tolerance around a token, in pixels. */
export const SELECT_RADIUS_PX = 30;

/** Closest token (player or ball) under the finger, or null on an empty area. */
export function tokenAt(
  positions: PlayerPosition[],
  px: number,
  py: number,
  courtW: number,
  courtH: number,
  radiusPx = SELECT_RADIUS_PX,
): string | null {
  let best: string | null = null;
  let bestDist = radiusPx;
  for (const p of positions) {
    const dist = Math.hypot(p.x * courtW - px, p.y * courtH - py);
    if (dist <= bestDist) {
      bestDist = dist;
      best = p.playerId;
    }
  }
  return best;
}

/** Step 1: a tap on a token selects it, a tap on an empty area deselects. */
export function nextSelection(_current: string | null, tapped: string | null): string | null {
  return tapped;
}

/**
 * Step 2: where the arrow starts and what it moves — the selected token,
 * wherever the finger starts, even next to another player. Without a
 * selection nothing is drawn (null): the board asks to tap a token first.
 */
export function arrowStart(
  positions: PlayerPosition[],
  selectedId: string | null,
  _fingerX: number,
  _fingerY: number,
  courtW: number,
  courtH: number,
): { x: number; y: number; linkedId: string } | null {
  const selected = selectedId ? positions.find((p) => p.playerId === selectedId) : undefined;
  if (!selected) return null;
  return { x: selected.x * courtW, y: selected.y * courtH, linkedId: selected.playerId };
}
