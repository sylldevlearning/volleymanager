import i18n from 'i18next';
import fr from '../src/i18n/fr.json';
import {
  bracketRounds,
  matchGroups,
  matchTitle,
  ordinal,
  rankingRows,
  scoreErrorText,
  scoreText,
  sideName,
  slotGroups,
  standingsTables,
} from '../src/features/tournament/display';
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
const byLabel = (matches: { label: string | null }[], label: string) => matches.find((m) => m.label === label)!;

function play(built: Built, keys: string[], matches: EngineMatch[] = built.matches): EngineMatch[] {
  let current = matches;
  for (const key of keys) {
    const o = recordResult(built.ctx, current, key, { sets: WIN, forfeitId: null });
    if (!o.ok) throw new Error(JSON.stringify(o));
    current = o.matches;
  }
  return current;
}

describe('ordinals', () => {
  it('French and English', () => {
    expect([1, 2, 3, 11].map((n) => ordinal(n, 'fr'))).toEqual(['1er', '2e', '3e', '11e']);
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map((n) => ordinal(n, 'en'))).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
    expect(['es', 'pt-BR', 'it', 'de', 'pl', 'tr', 'ru', 'ja', 'zh-Hans'].map((l) => ordinal(2, l)))
      .toEqual(['2.º', '2º', '2º', '2.', '2.', '2.', '2-е', '2位', '第2名']);
  });
});

describe('match titles', () => {
  it('pools and matchdays', () => {
    const bundle = bundleFrom(build('pools_knockout', 8));
    const m = bundle.matches.find((x) => x.stage === 'pool' && x.poolId === 'p1' && x.round === 2)!;
    expect(matchTitle(m, bundle, t)).toBe('Poule B · J2');
  });

  it('bracket rounds, 3rd place', () => {
    const bundle = bundleFrom(build('knockout', 16));
    expect(matchTitle(byLabel(bundle.matches, 'ko:2:1') as never, bundle, t)).toBe('Finale');
    expect(matchTitle(byLabel(bundle.matches, 'ko:4:2') as never, bundle, t)).toBe('Demi-finale 2');
    expect(matchTitle(byLabel(bundle.matches, 'ko:8:3') as never, bundle, t)).toBe('Quart de finale 3');
    expect(matchTitle(byLabel(bundle.matches, 'ko:16:5') as never, bundle, t)).toBe('8e de finale 5');
    expect(matchTitle(byLabel(bundle.matches, 'third') as never, bundle, t)).toBe('Match pour la 3e place');
  });

  it('Brassage + niveaux: rounds, levels and places', () => {
    const bundle = bundleFrom(build('brassage_levels', 16));
    const r2 = bundle.matches.find((m) => m.phase === 2 && m.round === 1)!;
    expect(matchTitle(r2, bundle, t)).toMatch(/^Tour 2 · Poule [A-D] · J1$/);
    const r1 = bundle.matches.find((m) => m.phase === 1)!;
    expect(matchTitle(r1, bundle, t)).toMatch(/^Tour 1 · Poule [A-D] · J1$/);
    // Levels of 8: brackets where every place is played
    expect(matchTitle(byLabel(bundle.matches.filter((m) => m.level === 0), 'place:1-2:1') as never, bundle, t)).toBe('Principale · Finale');
    expect(matchTitle(byLabel(bundle.matches.filter((m) => m.level === 1), 'place:5-6:1') as never, bundle, t)).toBe('Consolante · Match pour la 5e place');
    expect(matchTitle(byLabel(bundle.matches.filter((m) => m.level === 0), 'place:5-8:2') as never, bundle, t)).toBe('Principale · Places 5 à 8 · match 2');
  });

  it('a level with one pool is named after the level only', () => {
    const bundle = bundleFrom(build('brassage_levels', 8)); // levels of 4 → one pool each
    const m = bundle.matches.find((x) => x.level === 1 && x.round === 1)!;
    expect(matchTitle(m, bundle, t)).toBe('Consolante · J1');
  });
});

describe('team names, known or not yet', () => {
  it('the team name when known', () => {
    const bundle = bundleFrom(build('round_robin', 4));
    const m = bundle.matches[0];
    expect(sideName(m, 'home', bundle, t, 'fr')).toBe(bundle.teams.find((x) => x.id === m.homeId)!.name);
  });

  it('where it comes from otherwise', () => {
    const pools = bundleFrom(build('pools_knockout', 8));
    const semi = byLabel(pools.matches, 'ko:4:1') as never;
    expect(sideName(semi, 'home', pools, t, 'fr')).toBe('1er Poule A');
    expect(sideName(semi, 'away', pools, t, 'fr')).toBe('2e Poule B');
    expect(sideName(byLabel(pools.matches, 'ko:2:1') as never, 'home', pools, t, 'fr')).toBe('Vainqueur Demi-finale 1');
    expect(sideName(byLabel(pools.matches, 'third') as never, 'away', pools, t, 'fr')).toBe('Perdant Demi-finale 2');

    const thirds = bundleFrom(build('pools_knockout', 12));
    const withBest = thirds.matches.find((m) => m.awaySource.type === 'bestOf')!;
    expect(sideName(withBest, 'away', thirds, t, 'fr')).toMatch(/^Meilleur 3e n°[12]$/);

    const brassage = bundleFrom(build('brassage_levels', 16));
    const seat = brassage.matches.find((m) => m.phase === 2)!;
    expect(sideName(seat, 'home', brassage, t, 'fr')).toBe('Selon le tour 1');
    const level = brassage.matches.find((m) => m.homeSource.type === 'levelRank')!;
    expect(sideName(level, 'home', brassage, t, 'fr')).toMatch(/^Principale n°\d+$|^Consolante n°\d+$/);
  });
});

describe('planning', () => {
  it('matches grouped by time slot, by court', () => {
    const bundle = bundleFrom(build('pools_knockout', 8, { courts: 2 }));
    const groups = slotGroups(bundle.matches);
    expect(groups[0]).toMatchObject({ slot: 0, time: '09:00' });
    expect(groups[1]).toMatchObject({ slot: 1, time: '09:45' });
    for (const g of groups) {
      expect(g.matches.map((m) => m.court)).toEqual([...g.matches.map((m) => m.court!)].sort((a, b) => a - b));
    }
    expect(groups.flatMap((g) => g.matches)).toHaveLength(bundle.matches.length);
  });

  it('phase filters', () => {
    expect(matchGroups(bundleFrom(build('pools_knockout', 8)), t).map((g) => g.label)).toEqual(['Poule A', 'Poule B', 'Tableau final']);
    expect(matchGroups(bundleFrom(build('round_robin', 4)), t).map((g) => g.label)).toEqual(['Championnat']);
    expect(matchGroups(bundleFrom(build('brassage_levels', 16)), t).map((g) => g.label)).toEqual(['Tour 1', 'Tour 2', 'Principale', 'Consolante']);
  });
});

describe('scores', () => {
  it('sets won, then the set scores', () => {
    expect(scoreText({ sets: [[25, 20], [20, 25], [15, 12]], forfeitId: null, homeId: 'a', awayId: 'b' }, t)).toBe('2-1 · 25-20, 20-25, 15-12');
    expect(scoreText({ sets: null, forfeitId: null, homeId: 'a', awayId: 'b' }, t)).toBeNull();
    expect(scoreText({ sets: [[0, 25], [0, 25]], forfeitId: 'a', homeId: 'a', awayId: 'b' }, t)).toBe('0-2 · forfait');
  });

  it('errors in words, with the rules of the match', () => {
    const rules = { setsToWin: 2, pointsPerSet: 25, pointsLastSet: 15, winMargin: 2, tieBreak: true };
    expect(scoreErrorText({ code: 'set_not_finished', set: 3 }, rules, t)).toBe('Set 3 : pas encore gagné (15 points et 2 points d\'écart).');
    expect(scoreErrorText({ code: 'set_overshoot', set: 1 }, rules, t)).toBe('Set 1 : au-delà de 25 points, le set s\'arrête dès 2 points d\'écart.');
    expect(scoreErrorText({ code: 'match_not_finished' }, rules, t)).toBe('Match pas terminé : il faut 2 sets gagnants.');
    expect(scoreErrorText({ code: 'extra_set', set: 3 }, rules, t)).toBe('Set 3 : le match était déjà gagné.');
    expect(scoreErrorText({ code: 'invalid_points', set: 2 }, rules, t)).toBe('Set 2 : score invalide.');
  });
});

describe('standings', () => {
  it('a table per pool, with names, complete or not', () => {
    const built = build('pools_knockout', 8);
    const poolA = built.matches.filter((m) => m.stage === 'pool' && m.pool === 0).map((m) => m.key);
    const bundle = bundleFrom(built, play(built, poolA));
    const tables = standingsTables(bundle, t);
    expect(tables.map((x) => [x.title, x.complete])).toEqual([['Poule A', true], ['Poule B', false]]);
    expect(tables[0].rows).toHaveLength(4);
    expect(tables[0].rows[0]).toMatchObject({ rank: 1, played: 3 });
    // 6 matches in a pool of 4: 6 wins in all, 1 point each
    expect(tables[0].rows.reduce((sum, r) => sum + r.won, 0)).toBe(6);
    expect(tables[0].rows.reduce((sum, r) => sum + r.points, 0)).toBe(6);
    expect(tables[0].rows[0].name).toMatch(/^Équipe \d$/);
  });

  it('Brassage: tables of round 1 now, later ones once their teams are known', () => {
    const built = build('brassage_levels', 16);
    const tables = standingsTables(bundleFrom(built), t);
    expect(tables.map((x) => x.title)).toEqual(['Tour 1 · Poule A', 'Tour 1 · Poule B', 'Tour 1 · Poule C', 'Tour 1 · Poule D']);
    const played = playAll(built);
    const all = standingsTables(bundleFrom(built, played), t).map((x) => x.title);
    expect(all).toEqual(expect.arrayContaining(['Tour 2 · Poule A', 'Tour 2 · Poule D']));
  });

  it('bracket rounds, in order', () => {
    const bundle = bundleFrom(build('knockout', 8));
    expect(bracketRounds(bundle, t).map((r) => [r.title, r.matches.length])).toEqual([
      ['Quarts de finale', 4], ['Demi-finales', 2], ['Finales', 2],
    ]);
  });

  it('final ranking with names, once decided', () => {
    const built = build('knockout', 4);
    expect(rankingRows(bundleFrom(built))).toEqual([]);
    const rows = rankingRows(bundleFrom(built, playAll(built)));
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(rows[0].name).toMatch(/^Équipe \d$/);
  });
});
