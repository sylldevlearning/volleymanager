import type { TournamentSchedule } from '../../../models/tournament';
import type { EngineMatch } from './types';

export interface ScheduleOptions {
  courts: number;
  /** Slots a team should sit out between two matches. */
  restSlots: number;
}

/** A rest of a few minutes means at least one slot off. */
export function restSlotsFor(schedule: TournamentSchedule): number {
  return schedule.restMinutes <= 0 ? 0 : Math.ceil(schedule.restMinutes / schedule.matchMinutes);
}

/** 'HH:MM' at which a slot starts. */
export function slotStart(schedule: TournamentSchedule, slot: number): string {
  const [h, m] = schedule.startTime.split(':').map(Number);
  const minutes = (h * 60 + m + slot * schedule.matchMinutes) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

interface DependencyIndex {
  poolKeys: Map<number, string[]>;
  allPoolKeys: string[];
  /** Mixing matches by round */
  phaseKeys: Map<number, string[]>;
  lastPhase: number;
}

/** Matches whose result decides the teams of `m`. */
function dependencies(m: EngineMatch, index: DependencyIndex): string[] {
  return [m.homeRef, m.awayRef].flatMap((ref) => {
    switch (ref.type) {
      case 'winner':
      case 'loser': return [ref.match];
      case 'poolRank': return index.poolKeys.get(ref.pool) ?? [];
      case 'bestOf': return index.allPoolKeys;
      case 'seat': return index.phaseKeys.get(ref.phase - 1) ?? [];
      case 'levelRank': return index.phaseKeys.get(index.lastPhase) ?? [];
      default: return [];
    }
  });
}

const STAGE_ORDER: Record<EngineMatch['stage'], number> = { league: 0, pool: 0, brassage: 0, level: 0, placement: 1, knockout: 2 };

/** Phases in order: mixing rounds, pools, then levels and brackets. */
function tier(m: EngineMatch): number {
  if (m.stage === 'brassage') return m.phase ?? 0;
  if (m.stage === 'league' || m.stage === 'pool') return 0;
  return 1000;
}

/** Pools round by round, then the bracket round by round (3rd place before the final). */
function priority(a: EngineMatch, b: EngineMatch): number {
  return tier(a) - tier(b)
    || a.round - b.round
    || STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]
    || (a.pool ?? 0) - (b.pool ?? 0)
    || (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0);
}

/**
 * Places every match still to play on a slot and a court. Matches being played
 * or validated keep their place. Hard rules: a team never plays two matches at
 * once, and a match never starts before the matches deciding its teams are
 * over. The rest is kept whenever a match can be found that respects it; a
 * slot is only filled without rest rather than left completely empty.
 */
export function scheduleMatches(matches: EngineMatch[], opts: ScheduleOptions): EngineMatch[] {
  const courts = Math.max(1, opts.courts);
  const fixed = matches.filter((m) => m.status !== 'scheduled');
  const pending = matches
    .map((m, index) => ({ m, index }))
    .filter(({ m }) => m.status === 'scheduled')
    .sort((x, y) => priority(x.m, y.m) || x.index - y.index)
    .map(({ m }) => m);

  const poolKeys = new Map<number, string[]>();
  const phaseKeys = new Map<number, string[]>();
  for (const m of matches) {
    if (m.stage === 'pool' && m.pool !== null) poolKeys.set(m.pool, [...(poolKeys.get(m.pool) ?? []), m.key]);
    if (m.stage === 'brassage' && m.phase !== null) phaseKeys.set(m.phase, [...(phaseKeys.get(m.phase) ?? []), m.key]);
  }
  const index: DependencyIndex = {
    poolKeys,
    allPoolKeys: [...poolKeys.values()].flat(),
    phaseKeys,
    lastPhase: Math.max(0, ...phaseKeys.keys()),
  };
  const deps = new Map(pending.map((m) => [m.key, dependencies(m, index)]));

  // Slot of every match already placed (-Infinity: done without a slot)
  const placedSlot = new Map<string, number>();
  const usedCourts = new Map<number, Set<number>>();
  const teamSlots = new Map<string, Set<number>>();
  const occupy = (m: EngineMatch, slot: number, court: number | null) => {
    placedSlot.set(m.key, slot);
    if (court !== null) usedCourts.set(slot, (usedCourts.get(slot) ?? new Set()).add(court));
    for (const t of [m.homeId, m.awayId]) if (t) teamSlots.set(t, (teamSlots.get(t) ?? new Set()).add(slot));
  };
  for (const m of fixed) occupy(m, m.slot ?? -Infinity, m.slot === null ? null : m.court);

  const canPlay = (m: EngineMatch, slot: number, rest: number): boolean => {
    for (const d of deps.get(m.key)!) {
      const s = placedSlot.get(d);
      if (s === undefined || s + rest >= slot) return false;
    }
    for (const t of [m.homeId, m.awayId]) {
      if (!t) continue;
      const slots = teamSlots.get(t);
      if (!slots) continue;
      for (let s = slot - rest; s <= slot; s++) if (slots.has(s)) return false;
    }
    return true;
  };

  const result = new Map<string, { slot: number; court: number }>();
  let left = [...pending];
  for (let slot = 0; left.length > 0; slot++) {
    if (slot > 100_000) throw new Error('scheduleMatches: no progress');
    const fill = (rest: number): number => {
      let placed = 0;
      const remaining: EngineMatch[] = [];
      for (const m of left) {
        const taken = usedCourts.get(slot) ?? new Set<number>();
        const court = Array.from({ length: courts }, (_, i) => i + 1).find((c) => !taken.has(c));
        if (court !== undefined && canPlay(m, slot, rest)) {
          occupy(m, slot, court);
          result.set(m.key, { slot, court });
          placed++;
        } else {
          remaining.push(m);
        }
      }
      left = remaining;
      return placed;
    };
    if (fill(opts.restSlots) === 0 && opts.restSlots > 0) fill(0);
  }

  return matches.map((m) => {
    const placed = result.get(m.key);
    return placed ? { ...m, ...placed } : m;
  });
}
