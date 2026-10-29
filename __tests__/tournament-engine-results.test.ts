import { evaluateScore, forfeitSets, rulesForStage } from '../src/features/tournament/engine/results';
import { defaultRules, defaultSetRules } from '../src/features/tournament/engine/defaults';
import type { SetRules } from '../src/models/tournament';

const twoSets: SetRules = { setsToWin: 2, pointsPerSet: 25, pointsLastSet: 15, winMargin: 2, tieBreak: true };
const threeSets: SetRules = { ...twoSets, setsToWin: 3 };

describe('evaluateScore', () => {
  it('computes the winner of a 2-0', () => {
    const r = evaluateScore([[25, 18], [25, 20]], twoSets);
    expect(r).toEqual({
      ok: true,
      summary: { winner: 'home', setsHome: 2, setsAway: 0, pointsHome: 50, pointsAway: 38, tight: false },
    });
  });

  it('plays the deciding set to 15 with a tie-break', () => {
    const r = evaluateScore([[25, 18], [20, 25], [13, 15]], twoSets);
    expect(r.ok && r.summary).toMatchObject({ winner: 'away', setsHome: 1, setsAway: 2, tight: true });
  });

  it('plays the deciding set to 25 without a tie-break', () => {
    const noTb = { ...twoSets, tieBreak: false };
    expect(evaluateScore([[25, 18], [20, 25], [15, 13]], noTb)).toEqual({
      ok: false, errors: [{ code: 'set_not_finished', set: 3 }],
    });
    expect(evaluateScore([[25, 18], [20, 25], [25, 23]], noTb).ok).toBe(true);
  });

  it('accepts an extension won by exactly the margin', () => {
    expect(evaluateScore([[27, 25], [30, 28]], twoSets).ok).toBe(true);
  });

  it('refuses a set that is not finished, or overshoots', () => {
    expect(evaluateScore([[25, 24], [25, 10]], twoSets)).toEqual({ ok: false, errors: [{ code: 'set_not_finished', set: 1 }] });
    expect(evaluateScore([[25, 10], [28, 25]], twoSets)).toEqual({ ok: false, errors: [{ code: 'set_overshoot', set: 2 }] });
  });

  it('follows the configured margin', () => {
    expect(evaluateScore([[25, 24], [25, 24]], { ...twoSets, winMargin: 1 }).ok).toBe(true);
  });

  it('refuses an unfinished match, an extra set, and invalid points', () => {
    expect(evaluateScore([[25, 10]], twoSets)).toEqual({ ok: false, errors: [{ code: 'match_not_finished' }] });
    expect(evaluateScore([[25, 10], [25, 10], [15, 10]], twoSets)).toEqual({ ok: false, errors: [{ code: 'extra_set', set: 3 }] });
    expect(evaluateScore([], twoSets)).toEqual({ ok: false, errors: [{ code: 'match_not_finished' }] });
    expect(evaluateScore([[-1, 25], [25, 10]], twoSets)).toEqual({ ok: false, errors: [{ code: 'invalid_points', set: 1 }] });
    expect(evaluateScore([[25.5, 10], [25, 10]], twoSets)).toEqual({ ok: false, errors: [{ code: 'invalid_points', set: 1 }] });
  });

  it('handles 3 winning sets (5th set to 15)', () => {
    const r = evaluateScore([[25, 20], [20, 25], [25, 20], [20, 25], [15, 12]], threeSets);
    expect(r.ok && r.summary).toMatchObject({ winner: 'home', setsHome: 3, setsAway: 2, tight: true });
    expect(evaluateScore([[25, 20], [25, 20], [25, 20]], threeSets).ok).toBe(true);
  });

  it('a single set match is never "tight"', () => {
    const one = { ...twoSets, setsToWin: 1, tieBreak: false, pointsPerSet: 21 };
    const r = evaluateScore([[19, 21]], one);
    expect(r.ok && r.summary).toMatchObject({ winner: 'away', tight: false });
  });
});

describe('forfeitSets', () => {
  it('gives the other team every set at the set target', () => {
    expect(forfeitSets(twoSets, 'home')).toEqual([[0, 25], [0, 25]]);
    expect(forfeitSets(threeSets, 'away')).toEqual([[25, 0], [25, 0], [25, 0]]);
    const one = { ...twoSets, setsToWin: 1, pointsPerSet: 21, tieBreak: true };
    expect(forfeitSets(one, 'away')).toEqual([[21, 0]]);
  });
  it('is a valid score', () => {
    expect(evaluateScore(forfeitSets(threeSets, 'home'), threeSets).ok).toBe(true);
  });
});

describe('rules by stage', () => {
  it('final phase rules apply to knockout and placement matches only', () => {
    const rules = { ...defaultRules('indoor_6v6', 'pools_knockout', 8), finalsMatch: threeSets };
    expect(rulesForStage(rules, 'pool')).toBe(rules.match);
    expect(rulesForStage(rules, 'knockout')).toBe(threeSets);
    expect(rulesForStage(rules, 'placement')).toBe(threeSets);
    expect(rulesForStage({ ...rules, finalsMatch: null }, 'knockout')).toBe(rules.match);
  });
});

describe('default set rules by game type', () => {
  it.each([
    ['indoor_6v6', 2, 25, true],
    ['indoor_4v4', 2, 21, true],
    ['indoor_3v3', 1, 21, false],
    ['beach_2v2', 2, 21, true],
  ] as const)('%s → %i sets of %i', (type, setsToWin, points, tieBreak) => {
    expect(defaultSetRules(type)).toEqual({ setsToWin, pointsPerSet: points, pointsLastSet: 15, winMargin: 2, tieBreak });
  });
});
