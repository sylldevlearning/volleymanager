import {
  validateRegularSubstitution,
  validateLiberoSubstitution,
  checkLiberoRallySinceLastReplacement,
  checkLiberoNotAlreadyActive,
  validateTimeoutRequest,
  getExceptionalSubstitutionEligibility,
  type RegularSubstitutionContext,
} from '../src/utils/rulesValidator';
import type { Player } from '../src/models/player';
import type { SubstitutionPair, LiberoState } from '../src/models/substitution';
import type { MatchConfig } from '../src/models/match';
import type { MatchEvent } from '../src/models/event';

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

function player(id: string, number: number, position: Player['position'] = 'outside'): Player {
  return {
    id, teamId: 't1', firstName: null, lastName: null, number, position,
    photoUri: null, isActive: true, createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function pair(overrides: Partial<SubstitutionPair> & { playerOutId: string; playerInId: string }): SubstitutionPair {
  return {
    id: 'p1', matchId: 'm1', setId: 's1', teamId: 't1',
    isLibero: false, isExceptional: false, isCancelled: false,
    ...overrides,
  };
}

function sanctionEvent(overrides: Partial<MatchEvent> & { details: Record<string, unknown> }): MatchEvent {
  return {
    id: 'e1', matchId: 'm1', setId: 's1', eventType: 'sanction_home',
    playerId: null, teamId: 't1', timestamp: '2026-01-01T00:00:00.000Z', isCancelled: false,
    ...overrides,
  };
}

function subEvent(overrides: Partial<MatchEvent> & { eventType: MatchEvent['eventType']; details: Record<string, unknown> }): MatchEvent {
  return {
    id: 'e1', matchId: 'm1', setId: 's1', playerId: null, teamId: 't1',
    timestamp: '2026-01-01T00:00:00.000Z', isCancelled: false,
    ...overrides,
  };
}

function baseCtx(overrides: Partial<RegularSubstitutionContext>): RegularSubstitutionContext {
  return {
    playerOut: player('OUT', 0),
    playerIn: player('IN', 0),
    allPlayers: [],
    pairs: [],
    subsUsed: 0,
    config: BASE_CONFIG,
    onCourtPlayerIds: [],
    sanctionEventsForSet: [],
    sanctionEventsForMatch: [],
    ...overrides,
  };
}

// ─── Quota ──────────────────────────────────────────────────────────────────

test('sub_quota_reached: blocked at 6 subs with exact message', () => {
  const ctx = baseCtx({ playerOut: player('P1', 1), playerIn: player('P2', 2), subsUsed: 6 });
  const result = validateRegularSubstitution(ctx);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe('sub_quota_reached');
    expect(result.message).toBe('6 remplacements déjà effectués dans ce set.');
    expect(result.allowExceptional).toBe(true);
  }
});

test('sub_quota_reached: allowed under quota', () => {
  const ctx = baseCtx({ playerOut: player('P1', 1), playerIn: player('P2', 2), subsUsed: 5 });
  expect(validateRegularSubstitution(ctx).ok).toBe(true);
});

// ─── Starter already returned ──────────────────────────────────────────────

test('sub_starter_already_returned: starter #5 who already completed a cycle cannot leave again', () => {
  const p5 = player('P5', 5);
  const p20 = player('P20', 20);
  const pairs = [
    pair({ playerOutId: 'P5', playerInId: 'P12' }),
    pair({ playerOutId: 'P12', playerInId: 'P5' }),
  ];
  const ctx = baseCtx({ playerOut: p5, playerIn: p20, pairs, allPlayers: [p5, p20] });
  const result = validateRegularSubstitution(ctx);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe('sub_starter_already_returned');
    expect(result.message).toBe('Le n°5 est déjà sorti et revenu dans ce set.');
  }
});

// ─── Wrong return ───────────────────────────────────────────────────────────

test('sub_wrong_return: #5 can only come back in place of #12', () => {
  const p5 = player('P5', 5);
  const p12 = player('P12', 12);
  const p20 = player('P20', 20);
  const pairs = [pair({ playerOutId: 'P5', playerInId: 'P12' })];
  const ctx = baseCtx({ playerOut: p20, playerIn: p5, pairs, allPlayers: [p5, p12, p20] });
  const result = validateRegularSubstitution(ctx);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe('sub_wrong_return');
    expect(result.message).toBe("Le n°5 ne peut revenir qu'à la place du n°12.");
    expect(result.allowExceptional).toBe(true);
  }
});

test('sub_wrong_return: the correct reciprocal return is allowed', () => {
  const p5 = player('P5', 5);
  const p12 = player('P12', 12);
  const pairs = [pair({ playerOutId: 'P5', playerInId: 'P12' })];
  const ctx = baseCtx({ playerOut: p12, playerIn: p5, pairs, allPlayers: [p5, p12] });
  expect(validateRegularSubstitution(ctx).ok).toBe(true);
});

// ─── Reserve already used ──────────────────────────────────────────────────

test('sub_reserve_already_used: #12 already entered, can only be replaced by #5', () => {
  const p5 = player('P5', 5);
  const p12 = player('P12', 12);
  const p20 = player('P20', 20);
  const pairs = [pair({ playerOutId: 'P5', playerInId: 'P12' })];
  const ctx = baseCtx({ playerOut: p12, playerIn: p20, pairs, allPlayers: [p5, p12, p20] });
  const result = validateRegularSubstitution(ctx);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe('sub_reserve_already_used');
    expect(result.message).toBe('Le n°12 est déjà entré dans ce set, il ne peut être remplacé que par le n°5.');
    expect(result.allowExceptional).toBe(true);
  }
});

// ─── Player unavailable ────────────────────────────────────────────────────

test('sub_player_on_court: cannot bring in a player already on court', () => {
  const p9 = player('P9', 9);
  const ctx = baseCtx({ playerOut: player('P1', 1), playerIn: p9, onCourtPlayerIds: ['P9'] });
  const result = validateRegularSubstitution(ctx);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe('sub_player_on_court');
    expect(result.message).toBe('Le n°9 est déjà sur le terrain.');
  }
});

test('sub_player_expelled: cannot bring in a player expelled for this set', () => {
  const p9 = player('P9', 9);
  const sanctions = [sanctionEvent({ playerId: 'P9', details: { sanctionType: 'expulsion' } })];
  const ctx = baseCtx({ playerOut: player('P1', 1), playerIn: p9, sanctionEventsForSet: sanctions });
  const result = validateRegularSubstitution(ctx);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe('sub_player_expelled');
    expect(result.message).toBe('Le n°9 est expulsé pour ce set.');
  }
});

test('sub_player_disqualified: cannot bring in a player disqualified for the match', () => {
  const p9 = player('P9', 9);
  const sanctions = [sanctionEvent({ playerId: 'P9', details: { sanctionType: 'disqualification' } })];
  const ctx = baseCtx({ playerOut: player('P1', 1), playerIn: p9, sanctionEventsForMatch: sanctions });
  const result = validateRegularSubstitution(ctx);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe('sub_player_disqualified');
    expect(result.message).toBe('Le n°9 est disqualifié pour le match.');
  }
});

// ─── Libero excluded from regular substitutions ────────────────────────────

test('sub_libero_not_allowed: a libero cannot enter via a regular substitution', () => {
  const ctx = baseCtx({ playerOut: player('P1', 1), playerIn: player('L1', 77, 'libero') });
  const result = validateRegularSubstitution(ctx);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe('sub_libero_not_allowed');
    expect(result.message).toBe('Le libéro ne peut pas participer à un remplacement régulier.');
  }
});

test('sub_libero_not_allowed: a libero cannot be the one going out via a regular substitution', () => {
  const ctx = baseCtx({ playerOut: player('L1', 77, 'libero'), playerIn: player('P2', 2) });
  const result = validateRegularSubstitution(ctx);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.code).toBe('sub_libero_not_allowed');
});

// ─── Libero — back row only ─────────────────────────────────────────────────

test('libero_front_row: blocked entering at P3 (front row)', () => {
  const result = validateLiberoSubstitution(3);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe('libero_front_row');
    expect(result.message).toBe('Le libéro ne peut pas entrer en zone avant.');
  }
});

test('libero_front_row: allowed entering at P6 (back row)', () => {
  expect(validateLiberoSubstitution(6).ok).toBe(true);
});

// ─── Libero — cannot enter at P1 (the server's slot) while the team is serving ──

test('libero_cannot_serve: blocked entering at P1 while the team is serving', () => {
  const result = validateLiberoSubstitution(1, true);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe('libero_cannot_serve');
    expect(result.message).toBe('Le libéro ne peut pas servir.');
  }
});

test('libero_cannot_serve: allowed entering at P1 when the team is NOT serving (receiving)', () => {
  expect(validateLiberoSubstitution(1, false).ok).toBe(true);
});

test('libero_cannot_serve: entering at P5 while serving is unaffected (only P1 serves)', () => {
  expect(validateLiberoSubstitution(5, true).ok).toBe(true);
});

test('libero_cannot_serve: entering at P6 while serving is unaffected (only P1 serves)', () => {
  expect(validateLiberoSubstitution(6, true).ok).toBe(true);
});

test('libero_front_row still takes priority over the serving check at a front-row position', () => {
  const result = validateLiberoSubstitution(3, true);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.code).toBe('libero_front_row');
});

test('defaults to NOT serving when the second argument is omitted (back-compat)', () => {
  expect(validateLiberoSubstitution(1).ok).toBe(true);
});

// ─── Libero — at least one rally between two replacements ─────────────────

test('libero_rally_required: blocked re-entering before any point was played', () => {
  const events = [subEvent({ eventType: 'substitution_home', details: { isLibero: true } })];
  const result = checkLiberoRallySinceLastReplacement(events, 'home');
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe('libero_rally_required');
    expect(result.message).toBe('Il doit y avoir au moins un échange de jeu entre deux remplacements de libéro.');
  }
});

test('libero_rally_required: allowed once at least one point was played since', () => {
  const events = [
    subEvent({ eventType: 'substitution_home', details: { isLibero: true } }),
    subEvent({ eventType: 'point_home', details: {} }),
  ];
  expect(checkLiberoRallySinceLastReplacement(events, 'home').ok).toBe(true);
});

test('libero_rally_required: allowed when no libero replacement happened yet this set', () => {
  expect(checkLiberoRallySinceLastReplacement([], 'home').ok).toBe(true);
});

test('libero_rally_required: a cancelled libero replacement does not count', () => {
  const events = [subEvent({ eventType: 'substitution_home', isCancelled: true, details: { isLibero: true } })];
  expect(checkLiberoRallySinceLastReplacement(events, 'home').ok).toBe(true);
});

// ─── Libero — only one active at a time (2-libero support) ────────────────

test('libero_other_active: blocked when a DIFFERENT libero is already on court', () => {
  const active: LiberoState = { liberoId: 'L1', isOnCourt: true, replacedPlayerId: 'A5', replacedPosition: 5 };
  const result = checkLiberoNotAlreadyActive('L2', 12, active);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe('libero_other_active');
    expect(result.message).toBe('Le libéro n°12 est déjà sur le terrain.');
  }
});

test('libero_other_active: allowed when no libero is currently active', () => {
  expect(checkLiberoNotAlreadyActive('L2', 12, null).ok).toBe(true);
});

test('libero_other_active: allowed when re-selecting the SAME libero that is active', () => {
  const active: LiberoState = { liberoId: 'L1', isOnCourt: true, replacedPlayerId: 'A5', replacedPosition: 5 };
  expect(checkLiberoNotAlreadyActive('L1', 5, active).ok).toBe(true);
});

// ─── Timeouts ───────────────────────────────────────────────────────────────

test('timeout_quota_reached: blocked at 2 timeouts with exact message', () => {
  const result = validateTimeoutRequest(2, BASE_CONFIG, 'Les Aigles');
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe('timeout_quota_reached');
    expect(result.message).toBe('Plus de temps mort disponible pour Les Aigles dans ce set.');
  }
});

test('timeout_quota_reached: allowed under quota', () => {
  expect(validateTimeoutRequest(1, BASE_CONFIG, 'Les Aigles').ok).toBe(true);
});

test('timeout_quota_reached: leisure/unlimited config never blocks', () => {
  const unlimited: MatchConfig = { ...BASE_CONFIG, unlimitedTimeouts: true, timeoutsPerSet: null };
  expect(validateTimeoutRequest(99, unlimited, 'Les Aigles').ok).toBe(true);
});

// ─── Exceptional substitution (injury) ─────────────────────────────────────

test('getExceptionalSubstitutionEligibility: eligible when quota is reached and no bench player can legally enter', () => {
  const p5 = player('P5', 5);
  const bench = [player('P20', 20), player('P21', 21)];
  const ctx = { allPlayers: [p5, ...bench], pairs: [], subsUsed: 6, config: BASE_CONFIG, onCourtPlayerIds: [], sanctionEventsForSet: [], sanctionEventsForMatch: [] };
  const result = getExceptionalSubstitutionEligibility(p5, bench, ctx);
  expect(result.eligible).toBe(true);
});

test('getExceptionalSubstitutionEligibility: not eligible when a legal substitution still exists', () => {
  const p5 = player('P5', 5);
  const bench = [player('P20', 20), player('P21', 21)];
  const ctx = { allPlayers: [p5, ...bench], pairs: [], subsUsed: 1, config: BASE_CONFIG, onCourtPlayerIds: [], sanctionEventsForSet: [], sanctionEventsForMatch: [] };
  const result = getExceptionalSubstitutionEligibility(p5, bench, ctx);
  expect(result.eligible).toBe(false);
});
