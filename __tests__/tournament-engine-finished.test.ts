import { finishedTeams, newlyFinished } from '../src/features/tournament/engine/finished';
import { recordResult } from '../src/features/tournament/engine/cascade';
import { createRng } from '../src/features/tournament/engine/rng';
import { rulesForStage } from '../src/features/tournament/engine/results';
import type { EngineMatch } from '../src/features/tournament/engine/types';
import type { SetScore, TournamentFormat } from '../src/models/tournament';
import { build, randomScore, teamsOf, type Built } from './helpers/tournamentFixtures';

const WIN: SetScore[] = [[25, 10], [25, 10], [25, 10]];
const LOSS: SetScore[] = [[10, 25], [10, 25], [10, 25]];

function score(built: Built, m: EngineMatch, homeWins: boolean): SetScore[] {
  const n = rulesForStage(built.ctx.rules, m.stage).setsToWin;
  return (homeWins ? WIN : LOSS).slice(0, n);
}

/** Plays in planning order; after each result, the teams finished so far. */
function playSteps(built: Built, seed = 3) {
  const rng = createRng(seed);
  let matches = built.matches;
  const order = [...matches].sort((x, y) => (x.slot! - y.slot!) || (x.court! - y.court!)).map((m) => m.key);
  const steps: { key: string; finished: Set<string>; matches: EngineMatch[] }[] = [];
  for (const key of order) {
    const m = matches.find((x) => x.key === key)!;
    const sets = randomScore(rulesForStage(built.ctx.rules, m.stage), rng, rng() < 0.5);
    const outcome = recordResult(built.ctx, matches, key, { sets, forfeitId: null });
    if (!outcome.ok) throw new Error(`${key}: ${JSON.stringify(outcome)}`);
    matches = outcome.matches;
    steps.push({ key, finished: finishedTeams(built.ctx, matches), matches });
  }
  return { steps, order, final: matches };
}

const CASES: [TournamentFormat, number][] = [
  ['round_robin', 5], ['round_robin', 6],
  ['knockout', 8], ['knockout', 6], ['knockout', 12],
  ['pools_knockout', 8], ['pools_knockout', 12], ['pools_knockout', 10],
  ['brassage_levels', 8], ['brassage_levels', 12], ['brassage_levels', 16], ['brassage_levels', 24],
];

describe('a team has finished: no match left, and no future match it could be put in', () => {
  it.each(CASES)('%s, %i teams: never declared finished before its last match', (format, n) => {
    for (const seed of [1, 2, 3]) {
      const built = build(format, n);
      const { steps, final } = playSteps(built, seed);
      steps.forEach((step, i) => {
        const later = new Set(steps.slice(i + 1).flatMap((s) => teamsOf(final.find((m) => m.key === s.key)!)));
        for (const team of step.finished) expect(later.has(team)).toBe(false);
      });
    }
  });

  it.each(CASES)('%s, %i teams: everyone has finished at the end, nobody at the start', (format, n) => {
    const built = build(format, n);
    expect(finishedTeams(built.ctx, built.matches).size).toBe(0);
    const { final } = playSteps(built);
    expect(finishedTeams(built.ctx, final).size).toBe(n);
  });

  it('championship: a team has finished right after its last match', () => {
    const built = build('round_robin', 6);
    const { steps } = playSteps(built);
    steps.forEach((step, i) => {
      const later = new Set(steps.slice(i + 1).flatMap((s) => teamsOf(step.matches.find((m) => m.key === s.key)!)));
      for (const t of built.ctx.teams) expect(step.finished.has(t.id)).toBe(!later.has(t.id));
    });
  });

  it('knockout: a semi-final loser waits for the 3rd place match, unless there is none', () => {
    for (const thirdPlace of [true, false]) {
      const built = build('knockout', 4, { rules: { knockout: { thirdPlace } } });
      let matches = built.matches;
      const semis = matches.filter((m) => m.label === 'ko:4:1' || m.label === 'ko:4:2');
      expect(semis).toHaveLength(2);
      for (const semi of semis) {
        const outcome = recordResult(built.ctx, matches, semi.key, { sets: score(built, semi, true), forfeitId: null });
        if (!outcome.ok) throw new Error('semi');
        matches = outcome.matches;
      }
      const losers = semis.map((s) => s.awayId!);
      const finished = finishedTeams(built.ctx, matches);
      for (const l of losers) expect(finished.has(l)).toBe(!thirdPlace);
    }
  });

  it('pools + finals: nobody leaves while a pool place can still qualify', () => {
    const built = build('pools_knockout', 12);
    let matches = built.matches;
    const firstPool = matches.filter((m) => m.stage === 'pool' && m.pool === 0);
    for (const m of firstPool) {
      const outcome = recordResult(built.ctx, matches, m.key, { sets: score(built, m, true), forfeitId: null });
      if (!outcome.ok) throw new Error('pool');
      matches = outcome.matches;
    }
    const others = matches.filter((m) => m.stage === 'pool' && m.pool !== 0);
    expect(others.some((m) => m.status !== 'validated')).toBe(true);
    // Pool A is over, the others are not: if the best 3rds go on, no one of A has finished yet
    const usesBestOf = matches.some((m) => [m.homeRef, m.awayRef].some((r) => r.type === 'bestOf'));
    const finished = finishedTeams(built.ctx, matches);
    if (usesBestOf) expect(finished.size).toBe(0);
    const ranks = built.ctx.rules.pools!.qualifiersPerPool;
    expect(finished.size).toBeLessThanOrEqual(built.ctx.pools[0].length - ranks);
  });

  it('brassage + levels: nobody leaves before the levels are known', () => {
    const built = build('brassage_levels', 16);
    const { steps } = playSteps(built);
    for (const step of steps) {
      const levelsStarted = step.matches.some((m) => m.level !== null && m.homeId !== null);
      if (!levelsStarted) expect(step.finished.size).toBe(0);
    }
  });

  it('a corrected result that brings a team back: it has not finished anymore', () => {
    const built = build('knockout', 8, { rules: { knockout: { thirdPlace: false } } });
    let matches = built.matches;
    const quarter = matches.find((m) => m.label === 'ko:8:1')!;
    let outcome = recordResult(built.ctx, matches, quarter.key, { sets: score(built, quarter, true), forfeitId: null });
    if (!outcome.ok) throw new Error('quarter');
    matches = outcome.matches;
    const loser = quarter.awayId!;
    expect(finishedTeams(built.ctx, matches).has(loser)).toBe(true);
    outcome = recordResult(built.ctx, matches, quarter.key, { sets: score(built, quarter, false), forfeitId: null });
    if (!outcome.ok) throw new Error('correction');
    expect(finishedTeams(built.ctx, outcome.matches).has(loser)).toBe(false);
    expect(finishedTeams(built.ctx, outcome.matches).has(quarter.homeId!)).toBe(true);
  });

  it('newly finished: only the teams that finished with this result', () => {
    const built = build('round_robin', 4);
    const { steps } = playSteps(built);
    const before = new Set<string>();
    for (const step of steps) {
      const fresh = newlyFinished(before, step.finished);
      for (const t of fresh) expect(before.has(t)).toBe(false);
      for (const t of fresh) before.add(t);
    }
    expect(before.size).toBe(4);
  });
});
