import { HELP_TIPS, tipTextKey, placeBubble } from '../src/features/onboarding/helpTips';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';

type Dict = Record<string, unknown>;

function lookup(dict: Dict, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node as Dict | undefined)?.[part], dict);
}

describe('HELP_TIPS', () => {
  it('covers the arbitrage screen, the tactical board and the tournament screen', () => {
    expect(Object.keys(HELP_TIPS).sort()).toEqual(['arbitrage', 'tactical', 'tournament']);
    expect(HELP_TIPS.tournament).toEqual(['tabs', 'phases', 'matches', 'menu']);
    expect(HELP_TIPS.arbitrage).toHaveLength(4);
    expect(HELP_TIPS.tactical).toHaveLength(4);
  });

  it.each(['fr', 'en'] as const)('every bubble text exists in %s', (lang) => {
    const dict = (lang === 'fr' ? fr : en) as Dict;
    for (const id of ['arbitrage', 'tactical', 'tournament'] as const) {
      for (const step of HELP_TIPS[id]) {
        expect(typeof lookup(dict, tipTextKey(id, step))).toBe('string');
      }
    }
    for (const key of ['tips.next', 'tips.done']) {
      expect(typeof lookup(dict, key)).toBe('string');
    }
  });
});

describe('placeBubble', () => {
  const screen = { width: 360, height: 800 };

  it('goes below a target in the top half', () => {
    const b = placeBubble({ x: 20, y: 100, width: 100, height: 50 }, screen, 120);
    expect(b.placement).toBe('below');
    expect(b.top).toBeGreaterThanOrEqual(150);
  });

  it('goes above a target near the bottom', () => {
    const b = placeBubble({ x: 20, y: 700, width: 100, height: 50 }, screen, 120);
    expect(b.placement).toBe('above');
    expect(b.top + 120).toBeLessThanOrEqual(700);
  });

  it('keeps a 16px gutter and never exceeds the screen width', () => {
    const b = placeBubble({ x: 340, y: 100, width: 20, height: 20 }, screen, 120);
    expect(b.left).toBeGreaterThanOrEqual(16);
    expect(b.left + b.width).toBeLessThanOrEqual(screen.width - 16);
  });

  it('is centred when there is no target', () => {
    const b = placeBubble(null, screen, 120);
    expect(b.placement).toBe('center');
    expect(b.top).toBe((800 - 120) / 2);
  });

  it('is centred when the target fills the screen (no room above or below)', () => {
    const b = placeBubble({ x: 0, y: 40, width: 360, height: 720 }, screen, 120);
    expect(b.placement).toBe('center');
  });
});
