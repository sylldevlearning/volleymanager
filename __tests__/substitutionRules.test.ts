import {
  validateSubstitution,
  validateLiberoSubstitution,
  liberoMustExit,
  countNormalSubs,
  isBackRow,
  canLiberoEnter,
  predictLiberoAutoExit,
} from '../src/utils/substitutionRules';
import type { SubstitutionPair, LiberoState } from '../src/models/substitution';
import type { MatchConfig } from '../src/models/match';

const BASE_CONFIG: MatchConfig = {
  pointsPerSet: 25,
  pointsLastSet: 15,
  setsToWin: 3,
  timeoutsPerSet: 2,
  substitutionsPerSet: 6,
  unlimitedTimeouts: false,
  unlimitedSubstitutions: false,
  winMargin: 2,
  timeoutDurationSec: 30,
  breakBetweenSetsSec: 180,
  sanctionsEnabled: true,
};

const LEISURE_CONFIG: MatchConfig = {
  ...BASE_CONFIG,
  substitutionsPerSet: null,
  unlimitedSubstitutions: true,
};

function pair(
  overrides: Partial<SubstitutionPair> & { playerOutId: string; playerInId: string },
): SubstitutionPair {
  return {
    id: 'p1',
    matchId: 'm1',
    setId: 's1',
    teamId: 't1',
    isLibero: false,
    isExceptional: false,
    isCancelled: false,
    ...overrides,
  };
}

// ─── Normal substitutions ──────────────────────────────────────────────────

test('1. normal sub decrements counter (6→5 remaining)', () => {
  // 1 sub already used, 5 remaining — 6th total → still ok (1 used < 6 max)
  const result = validateSubstitution('A', 'B', [], 1, BASE_CONFIG, 'indoor_6v6', 'competition');
  expect(result.ok).toBe(true);
});

test('2. 7th substitution is refused (max 6)', () => {
  const result = validateSubstitution('A', 'B', [], 6, BASE_CONFIG, 'indoor_6v6', 'competition');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe('max_reached');
});

test('3. reciprocity: A out → B in. Later B out → only A can come back', () => {
  const pairs = [pair({ playerOutId: 'A', playerInId: 'B' })];
  const result = validateSubstitution('B', 'A', pairs, 1, BASE_CONFIG, 'indoor_6v6', 'competition');
  expect(result.ok).toBe(true);
});

test('4. reciprocity: A out → B in. C cannot replace A directly', () => {
  const pairs = [pair({ playerOutId: 'A', playerInId: 'B' })];
  // Try to put in A with C going out — but A's pair says B replaced A, so only B can leave to let A back
  const result = validateSubstitution('C', 'A', pairs, 1, BASE_CONFIG, 'indoor_6v6', 'competition');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe('reciprocity_violation');
});

test('5. a reserve already on court cannot sub in a second time', () => {
  // B already played as reserve (came in for A)
  const pairs = [pair({ playerOutId: 'A', playerInId: 'B' })];
  // Now someone tries to put B in again
  const result = validateSubstitution('X', 'B', pairs, 2, BASE_CONFIG, 'indoor_6v6', 'competition');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe('not_eligible');
});

test('6. counters reset at new set (empty pairs = 0 subs used)', () => {
  // New set: no pairs, 0 subs used
  const result = validateSubstitution('A', 'B', [], 0, BASE_CONFIG, 'indoor_6v6', 'competition');
  expect(result.ok).toBe(true);
});

test('7. reciprocity pairs empty at new set — prior pairs gone', () => {
  // If we pass empty pairs (new set), any A→B swap is valid
  const result = validateSubstitution('A', 'B', [], 0, BASE_CONFIG, 'indoor_6v6', 'competition');
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.isLibero).toBe(false);
});

test('8. leisure mode: no limit, no reciprocity', () => {
  // Even if we've "used" 99 subs, leisure allows it
  const result = validateSubstitution('A', 'B', [], 99, LEISURE_CONFIG, 'indoor_6v6', 'leisure');
  expect(result.ok).toBe(true);
});

test('9. beach 2v2: no substitutions at all', () => {
  const result = validateSubstitution('A', 'B', [], 0, BASE_CONFIG, 'beach_2v2', 'competition');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe('beach_no_sub');
});

// ─── Libero rules ─────────────────────────────────────────────────────────

test('10. libero can enter at P1 (back row)', () => {
  const result = validateLiberoSubstitution(1, 'indoor_6v6');
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.isLibero).toBe(true);
});

test('11. libero can enter at P5 (back row)', () => {
  const result = validateLiberoSubstitution(5, 'indoor_6v6');
  expect(result.ok).toBe(true);
});

test('12. libero can enter at P6 (back row)', () => {
  const result = validateLiberoSubstitution(6, 'indoor_6v6');
  expect(result.ok).toBe(true);
});

test('13. libero cannot enter at P2 (front row)', () => {
  const result = validateLiberoSubstitution(2, 'indoor_6v6');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe('libero_front_row');
});

test('14. libero cannot enter at P3 (front row)', () => {
  const result = validateLiberoSubstitution(3, 'indoor_6v6');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe('libero_front_row');
});

test('15. libero cannot enter at P4 (front row)', () => {
  const result = validateLiberoSubstitution(4, 'indoor_6v6');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe('libero_front_row');
});

test('16. libero sub does not count toward the 6 normal subs', () => {
  const liberoPair = pair({ playerOutId: 'Starter', playerInId: 'Libero', isLibero: true });
  // countNormalSubs should return 0 because the pair is a libero swap
  expect(countNormalSubs([liberoPair])).toBe(0);
});

test('17. libero must exit when position is front row (P2)', () => {
  expect(liberoMustExit(2)).toBe(true);
});

test('18. libero must exit when position is P3', () => {
  expect(liberoMustExit(3)).toBe(true);
});

test('19. libero does NOT need to exit from back row (P1)', () => {
  expect(liberoMustExit(1)).toBe(false);
});

test('20. isBackRow returns false for P4 (front row)', () => {
  expect(isBackRow(4)).toBe(false);
  expect(isBackRow(1)).toBe(true);
  expect(isBackRow(5)).toBe(true);
  expect(isBackRow(6)).toBe(true);
  expect(isBackRow(2)).toBe(false);
  expect(isBackRow(3)).toBe(false);
});

// ─── Dual-libero: only one on court at a time ──────────────────────────────

test('21. canLiberoEnter is true when no libero is currently active', () => {
  expect(canLiberoEnter('L1', null)).toBe(true);
  expect(canLiberoEnter('L1', { liberoId: 'L2', isOnCourt: false, replacedPlayerId: null, replacedPosition: null })).toBe(true);
});

test('22. canLiberoEnter is true for the already-active libero (re-selecting same one)', () => {
  const active: LiberoState = { liberoId: 'L1', isOnCourt: true, replacedPlayerId: 'A', replacedPosition: 6 };
  expect(canLiberoEnter('L1', active)).toBe(true);
});

test('23. canLiberoEnter is false for the OTHER libero while one is active (no direct L1<->L2 exchange)', () => {
  const active: LiberoState = { liberoId: 'L1', isOnCourt: true, replacedPlayerId: 'A', replacedPosition: 6 };
  expect(canLiberoEnter('L2', active)).toBe(false);
});

// ─── Libero automatic exit prediction (rotation into front row) ────────────

test('24. predictLiberoAutoExit: no exit when libero is not on court', () => {
  expect(predictLiberoAutoExit(null)).toEqual({ mustExit: false, newPosition: null });
  const inactive: LiberoState = { liberoId: 'L1', isOnCourt: false, replacedPlayerId: null, replacedPosition: null };
  expect(predictLiberoAutoExit(inactive)).toEqual({ mustExit: false, newPosition: null });
});

test('25. predictLiberoAutoExit: libero at P5 rotates to P4 (front row) -> must exit', () => {
  const libero: LiberoState = { liberoId: 'L1', isOnCourt: true, replacedPlayerId: 'A', replacedPosition: 5 };
  expect(predictLiberoAutoExit(libero)).toEqual({ mustExit: true, newPosition: 4 });
});

test('26. predictLiberoAutoExit: libero at P6 rotates to P5 (still back row) -> stays', () => {
  const libero: LiberoState = { liberoId: 'L1', isOnCourt: true, replacedPlayerId: 'A', replacedPosition: 6 };
  expect(predictLiberoAutoExit(libero)).toEqual({ mustExit: false, newPosition: 5 });
});

test('27. predictLiberoAutoExit: libero at P1 rotates to P6 (back row) -> stays', () => {
  const libero: LiberoState = { liberoId: 'L1', isOnCourt: true, replacedPlayerId: 'A', replacedPosition: 1 };
  expect(predictLiberoAutoExit(libero)).toEqual({ mustExit: false, newPosition: 6 });
});
