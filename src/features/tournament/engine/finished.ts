import type { TeamRef } from '../../../models/tournament';
import { resolveTeams } from './qualification';
import type { EngineContext, EngineMatch } from './types';

/**
 * Teams that have finished their tournament: no match left to play, and no
 * future match they could still be put in (3rd place match, placement
 * matches, next level or round). Read from the results, so a correction that
 * brings a team back makes it unfinished again.
 */
export function finishedTeams(ctx: EngineContext, matches: EngineMatch[]): Set<string> {
  const resolved = resolveTeams(ctx, matches);
  const allTeams = ctx.teams.map((t) => t.id);
  const poolTeams = ctx.pools.flat();

  /** Teams that may end up on this side of a match, as far as the results tell */
  function candidates(ref: TeamRef, known: string | null): string[] {
    if (known) return [known];
    switch (ref.type) {
      case 'team':
        return [ref.id];
      case 'poolRank':
        // Any team of the pool while it is not over
        return ctx.pools[ref.pool] ?? allTeams;
      case 'bestOf':
        return poolTeams.length > 0 ? poolTeams : allTeams;
      case 'winner':
      case 'loser':
        // That match is not played yet: its teams are still in through it
        return [];
      case 'seat':
      case 'levelRank':
        // Composed from the ranking of the previous round: anyone still in
        return allTeams;
    }
  }

  const stillIn = new Set(matches
    .filter((m) => m.status !== 'validated')
    .flatMap((m) => {
      const r = resolved.get(m.key)!;
      return [...candidates(m.homeRef, m.homeId ?? r.homeId), ...candidates(m.awayRef, m.awayId ?? r.awayId)];
    }));
  return new Set(allTeams.filter((id) => !stillIn.has(id)));
}

/** Teams that finished with the last result (after a correction too). */
export function newlyFinished(before: Set<string>, after: Set<string>): string[] {
  return [...after].filter((id) => !before.has(id));
}
