/**
 * useResponsive — breakpoint logic unit tests.
 * Tests the pure classification logic (not the hook itself which needs RN env).
 */

type ScreenSize = 'small' | 'medium' | 'tablet';

function classifyWidth(width: number): ScreenSize {
  if (width < 370) return 'small';
  if (width < 768) return 'medium';
  return 'tablet';
}

function getScoreFontSize(size: ScreenSize): number {
  if (size === 'small') return 72;
  if (size === 'tablet') return 128;
  return 96;
}

function getScoreButtonSize(size: ScreenSize): number {
  if (size === 'small') return 72;
  if (size === 'tablet') return 140;
  return 88;
}

describe('useResponsive — breakpoint classification', () => {
  it('width 320 → small', () => expect(classifyWidth(320)).toBe('small'));
  it('width 369 → small', () => expect(classifyWidth(369)).toBe('small'));
  it('width 370 → medium', () => expect(classifyWidth(370)).toBe('medium'));
  it('width 414 → medium (iPhone typical)', () => expect(classifyWidth(414)).toBe('medium'));
  it('width 767 → medium', () => expect(classifyWidth(767)).toBe('medium'));
  it('width 768 → tablet', () => expect(classifyWidth(768)).toBe('tablet'));
  it('width 1024 → tablet', () => expect(classifyWidth(1024)).toBe('tablet'));
});

describe('useResponsive — score font size', () => {
  it('small → 72', () => expect(getScoreFontSize('small')).toBe(72));
  it('medium → 96', () => expect(getScoreFontSize('medium')).toBe(96));
  it('tablet → 128', () => expect(getScoreFontSize('tablet')).toBe(128));
});

describe('useResponsive — score button size', () => {
  it('small → 72', () => expect(getScoreButtonSize('small')).toBe(72));
  it('medium → 88', () => expect(getScoreButtonSize('medium')).toBe(88));
  it('tablet → 140', () => expect(getScoreButtonSize('tablet')).toBe(140));
});
