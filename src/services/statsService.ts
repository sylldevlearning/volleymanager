import { getEventsForMatch, getMatchIdsForPlayer } from './eventService';
import { getMatchById, getSetsForMatch } from './matchService';
import { getTeamById } from './teamService';
import { getPlayersByTeam, getPlayerById } from './playerService';
import type { MatchEvent } from '../models/event';
import type { PlayerStats } from '../models/stats';
import type { Player } from '../models/player';
import { getPlayerDisplayName } from '../features/players/player-helpers';

// ─── Core player stats aggregation (unchanged) ───────────────────────────────

export async function getPlayerStatsForMatch(matchId: string): Promise<PlayerStats[]> {
  const events = await getEventsForMatch(matchId);
  return computePlayerStats(events);
}

export function computePlayerStats(events: MatchEvent[]): PlayerStats[] {
  const statsMap = new Map<string, PlayerStats>();

  function getOrCreate(playerId: string, matchId: string): PlayerStats {
    if (!statsMap.has(playerId)) {
      statsMap.set(playerId, {
        playerId,
        matchId,
        serveAce: 0,
        serveFault: 0,
        serveIn: 0,
        attackKill: 0,
        attackFault: 0,
        attackDefended: 0,
        blockKill: 0,
        blockTouch: 0,
        blockFault: 0,
        receptionA: 0,
        receptionB: 0,
        receptionC: 0,
        receptionD: 0,
        defenseSuccess: 0,
        defenseFault: 0,
        setPerfect: 0,
        setGood: 0,
        setBad: 0,
      });
    }
    return statsMap.get(playerId)!;
  }

  for (const event of events) {
    if (event.isCancelled || !event.playerId) continue;
    const s = getOrCreate(event.playerId, event.matchId);

    switch (event.eventType) {
      case 'serve_ace': s.serveAce++; break;
      case 'serve_fault': s.serveFault++; break;
      case 'serve_in': s.serveIn++; break;
      case 'attack_kill': s.attackKill++; break;
      case 'attack_fault': s.attackFault++; break;
      case 'attack_defended': s.attackDefended++; break;
      case 'block_kill': s.blockKill++; break;
      case 'block_touch': s.blockTouch++; break;
      case 'block_fault': s.blockFault++; break;
      case 'reception_a': s.receptionA++; break;
      case 'reception_b': s.receptionB++; break;
      case 'reception_c': s.receptionC++; break;
      case 'reception_d': s.receptionD++; break;
      case 'defense_success': s.defenseSuccess++; break;
      case 'defense_fault': s.defenseFault++; break;
      case 'set_perfect': s.setPerfect++; break;
      case 'set_good': s.setGood++; break;
      case 'set_bad': s.setBad++; break;
    }
  }

  return Array.from(statsMap.values());
}

// ─── Extended interfaces ──────────────────────────────────────────────────────

export interface PlayerMatchStats {
  playerId: string;
  matchId: string;
  playerNumber: number;
  playerName: string;
  teamId: string;

  serveAce: number;
  serveFault: number;
  serveIn: number;
  serveTotal: number;
  serveEfficiency: number;

  attackKill: number;
  attackFault: number;
  attackDefended: number;
  attackTotal: number;
  attackEfficiency: number;

  blockKill: number;
  blockTouch: number;
  blockFault: number;
  blockTotal: number;
  blockEfficiency: number;

  receptionA: number;
  receptionB: number;
  receptionC: number;
  receptionD: number;
  receptionTotal: number;
  receptionPositive: number;

  defenseSuccess: number;
  defenseFault: number;
  defenseTotal: number;
  defenseEfficiency: number;

  setPerfect: number;
  setGood: number;
  setBad: number;
  setTotal: number;
  setEfficiency: number;

  totalPoints: number;
  totalFaults: number;
  plusMinus: number;
}

export interface TeamMatchStats {
  teamId: string;
  teamName: string;
  teamColor: string;
  players: PlayerMatchStats[];
  totals: PlayerMatchStats;
  pointsByAttack: number;
  pointsByBlock: number;
  pointsByAce: number;
  pointsByOpponentFault: number;
}

export interface SetBreakdown {
  setNumber: number;
  homePoints: { attack: number; block: number; ace: number; opponentFault: number };
  awayPoints: { attack: number; block: number; ace: number; opponentFault: number };
}

export interface MatchDashboardData {
  matchId: string;
  homeTeam: TeamMatchStats;
  awayTeam: TeamMatchStats;
  setBySetBreakdown: SetBreakdown[];
  topPerformers: {
    bestAttacker: { player: PlayerMatchStats; value: number } | null;
    bestServer: { player: PlayerMatchStats; value: number } | null;
    bestReceiver: { player: PlayerMatchStats; value: number } | null;
    bestBlocker: { player: PlayerMatchStats; value: number } | null;
  };
}

export interface PlayerCareerStats {
  playerId: string;
  playerName: string;
  matchCount: number;
  averages: PlayerMatchStats;
  records: {
    mostKills: { value: number; matchDate: string };
    mostAces: { value: number; matchDate: string };
    bestEfficiency: { value: number; matchDate: string };
    worstEfficiency: { value: number; matchDate: string };
  };
  history: { matchId: string; date: string; opponentName: string; stats: PlayerMatchStats }[];
}

// ─── Helper: derive computed stats from raw PlayerStats ───────────────────────

function eff(num: number, den: number): number {
  return den === 0 ? 0 : Math.round((num / den) * 100);
}

export function derivePlayerMatchStats(
  raw: PlayerStats,
  player: Player | null,
  teamId: string,
): PlayerMatchStats {
  const serveTotal = raw.serveAce + raw.serveFault + raw.serveIn;
  const attackTotal = raw.attackKill + raw.attackFault + raw.attackDefended;
  const blockTotal = raw.blockKill + raw.blockTouch + raw.blockFault;
  const receptionTotal = raw.receptionA + raw.receptionB + raw.receptionC + raw.receptionD;
  const defenseTotal = raw.defenseSuccess + raw.defenseFault;
  const setTotal = raw.setPerfect + raw.setGood + raw.setBad;

  const totalPoints = raw.attackKill + raw.serveAce + raw.blockKill;
  const totalFaults = raw.serveFault + raw.attackFault + raw.blockFault + raw.receptionD + raw.defenseFault;

  return {
    playerId: raw.playerId,
    matchId: raw.matchId,
    playerNumber: player?.number ?? 0,
    playerName: player ? getPlayerDisplayName(player) : '',
    teamId,

    serveAce: raw.serveAce,
    serveFault: raw.serveFault,
    serveIn: raw.serveIn,
    serveTotal,
    serveEfficiency: eff(raw.serveAce, serveTotal),

    attackKill: raw.attackKill,
    attackFault: raw.attackFault,
    attackDefended: raw.attackDefended,
    attackTotal,
    attackEfficiency: eff(raw.attackKill, attackTotal),

    blockKill: raw.blockKill,
    blockTouch: raw.blockTouch,
    blockFault: raw.blockFault,
    blockTotal,
    blockEfficiency: eff(raw.blockKill, blockTotal),

    receptionA: raw.receptionA,
    receptionB: raw.receptionB,
    receptionC: raw.receptionC,
    receptionD: raw.receptionD,
    receptionTotal,
    receptionPositive: eff(raw.receptionA + raw.receptionB, receptionTotal),

    defenseSuccess: raw.defenseSuccess,
    defenseFault: raw.defenseFault,
    defenseTotal,
    defenseEfficiency: eff(raw.defenseSuccess, defenseTotal),

    setPerfect: raw.setPerfect,
    setGood: raw.setGood,
    setBad: raw.setBad,
    setTotal,
    setEfficiency: eff(raw.setPerfect + raw.setGood, setTotal),

    totalPoints,
    totalFaults,
    plusMinus: totalPoints - totalFaults,
  };
}

function emptyRawStats(playerId: string, matchId: string): PlayerStats {
  return {
    playerId, matchId,
    serveAce: 0, serveFault: 0, serveIn: 0,
    attackKill: 0, attackFault: 0, attackDefended: 0,
    blockKill: 0, blockTouch: 0, blockFault: 0,
    receptionA: 0, receptionB: 0, receptionC: 0, receptionD: 0,
    defenseSuccess: 0, defenseFault: 0,
    setPerfect: 0, setGood: 0, setBad: 0,
  };
}

function sumRawStats(statsArray: PlayerMatchStats[], matchId: string): PlayerStats {
  const sum = (key: keyof PlayerMatchStats) =>
    statsArray.reduce((acc, s) => acc + (s[key] as number), 0);
  return {
    playerId: 'totals',
    matchId,
    serveAce: sum('serveAce'),
    serveFault: sum('serveFault'),
    serveIn: sum('serveIn'),
    attackKill: sum('attackKill'),
    attackFault: sum('attackFault'),
    attackDefended: sum('attackDefended'),
    blockKill: sum('blockKill'),
    blockTouch: sum('blockTouch'),
    blockFault: sum('blockFault'),
    receptionA: sum('receptionA'),
    receptionB: sum('receptionB'),
    receptionC: sum('receptionC'),
    receptionD: sum('receptionD'),
    defenseSuccess: sum('defenseSuccess'),
    defenseFault: sum('defenseFault'),
    setPerfect: sum('setPerfect'),
    setGood: sum('setGood'),
    setBad: sum('setBad'),
  };
}

function findBest(
  players: PlayerMatchStats[],
  score: (s: PlayerMatchStats) => number,
): { player: PlayerMatchStats; value: number } | null {
  const active = players.filter((p) => score(p) > 0);
  if (active.length === 0) return null;
  const best = active.reduce((a, b) => (score(a) >= score(b) ? a : b));
  return { player: best, value: score(best) };
}

// ─── getMatchDashboard ────────────────────────────────────────────────────────

export async function getMatchDashboard(matchId: string): Promise<MatchDashboardData> {
  const [match, sets] = await Promise.all([
    getMatchById(matchId),
    getSetsForMatch(matchId),
  ]);
  if (!match) throw new Error(`Match ${matchId} not found`);

  const [homeTeam, awayTeam, homePlayers, awayPlayers, events] = await Promise.all([
    getTeamById(match.teamHomeId),
    getTeamById(match.teamAwayId),
    getPlayersByTeam(match.teamHomeId),
    getPlayersByTeam(match.teamAwayId),
    getEventsForMatch(matchId),
  ]);

  const homePlayerIds = new Set(homePlayers.map((p) => p.id));
  const awayPlayerIds = new Set(awayPlayers.map((p) => p.id));

  const rawStatsMap = new Map(
    computePlayerStats(events).map((s) => [s.playerId, s])
  );

  function buildPlayerStats(player: Player, teamId: string): PlayerMatchStats {
    const raw = rawStatsMap.get(player.id) ?? emptyRawStats(player.id, matchId);
    return derivePlayerMatchStats(raw, player, teamId);
  }

  const homePlayerStats = homePlayers.map((p) => buildPlayerStats(p, match.teamHomeId));
  const awayPlayerStats = awayPlayers.map((p) => buildPlayerStats(p, match.teamAwayId));
  const allPlayerStats = [...homePlayerStats, ...awayPlayerStats];

  function buildTotals(players: PlayerMatchStats[], teamId: string): PlayerMatchStats {
    if (players.length === 0) return derivePlayerMatchStats(emptyRawStats('totals', matchId), null, teamId);
    return derivePlayerMatchStats(sumRawStats(players, matchId), null, teamId);
  }

  // Set-by-set breakdown
  const setBySetBreakdown: SetBreakdown[] = sets.map((set) => {
    const ev = events.filter((e) => e.setId === set.id);
    const count = (types: string[], ids: Set<string>) =>
      ev.filter((e) => types.includes(e.eventType) && e.playerId !== null && ids.has(e.playerId!)).length;

    const faultTypes = ['serve_fault', 'attack_fault', 'block_fault', 'defense_fault', 'reception_d'];
    return {
      setNumber: set.setNumber,
      homePoints: {
        attack: count(['attack_kill'], homePlayerIds),
        block: count(['block_kill'], homePlayerIds),
        ace: count(['serve_ace'], homePlayerIds),
        opponentFault: count(faultTypes, awayPlayerIds),
      },
      awayPoints: {
        attack: count(['attack_kill'], awayPlayerIds),
        block: count(['block_kill'], awayPlayerIds),
        ace: count(['serve_ace'], awayPlayerIds),
        opponentFault: count(faultTypes, homePlayerIds),
      },
    };
  });

  return {
    matchId,
    homeTeam: {
      teamId: match.teamHomeId,
      teamName: homeTeam?.name ?? '',
      teamColor: homeTeam?.color ?? '#1D4ED8',
      players: homePlayerStats,
      totals: buildTotals(homePlayerStats, match.teamHomeId),
      pointsByAttack: homePlayerStats.reduce((a, s) => a + s.attackKill, 0),
      pointsByBlock: homePlayerStats.reduce((a, s) => a + s.blockKill, 0),
      pointsByAce: homePlayerStats.reduce((a, s) => a + s.serveAce, 0),
      pointsByOpponentFault: awayPlayerStats.reduce((a, s) => a + s.totalFaults, 0),
    },
    awayTeam: {
      teamId: match.teamAwayId,
      teamName: awayTeam?.name ?? '',
      teamColor: awayTeam?.color ?? '#E63946',
      players: awayPlayerStats,
      totals: buildTotals(awayPlayerStats, match.teamAwayId),
      pointsByAttack: awayPlayerStats.reduce((a, s) => a + s.attackKill, 0),
      pointsByBlock: awayPlayerStats.reduce((a, s) => a + s.blockKill, 0),
      pointsByAce: awayPlayerStats.reduce((a, s) => a + s.serveAce, 0),
      pointsByOpponentFault: homePlayerStats.reduce((a, s) => a + s.totalFaults, 0),
    },
    setBySetBreakdown,
    topPerformers: {
      bestAttacker: findBest(allPlayerStats, (s) => s.attackEfficiency),
      bestServer: findBest(allPlayerStats, (s) => s.serveAce),
      bestReceiver: findBest(allPlayerStats, (s) => s.receptionPositive),
      bestBlocker: findBest(allPlayerStats, (s) => s.blockKill),
    },
  };
}

// ─── getPlayerMatchStats ──────────────────────────────────────────────────────

export async function getPlayerMatchStats(
  matchId: string,
  playerId: string,
): Promise<PlayerMatchStats | null> {
  const [match, events, player] = await Promise.all([
    getMatchById(matchId),
    getEventsForMatch(matchId),
    getPlayerById(playerId),
  ]);
  if (!match || !player) return null;

  const raw = computePlayerStats(events).find((s) => s.playerId === playerId)
    ?? emptyRawStats(playerId, matchId);

  const teamId = player.teamId;
  return derivePlayerMatchStats(raw, player, teamId);
}

// ─── getPlayerSetStats ────────────────────────────────────────────────────────

export async function getPlayerSetStats(
  matchId: string,
  playerId: string,
): Promise<Map<number, PlayerMatchStats>> {
  const [match, sets, events, player] = await Promise.all([
    getMatchById(matchId),
    getSetsForMatch(matchId),
    getEventsForMatch(matchId),
    getPlayerById(playerId),
  ]);

  const result = new Map<number, PlayerMatchStats>();
  if (!match || !player) return result;

  for (const set of sets) {
    const setEvents = events.filter((e) => e.setId === set.id);
    const raw = computePlayerStats(setEvents).find((s) => s.playerId === playerId)
      ?? emptyRawStats(playerId, matchId);
    result.set(set.setNumber, derivePlayerMatchStats(raw, player, player.teamId));
  }
  return result;
}

// ─── getPlayerCareerStats ─────────────────────────────────────────────────────

export async function getPlayerCareerStats(playerId: string): Promise<PlayerCareerStats> {
  const [player, matchIds] = await Promise.all([
    getPlayerById(playerId),
    getMatchIdsForPlayer(playerId),
  ]);

  const playerName = player ? getPlayerDisplayName(player) : playerId;

  if (matchIds.length === 0) {
    const emptyStats = derivePlayerMatchStats(emptyRawStats(playerId, ''), player, player?.teamId ?? '');
    return {
      playerId,
      playerName,
      matchCount: 0,
      averages: emptyStats,
      records: {
        mostKills: { value: 0, matchDate: '' },
        mostAces: { value: 0, matchDate: '' },
        bestEfficiency: { value: 0, matchDate: '' },
        worstEfficiency: { value: 0, matchDate: '' },
      },
      history: [],
    };
  }

  // Load all match data in parallel
  const matchDataArray = await Promise.all(
    matchIds.map(async (mid) => {
      const [match, events] = await Promise.all([
        getMatchById(mid),
        getEventsForMatch(mid),
      ]);
      if (!match) return null;

      // Find opponent team name
      const opponentId = match.teamHomeId === player?.teamId ? match.teamAwayId : match.teamHomeId;
      const opponent = await getTeamById(opponentId);

      const raw = computePlayerStats(events).find((s) => s.playerId === playerId)
        ?? emptyRawStats(playerId, mid);
      const stats = derivePlayerMatchStats(raw, player, player?.teamId ?? '');

      return { matchId: mid, date: match.date, opponentName: opponent?.name ?? '', stats };
    })
  );

  const history = matchDataArray.filter(Boolean) as {
    matchId: string;
    date: string;
    opponentName: string;
    stats: PlayerMatchStats;
  }[];

  if (history.length === 0) {
    const emptyStats = derivePlayerMatchStats(emptyRawStats(playerId, ''), player, player?.teamId ?? '');
    return {
      playerId, playerName, matchCount: 0,
      averages: emptyStats,
      records: {
        mostKills: { value: 0, matchDate: '' },
        mostAces: { value: 0, matchDate: '' },
        bestEfficiency: { value: 0, matchDate: '' },
        worstEfficiency: { value: 0, matchDate: '' },
      },
      history: [],
    };
  }

  // Compute averages by summing raw then dividing
  const count = history.length;
  const avgRaw: PlayerStats = {
    playerId,
    matchId: '',
    serveAce: Math.round(history.reduce((a, h) => a + h.stats.serveAce, 0) / count),
    serveFault: Math.round(history.reduce((a, h) => a + h.stats.serveFault, 0) / count),
    serveIn: Math.round(history.reduce((a, h) => a + h.stats.serveIn, 0) / count),
    attackKill: Math.round(history.reduce((a, h) => a + h.stats.attackKill, 0) / count),
    attackFault: Math.round(history.reduce((a, h) => a + h.stats.attackFault, 0) / count),
    attackDefended: Math.round(history.reduce((a, h) => a + h.stats.attackDefended, 0) / count),
    blockKill: Math.round(history.reduce((a, h) => a + h.stats.blockKill, 0) / count),
    blockTouch: Math.round(history.reduce((a, h) => a + h.stats.blockTouch, 0) / count),
    blockFault: Math.round(history.reduce((a, h) => a + h.stats.blockFault, 0) / count),
    receptionA: Math.round(history.reduce((a, h) => a + h.stats.receptionA, 0) / count),
    receptionB: Math.round(history.reduce((a, h) => a + h.stats.receptionB, 0) / count),
    receptionC: Math.round(history.reduce((a, h) => a + h.stats.receptionC, 0) / count),
    receptionD: Math.round(history.reduce((a, h) => a + h.stats.receptionD, 0) / count),
    defenseSuccess: Math.round(history.reduce((a, h) => a + h.stats.defenseSuccess, 0) / count),
    defenseFault: Math.round(history.reduce((a, h) => a + h.stats.defenseFault, 0) / count),
    setPerfect: Math.round(history.reduce((a, h) => a + h.stats.setPerfect, 0) / count),
    setGood: Math.round(history.reduce((a, h) => a + h.stats.setGood, 0) / count),
    setBad: Math.round(history.reduce((a, h) => a + h.stats.setBad, 0) / count),
  };

  const averages = derivePlayerMatchStats(avgRaw, player, player?.teamId ?? '');

  // Records
  const byKills = [...history].sort((a, b) => b.stats.attackKill - a.stats.attackKill)[0];
  const byAces = [...history].sort((a, b) => b.stats.serveAce - a.stats.serveAce)[0];
  const byBestEff = [...history].sort((a, b) => b.stats.attackEfficiency - a.stats.attackEfficiency)[0];
  const byWorstEff = [...history].sort((a, b) => a.stats.attackEfficiency - b.stats.attackEfficiency)[0];

  return {
    playerId,
    playerName,
    matchCount: count,
    averages,
    records: {
      mostKills: { value: byKills.stats.attackKill, matchDate: byKills.date },
      mostAces: { value: byAces.stats.serveAce, matchDate: byAces.date },
      bestEfficiency: { value: byBestEff.stats.attackEfficiency, matchDate: byBestEff.date },
      worstEfficiency: { value: byWorstEff.stats.attackEfficiency, matchDate: byWorstEff.date },
    },
    history,
  };
}
