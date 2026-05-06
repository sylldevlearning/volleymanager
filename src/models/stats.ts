export interface PlayerStats {
  playerId: string;
  matchId: string;
  setId?: string;
  serveAce: number;
  serveFault: number;
  serveIn: number;
  attackKill: number;
  attackFault: number;
  attackDefended: number;
  blockKill: number;
  blockTouch: number;
  blockFault: number;
  receptionA: number;
  receptionB: number;
  receptionC: number;
  receptionD: number;
  defenseSuccess: number;
  defenseFault: number;
  setPerfect: number;
  setGood: number;
  setBad: number;
}

export interface TeamStats {
  teamId: string;
  matchId: string;
  totalPoints: number;
  totalAces: number;
  totalFaults: number;
  setsWon: number;
}

export function serveEfficiency(stats: PlayerStats): number {
  const total = stats.serveAce + stats.serveFault + stats.serveIn;
  if (total === 0) return 0;
  return Math.round(((stats.serveAce - stats.serveFault) / total) * 100);
}

export function attackEfficiency(stats: PlayerStats): number {
  const total = stats.attackKill + stats.attackFault + stats.attackDefended;
  if (total === 0) return 0;
  return Math.round(((stats.attackKill - stats.attackFault) / total) * 100);
}

export function receptionEfficiency(stats: PlayerStats): number {
  const total = stats.receptionA + stats.receptionB + stats.receptionC + stats.receptionD;
  if (total === 0) return 0;
  const score = stats.receptionA * 3 + stats.receptionB * 2 + stats.receptionC * 1;
  return Math.round((score / (total * 3)) * 100);
}
