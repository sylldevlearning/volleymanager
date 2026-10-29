import i18n from 'i18next';
import fr from '../src/i18n/fr.json';
import { LEVEL_COLORS, levelsSummary, phaseStatuses, roundJustCompleted, roundSummary } from '../src/features/tournament/phases';
import { recordResult } from '../src/features/tournament/engine/cascade';
import type { EngineMatch } from '../src/features/tournament/engine/types';
import type { SetScore } from '../src/models/tournament';
import { build, bundleFrom, playAll, type Built } from './helpers/tournamentFixtures';

const tr = i18n.createInstance();
beforeAll(async () => {
  await tr.init({ lng: 'fr', resources: { fr: { translation: fr } } });
});
const t = (key: string, opts?: Record<string, unknown>) => tr.t(key, opts) as string;

const WIN: SetScore[] = [[25, 10], [25, 10]];
const LOSS: SetScore[] = [[10, 25], [10, 25]];

/** Plays the matches of mixing rounds; the lower team id wins. */
function playRounds(built: Built, rounds: number[], matches: EngineMatch[] = built.matches): EngineMatch[] {
  let current = matches;
  for (const r of rounds) {
    for (const m of current.filter((x) => x.phase === r && x.status !== 'validated')) {
      const now = current.find((x) => x.key === m.key)!;
      const o = recordResult(built.ctx, current, m.key, { sets: now.homeId! < now.awayId! ? WIN : LOSS, forfeitId: null });
      if (!o.ok) throw new Error(JSON.stringify(o));
      current = o.matches;
    }
  }
  return current;
}

describe('phase statuses', () => {
  it('Brassage + niveaux: rounds then levels, done / in progress / to come', () => {
    const built = build('brassage_levels', 16); // 2 rounds, 2 levels
    const statuses = (m: EngineMatch[]) => phaseStatuses(bundleFrom(built, m), t).map((p) => [p.label, p.status]);
    expect(statuses(built.matches)).toEqual([
      ['Tour 1', 'live'], ['Tour 2', 'upcoming'], ['Principale', 'upcoming'], ['Consolante', 'upcoming'],
    ]);
    const afterRound1 = playRounds(built, [1]);
    expect(statuses(afterRound1)).toEqual([
      ['Tour 1', 'done'], ['Tour 2', 'live'], ['Principale', 'upcoming'], ['Consolante', 'upcoming'],
    ]);
    expect(statuses(playAll(built))).toEqual([
      ['Tour 1', 'done'], ['Tour 2', 'done'], ['Principale', 'done'], ['Consolante', 'done'],
    ]);
  });

  it('pools + finals and championship', () => {
    expect(phaseStatuses(bundleFrom(build('pools_knockout', 8)), t).map((p) => [p.label, p.status]))
      .toEqual([['Poules', 'live'], ['Tableau final', 'upcoming']]);
    expect(phaseStatuses(bundleFrom(build('round_robin', 4)), t).map((p) => [p.label, p.status]))
      .toEqual([['Championnat', 'live']]);
  });

  it('a phase starts as soon as one of its results is in', () => {
    const built = build('pools_knockout', 8);
    const first = built.matches.find((m) => m.stage === 'pool')!;
    const o = recordResult(built.ctx, built.matches, first.key, { sets: WIN, forfeitId: null });
    if (!o.ok) throw new Error();
    expect(phaseStatuses(bundleFrom(built, o.matches), t)[0]).toMatchObject({ status: 'live', done: 1, total: 12 });
  });

  it('round and level screens are linked from their phase', () => {
    const phases = phaseStatuses(bundleFrom(build('brassage_levels', 16)), t);
    expect(phases.map((p) => p.screen)).toEqual([
      { kind: 'round', round: 1 }, { kind: 'round', round: 2 }, { kind: 'levels' }, { kind: 'levels' },
    ]);
  });
});

describe('"Tour N terminé"', () => {
  it('ranking of the round, then the pools of the next round', () => {
    const built = build('brassage_levels', 16);
    expect(roundSummary(bundleFrom(built), 1, t)).toMatchObject({ complete: false, ranking: [], next: null });

    const played = playRounds(built, [1]);
    const summary = roundSummary(bundleFrom(built, played), 1, t)!;
    expect(summary.complete).toBe(true);
    expect(summary.ranking.map((r) => r.rank)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(summary.ranking[0]).toMatchObject({ pool: expect.stringMatching(/^Poule [A-D]$/) });
    expect(summary.next).toMatchObject({ kind: 'round', round: 2 });
    if (summary.next?.kind !== 'round') throw new Error();
    expect(summary.next.pools.map((p) => p.title)).toEqual(['Poule A', 'Poule B', 'Poule C', 'Poule D']);
    // Same level together: the 4 best of round 1 in pool A
    expect(summary.next.pools[0].teams).toEqual(summary.ranking.slice(0, 4).map((r) => r.name));
  });

  it('after the last round, the next step is the levels', () => {
    const built = build('brassage_levels', 16);
    const summary = roundSummary(bundleFrom(built, playRounds(built, [1, 2])), 2, t)!;
    expect(summary.next).toMatchObject({ kind: 'levels' });
  });

  it('is shown right when the last match of a round is validated', () => {
    const built = build('brassage_levels', 16);
    const round1 = built.matches.filter((m) => m.phase === 1);
    const allButLast = playRounds(built, [1], built.matches).map((m) => (m.key === round1[round1.length - 1].key
      ? { ...m, status: 'scheduled' as const, sets: null, winnerId: null } : m));
    const before = bundleFrom(built, allButLast);
    const after = bundleFrom(built, playRounds(built, [1], allButLast));
    expect(roundJustCompleted(before, after, round1[round1.length - 1].key)).toBe(1);
    expect(roundJustCompleted(after, after, round1[0].key)).toBeNull();
  });
});

describe('"Répartition des niveaux"', () => {
  it('levels with their colour and teams, once the mixing is over', () => {
    const built = build('brassage_levels', 24); // 2 rounds, 3 levels of 8
    expect(levelsSummary(bundleFrom(built), t)).toBeNull();
    const summary = levelsSummary(bundleFrom(built, playRounds(built, [1, 2])), t)!;
    expect(summary.map((l) => [l.name, l.color, l.teams.length])).toEqual([
      ['Principale', LEVEL_COLORS[0], 8], ['Consolante', LEVEL_COLORS[1], 8], ['Super-consolante', LEVEL_COLORS[2], 8],
    ]);
    expect(LEVEL_COLORS.slice(0, 3)).toEqual(['#D4AF37', '#C0C0C0', '#CD7F32']);
  });

  it('follows a corrected result', () => {
    const built = build('brassage_levels', 16);
    const played = playRounds(built, [1, 2]);
    const before = levelsSummary(bundleFrom(built, played), t)!;
    // Turn around the round-2 match between the 1st and 2nd places of pool A:
    // the order inside the Principale changes
    const round2 = played.filter((m) => m.phase === 2);
    const pools = [...new Set(round2.map((m) => m.pool!))].sort((a, b) => a - b);
    const border = round2.find((m) => m.pool === pools[0]
      && [m.homeRef, m.awayRef].every((r) => r.type === 'seat' && r.seat <= 1))!;
    const o = recordResult(built.ctx, played, border.key, { sets: border.winnerId === border.homeId ? LOSS : WIN, forfeitId: null });
    if (!o.ok) throw new Error(JSON.stringify(o));
    const after = levelsSummary(bundleFrom(built, o.matches), t)!;
    expect(after).not.toEqual(before);
    expect(after[0].teams).toHaveLength(8);
  });

  it('is only for "Brassage + niveaux"', () => {
    const built = build('pools_knockout', 8);
    expect(levelsSummary(bundleFrom(built, playAll(built)), t)).toBeNull();
  });
});
