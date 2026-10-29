import { generateTournament, validateSetup } from '../src/features/tournament/engine/generate';
import { drawPools } from '../src/features/tournament/engine/pools';
import { roundRobin } from '../src/features/tournament/engine/roundRobin';
import { createRng, shuffle } from '../src/features/tournament/engine/rng';
import { defaultPoolRules, defaultRules, defaultSchedule, recommendFormat } from '../src/features/tournament/engine/defaults';
import type { EngineMatch } from '../src/features/tournament/engine/types';
import type { TournamentFormat } from '../src/models/tournament';
import { build, makeTeams, playAll, teamsOf } from './helpers/tournamentFixtures';

const SIZES = [4, 8, 12, 16, 24, 32, 64];
const FORMATS: TournamentFormat[] = ['round_robin', 'pools_knockout', 'knockout'];
const pairKey = (a: string, b: string) => [a, b].sort().join('-');
const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(n));

describe('seeded random', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(123);
    const b = createRng(123);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(Array.from({ length: 5 }, createRng(124))).not.toEqual(seqA);
  });
  it('shuffles without losing anything', () => {
    const list = Array.from({ length: 20 }, (_, i) => i);
    const out = shuffle(list, createRng(1));
    expect([...out].sort((x, y) => x - y)).toEqual(list);
    expect(out).not.toEqual(list);
    expect(list[0]).toBe(0); // the input is not modified
  });
});

describe('round robin (Berger)', () => {
  it.each([4, 5, 6, 7])('%i teams: every pair once, nobody twice in a round', (n) => {
    const ids = makeTeams(n).map((t) => t.id);
    const games = roundRobin(ids, 1);
    expect(games).toHaveLength((n * (n - 1)) / 2);
    expect(new Set(games.map((g) => pairKey(g.home, g.away))).size).toBe(games.length);
    const rounds = new Set(games.map((g) => g.round));
    expect(rounds.size).toBe(n % 2 === 0 ? n - 1 : n);
    for (const r of rounds) {
      const playing = games.filter((g) => g.round === r).flatMap((g) => [g.home, g.away]);
      expect(new Set(playing).size).toBe(playing.length);
    }
  });
  it('balances home and away', () => {
    const ids = makeTeams(6).map((t) => t.id);
    const games = roundRobin(ids, 1);
    for (const id of ids) {
      const home = games.filter((g) => g.home === id).length;
      expect(Math.abs(home - (5 - home))).toBeLessThanOrEqual(1);
    }
  });
  it('two legs: each pair twice, home and away swapped', () => {
    const games = roundRobin(['a', 'b', 'c', 'd'], 2);
    expect(games).toHaveLength(12);
    const ab = games.filter((g) => pairKey(g.home, g.away) === 'a-b');
    expect(ab.map((g) => g.home).sort()).toEqual(['a', 'b']);
    expect(Math.max(...games.map((g) => g.round))).toBe(6);
  });
});

describe('pools', () => {
  it('random draw: balanced sizes, everyone once, deterministic', () => {
    const teams = makeTeams(14);
    const pools = drawPools(teams, 4, 'random', createRng(9));
    expect(pools.map((p) => p.length).sort()).toEqual([3, 3, 4, 4]);
    expect(new Set(pools.flat()).size).toBe(14);
    expect(drawPools(teams, 4, 'random', createRng(9))).toEqual(pools);
    expect(drawPools(teams, 4, 'random', createRng(10))).not.toEqual(pools);
  });
  it('seeded: serpentine, each top seed in a different pool', () => {
    const teams = makeTeams(16, 8);
    const pools = drawPools(teams, 4, 'seeded', createRng(1));
    expect(pools.map((p) => p[0])).toEqual(['t01', 't02', 't03', 't04']);
    expect(pools.map((p) => p[1])).toEqual(['t08', 't07', 't06', 't05']);
  });
});

describe('defaults', () => {
  it('recommends a championship for few teams, pools otherwise', () => {
    expect(recommendFormat(4)).toBe('round_robin');
    expect(recommendFormat(6)).toBe('round_robin');
    expect(recommendFormat(8)).toBe('pools_knockout');
  });
  it.each([
    [8, 2, 2, 0],
    [12, 3, 2, 2],
    [16, 4, 2, 0],
    [24, 6, 2, 4],
    [32, 8, 2, 0],
    [64, 16, 2, 0],
  ])('%i teams → %i pools, %i qualified each, %i best others', (n, count, qualifiers, bestOthers) => {
    expect(defaultPoolRules(n)).toEqual({ count, qualifiersPerPool: qualifiers, bestOthers });
  });
  it('schedule: 9:00, rest, courts grow with the teams', () => {
    expect(defaultSchedule('indoor_6v6', 4)).toEqual({ courts: 1, startTime: '09:00', matchMinutes: 45, restMinutes: 10 });
    expect(defaultSchedule('beach_2v2', 24).courts).toBe(4);
    expect(defaultSchedule('indoor_3v3', 8).matchMinutes).toBeLessThan(defaultSchedule('indoor_6v6', 8).matchMinutes);
  });
  it('rules: no pools outside "pools + finals"', () => {
    expect(defaultRules('indoor_6v6', 'round_robin', 8).pools).toBeNull();
    expect(defaultRules('indoor_6v6', 'pools_knockout', 8).pools).toEqual(defaultPoolRules(8));
    expect(defaultRules('indoor_6v6', 'knockout', 8).knockout).toEqual({ thirdPlace: true });
  });
});

describe('setup validation', () => {
  const input = (format: TournamentFormat, n: number) => ({
    format, rules: defaultRules('indoor_6v6', format, n), teams: makeTeams(n), seed: 1, seeding: 'random' as const,
  });
  it('accepts the defaults for every size', () => {
    for (const f of FORMATS) for (const n of SIZES) expect(validateSetup(input(f, n))).toEqual([]);
  });
  it('needs at least 2 teams', () => {
    expect(validateSetup(input('round_robin', 1))).toContain('too_few_teams');
  });
  it('refuses pools too small for their qualifiers', () => {
    const i = input('pools_knockout', 8);
    i.rules = { ...i.rules, pools: { count: 4, qualifiersPerPool: 2, bestOthers: 2 } };
    expect(validateSetup(i)).toContain('pool_too_small');
    i.rules = { ...i.rules, pools: { count: 2, qualifiersPerPool: 5, bestOthers: 0 } };
    expect(validateSetup(i)).toContain('pool_too_small');
  });
  it('refuses fewer than 2 qualifiers or more pools than possible', () => {
    const i = input('pools_knockout', 8);
    i.rules = { ...i.rules, pools: { count: 1, qualifiersPerPool: 1, bestOthers: 0 } };
    expect(validateSetup(i)).toContain('too_few_qualifiers');
    i.rules = { ...i.rules, pools: { count: 5, qualifiersPerPool: 1, bestOthers: 0 } };
    expect(validateSetup(i)).toContain('pool_too_small');
  });
  it('refuses a seed given twice', () => {
    const i = input('knockout', 4);
    i.teams = i.teams.map((t) => ({ ...t, seedRank: 1 }));
    expect(validateSetup(i)).toContain('seed_duplicate');
  });
});

function checkPlanning(matches: EngineMatch[], courts: number) {
  // Every match placed, courts in range, at most `courts` per slot
  for (const m of matches) {
    expect(m.slot).not.toBeNull();
    expect(m.court).toBeGreaterThanOrEqual(1);
    expect(m.court).toBeLessThanOrEqual(courts);
  }
  const bySlot = new Map<number, EngineMatch[]>();
  for (const m of matches) bySlot.set(m.slot!, [...(bySlot.get(m.slot!) ?? []), m]);
  for (const list of bySlot.values()) {
    expect(new Set(list.map((m) => m.court)).size).toBe(list.length);
  }
  // A match always comes after the matches it depends on
  const byKey = new Map(matches.map((m) => [m.key, m]));
  for (const m of matches) {
    for (const ref of [m.homeRef, m.awayRef]) {
      if (ref.type === 'winner' || ref.type === 'loser') expect(byKey.get(ref.match)!.slot!).toBeLessThan(m.slot!);
      if (ref.type === 'poolRank') {
        for (const p of matches.filter((x) => x.stage === 'pool' && x.pool === ref.pool)) expect(p.slot!).toBeLessThan(m.slot!);
      }
      if (ref.type === 'bestOf') {
        for (const p of matches.filter((x) => x.stage === 'pool')) expect(p.slot!).toBeLessThan(m.slot!);
      }
    }
  }
}

/** Never two matches at the same time for a team — checked once every team is known. */
function checkNoClash(played: EngineMatch[]) {
  const bySlot = new Map<number, string[]>();
  for (const m of played) bySlot.set(m.slot!, [...(bySlot.get(m.slot!) ?? []), ...teamsOf(m)]);
  for (const teams of bySlot.values()) expect(new Set(teams).size).toBe(teams.length);
}

describe.each(SIZES)('%i teams', (n) => {
  it('championship: every pair meets exactly once', () => {
    const { matches } = build('round_robin', n);
    expect(matches).toHaveLength((n * (n - 1)) / 2);
    expect(new Set(matches.map((m) => pairKey(m.homeId!, m.awayId!))).size).toBe(matches.length);
    checkPlanning(matches, Math.ceil(n / 6));
    checkNoClash(matches);
  });

  it('pools + finals: pairs once in each pool, bracket of the right size', () => {
    const built = build('pools_knockout', n);
    const { pools, rules } = built.ctx;
    const poolRules = rules.pools!;
    expect(pools).toHaveLength(poolRules.count);
    expect(new Set(pools.flat()).size).toBe(n);
    const poolMatches = built.matches.filter((m) => m.stage === 'pool');
    pools.forEach((teams, p) => {
      const inPool = poolMatches.filter((m) => m.pool === p);
      expect(inPool).toHaveLength((teams.length * (teams.length - 1)) / 2);
      expect(new Set(inPool.map((m) => pairKey(m.homeId!, m.awayId!))).size).toBe(inPool.length);
      for (const m of inPool) expect(teams).toEqual(expect.arrayContaining([m.homeId, m.awayId]));
    });
    const qualified = poolRules.count * poolRules.qualifiersPerPool + poolRules.bestOthers;
    const knockout = built.matches.filter((m) => m.stage === 'knockout');
    expect(knockout).toHaveLength(qualified - 1);
    const firstRound = Math.min(...knockout.map((m) => m.round));
    const size = nextPow2(qualified);
    expect(knockout.find((m) => m.label === 'ko:2:1')).toBeDefined();
    expect(knockout.filter((m) => m.label?.startsWith(`ko:${size}:`))).toHaveLength(qualified - size / 2);
    expect(knockout.filter((m) => m.round === firstRound).length).toBeGreaterThan(0);
    expect(built.matches.filter((m) => m.stage === 'placement')).toHaveLength(qualified >= 4 ? 1 : 0);
    checkPlanning(built.matches, Math.ceil(n / 6));
  });

  it('knockout: n - 1 matches plus the 3rd place', () => {
    const built = build('knockout', n);
    expect(built.matches.filter((m) => m.stage === 'knockout')).toHaveLength(n - 1);
    expect(built.matches.filter((m) => m.stage === 'placement')).toHaveLength(1);
    checkPlanning(built.matches, Math.ceil(n / 6));
  });

  it.each(FORMATS)('%s: can be played to the end, never two matches at once for a team', (format) => {
    const built = build(format, n);
    const played = playAll(built);
    expect(played.every((m) => m.status === 'validated')).toBe(true);
    checkNoClash(played);
  });

  it.each(FORMATS)('%s: same seed → same tournament, schedule included', (format) => {
    expect(build(format, n, { seed: 5 })).toEqual(build(format, n, { seed: 5 }));
  });
});

describe('draw', () => {
  it('another seed draws other pools', () => {
    expect(build('pools_knockout', 16, { seed: 1 }).ctx.pools).not.toEqual(build('pools_knockout', 16, { seed: 2 }).ctx.pools);
  });

  it('pools + finals: first round crosses the pools (1st A vs 2nd B…)', () => {
    const { matches } = build('pools_knockout', 8);
    const semis = matches.filter((m) => m.label?.startsWith('ko:4:'));
    expect(semis.map((m) => [m.homeRef, m.awayRef])).toEqual([
      [{ type: 'poolRank', pool: 0, rank: 1 }, { type: 'poolRank', pool: 1, rank: 2 }],
      [{ type: 'poolRank', pool: 1, rank: 1 }, { type: 'poolRank', pool: 0, rank: 2 }],
    ]);
  });

  it('never two teams of the same pool in the first round when avoidable (3 pools)', () => {
    const { matches } = build('pools_knockout', 12);
    const quarters = matches.filter((m) => m.label?.startsWith('ko:8:'));
    expect(quarters).toHaveLength(4);
    for (const q of quarters) {
      const [h, a] = [q.homeRef, q.awayRef];
      if (h.type === 'poolRank' && a.type === 'poolRank') expect(h.pool).not.toBe(a.pool);
    }
    expect(quarters.flatMap((q) => [q.homeRef, q.awayRef]).filter((r) => r.type === 'bestOf')).toHaveLength(2);
  });

  it('byes go to the best seeds', () => {
    // 6 teams: bracket of 8, seeds 1 and 2 skip the first round
    const { matches } = build('knockout', 6, { seeding: 'seeded', seeded: 6 });
    const firstRound = matches.filter((m) => m.label?.startsWith('ko:8:'));
    const firstRoundTeams = firstRound.flatMap(teamsOf);
    expect(firstRoundTeams).toHaveLength(4);
    expect(firstRoundTeams).not.toContain('t01');
    expect(firstRoundTeams).not.toContain('t02');
    const semis = matches.filter((m) => m.label?.startsWith('ko:4:'));
    expect(semis.flatMap(teamsOf).sort()).toEqual(['t01', 't02']);
  });

  it('seeds 1 and 2 can only meet in the final', () => {
    const built = build('knockout', 16, { seeding: 'seeded', seeded: 16 });
    const played = playAll({ ...built, matches: built.matches });
    const final = played.find((m) => m.label === 'ko:2:1')!;
    // The stronger team (lower id) wins 75 % of the time — not guaranteed; check the bracket halves instead
    const r1 = built.matches.filter((m) => m.label?.startsWith('ko:16:'));
    const half = (id: string) => r1.findIndex((m) => teamsOf(m).includes(id)) < 4 ? 'top' : 'bottom';
    expect(half('t01')).not.toBe(half('t02'));
    expect(final.status).toBe('validated');
  });

  it('a pure knockout with a random draw is deterministic', () => {
    const a = generateTournament({ format: 'knockout', rules: defaultRules('beach_2v2', 'knockout', 8), teams: makeTeams(8), seed: 3, seeding: 'random' });
    const b = generateTournament({ format: 'knockout', rules: defaultRules('beach_2v2', 'knockout', 8), teams: makeTeams(8), seed: 3, seeding: 'random' });
    expect(a).toEqual(b);
  });

  it('prefixes match keys (and references) with the given prefix', () => {
    const g = generateTournament({ format: 'knockout', rules: defaultRules('indoor_6v6', 'knockout', 4), teams: makeTeams(4), seed: 1, seeding: 'random', keyPrefix: 'T1:' });
    expect(g.matches.every((m) => m.key.startsWith('T1:'))).toBe(true);
    const final = g.matches.find((m) => m.label === 'ko:2:1')!;
    expect(final.homeRef).toEqual({ type: 'winner', match: expect.stringMatching(/^T1:/) });
  });

  it('two legs in a championship', () => {
    const { matches } = build('round_robin', 4, { rules: { roundRobinLegs: 2 } });
    expect(matches).toHaveLength(12);
  });
});
