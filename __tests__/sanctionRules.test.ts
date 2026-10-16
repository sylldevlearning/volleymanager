import { getDelaySanctionOutcome, isPlayerExpelled, isPlayerDisqualified } from '../src/utils/sanctionRules';
import type { MatchEvent } from '../src/models/event';

function sanctionEvent(overrides: Partial<MatchEvent> & { details: Record<string, unknown> }): MatchEvent {
  return {
    id: 'e1',
    matchId: 'm1',
    setId: 's1',
    eventType: 'sanction_home',
    playerId: null,
    teamId: 't1',
    timestamp: '2026-01-01T00:00:00.000Z',
    isCancelled: false,
    ...overrides,
  };
}

// ─── Delay sanction escalation ─────────────────────────────────────────────

test('1st delay of the match does not award a point', () => {
  expect(getDelaySanctionOutcome(0).awardsPoint).toBe(false);
});

test('2nd delay of the match awards a point', () => {
  expect(getDelaySanctionOutcome(1).awardsPoint).toBe(true);
});

test('3rd+ delay of the match still awards a point', () => {
  expect(getDelaySanctionOutcome(4).awardsPoint).toBe(true);
});

// ─── Expulsion ──────────────────────────────────────────────────────────────

test('isPlayerExpelled is true when an active expulsion event targets the player', () => {
  const events = [sanctionEvent({ playerId: 'P5', details: { sanctionType: 'expulsion' } })];
  expect(isPlayerExpelled('P5', events)).toBe(true);
});

test('isPlayerExpelled is false for a different player', () => {
  const events = [sanctionEvent({ playerId: 'P5', details: { sanctionType: 'expulsion' } })];
  expect(isPlayerExpelled('P12', events)).toBe(false);
});

test('isPlayerExpelled ignores cancelled sanction events', () => {
  const events = [sanctionEvent({ playerId: 'P5', isCancelled: true, details: { sanctionType: 'expulsion' } })];
  expect(isPlayerExpelled('P5', events)).toBe(false);
});

test('isPlayerExpelled ignores non-expulsion sanctions', () => {
  const events = [sanctionEvent({ playerId: 'P5', details: { sanctionType: 'warning' } })];
  expect(isPlayerExpelled('P5', events)).toBe(false);
});

// ─── Disqualification ───────────────────────────────────────────────────────

test('isPlayerDisqualified is true when an active disqualification event targets the player', () => {
  const events = [sanctionEvent({ playerId: 'P5', details: { sanctionType: 'disqualification' } })];
  expect(isPlayerDisqualified('P5', events)).toBe(true);
});

test('isPlayerDisqualified is false for a different player', () => {
  const events = [sanctionEvent({ playerId: 'P5', details: { sanctionType: 'disqualification' } })];
  expect(isPlayerDisqualified('P12', events)).toBe(false);
});

test('isPlayerDisqualified ignores cancelled sanction events', () => {
  const events = [sanctionEvent({ playerId: 'P5', isCancelled: true, details: { sanctionType: 'disqualification' } })];
  expect(isPlayerDisqualified('P5', events)).toBe(false);
});
