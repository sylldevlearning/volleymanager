// Development tool: fills a tournament with random results to try the
// formats quickly. Never offered in a production build.

import type { SetRules, SetScore } from '../../models/tournament';
import { getTournamentBundle, recordTournamentResult } from '../../services/tournamentService';
import { rulesForStage } from './engine/results';
import { createRng } from './engine/rng';

/** A random score valid for these rules (the winner reaches the target, by the margin). */
export function randomValidScore(rules: SetRules, rng: () => number): SetScore[] {
  const homeWins = rng() < 0.5;
  // Sets taken by the loser, spread before the winner's last set
  const loserSets = Math.floor(rng() * rules.setsToWin);
  const flags = Array.from({ length: rules.setsToWin + loserSets - 1 }, (_, i) => i >= loserSets);
  for (let i = flags.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [flags[i], flags[j]] = [flags[j], flags[i]];
  }
  flags.push(true);
  return flags.map((winnerTakes, i): SetScore => {
    const deciding = rules.tieBreak && rules.setsToWin > 1 && i === rules.setsToWin * 2 - 2;
    const target = deciding ? rules.pointsLastSet : rules.pointsPerSet;
    const loser = Math.floor(rng() * (target - rules.winMargin + 1));
    return winnerTakes === homeWins ? [target, loser] : [loser, target];
  });
}

/** Plays every match still to play, in planning order. Returns how many were filled. */
export async function fillRandomResults(tournamentId: string, seed = Date.now()): Promise<number> {
  if (!__DEV__) return 0;
  const rng = createRng(seed);
  let filled = 0;
  for (;;) {
    const bundle = await getTournamentBundle(tournamentId);
    if (!bundle) return filled;
    const next = bundle.matches
      .filter((m) => m.status === 'scheduled' && m.homeId && m.awayId)
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0) || (a.court ?? 0) - (b.court ?? 0))[0];
    if (!next) return filled;
    const sets = randomValidScore(rulesForStage(bundle.tournament.rules, next.stage), rng);
    const outcome = await recordTournamentResult(tournamentId, next.id, { sets, forfeitId: null, source: 'manual' });
    if (!outcome.ok) return filled;
    filled++;
  }
}
