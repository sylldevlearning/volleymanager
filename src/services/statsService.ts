import { getEventsForMatch } from './eventService';
import type { MatchEvent } from '../models/event';
import type { PlayerStats } from '../models/stats';

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
