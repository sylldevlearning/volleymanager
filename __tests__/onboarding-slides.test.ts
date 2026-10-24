import { ONBOARDING_SLIDES } from '../src/features/onboarding/slides';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';

type Dict = Record<string, unknown>;

function lookup(dict: Dict, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node as Dict | undefined)?.[part], dict);
}

describe('ONBOARDING_SLIDES', () => {
  it('has at most 4 pages, in the agreed order', () => {
    expect(ONBOARDING_SLIDES.map((s) => s.id)).toEqual(['quickMatch', 'arbitrage', 'tactical', 'teams']);
  });

  it.each(['fr', 'en'] as const)('every slide text exists in %s', (lang) => {
    const dict = (lang === 'fr' ? fr : en) as Dict;
    for (const slide of ONBOARDING_SLIDES) {
      expect(typeof lookup(dict, slide.titleKey)).toBe('string');
      expect(typeof lookup(dict, slide.bodyKey)).toBe('string');
    }
    for (const key of ['onboarding.skip', 'onboarding.next', 'onboarding.start']) {
      expect(typeof lookup(dict, key)).toBe('string');
    }
  });

  it('page 2 mentions the official rules', () => {
    expect(lookup(fr as Dict, ONBOARDING_SLIDES[1].bodyKey)).toContain('selon les règles officielles');
  });
});
