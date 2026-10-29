import { scheduleMatches, type ScheduleOptions } from './scheduler';
import type { EngineMatch } from './types';

/**
 * New planning (court unavailable, delay…). Validated and live matches keep
 * their teams, court, time and score; only matches still to play move.
 */
export function reschedule(matches: EngineMatch[], opts: ScheduleOptions): EngineMatch[] {
  return scheduleMatches(matches, opts);
}

/** A new draw would change the teams of every match: only before any result. */
export function canRedraw(matches: EngineMatch[]): boolean {
  return matches.every((m) => m.status === 'scheduled');
}
