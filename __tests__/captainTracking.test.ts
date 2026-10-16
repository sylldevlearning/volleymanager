import { getDisplayedCaptainId, needsNewActingCaptain } from '../src/utils/captainTracking';

// ─── getDisplayedCaptainId ──────────────────────────────────────────────────

describe('getDisplayedCaptainId', () => {
  it('returns the registered captain when they are on court', () => {
    const id = getDisplayedCaptainId({
      registeredCaptainId: 'P5', actingCaptainId: null, onCourtPlayerIds: ['P1', 'P5', 'P6'],
    });
    expect(id).toBe('P5');
  });

  it('returns the acting captain when the registered captain is off court', () => {
    const id = getDisplayedCaptainId({
      registeredCaptainId: 'P5', actingCaptainId: 'P6', onCourtPlayerIds: ['P1', 'P6', 'P7'],
    });
    expect(id).toBe('P6');
  });

  it('returns null when the registered captain is off court and no acting captain is set yet', () => {
    const id = getDisplayedCaptainId({
      registeredCaptainId: 'P5', actingCaptainId: null, onCourtPlayerIds: ['P1', 'P6', 'P7'],
    });
    expect(id).toBeNull();
  });

  it('returns null when there is no registered captain at all (legacy match)', () => {
    const id = getDisplayedCaptainId({
      registeredCaptainId: null, actingCaptainId: null, onCourtPlayerIds: ['P1', 'P6'],
    });
    expect(id).toBeNull();
  });

  it('prefers the registered captain over a stale acting captain once the registered captain returns', () => {
    const id = getDisplayedCaptainId({
      registeredCaptainId: 'P5', actingCaptainId: 'P6', onCourtPlayerIds: ['P1', 'P5', 'P6'],
    });
    expect(id).toBe('P5');
  });
});

// ─── needsNewActingCaptain ──────────────────────────────────────────────────

describe('needsNewActingCaptain', () => {
  it('false when there is no registered captain (legacy match)', () => {
    expect(needsNewActingCaptain({
      registeredCaptainId: null, actingCaptainId: null, onCourtPlayerIds: ['P1'],
    })).toBe(false);
  });

  it('false when the registered captain is on court', () => {
    expect(needsNewActingCaptain({
      registeredCaptainId: 'P5', actingCaptainId: null, onCourtPlayerIds: ['P1', 'P5'],
    })).toBe(false);
  });

  it('true when the registered captain just left and no acting captain is set', () => {
    expect(needsNewActingCaptain({
      registeredCaptainId: 'P5', actingCaptainId: null, onCourtPlayerIds: ['P1', 'P6'],
    })).toBe(true);
  });

  it('false when the registered captain is off court but a valid acting captain is already on court', () => {
    expect(needsNewActingCaptain({
      registeredCaptainId: 'P5', actingCaptainId: 'P6', onCourtPlayerIds: ['P1', 'P6'],
    })).toBe(false);
  });

  it('true when the previously-designated acting captain has ALSO left the court (need a new pick)', () => {
    expect(needsNewActingCaptain({
      registeredCaptainId: 'P5', actingCaptainId: 'P6', onCourtPlayerIds: ['P1', 'P7'],
    })).toBe(true);
  });

  it('false once the registered captain returns, even if an acting captain was set before', () => {
    expect(needsNewActingCaptain({
      registeredCaptainId: 'P5', actingCaptainId: 'P6', onCourtPlayerIds: ['P1', 'P5', 'P6'],
    })).toBe(false);
  });
});
