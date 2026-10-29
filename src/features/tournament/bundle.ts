import type { Tournament, TournamentMatch, TournamentPool, TournamentTeam } from '../../models/tournament';
import type { EngineContext, EngineMatch } from './engine/types';

/** A tournament as stored: everything the screens and the engine need. */
export interface TournamentBundle {
  tournament: Tournament;
  pools: TournamentPool[];
  teams: TournamentTeam[];
  matches: TournamentMatch[];
}

// Engine ↔ storage

export function engineContext(bundle: TournamentBundle): EngineContext {
  const { tournament, pools, teams } = bundle;
  return {
    format: tournament.format,
    rules: tournament.rules,
    teams: teams.map((t) => ({ id: t.id, seedRank: t.seedRank, position: t.position })),
    pools: pools.map((p) => teams.filter((t) => t.poolId === p.id).map((t) => t.id)),
    poolDefs: pools.map((p) => ({ phase: p.phase, level: p.level })),
  };
}

export function toEngineMatch(m: TournamentMatch, pools: TournamentPool[]): EngineMatch {
  const pool = m.poolId ? pools.findIndex((p) => p.id === m.poolId) : -1;
  return {
    key: m.id,
    stage: m.stage,
    pool: pool >= 0 ? pool : null,
    phase: m.phase,
    level: m.level,
    round: m.round,
    bracketSlot: m.bracketSlot,
    label: m.label,
    homeRef: m.homeSource,
    awayRef: m.awaySource,
    homeId: m.homeId,
    awayId: m.awayId,
    status: m.status,
    sets: m.sets,
    forfeitId: m.forfeitId,
    winnerId: m.winnerId,
    slot: m.slot,
    court: m.court,
  };
}

