// BUG 2 repro: the right-side court must be the central (180°) symmetry of the
// left-side court, not just a horizontal mirror. Per spec:
//   Left  — front (near net) top→bottom: IV, III, II ; back top→bottom: V, VI, I
//   Right — front (near net) top→bottom: II, III, IV ; back top→bottom: I, VI, V
//
// BUG 3 repro: the libero rotation/auto-exit logic must depend ONLY on the I-VI
// position number, never on which screen side (left/right) a team is drawn on.
// These tests prove the rendering mapping is a pure function of (position, isLeft)
// — the same position number is NEVER coupled to a specific team or side.

import { getPositionSlot } from '../src/components/court/FullCourt';

describe('getPositionSlot — left side (front col top-to-bottom: IV, III, II; back: V, VI, I)', () => {
  it('IV (front) is top', () => expect(getPositionSlot(4, true)).toEqual({ row: 'top', col: 'front' }));
  it('III (front) is mid', () => expect(getPositionSlot(3, true)).toEqual({ row: 'mid', col: 'front' }));
  it('II (front) is bottom', () => expect(getPositionSlot(2, true)).toEqual({ row: 'bottom', col: 'front' }));
  it('V (back) is top', () => expect(getPositionSlot(5, true)).toEqual({ row: 'top', col: 'back' }));
  it('VI (back) is mid', () => expect(getPositionSlot(6, true)).toEqual({ row: 'mid', col: 'back' }));
  it('I (back) is bottom', () => expect(getPositionSlot(1, true)).toEqual({ row: 'bottom', col: 'back' }));
});

describe('getPositionSlot — right side (180° rotation: front top-to-bottom: II, III, IV; back: I, VI, V)', () => {
  it('II (front) is top', () => expect(getPositionSlot(2, false)).toEqual({ row: 'top', col: 'front' }));
  it('III (front) is mid', () => expect(getPositionSlot(3, false)).toEqual({ row: 'mid', col: 'front' }));
  it('IV (front) is bottom', () => expect(getPositionSlot(4, false)).toEqual({ row: 'bottom', col: 'front' }));
  it('I (back) is top', () => expect(getPositionSlot(1, false)).toEqual({ row: 'top', col: 'back' }));
  it('VI (back) is mid', () => expect(getPositionSlot(6, false)).toEqual({ row: 'mid', col: 'back' }));
  it('V (back) is bottom', () => expect(getPositionSlot(5, false)).toEqual({ row: 'bottom', col: 'back' }));
});

describe('getPositionSlot — servers (position I) are diagonally opposite', () => {
  it('left server (I) is back/bottom while right server (I) is back/top', () => {
    expect(getPositionSlot(1, true)).toEqual({ row: 'bottom', col: 'back' });
    expect(getPositionSlot(1, false)).toEqual({ row: 'top', col: 'back' });
  });
});

describe('getPositionSlot — the center row (III, VI) stays centered on both sides', () => {
  it('III is mid on both sides', () => {
    expect(getPositionSlot(3, true).row).toBe('mid');
    expect(getPositionSlot(3, false).row).toBe('mid');
  });
  it('VI is mid on both sides', () => {
    expect(getPositionSlot(6, true).row).toBe('mid');
    expect(getPositionSlot(6, false).row).toBe('mid');
  });
});

// ─── BUG 3: position mapping never depends on which team occupies the slot ─
// (it's a pure function of position + isLeft — swapping sides with the ⇄
// button only changes which team's data is passed as "left"/"right", never
// how a given position number is placed).

describe('getPositionSlot is a pure function of (position, isLeft) — never of team identity', () => {
  it('every back-row position (I, V, VI) stays a back-row slot on both sides', () => {
    for (const pos of [1, 5, 6] as const) {
      expect(getPositionSlot(pos, true).col).toBe('back');
      expect(getPositionSlot(pos, false).col).toBe('back');
    }
  });

  it('every front-row position (II, III, IV) stays a front-row slot on both sides', () => {
    for (const pos of [2, 3, 4] as const) {
      expect(getPositionSlot(pos, true).col).toBe('front');
      expect(getPositionSlot(pos, false).col).toBe('front');
    }
  });

  it('flipping isLeft for the SAME position never changes its back/front classification (only the row)', () => {
    for (const pos of [1, 2, 3, 4, 5, 6] as const) {
      expect(getPositionSlot(pos, true).col).toBe(getPositionSlot(pos, false).col);
    }
  });
});
