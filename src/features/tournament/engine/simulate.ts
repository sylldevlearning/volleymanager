import { recordResult } from './cascade';
import { rulesForStage } from './results';
import type { EngineContext, EngineMatch } from './types';

/**
 * Plays every match with a made-up result (home team wins in straight sets),
 * as soon as its teams are known. Used to count matches before creating.
 */
export function simulateTournament(ctx: EngineContext, matches: EngineMatch[]): EngineMatch[] {
  let current = matches;
  for (let progress = true; progress;) {
    progress = false;
    for (const m of current) {
      const now = current.find((x) => x.key === m.key)!;
      if (now.status !== 'scheduled' || !now.homeId || !now.awayId) continue;
      const rules = rulesForStage(ctx.rules, now.stage);
      const sets = Array.from({ length: rules.setsToWin }, (): [number, number] => [rules.pointsPerSet, 0]);
      const outcome = recordResult(ctx, current, now.key, { sets, forfeitId: null });
      if (outcome.ok) {
        current = outcome.matches;
        progress = true;
      }
    }
  }
  return current;
}

/** Fewest and most matches played by a team over the whole tournament. */
export function matchCountRange(ctx: EngineContext, matches: EngineMatch[]): { min: number; max: number } {
  // Every team known from the start (championship): no need to play it out
  const known = matches.every((m) => m.homeRef.type === 'team' && m.awayRef.type === 'team');
  const played = known ? matches.map((m) => ({ ...m, status: 'validated' as const })) : simulateTournament(ctx, matches);
  const counts = new Map(ctx.teams.map((t) => [t.id, 0]));
  for (const m of played) {
    if (m.status !== 'validated') continue;
    for (const t of [m.homeId, m.awayId]) if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const values = [...counts.values()];
  return { min: Math.min(...values), max: Math.max(...values) };
}
