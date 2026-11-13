/**
 * What the match summary shows from the players' stats: success rates (never
 * negative, unlike the efficiency of the detailed stats), the team totals and
 * their radar, how each team scored its points, and the players by team.
 */
import {
  attackPositiveRate,
  blockPositiveRate,
  defensePositiveRate,
  receptionPositiveRate,
  servePositiveRate,
  type PlayerStats,
} from '../../models/stats';

type Counts = Omit<PlayerStats, 'playerId' | 'matchId' | 'setId'>;

const COUNT_KEYS: (keyof Counts)[] = [
  'serveAce', 'serveFault', 'serveIn',
  'attackKill', 'attackFault', 'attackDefended',
  'blockKill', 'blockTouch', 'blockFault',
  'receptionA', 'receptionB', 'receptionC', 'receptionD',
  'defenseSuccess', 'defenseFault',
  'setPerfect', 'setGood', 'setBad',
];

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/** The stats of every player of a team, added up. */
export function sumStats(stats: PlayerStats[], id = 'team', matchId = ''): PlayerStats {
  const total = { playerId: id, matchId } as PlayerStats;
  for (const key of COUNT_KEYS) total[key] = stats.reduce((n, s) => n + s[key], 0);
  return total;
}

/** At least one counted action. */
export function hasRecordedStats(ps: PlayerStats): boolean {
  return COUNT_KEYS.some((k) => ps[k] > 0);
}

/** Points a player scored: attacks, blocks and aces. */
export function pointsScored(ps: PlayerStats): number {
  return ps.attackKill + ps.blockKill + ps.serveAce;
}

export interface SuccessRates {
  /** Serves without a fault */
  serve: number;
  /** Attacks that scored */
  attack: number;
  /** Good receptions (A + B) */
  reception: number;
}

/** Success rates of the summary, 0-100. */
export function successRates(ps: PlayerStats): SuccessRates {
  return {
    serve: pct(ps.serveAce + ps.serveIn, ps.serveAce + ps.serveIn + ps.serveFault),
    attack: attackPositiveRate(ps),
    reception: receptionPositiveRate(ps),
  };
}

export const RADAR_AXES = ['serve', 'attack', 'block', 'reception', 'defense'] as const;
export type RadarAxis = (typeof RADAR_AXES)[number];

/** Radar values (0-100) on the same axes for players and teams. */
export function radarValues(ps: PlayerStats): number[] {
  return [
    servePositiveRate(ps),
    attackPositiveRate(ps),
    blockPositiveRate(ps),
    receptionPositiveRate(ps),
    defensePositiveRate(ps),
  ];
}

export const POINT_KINDS = ['attack', 'block', 'ace', 'opponentFault', 'unspecified'] as const;
export type PointKind = (typeof POINT_KINDS)[number];

export interface PointBreakdown {
  total: number;
  rows: { kind: PointKind; count: number; percent: number }[];
}

/**
 * How a team scored: its attacks, blocks and aces, the opponent's faults, and
 * the points nobody detailed (scored with « Passer »). `points` is the team's
 * score over the sets.
 */
export function pointBreakdown(points: number, own: PlayerStats, opponent: PlayerStats): PointBreakdown {
  const opponentFault = opponent.serveFault + opponent.attackFault + opponent.blockFault
    + opponent.defenseFault + opponent.receptionD;
  const known = { attack: own.attackKill, block: own.blockKill, ace: own.serveAce, opponentFault };
  const detailed = known.attack + known.block + known.ace + known.opponentFault;
  const total = Math.max(points, detailed);
  const counts: Record<PointKind, number> = { ...known, unspecified: total - detailed };
  return {
    total,
    rows: POINT_KINDS
      .filter((kind) => kind !== 'unspecified' || counts.unspecified > 0)
      .map((kind) => ({ kind, count: counts[kind], percent: pct(counts[kind], total) })),
  };
}

/** Players with recorded stats, home team first, each team by points scored (then shirt number). */
export function playersByTeam<P extends { id: string; number: number }>(
  stats: PlayerStats[],
  homePlayers: P[],
  awayPlayers: P[],
): { side: 'home' | 'away'; players: { player: P; stats: PlayerStats }[] }[] {
  const recorded = new Map(stats.filter(hasRecordedStats).map((s) => [s.playerId, s]));
  const group = (side: 'home' | 'away', players: P[]) => ({
    side,
    players: players
      .flatMap((player) => {
        const s = recorded.get(player.id);
        return s ? [{ player, stats: s }] : [];
      })
      .sort((a, b) => pointsScored(b.stats) - pointsScored(a.stats) || a.player.number - b.player.number),
  });
  return [group('home', homePlayers), group('away', awayPlayers)].filter((g) => g.players.length > 0);
}

/** Radar drawing in the summary: fits a 360 dp screen (sections 320 dp wide, 14 dp padding) */
export const SUMMARY_RADAR = { width: 280, height: 200 } as const;
