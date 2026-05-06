import {
  isSetWon,
  isMatchWon,
  shouldChangeEndsBeach,
  nextRotation,
  isLiberoZone,
  canRequestTimeout,
  canRequestSubstitution,
  getMaxTimeouts,
  isLastSet,
  getTotalSets,
} from '../src/utils/volleyball-rules';
import {
  DEFAULT_INDOOR_CONFIG,
  DEFAULT_BEACH_CONFIG,
  DEFAULT_LEISURE_CONFIG,
} from '../src/models/match';

describe('isSetWon', () => {
  it('wins regular set at 25 with 2-point lead', () => {
    expect(isSetWon(25, 23, DEFAULT_INDOOR_CONFIG, false)).toBe(true);
  });

  it('does not win at exactly 25 without 2-point lead', () => {
    expect(isSetWon(25, 24, DEFAULT_INDOOR_CONFIG, false)).toBe(false);
  });

  it('wins at 26-24 (extended set)', () => {
    expect(isSetWon(26, 24, DEFAULT_INDOOR_CONFIG, false)).toBe(true);
  });

  it('wins 5th set at 15 with 2-point lead', () => {
    expect(isSetWon(15, 13, DEFAULT_INDOOR_CONFIG, true)).toBe(true);
  });

  it('does not win 5th set at 14', () => {
    expect(isSetWon(14, 12, DEFAULT_INDOOR_CONFIG, true)).toBe(false);
  });

  it('wins beach set at 21 with 2-point lead', () => {
    expect(isSetWon(21, 19, DEFAULT_BEACH_CONFIG, false)).toBe(true);
  });
});

describe('isMatchWon', () => {
  it('indoor: wins at 3 sets', () => {
    expect(isMatchWon(3, DEFAULT_INDOOR_CONFIG)).toBe(true);
  });

  it('indoor: does not win at 2 sets', () => {
    expect(isMatchWon(2, DEFAULT_INDOOR_CONFIG)).toBe(false);
  });

  it('beach: wins at 2 sets', () => {
    expect(isMatchWon(2, DEFAULT_BEACH_CONFIG)).toBe(true);
  });

  it('beach: does not win at 1 set', () => {
    expect(isMatchWon(1, DEFAULT_BEACH_CONFIG)).toBe(false);
  });
});

describe('getTotalSets / isLastSet', () => {
  it('indoor max sets = 5', () => {
    expect(getTotalSets(DEFAULT_INDOOR_CONFIG)).toBe(5);
  });

  it('beach max sets = 3', () => {
    expect(getTotalSets(DEFAULT_BEACH_CONFIG)).toBe(3);
  });

  it('indoor 5th set is last', () => {
    expect(isLastSet(5, DEFAULT_INDOOR_CONFIG)).toBe(true);
  });

  it('indoor 3rd set is not last', () => {
    expect(isLastSet(3, DEFAULT_INDOOR_CONFIG)).toBe(false);
  });
});

describe('shouldChangeEndsBeach', () => {
  it('changes ends at 7 total points in regular set', () => {
    expect(shouldChangeEndsBeach(4, 3, 1, DEFAULT_BEACH_CONFIG)).toBe(true);
  });

  it('changes ends at 14 total points', () => {
    expect(shouldChangeEndsBeach(8, 6, 1, DEFAULT_BEACH_CONFIG)).toBe(true);
  });

  it('does not change at 6 total points', () => {
    expect(shouldChangeEndsBeach(4, 2, 1, DEFAULT_BEACH_CONFIG)).toBe(false);
  });

  it('changes at 5 total points in last set (beach)', () => {
    expect(shouldChangeEndsBeach(3, 2, 3, DEFAULT_BEACH_CONFIG)).toBe(true);
  });

  it('does not change at 4 total in last set', () => {
    expect(shouldChangeEndsBeach(3, 1, 3, DEFAULT_BEACH_CONFIG)).toBe(false);
  });
});

describe('nextRotation', () => {
  it('rotates all positions forward', () => {
    expect(nextRotation([1, 2, 3, 4, 5, 6])).toEqual([2, 3, 4, 5, 6, 1]);
  });

  it('wraps P6 to P1', () => {
    expect(nextRotation([6])).toEqual([1]);
  });

  it('double rotation returns to original', () => {
    const start = [1, 2, 3, 4, 5, 6];
    let rotated = start;
    for (let i = 0; i < 6; i++) {
      rotated = nextRotation(rotated);
    }
    expect(rotated).toEqual(start);
  });
});

describe('isLiberoZone', () => {
  it('P1 is back row', () => expect(isLiberoZone(1)).toBe(true));
  it('P5 is back row', () => expect(isLiberoZone(5)).toBe(true));
  it('P6 is back row', () => expect(isLiberoZone(6)).toBe(true));
  it('P2 is front row', () => expect(isLiberoZone(2)).toBe(false));
  it('P3 is front row', () => expect(isLiberoZone(3)).toBe(false));
  it('P4 is front row', () => expect(isLiberoZone(4)).toBe(false));
});

describe('canRequestTimeout', () => {
  it('allows timeout when under limit', () => {
    expect(canRequestTimeout(1, DEFAULT_INDOOR_CONFIG)).toBe(true);
  });

  it('blocks timeout at limit', () => {
    expect(canRequestTimeout(2, DEFAULT_INDOOR_CONFIG)).toBe(false);
  });

  it('leisure mode: always allows timeout', () => {
    expect(canRequestTimeout(99, DEFAULT_LEISURE_CONFIG)).toBe(true);
  });
});

describe('canRequestSubstitution', () => {
  it('allows substitution under limit', () => {
    expect(canRequestSubstitution(5, DEFAULT_INDOOR_CONFIG)).toBe(true);
  });

  it('blocks substitution at limit (6)', () => {
    expect(canRequestSubstitution(6, DEFAULT_INDOOR_CONFIG)).toBe(false);
  });

  it('leisure: always allows', () => {
    expect(canRequestSubstitution(99, DEFAULT_LEISURE_CONFIG)).toBe(true);
  });
});

describe('getMaxTimeouts', () => {
  it('indoor competition = 2', () => {
    expect(getMaxTimeouts(DEFAULT_INDOOR_CONFIG)).toBe(2);
  });

  it('leisure = Infinity', () => {
    expect(getMaxTimeouts(DEFAULT_LEISURE_CONFIG)).toBe(Infinity);
  });
});
