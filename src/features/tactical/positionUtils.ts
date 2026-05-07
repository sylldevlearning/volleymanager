import type { PlayerPosition } from '../../models/tactical';

// Full-court portrait coordinate system:
// x: 0 (left) → 1 (right)
// y: 0 (top = away back line) → 1 (bottom = home back line)
// Net: y = 0.5

export const HOME_POSITION_COORDS: Record<1 | 2 | 3 | 4 | 5 | 6, { x: number; y: number }> = {
  1: { x: 0.83, y: 0.85 }, // back right
  2: { x: 0.83, y: 0.60 }, // front right
  3: { x: 0.50, y: 0.60 }, // front center
  4: { x: 0.17, y: 0.60 }, // front left
  5: { x: 0.17, y: 0.85 }, // back left
  6: { x: 0.50, y: 0.85 }, // back center
};

export const AWAY_POSITION_COORDS: Record<1 | 2 | 3 | 4 | 5 | 6, { x: number; y: number }> = {
  1: { x: 0.17, y: 0.15 }, // back right (mirrored)
  2: { x: 0.17, y: 0.40 }, // front right (mirrored)
  3: { x: 0.50, y: 0.40 }, // front center
  4: { x: 0.83, y: 0.40 }, // front left (mirrored)
  5: { x: 0.83, y: 0.15 }, // back left (mirrored)
  6: { x: 0.50, y: 0.15 }, // back center
};

export const BEACH_HOME_COORDS: Record<1 | 2, { x: number; y: number }> = {
  1: { x: 0.65, y: 0.78 },
  2: { x: 0.35, y: 0.62 },
};

export const BEACH_AWAY_COORDS: Record<1 | 2, { x: number; y: number }> = {
  1: { x: 0.35, y: 0.22 },
  2: { x: 0.65, y: 0.38 },
};

export interface SimplePlayer {
  id: string;
  number: number;
  teamId: string;
}

export function buildInitialPositions(
  homePlayers: SimplePlayer[],
  awayPlayers: SimplePlayer[],
  homeTeamId: string,
  awayTeamId: string,
  format: 'indoor_6v6' | 'beach_2v2',
  rotationHome: number[],
  rotationAway: number[],
): PlayerPosition[] {
  const positions: PlayerPosition[] = [];

  if (format === 'indoor_6v6') {
    const homeCount = Math.min(homePlayers.length, 6);
    for (let i = 0; i < homeCount; i++) {
      const pos = (rotationHome[i] ?? (i + 1)) as 1 | 2 | 3 | 4 | 5 | 6;
      const coord = HOME_POSITION_COORDS[pos] ?? HOME_POSITION_COORDS[1];
      const player = homePlayers[i];
      positions.push({
        playerId: player.id,
        x: coord.x,
        y: coord.y,
        teamId: homeTeamId,
        number: player.number,
        label: String(player.number),
        isHome: true,
      });
    }
    const awayCount = Math.min(awayPlayers.length, 6);
    for (let i = 0; i < awayCount; i++) {
      const pos = (rotationAway[i] ?? (i + 1)) as 1 | 2 | 3 | 4 | 5 | 6;
      const coord = AWAY_POSITION_COORDS[pos] ?? AWAY_POSITION_COORDS[1];
      const player = awayPlayers[i];
      positions.push({
        playerId: player.id,
        x: coord.x,
        y: coord.y,
        teamId: awayTeamId,
        number: player.number,
        label: String(player.number),
        isHome: false,
      });
    }
  } else {
    // beach
    for (let i = 0; i < Math.min(homePlayers.length, 2); i++) {
      const pos = (i + 1) as 1 | 2;
      const coord = BEACH_HOME_COORDS[pos];
      const player = homePlayers[i];
      positions.push({
        playerId: player.id,
        x: coord.x,
        y: coord.y,
        teamId: homeTeamId,
        number: player.number,
        label: String(player.number),
        isHome: true,
      });
    }
    for (let i = 0; i < Math.min(awayPlayers.length, 2); i++) {
      const pos = (i + 1) as 1 | 2;
      const coord = BEACH_AWAY_COORDS[pos];
      const player = awayPlayers[i];
      positions.push({
        playerId: player.id,
        x: coord.x,
        y: coord.y,
        teamId: awayTeamId,
        number: player.number,
        label: String(player.number),
        isHome: false,
      });
    }
  }

  return positions;
}

export function findNearestPlayer(
  positions: PlayerPosition[],
  x: number,
  y: number,
): PlayerPosition | null {
  if (positions.length === 0) return null;
  let nearest = positions[0];
  let minDist = Infinity;
  for (const p of positions) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < minDist) {
      minDist = d;
      nearest = p;
    }
  }
  return nearest;
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.max(min, Math.min(max, value));
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
