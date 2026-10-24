import type { BenchPlayer, PlayerPosition } from '../../models/tactical';
import type { MatchFormat } from '../../models/match';
import type { Player } from '../../models/player';
import { getPlayerShortName } from '../players/player-helpers';

export const DEFAULT_BENCH_NUMBERS = [7, 8, 9, 10, 11, 12];

export const MAX_ON_COURT: Record<MatchFormat, number> = {
  indoor_6v6: 6,
  beach_2v2: 2,
};

export interface BenchBoard {
  positions: PlayerPosition[];
  benchHome: BenchPlayer[];
  benchAway: BenchPlayer[];
}

/** Numbered substitutes for teams without a roster (home screen, quick match). */
export function buildDefaultBench(teamId: string, isHome: boolean): BenchPlayer[] {
  const prefix = isHome ? 'home' : 'away';
  return DEFAULT_BENCH_NUMBERS.map((number) => ({
    playerId: `${prefix}_b${number}`,
    teamId,
    number,
    label: String(number),
    isHome,
  }));
}

export function benchFromPlayers(players: Player[], teamId: string, isHome: boolean): BenchPlayer[] {
  return players.map((p) => ({
    playerId: p.id,
    teamId,
    number: p.number,
    label: getPlayerShortName(p),
    firstName: p.firstName,
    lastName: p.lastName,
    isHome,
    isLibero: p.position === 'libero',
  }));
}

function toBench(p: PlayerPosition): BenchPlayer {
  const { x: _x, y: _y, isBall: _isBall, ...rest } = p;
  return rest;
}

function benchKey(isHome: boolean): 'benchHome' | 'benchAway' {
  return isHome ? 'benchHome' : 'benchAway';
}

function findBenchPlayer(board: BenchBoard, benchId: string): BenchPlayer | undefined {
  return board.benchHome.find((p) => p.playerId === benchId)
    ?? board.benchAway.find((p) => p.playerId === benchId);
}

/**
 * The bench player takes the exact spot of a same-team court player, who goes
 * to the bench in the substitute's slot. Returns `board` unchanged when invalid.
 */
export function swapWithBench(board: BenchBoard, benchId: string, targetId: string): BenchBoard {
  const incoming = findBenchPlayer(board, benchId);
  const target = board.positions.find((p) => p.playerId === targetId);
  if (!incoming || !target || target.isBall || target.isHome !== incoming.isHome) return board;

  const key = benchKey(incoming.isHome);
  return {
    ...board,
    positions: board.positions.map((p) =>
      p.playerId === targetId ? { ...incoming, x: target.x, y: target.y } : p
    ),
    [key]: board[key].map((p) => (p.playerId === benchId ? toBench(target) : p)),
  };
}

/** Court player leaves the court and joins the end of their team's bench. */
export function sendToBench(board: BenchBoard, playerId: string): BenchBoard {
  const target = board.positions.find((p) => p.playerId === playerId);
  if (!target || target.isBall) return board;

  const key = benchKey(target.isHome);
  return {
    ...board,
    positions: board.positions.filter((p) => p.playerId !== playerId),
    [key]: [...board[key], toBench(target)],
  };
}

/** Bench player enters at (x, y) if their team has fewer than `maxOnCourt` players. */
export function enterFromBench(
  board: BenchBoard,
  benchId: string,
  x: number,
  y: number,
  maxOnCourt: number,
): BenchBoard {
  const incoming = findBenchPlayer(board, benchId);
  if (!incoming) return board;
  const onCourt = board.positions.filter((p) => !p.isBall && p.isHome === incoming.isHome).length;
  if (onCourt >= maxOnCourt) return board;

  const key = benchKey(incoming.isHome);
  return {
    ...board,
    positions: [...board.positions, { ...incoming, x, y }],
    [key]: board[key].filter((p) => p.playerId !== benchId),
  };
}

/** Closest same-team token (ball excluded) within `radiusPx` of a point in court pixels. */
export function findTokenAt(
  positions: PlayerPosition[],
  px: number,
  py: number,
  courtW: number,
  courtH: number,
  radiusPx: number,
  isHome: boolean,
): PlayerPosition | null {
  let best: PlayerPosition | null = null;
  let bestDist = radiusPx;
  for (const p of positions) {
    if (p.isBall || p.isHome !== isHome) continue;
    const dist = Math.hypot(p.x * courtW - px, p.y * courtH - py);
    if (dist <= bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best;
}
