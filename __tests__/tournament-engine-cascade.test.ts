import { recordResult } from '../src/features/tournament/engine/cascade';
import { resolveTeams } from '../src/features/tournament/engine/qualification';
import { finalRanking } from '../src/features/tournament/engine/finalRanking';
import type { EngineMatch } from '../src/features/tournament/engine/types';
import type { SetScore } from '../src/models/tournament';
import { build, playAll, type Built } from './helpers/tournamentFixtures';

const WIN: SetScore[] = [[25, 10], [25, 10]];
const LOSS: SetScore[] = [[10, 25], [10, 25]];

/** Validates every pool match: the team listed first in its pool wins (pool order = ranking). */
function playPools(built: Built): EngineMatch[] {
  let matches = built.matches;
  for (const m of built.matches.filter((x) => x.stage === 'pool')) {
    const pool = built.ctx.pools[m.pool!];
    const homeBetter = pool.indexOf(m.homeId!) < pool.indexOf(m.awayId!);
    const outcome = recordResult(built.ctx, matches, m.key, { sets: homeBetter ? WIN : LOSS, forfeitId: null });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome));
    matches = outcome.matches;
  }
  return matches;
}

const byLabel = (matches: EngineMatch[], label: string) => matches.find((m) => m.label === label)!;

describe('recording a result', () => {
  it('computes the winner and validates the match', () => {
    const built = build('round_robin', 4);
    const m = built.matches[0];
    const outcome = recordResult(built.ctx, built.matches, m.key, { sets: [[20, 25], [25, 20], [10, 15]], forfeitId: null });
    expect(outcome.ok).toBe(true);
    const saved = outcome.ok ? outcome.matches.find((x) => x.key === m.key)! : null;
    expect(saved).toMatchObject({ status: 'validated', winnerId: m.awayId, forfeitId: null, sets: [[20, 25], [25, 20], [10, 15]] });
  });

  it('refuses an invalid score with the engine errors', () => {
    const built = build('round_robin', 4);
    expect(recordResult(built.ctx, built.matches, built.matches[0].key, { sets: [[25, 24]], forfeitId: null }))
      .toEqual({ ok: false, reason: 'invalid_score', errors: [{ code: 'set_not_finished', set: 1 }] });
  });

  it('a forfeit fills in the score', () => {
    const built = build('round_robin', 4);
    const m = built.matches[0];
    const outcome = recordResult(built.ctx, built.matches, m.key, { sets: [], forfeitId: m.homeId });
    const saved = outcome.ok ? outcome.matches.find((x) => x.key === m.key)! : null;
    expect(saved).toMatchObject({ winnerId: m.awayId, forfeitId: m.homeId, sets: [[0, 25], [0, 25]] });
  });

  it('refuses a forfeit by a team that is not in the match', () => {
    const built = build('round_robin', 4);
    const m = built.matches[0];
    const other = built.ctx.teams.find((t) => t.id !== m.homeId && t.id !== m.awayId)!;
    expect(recordResult(built.ctx, built.matches, m.key, { sets: [], forfeitId: other.id })).toEqual({ ok: false, reason: 'not_in_match' });
  });

  it('refuses a match whose teams are not known yet', () => {
    const built = build('knockout', 4);
    const final = byLabel(built.matches, 'ko:2:1');
    expect(recordResult(built.ctx, built.matches, final.key, { sets: WIN, forfeitId: null })).toEqual({ ok: false, reason: 'teams_unknown' });
  });

  it('does not modify the list it was given', () => {
    const built = build('round_robin', 4);
    const before = JSON.stringify(built.matches);
    recordResult(built.ctx, built.matches, built.matches[0].key, { sets: WIN, forfeitId: null });
    expect(JSON.stringify(built.matches)).toBe(before);
  });
});

describe('qualification', () => {
  it('the bracket fills in once a pool is complete', () => {
    const built = build('pools_knockout', 8);
    let matches = built.matches;
    const semi1 = byLabel(matches, 'ko:4:1');
    expect([semi1.homeId, semi1.awayId]).toEqual([null, null]);

    // Pool A only
    for (const m of built.matches.filter((x) => x.stage === 'pool' && x.pool === 0)) {
      const pool = built.ctx.pools[0];
      const outcome = recordResult(built.ctx, matches, m.key, { sets: pool.indexOf(m.homeId!) < pool.indexOf(m.awayId!) ? WIN : LOSS, forfeitId: null });
      if (!outcome.ok) throw new Error();
      matches = outcome.matches;
    }
    // 1st A known, 2nd B not yet
    expect([byLabel(matches, 'ko:4:1').homeId, byLabel(matches, 'ko:4:1').awayId]).toEqual([built.ctx.pools[0][0], null]);

    matches = playPools(built);
    const [a, b] = built.ctx.pools;
    expect([byLabel(matches, 'ko:4:1').homeId, byLabel(matches, 'ko:4:1').awayId]).toEqual([a[0], b[1]]);
    expect([byLabel(matches, 'ko:4:2').homeId, byLabel(matches, 'ko:4:2').awayId]).toEqual([b[0], a[1]]);
  });

  it('winners go to the final, losers to the 3rd place match', () => {
    const built = build('pools_knockout', 8);
    let matches = playPools(built);
    for (const label of ['ko:4:1', 'ko:4:2']) {
      const outcome = recordResult(built.ctx, matches, byLabel(matches, label).key, { sets: WIN, forfeitId: null });
      if (!outcome.ok) throw new Error();
      matches = outcome.matches;
    }
    const semi1 = byLabel(matches, 'ko:4:1');
    const semi2 = byLabel(matches, 'ko:4:2');
    expect([byLabel(matches, 'ko:2:1').homeId, byLabel(matches, 'ko:2:1').awayId]).toEqual([semi1.homeId, semi2.homeId]);
    expect([byLabel(matches, 'third').homeId, byLabel(matches, 'third').awayId]).toEqual([semi1.awayId, semi2.awayId]);
  });

  it('best third places across pools of different sizes: points per match first', () => {
    const built = build('pools_knockout', 10); // pools of 4, 3, 3 — 2 best thirds
    expect(built.ctx.rules.pools).toEqual({ count: 3, qualifiersPerPool: 2, bestOthers: 2 });
    const matches = playPools(built);
    const resolved = resolveTeams(built.ctx, matches);
    const bestOf = matches.filter((m) => m.stage === 'knockout')
      .flatMap((m) => [[m.homeRef, resolved.get(m.key)!.homeId], [m.awayRef, resolved.get(m.key)!.awayId]] as const)
      .filter(([ref]) => ref.type === 'bestOf');
    expect(bestOf).toHaveLength(2);
    const thirds = built.ctx.pools.map((p) => p[2]);
    for (const [, id] of bestOf) expect(thirds).toContain(id);
  });
});

describe('corrections in cascade', () => {
  function setup() {
    const built = build('pools_knockout', 8);
    const matches = playPools(built);
    // Pool A: the 2nd beat the 1st; turning that result around swaps them
    const [a] = built.ctx.pools;
    const key = matches.find((m) => m.stage === 'pool' && m.pool === 0 && [m.homeId, m.awayId].includes(a[0]) && [m.homeId, m.awayId].includes(a[1]))!;
    return { built, matches, decisive: key };
  }

  it('a corrected pool result updates the matches of the bracket not played yet', () => {
    const { built, matches, decisive } = setup();
    const [a] = built.ctx.pools;
    const reversed = decisive.homeId === a[0] ? LOSS : WIN; // now a[1] beats a[0]
    // a[0] and a[1] now have 2 wins each… a[0] beat a[2], a[3]; a[1] beat a[0], a[2], a[3] → a[1] first
    const outcome = recordResult(built.ctx, matches, decisive.key, { sets: reversed, forfeitId: null });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(byLabel(outcome.matches, 'ko:4:1').homeId).toBe(a[1]);
    expect(byLabel(outcome.matches, 'ko:4:2').awayId).toBe(a[0]);
    expect(outcome.changed).toEqual(expect.arrayContaining([decisive.key, byLabel(matches, 'ko:4:1').key, byLabel(matches, 'ko:4:2').key]));
  });

  it('…but is blocked when a bracket match it feeds is already played', () => {
    const { built, matches, decisive } = setup();
    const [a] = built.ctx.pools;
    const semi = recordResult(built.ctx, matches, byLabel(matches, 'ko:4:1').key, { sets: WIN, forfeitId: null });
    if (!semi.ok) throw new Error();
    const outcome = recordResult(built.ctx, semi.matches, decisive.key, { sets: decisive.homeId === a[0] ? LOSS : WIN, forfeitId: null });
    expect(outcome).toEqual({ ok: false, reason: 'blocked', blockedBy: [byLabel(matches, 'ko:4:1').key] });
  });

  it('a correction that changes nobody\'s place goes through', () => {
    const { built, matches, decisive } = setup();
    const same = decisive.homeId === built.ctx.pools[0][0] ? [[25, 20], [25, 23]] as SetScore[] : [[20, 25], [23, 25]] as SetScore[];
    const semi = recordResult(built.ctx, matches, byLabel(matches, 'ko:4:1').key, { sets: WIN, forfeitId: null });
    if (!semi.ok) throw new Error();
    expect(recordResult(built.ctx, semi.matches, decisive.key, { sets: same, forfeitId: null }).ok).toBe(true);
  });

  it('a corrected semi-final updates the final if it is not played', () => {
    const built = build('knockout', 4);
    let matches = built.matches;
    for (const label of ['ko:4:1', 'ko:4:2']) {
      const o = recordResult(built.ctx, matches, byLabel(matches, label).key, { sets: WIN, forfeitId: null });
      if (!o.ok) throw new Error();
      matches = o.matches;
    }
    const semi1 = byLabel(matches, 'ko:4:1');
    const o = recordResult(built.ctx, matches, semi1.key, { sets: LOSS, forfeitId: null });
    if (!o.ok) throw new Error();
    expect(byLabel(o.matches, 'ko:2:1').homeId).toBe(semi1.awayId);
    expect(byLabel(o.matches, 'third').homeId).toBe(semi1.homeId);
  });
});

describe('final ranking', () => {
  it('championship: the table', () => {
    const built = build('round_robin', 6);
    const played = playAll(built);
    const ranking = finalRanking(built.ctx, played);
    expect(ranking.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('knockout: final, 3rd place match, then by round reached', () => {
    const built = build('knockout', 8);
    const played = playAll(built);
    const ranking = finalRanking(built.ctx, played);
    const final = byLabel(played, 'ko:2:1');
    const third = byLabel(played, 'third');
    const loser = (m: EngineMatch) => (m.winnerId === m.homeId ? m.awayId : m.homeId);
    expect(ranking.slice(0, 4).map((r) => r.teamId)).toEqual([final.winnerId, loser(final), third.winnerId, loser(third)]);
    expect(ranking.slice(4).map((r) => r.rank)).toEqual([5, 5, 5, 5]);
  });

  it('pools + finals: non-qualified teams come after the bracket', () => {
    const built = build('pools_knockout', 12);
    const played = playAll(built);
    const ranking = finalRanking(built.ctx, played);
    expect(ranking).toHaveLength(12);
    expect(new Set(ranking.map((r) => r.teamId)).size).toBe(12);
    expect(ranking.slice(0, 4).map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(ranking.slice(4, 8).map((r) => r.rank)).toEqual([5, 5, 5, 5]);
    expect(ranking.slice(8).every((r) => r.rank !== null && r.rank >= 9)).toBe(true);
  });

  it('unknown places stay empty while the tournament is running', () => {
    const built = build('knockout', 4);
    const ranking = finalRanking(built.ctx, built.matches);
    expect(ranking.every((r) => r.rank === null)).toBe(true);
  });
});
