import {
  composePools,
  levelFormat,
  levelSizes,
  pairKey as metKey,
  poolSizes,
} from '../src/features/tournament/engine/brassage';
import { defaultBrassageRules, defaultFormat, defaultRules } from '../src/features/tournament/engine/defaults';
import { generateTournament, validateSetup } from '../src/features/tournament/engine/generate';
import { recordResult } from '../src/features/tournament/engine/cascade';
import { finalRanking } from '../src/features/tournament/engine/finalRanking';
import { matchCountRange } from '../src/features/tournament/engine/simulate';
import type { EngineMatch } from '../src/features/tournament/engine/types';
import type { SetScore } from '../src/models/tournament';
import { build, makeTeams, playAll, teamsOf, type Built } from './helpers/tournamentFixtures';

const pairKey = (a: string, b: string) => [a, b].sort().join('-');
const WIN: SetScore[] = [[25, 10], [25, 10]];
const LOSS: SetScore[] = [[10, 25], [10, 25]];

describe('sizes', () => {
  it('pools of 4 first, then pools of 3, biggest at the top', () => {
    expect(poolSizes(6)).toEqual([3, 3]);
    expect(poolSizes(7)).toEqual([4, 3]);
    expect(poolSizes(10)).toEqual([4, 3, 3]);
    expect(poolSizes(13)).toEqual([4, 3, 3, 3]);
    expect(poolSizes(16)).toEqual([4, 4, 4, 4]);
  });

  it('levels of equal size, the bigger ones first', () => {
    expect(levelSizes(16, 2)).toEqual([8, 8]);
    expect(levelSizes(10, 2)).toEqual([5, 5]);
    expect(levelSizes(22, 3)).toEqual([8, 7, 7]);
  });

  it('format of a level: one pool up to 5, a full bracket for 8/16/32, pools of 4/3 otherwise', () => {
    expect([3, 4, 5].map(levelFormat)).toEqual(['pool', 'pool', 'pool']);
    expect([8, 16, 32].map(levelFormat)).toEqual(['bracket', 'bracket', 'bracket']);
    expect([6, 7, 10, 12].map(levelFormat)).toEqual(['pools', 'pools', 'pools', 'pools']);
  });
});

describe('defaults', () => {
  it('Brassage + niveaux by default in 4×4, 3×3 and 2×2; pools + finals in 6×6', () => {
    expect(defaultFormat('indoor_6v6')).toBe('pools_knockout');
    expect(defaultFormat('indoor_4v4')).toBe('brassage_levels');
    expect(defaultFormat('indoor_3v3')).toBe('brassage_levels');
    expect(defaultFormat('beach_2v2')).toBe('brassage_levels');
  });

  it.each([
    [8, 1, 2], [11, 1, 2], [12, 2, 2], [23, 2, 2], [24, 2, 3], [64, 2, 3],
  ])('%i teams → %i round(s), %i levels', (n, rounds, levels) => {
    expect(defaultBrassageRules(n)).toEqual({ rounds, levels });
    expect(defaultRules('indoor_4v4', 'brassage_levels', n).brassage).toEqual({ rounds, levels });
  });
});

describe('composing the pools of the next round', () => {
  const ranking = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  it('groups teams of the same level: 1-4, 5-8', () => {
    expect(composePools(ranking, [4, 4], new Set())).toEqual([['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']]);
  });

  it('separates teams that already met, with the closest team of the next pool', () => {
    const met = new Set([metKey('a', 'b')]);
    expect(composePools(ranking, [4, 4], met)).toEqual([['a', 'c', 'd', 'e'], ['b', 'f', 'g', 'h']]);
  });

  it('keeps a meeting nobody can avoid', () => {
    const met = new Set([metKey('a', 'b')]);
    expect(composePools(['a', 'b', 'c', 'd'], [4], met)).toEqual([['a', 'b', 'c', 'd']]);
  });
});

describe('setup validation', () => {
  const input = (n: number, rounds = 1, levels = 2) => ({
    format: 'brassage_levels' as const,
    rules: { ...defaultRules('indoor_4v4', 'brassage_levels', n), brassage: { rounds, levels } },
    teams: makeTeams(n), seed: 1, seeding: 'random' as const,
  });
  it('needs 6 teams and at least 2 teams per level', () => {
    expect(validateSetup(input(5))).toContain('brassage_too_few_teams');
    expect(validateSetup(input(6, 1, 4))).toContain('too_many_levels');
    expect(validateSetup(input(6))).toEqual([]);
  });
});

const SIZES = [6, 8, 10, 12, 16, 24, 32, 64];

function brassage(n: number, seed = 42): Built {
  return build('brassage_levels', n, { seed });
}

describe.each(SIZES)('%i teams', (n) => {
  it('round 1: everyone in a pool of 3 or 4, pairs once', () => {
    const { ctx, matches } = brassage(n);
    const round1 = matches.filter((m) => m.stage === 'brassage' && m.phase === 1);
    const pools = new Set(round1.map((m) => m.pool));
    expect(pools.size).toBe(poolSizes(n).length);
    expect(new Set(round1.flatMap(teamsOf))).toEqual(new Set(ctx.teams.map((t) => t.id)));
    expect(new Set(round1.map((m) => pairKey(m.homeId!, m.awayId!))).size).toBe(round1.length);
  });

  it('can be played to the end: never two matches at once, every team ranked once', () => {
    const built = brassage(n);
    const played = playAll(built);
    expect(played.every((m) => m.status === 'validated')).toBe(true);
    const bySlot = new Map<number, string[]>();
    for (const m of played) bySlot.set(m.slot!, [...(bySlot.get(m.slot!) ?? []), ...teamsOf(m)]);
    for (const teams of bySlot.values()) expect(new Set(teams).size).toBe(teams.length);
    const ranking = finalRanking(built.ctx, played);
    expect(ranking.map((r) => r.rank)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
  });

  it('every team plays about the same number of matches', () => {
    const { min, max } = matchCountRange(brassage(n).ctx, brassage(n).matches);
    expect(min).toBeGreaterThanOrEqual(2);
    expect(max - min).toBeLessThanOrEqual(2);
  });

  it('the next phase always comes after the previous one', () => {
    const { matches } = brassage(n);
    const lastOf = (filter: (m: EngineMatch) => boolean) => Math.max(...matches.filter(filter).map((m) => m.slot!));
    const firstOf = (filter: (m: EngineMatch) => boolean) => Math.min(...matches.filter(filter).map((m) => m.slot!));
    const rounds = Math.max(...matches.filter((m) => m.stage === 'brassage').map((m) => m.phase!));
    for (let r = 2; r <= rounds; r++) {
      expect(firstOf((m) => m.phase === r)).toBeGreaterThan(lastOf((m) => m.phase === r - 1));
    }
    expect(firstOf((m) => m.level !== null)).toBeGreaterThan(lastOf((m) => m.phase === rounds));
  });

  it('same seed → same tournament', () => {
    expect(brassage(n, 5)).toEqual(brassage(n, 5));
  });
});

describe('round 2 and levels', () => {
  /** Plays only the mixing rounds, the team listed first in its pool winning. */
  function playRounds(built: Built, rounds: number[]): EngineMatch[] {
    let matches = built.matches;
    for (const r of rounds) {
      for (const m of matches.filter((x) => x.stage === 'brassage' && x.phase === r)) {
        const current = matches.find((x) => x.key === m.key)!;
        const outcome = recordResult(built.ctx, matches, m.key, { sets: current.homeId! < current.awayId! ? WIN : LOSS, forfeitId: null });
        if (!outcome.ok) throw new Error(JSON.stringify(outcome));
        matches = outcome.matches;
      }
    }
    return matches;
  }

  const winnersOfRound = (matches: EngineMatch[], round: number) => {
    const byPool = new Map<number, Map<string, number>>();
    for (const m of matches.filter((x) => x.stage === 'brassage' && x.phase === round)) {
      const wins = byPool.get(m.pool!) ?? new Map<string, number>();
      for (const t of teamsOf(m)) wins.set(t, (wins.get(t) ?? 0) + (m.winnerId === t ? 1 : 0));
      byPool.set(m.pool!, wins);
    }
    return [...byPool.values()].map((wins) => [...wins.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  };

  it('round 2: the first pool gathers the winners of round 1', () => {
    const built = brassage(16);
    expect(built.ctx.rules.brassage).toEqual({ rounds: 2, levels: 2 });
    const matches = playRounds(built, [1]);
    const round2 = matches.filter((m) => m.stage === 'brassage' && m.phase === 2);
    const firstPool = Math.min(...round2.map((m) => m.pool!));
    const top = new Set(round2.filter((m) => m.pool === firstPool).flatMap(teamsOf));
    expect(top).toEqual(new Set(winnersOfRound(matches, 1)));
  });

  it.each([16, 24, 32])('%i teams: nobody meets the same team again in round 2', (n) => {
    const matches = playRounds(brassage(n), [1]);
    const met = new Set(matches.filter((m) => m.phase === 1).map((m) => pairKey(m.homeId!, m.awayId!)));
    for (const m of matches.filter((x) => x.phase === 2)) expect(met.has(pairKey(m.homeId!, m.awayId!))).toBe(false);
  });

  it('the Principale gets the top half of the last round', () => {
    const built = brassage(16);
    const matches = playRounds(built, [1, 2]);
    const round2 = matches.filter((m) => m.phase === 2);
    const pools = [...new Set(round2.map((m) => m.pool!))].sort((a, b) => a - b);
    const topTeams = new Set(round2.filter((m) => m.pool === pools[0] || m.pool === pools[1]).flatMap(teamsOf));
    const principale = new Set(matches.filter((m) => m.level === 0).flatMap(teamsOf));
    expect(principale).toEqual(topTeams);
    expect(principale.size).toBe(8);
  });

  it('a corrected round-1 result updates round 2 until it is played', () => {
    const built = brassage(16);
    const matches = playRounds(built, [1]);
    const first = matches.find((m) => m.phase === 1)!;
    const reversed = recordResult(built.ctx, matches, first.key, { sets: first.winnerId === first.homeId ? LOSS : WIN, forfeitId: null });
    expect(reversed.ok).toBe(true);
    if (!reversed.ok) return;
    expect(reversed.changed.length).toBeGreaterThan(1);

    // A round-2 match whose teams the correction changes
    const r2 = matches.find((m) => m.phase === 2 && reversed.changed.includes(m.key))!;
    const playedR2 = recordResult(built.ctx, matches, r2.key, { sets: WIN, forfeitId: null });
    if (!playedR2.ok) throw new Error();
    const blocked = recordResult(built.ctx, playedR2.matches, first.key, { sets: first.winnerId === first.homeId ? LOSS : WIN, forfeitId: null });
    expect(blocked.ok).toBe(false);
  });

  it('levels of 8 play a full bracket: every place from 1 to 8 decided', () => {
    const built = brassage(16);
    const played = playAll(built);
    const principale = played.filter((m) => m.level === 0);
    expect(principale).toHaveLength(12); // 3 rounds of 4 matches
    expect(principale.filter((m) => /^place:\d+-\d+:/.test(m.label ?? ''))).toHaveLength(12);
    const finals = principale.filter((m) => m.label?.startsWith('place:') && m.label.split(':')[1].split('-').map(Number).reduce((a, b) => b - a) === 1);
    expect(finals).toHaveLength(4); // places 1-2, 3-4, 5-6, 7-8
  });
});

describe('preview of the number of matches', () => {
  it('works for every format', () => {
    for (const format of ['round_robin', 'pools_knockout', 'knockout', 'brassage_levels'] as const) {
      const { ctx, matches } = build(format, 12);
      const { min, max } = matchCountRange(ctx, matches);
      expect(min).toBeGreaterThan(0);
      expect(max).toBeGreaterThanOrEqual(min);
    }
    const league = build('round_robin', 6);
    expect(matchCountRange(league.ctx, league.matches)).toEqual({ min: 5, max: 5 });
  });

  it('does not change the matches it is given', () => {
    const built = brassage(12);
    const before = JSON.stringify(built.matches);
    matchCountRange(built.ctx, built.matches);
    expect(JSON.stringify(built.matches)).toBe(before);
  });

  it('generation keeps pool definitions', () => {
    const g = generateTournament({
      format: 'brassage_levels', rules: defaultRules('indoor_4v4', 'brassage_levels', 12), teams: makeTeams(12), seed: 1, seeding: 'random',
    });
    // Round 1: 3 pools with teams, round 2: 3 pools composed later, levels of 6: 2 pools of 3 each
    expect(g.poolDefs.map((d) => [d.phase, d.level])).toEqual([
      [1, null], [1, null], [1, null], [2, null], [2, null], [2, null], [null, 0], [null, 0], [null, 1], [null, 1],
    ]);
    expect(g.pools.map((p) => p.length)).toEqual([4, 4, 4, 0, 0, 0, 0, 0, 0, 0]);
  });
});
