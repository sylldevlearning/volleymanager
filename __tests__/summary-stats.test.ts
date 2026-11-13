/**
 * Match summary (1.2.5): success rates instead of efficiency, team totals with
 * an overlaid radar and the points breakdown, players grouped by team and
 * sorted by points, radar labels never cut (11 languages, 360 dp screen).
 */
import fs from 'fs';
import path from 'path';
import type { PlayerStats } from '../src/models/stats';
import {
  pointBreakdown, playersByTeam, radarValues, successRates, sumStats, SUMMARY_RADAR,
} from '../src/features/match/summaryStats';
import { estimateTextWidth, radarLayout } from '../src/components/stats/radarLayout';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LANGS = ['fr', 'en', 'es', 'pt-BR', 'it', 'de', 'pl', 'tr', 'ru', 'ja', 'zh-Hans'];

function ps(playerId: string, s: Partial<PlayerStats> = {}): PlayerStats {
  return {
    playerId, matchId: 'm',
    serveAce: 0, serveFault: 0, serveIn: 0, attackKill: 0, attackFault: 0, attackDefended: 0,
    blockKill: 0, blockTouch: 0, blockFault: 0, receptionA: 0, receptionB: 0, receptionC: 0, receptionD: 0,
    defenseSuccess: 0, defenseFault: 0, setPerfect: 0, setGood: 0, setBad: 0, ...s,
  };
}

describe('success rates', () => {
  it('never negative, even with more faults than points', () => {
    const r = successRates(ps('p', { serveFault: 5, serveIn: 1, attackKill: 1, attackFault: 4, receptionD: 3 }));
    expect(r).toEqual({ serve: 17, attack: 20, reception: 0 });
  });

  it('serve = serves without a fault, attack = winning attacks, reception = A + B', () => {
    const r = successRates(ps('p', {
      serveAce: 2, serveIn: 6, serveFault: 2, attackKill: 3, attackDefended: 1,
      receptionA: 2, receptionB: 1, receptionC: 1,
    }));
    expect(r).toEqual({ serve: 80, attack: 75, reception: 75 });
  });

  it('0 when nothing was recorded', () => {
    expect(successRates(ps('p'))).toEqual({ serve: 0, attack: 0, reception: 0 });
  });
});

describe('team stats', () => {
  it('sums every player', () => {
    const total = sumStats([ps('a', { attackKill: 2, blockKill: 1 }), ps('b', { attackKill: 3, serveAce: 1 })]);
    expect(total).toMatchObject({ attackKill: 5, blockKill: 1, serveAce: 1 });
  });

  it('radar on the players axes: serve, attack, block, reception, defense', () => {
    const total = sumStats([ps('a', { serveAce: 1, serveIn: 3, attackKill: 1, attackFault: 1, blockKill: 1, blockTouch: 1, receptionA: 1, receptionC: 1, defenseSuccess: 3, defenseFault: 1 })]);
    expect(radarValues(total)).toEqual([25, 50, 50, 50, 75]);
  });

  it('points breakdown: attack, block, ace, opponent faults, in number and percent', () => {
    const own = ps('h', { attackKill: 12, blockKill: 4, serveAce: 2 });
    const opp = ps('a', { serveFault: 3, attackFault: 2, receptionD: 1, blockFault: 1, defenseFault: 0 });
    const b = pointBreakdown(25, own, opp);
    expect(b.total).toBe(25);
    expect(b.rows).toEqual([
      { kind: 'attack', count: 12, percent: 48 },
      { kind: 'block', count: 4, percent: 16 },
      { kind: 'ace', count: 2, percent: 8 },
      { kind: 'opponentFault', count: 7, percent: 28 },
    ]);
  });

  it('points nobody detailed are shown apart', () => {
    const b = pointBreakdown(20, ps('h', { attackKill: 5 }), ps('a'));
    expect(b.rows.find((r) => r.kind === 'unspecified')).toEqual({ kind: 'unspecified', count: 15, percent: 75 });
  });
});

describe('players by team', () => {
  const home = [{ id: 'h1', number: 1 }, { id: 'h2', number: 2 }, { id: 'h3', number: 3 }, { id: 'h4', number: 4 }];
  const away = [{ id: 'a1', number: 7 }, { id: 'a2', number: 9 }];

  it('home first, then away, each sorted by points scored; players without stats left out', () => {
    const groups = playersByTeam([
      ps('a1', { attackKill: 1 }),
      ps('h1', { attackKill: 1 }),
      ps('h2', { attackKill: 3, serveAce: 2 }),
      ps('h3', { blockKill: 1 }),
      ps('a2', { attackKill: 4 }),
      ps('h4'),
    ], home, away);
    expect(groups.map((g) => [g.side, g.players.map((p) => p.player.id)])).toEqual([
      ['home', ['h2', 'h1', 'h3']],
      ['away', ['a2', 'a1']],
    ]);
  });

  it('nothing when no stat was recorded', () => {
    expect(playersByTeam([ps('h1')], home, away)).toEqual([]);
  });
});

describe('radar labels', () => {
  it('a wide label is measured wider than a short one, CJK as full width', () => {
    expect(estimateTextWidth('Réception', 11)).toBeGreaterThan(estimateTextWidth('Block', 11));
    expect(estimateTextWidth('一传', 11)).toBe(22);
  });

  it('fits a 360 dp screen', () => {
    // 360 − 2 × 20 (screen padding) = 320 for a section; 14 of padding each side
    expect(SUMMARY_RADAR.width).toBeLessThanOrEqual(360 - 40 - 28);
  });

  it.each(LANGS)('%s: every label whole inside the drawing, with a readable radar', (lang) => {
    const s = JSON.parse(read(`src/i18n/${lang}.json`)).stats;
    const labels = [s.serve, s.attack, s.block, s.reception, s.defense];
    const { r, labels: placed } = radarLayout(labels, SUMMARY_RADAR.width, SUMMARY_RADAR.height, 11);
    for (const { box } of placed) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(SUMMARY_RADAR.width);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(SUMMARY_RADAR.height);
    }
    expect(r).toBeGreaterThanOrEqual(55);
  });

  it('the chart places its labels with the layout (no fixed radius that cuts them)', () => {
    const src = read('src/components/stats/RadarChart.tsx');
    expect(src).toMatch(/radarLayout\(/);
    expect(src).not.toMatch(/size \/ 2 - 28/);
  });
});

describe('summary screen', () => {
  const src = read('app/match/[id]/summary.tsx');

  it('team stats before player stats', () => {
    expect(src.indexOf("t('summary.teamStats')")).toBeGreaterThan(-1);
    expect(src.indexOf("t('summary.teamStats')")).toBeLessThan(src.indexOf("t('summary.playerStats')"));
    expect(src).not.toMatch(/t\('player\.position'\)/);
  });

  it('two radars overlaid in the team colours, and the points breakdown', () => {
    expect(src).toMatch(/series=\{\[\{ values: homeRadar, color: homeColor \}, \{ values: awayRadar, color: awayColor \}\]\}/);
    expect(src).toMatch(/pointBreakdown\(homePoints/);
    expect(src).toMatch(/t\('summary\.noTeamStats'\)/);
  });

  it('success rates, not efficiency', () => {
    expect(src).toMatch(/successRates\(/);
    expect(src).not.toMatch(/Efficiency\(/);
    expect(src).toMatch(/t\('summary\.successRates'\)/);
  });

  it('players grouped by team', () => {
    expect(src).toMatch(/playersByTeam\(/);
  });
});

describe('texts in the 11 languages', () => {
  const KEYS = [
    'summary.teamStats', 'summary.playerStats', 'summary.pointsBreakdown', 'summary.successRates', 'summary.noTeamStats',
    'stats.pointTypes.attack', 'stats.pointTypes.block', 'stats.pointTypes.ace', 'stats.pointTypes.opponentFault',
    'stats.pointTypes.unspecified', 'stats.total',
  ];
  const en = JSON.parse(read('src/i18n/en.json'));
  const get = (json: Record<string, unknown>, key: string) =>
    key.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], json);

  it.each(LANGS)('%s', (lang) => {
    const json = JSON.parse(read(`src/i18n/${lang}.json`));
    for (const key of KEYS) expect(typeof get(json, key)).toBe('string');
    if (lang !== 'en') {
      for (const key of ['summary.teamStats', 'summary.playerStats', 'summary.successRates']) {
        expect(get(json, key)).not.toBe(get(en, key));
      }
    }
  });

  it('French names', () => {
    const fr = JSON.parse(read('src/i18n/fr.json'));
    expect(fr.summary.playerStats).toBe('Statistiques par joueur');
    expect(fr.summary.teamStats).toBe('Statistiques par équipe');
  });

  it.each(LANGS)('%s: the « ? » of the detailed stats explains the efficiency', (lang) => {
    const help: string = JSON.parse(read(`src/i18n/${lang}.json`)).help.stats;
    expect(help).toMatch(/−/);
    expect(help).toMatch(/÷/);
  });
});
