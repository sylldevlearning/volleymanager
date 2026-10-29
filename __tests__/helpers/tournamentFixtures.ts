import { createRng } from '../../src/features/tournament/engine/rng';
import { defaultRules } from '../../src/features/tournament/engine/defaults';
import { generateTournament } from '../../src/features/tournament/engine/generate';
import { scheduleMatches, slotStart } from '../../src/features/tournament/engine/scheduler';
import type { TournamentBundle } from '../../src/features/tournament/bundle';
import { recordResult } from '../../src/features/tournament/engine/cascade';
import { rulesForStage } from '../../src/features/tournament/engine/results';
import type { EngineContext, EngineMatch, EngineTeam } from '../../src/features/tournament/engine/types';
import type { SeedingMode, SetRules, SetScore, TournamentFormat, TournamentRules } from '../../src/models/tournament';

export function makeTeams(n: number, seeded = 0): EngineTeam[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${String(i + 1).padStart(2, '0')}`,
    seedRank: i < seeded ? i + 1 : null,
    position: i,
  }));
}

export interface Built {
  ctx: EngineContext;
  matches: EngineMatch[];
}

export function build(
  format: TournamentFormat,
  n: number,
  opts: { seed?: number; seeding?: SeedingMode; seeded?: number; courts?: number; restSlots?: number; rules?: Partial<TournamentRules> } = {},
): Built {
  const teams = makeTeams(n, opts.seeded ?? 0);
  const rules = { ...defaultRules('indoor_6v6', format, n), ...opts.rules };
  const generated = generateTournament({
    format, rules, teams, seed: opts.seed ?? 42, seeding: opts.seeding ?? 'random',
  });
  const matches = scheduleMatches(generated.matches, {
    courts: opts.courts ?? Math.max(1, Math.ceil(n / 6)),
    restSlots: opts.restSlots ?? 1,
  });
  return { ctx: { format, rules, teams, pools: generated.pools }, matches };
}

/** A valid random score, the stronger team (lower id) winning more often. */
export function randomScore(rules: SetRules, rng: () => number, homeWins: boolean): SetScore[] {
  // Sets taken by the loser, spread before the winner's last set
  const loserSets = Math.floor(rng() * rules.setsToWin);
  const total = rules.setsToWin + loserSets;
  const winnerFlags = Array.from({ length: total - 1 }, (_, i) => i >= loserSets);
  for (let i = winnerFlags.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [winnerFlags[i], winnerFlags[j]] = [winnerFlags[j], winnerFlags[i]];
  }
  winnerFlags.push(true);
  return winnerFlags.map((winnerTakes, i): SetScore => {
    const deciding = rules.tieBreak && rules.setsToWin > 1 && i === rules.setsToWin * 2 - 2;
    const target = deciding ? rules.pointsLastSet : rules.pointsPerSet;
    const loser = Math.floor(rng() * (target - rules.winMargin + 1));
    const homeTakes = winnerTakes === homeWins;
    return homeTakes ? [target, loser] : [loser, target];
  });
}

/** Plays every match in planning order, as an organiser would. */
export function playAll(built: Built, seed = 7): EngineMatch[] {
  const rng = createRng(seed);
  let matches = built.matches;
  const order = [...matches].sort((x, y) => (x.slot! - y.slot!) || (x.court! - y.court!));
  for (const { key } of order) {
    const m = matches.find((x) => x.key === key)!;
    if (!m.homeId || !m.awayId) throw new Error(`teams of ${key} unknown when it is due`);
    const homeWins = m.homeId < m.awayId ? rng() < 0.75 : rng() < 0.25;
    const sets = randomScore(rulesForStage(built.ctx.rules, m.stage), rng, homeWins);
    const outcome = recordResult(built.ctx, matches, key, { sets, forfeitId: null });
    if (!outcome.ok) throw new Error(`${key}: ${JSON.stringify(outcome)}`);
    matches = outcome.matches;
  }
  return matches;
}

/** Teams playing in a match, whether known now or only through results. */
export function teamsOf(m: EngineMatch): string[] {
  return [m.homeId, m.awayId].filter((t): t is string => t !== null);
}

/** A stored-like tournament (as the service returns it), without SQLite. */
export function bundleFrom(built: Built, matches: EngineMatch[] = built.matches, opts: { date?: string } = {}): TournamentBundle {
  const { ctx } = built;
  const poolCount = Math.max(ctx.pools.length, ...matches.map((m) => (m.pool ?? -1) + 1));
  const defs = Array.from({ length: poolCount }, (_, p) => {
    const m = matches.find((x) => x.pool === p);
    return { phase: m?.phase ?? null, level: m?.level ?? null };
  });
  const pools = defs.map((def, p) => ({
    id: `p${p}`, tournamentId: 'T', position: p, ...def,
    name: String.fromCharCode(65 + defs.slice(0, p).filter((d) => d.phase === def.phase && d.level === def.level).length),
  }));
  const schedule = { courts: 2, startTime: '09:00', matchMinutes: 45, restMinutes: 10 };
  return {
    tournament: {
      id: 'T', name: 'Open', date: opts.date ?? '2026-05-16', location: null, gameType: 'indoor_6v6', format: ctx.format,
      rules: ctx.rules, schedule, seed: 1, seeding: 'random', secret: 'x', status: 'live', createdAt: '', updatedAt: '',
    },
    pools,
    teams: ctx.teams.map((t, i) => ({
      id: t.id, tournamentId: 'T', teamId: null, name: `Équipe ${i + 1}`, color: '#1D4ED8', seedRank: t.seedRank,
      poolId: (() => { const p = ctx.pools.findIndex((ids) => ids.includes(t.id)); return p >= 0 ? `p${p}` : null; })(),
      position: t.position,
    })),
    matches: matches.map((m) => ({
      id: m.key, tournamentId: 'T', stage: m.stage, poolId: m.pool === null ? null : `p${m.pool}`, phase: m.phase, level: m.level,
      round: m.round, bracketSlot: m.bracketSlot, label: m.label, homeId: m.homeId, awayId: m.awayId,
      homeSource: m.homeRef, awaySource: m.awayRef, slot: m.slot, court: m.court,
      scheduledAt: m.slot === null ? null : `2026-05-16T${slotStart(schedule, m.slot)}`,
      status: m.status, sets: m.sets, forfeitId: m.forfeitId, winnerId: m.winnerId,
      resultSource: m.status === 'validated' ? 'manual' : null, arbitrageMatchId: null, validatedAt: null, updatedAt: '',
    })),
  };
}
