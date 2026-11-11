import fs from 'fs';
import path from 'path';
import { LANGUAGES } from '../src/i18n/languages';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('tactical board: the slate icon asks before clearing', () => {
  const board = read('src/components/tactical/TacticalBoard.tsx');

  it('the header button opens a confirmation, not the reset itself', () => {
    expect(board).not.toContain('onPress={handleNewBoard}');
    expect(board).toContain('onPress={confirmNewBoard}');
  });

  it('Cancel / Clear (destructive), clearing only on confirmation', () => {
    const start = board.indexOf('function confirmNewBoard');
    const body = board.slice(start, board.indexOf('\n  }\n', start));
    expect(body).toContain("t('tactical.newBoardConfirm.title')");
    expect(body).toContain("t('tactical.newBoardConfirm.message')");
    expect(body).toContain("t('common.cancel')");
    expect(body).toContain("style: 'destructive'");
    expect(body).toContain("t('tactical.newBoardConfirm.action')");
    expect(body).toContain('onPress: handleNewBoard');
  });

  it('French wording as asked', () => {
    const fr = JSON.parse(read('src/i18n/fr.json'));
    expect(fr.tactical.newBoardConfirm).toEqual({
      title: 'Tout effacer ?',
      message: 'Les combinaisons prévues seront perdues.',
      action: 'Effacer',
    });
  });

  it.each(LANGUAGES.map((l) => l.code))('%s has the three texts', (code) => {
    const dict = JSON.parse(read(`src/i18n/${code}.json`));
    for (const key of ['title', 'message', 'action']) {
      expect(typeof dict.tactical.newBoardConfirm[key]).toBe('string');
    }
  });
});

describe('tactical board: "Tout effacer" in the ⋮ menu asks too', () => {
  const board = read('src/components/tactical/TacticalBoard.tsx');

  it('the menu item opens a confirmation instead of clearing at once', () => {
    expect(board).not.toContain('onPress={() => { setShowMenu(false); clearArrows(); handleReset(); }}');
    expect(board).toContain('onPress={() => { setShowMenu(false); confirmClearDrawings(); }}');
  });

  it('same action as the toolbar (drawings only): its title, Cancel / Clear', () => {
    const start = board.indexOf('function confirmClearDrawings');
    const body = board.slice(start, board.indexOf('\n  }\n', start));
    expect(body).toContain("t('tactical.clearConfirm')");
    expect(body).toContain("t('tactical.newBoardConfirm.message')");
    expect(body).toContain("t('common.cancel')");
    expect(body).toContain("style: 'destructive'");
    expect(body).toContain("t('tactical.newBoardConfirm.action')");
    expect(body).toMatch(/clearArrows\(\);\s*handleReset\(\);/);
  });
});
