import fs from 'fs';
import path from 'path';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';
import i18n from 'i18next';

const ROOT = path.join(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

type Dict = Record<string, unknown>;
const apply = (lang: Dict) => ((lang.tactical as Dict).apply as Dict);

describe('"Appliquer au match" — texts', () => {
  const keys = [
    'button', 'title', 'subLine', 'liberoTag', 'lineupTitle', 'zone', 'confirm', 'later', 'now',
    'askOnClose', 'nothingTitle', 'nothingInSet', 'nothingSetOver', 'nothingLineup', 'refusedHint', 'failed',
  ];

  it.each([['fr', fr], ['en', en]] as const)('has every text in %s', (_lang, dict) => {
    for (const key of keys) expect(typeof apply(dict as Dict)[key]).toBe('string');
    const errors = apply(dict as Dict).lineupErrors as Dict;
    for (const code of ['lineup_count', 'lineup_same_zone', 'lineup_libero']) expect(typeof errors[code]).toBe('string');
  });

  it('words the recap like the coach: "7 entre à la place de 12"', async () => {
    const t = i18n.createInstance();
    await t.init({ lng: 'fr', resources: { fr: { translation: fr } } });
    expect(t.t('tactical.apply.subLine', { in: 7, out: 12 })).toBe('7 entre à la place de 12');
    expect(t.t('tactical.apply.askOnClose')).toBe('Appliquer ces changements au match ?');
    expect(t.t('tactical.apply.now')).toBe('Maintenant');
    expect(t.t('tactical.apply.later')).toBe('Plus tard');
  });

  it('explains the match board in its "?" help', () => {
    for (const dict of [fr, en]) expect(typeof (dict.help as Dict).tacticalMatch).toBe('string');
    expect(read('src/components/tactical/TacticalBoard.tsx')).toContain('textKey="help.tacticalMatch"');
  });
});

describe('"Appliquer au match" — wiring', () => {
  const board = read('src/components/tactical/TacticalBoard.tsx');

  it('shows the button from a match only', () => {
    expect(board).toMatch(/onApplyToMatch=\{canApply \? handleApplyPress : undefined\}/);
  });

  it('asks before leaving the board with changes', () => {
    expect(board).toContain("t('tactical.apply.askOnClose')");
  });

  it('records real substitutions and lineups through the shared match services', () => {
    expect(board).toContain('recordSubstitution(');
    expect(board).toContain('applyBoardLineup(');
  });
});
