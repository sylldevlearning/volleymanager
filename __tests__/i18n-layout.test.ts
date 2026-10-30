import fs from 'fs';
import path from 'path';
import { LANGUAGES } from '../src/i18n/languages';

type Dict = { [key: string]: string | Dict };
const load = (code: string): Dict => JSON.parse(fs.readFileSync(path.join(__dirname, `../src/i18n/${code}.json`), 'utf8'));
const lookup = (dict: Dict, key: string): string =>
  key.split('.').reduce<unknown>((node, part) => (node as Dict)[part], dict) as string;

/** Display width in Latin characters: Japanese and Chinese characters are about twice as wide */
const width = (text: string) => [...text].reduce((w, c) => w + ((c.codePointAt(0) ?? 0) >= 0x2e80 ? 2 : 1), 0);

/**
 * Labels in tight places (buttons sharing a row, tabs, table headers), with the
 * room they have. German and the other long languages must fit too.
 */
const TIGHT: Record<string, number> = {
  // Arbitrage: 4 buttons per row (Remplacement ×2, Temps mort ×2, Carton ×2), then the action bar
  'match.substitution': 14,
  'arbitrage.timeoutButton': 12,
  'sanction.button': 10,
  'arbitrage.actionMenu': 12,
  'arbitrage.actionRecap': 12,
  'arbitrage.actionEnd': 12,
  // Referee: who scored — buttons side by side
  'referee.attribution.ace': 16,
  'referee.attribution.attack': 16,
  'referee.attribution.block': 16,
  'referee.attribution.serveFault': 16,
  'referee.attribution.attackFault': 16,
  'referee.attribution.blockFault': 16,
  'referee.attribution.defenseFault': 16,
  // Tactical board toolbar (small text under an icon)
  'tactical.syncFromMatch': 20,
  'tactical.apply.button': 20,
  // Bottom tabs, tournament tabs
  'tabs.home': 13,
  'tabs.matches': 13,
  'tabs.teams': 13,
  'tabs.settings': 13,
  'tournament.view.tabPlanning': 13,
  'tournament.view.tabMatches': 13,
  'tournament.view.tabStandings': 13,
  // Match row status, "Terminé" badge
  'tournament.view.statusScheduled': 14,
  'tournament.view.statusLive': 14,
  'tournament.view.waiting': 14,
  'tournament.finished.badge': 12,
  // Standings table headers (narrow columns)
  'tournament.view.colPlayed': 3,
  'tournament.view.colWon': 3,
  'tournament.view.colLost': 3,
  'tournament.view.colPoints': 4,
  'tournament.view.colSets': 6,
  'tournament.view.colDiff': 6,
};

describe('long languages do not overflow the buttons', () => {
  it.each(LANGUAGES.map((l) => l.code))('%s: labels in tight places fit', (code) => {
    const dict = load(code);
    const tooLong = Object.entries(TIGHT)
      .map(([key, max]) => ({ key, text: lookup(dict, key), max }))
      .filter(({ text, max }) => width(text) > max)
      .map(({ key, text, max }) => `${key}: "${text}" (${width(text)} > ${max})`);
    expect(tooLong).toEqual([]);
  });

  it('and if a phone font is bigger, those buttons stay on one line and shrink', () => {
    const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
    const FIT = 'numberOfLines={1} adjustsFontSizeToFit';
    expect(read('app/match/[id]/arbitrage.tsx').split(FIT).length - 1).toBeGreaterThanOrEqual(5);
    expect(read('src/components/tactical/ToolBar.tsx').split(FIT).length - 1).toBe(2);
    expect(read('app/match/[id]/referee.tsx')).toContain(FIT);
    expect(read('src/components/tournament/MatchRow.tsx')).toContain(FIT);
    expect(read('src/components/tournament/StandingsTableView.tsx')).toContain(FIT);
  });
});
