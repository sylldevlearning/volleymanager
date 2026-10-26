// Quick match screen (referee.tsx): "Annuler" on a substitution only cancelled
// the event in the DB — the court, bench, pairs and quota stayed substituted.
// Also, the starter leaving the court vanished from the bench, so they could
// never come back.
import { useScoringStore } from '../src/stores/scoringStore';
import type { Player } from '../src/models/player';
import type { SubstitutionPair } from '../src/models/substitution';

jest.mock('../src/services/database', () => ({ generateId: () => 'id', getDb: jest.fn() }));

const player = (id: string, number: number, position: Player['position'] = null): Player => ({
  id, teamId: 'H', firstName: null, lastName: id, number, position, photoUri: null, isActive: true, createdAt: '',
});
const p1 = player('p1', 1);
const p5 = player('p5', 5);
const p7 = player('p7', 7);
const L = player('L', 13, 'libero');
const pair = (outId: string, inId: string, isLibero = false): SubstitutionPair => ({
  id: `pair-${inId}`, matchId: 'm', setId: 's', teamId: 'H', playerOutId: outId, playerInId: inId,
  isLibero, isExceptional: false, isCancelled: false,
});
const court = { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' };
const liberoOff = { liberoId: 'L', isOnCourt: false, replacedPlayerId: null, replacedPosition: null };

beforeEach(() => {
  const s = useScoringStore.getState();
  s.reset();
  useScoringStore.setState({ substitutionsHome: 0, substitutionsAway: 0 });
  s.initLineup('home', court, [p7, L], liberoOff);
});

const state = () => useScoringStore.getState();

describe('applySubstitution — bench', () => {
  it('sends the starter who left to the bench', () => {
    state().applySubstitution('home', 'p1', 'p7', 1, false, pair('p1', 'p7'), { playerOut: p1 });
    expect(state().benchHome.map((p) => p.id)).toEqual(['L', 'p1']);
  });

  it('keeps an injured player (exceptional substitution) off the bench', () => {
    state().applySubstitution('home', 'p1', 'p7', 1, false, pair('p1', 'p7'), { playerOut: p1, isExceptional: true });
    expect(state().benchHome.map((p) => p.id)).toEqual(['L']);
  });

  it('does not put the player replaced by the libero on the bench', () => {
    state().applySubstitution('home', 'p5', 'L', 5, true, pair('p5', 'L', true), { playerOut: p5 });
    expect(state().benchHome.map((p) => p.id)).toEqual(['p7']);
  });
});

describe('revertSubstitution — "Annuler" on a substitution', () => {
  it('puts the court, bench, pairs and quota back', () => {
    state().applySubstitution('home', 'p1', 'p7', 1, false, pair('p1', 'p7'), { playerOut: p1 });
    state().revertSubstitution('home', {
      playerOutId: 'p1', playerInId: 'p7', position: 1, pairId: 'pair-p7', isLibero: false, isExceptional: false,
    }, p7);

    expect(state().onCourtHome).toEqual(court);
    expect(state().benchHome.map((p) => p.id).sort()).toEqual(['L', 'p7']);
    expect(state().pairsHome).toEqual([]);
    expect(state().substitutionsHome).toBe(0);
  });

  it('takes the libero back off the court without touching the quota', () => {
    state().applySubstitution('home', 'p5', 'L', 5, true, pair('p5', 'L', true), { playerOut: p5 });
    state().revertSubstitution('home', {
      playerOutId: 'p5', playerInId: 'L', position: 5, pairId: 'pair-L', isLibero: true, isExceptional: false,
    }, L);

    expect(state().onCourtHome).toEqual(court);
    expect(state().liberoHome).toEqual(liberoOff);
    expect(state().benchHome.map((p) => p.id).sort()).toEqual(['L', 'p7']);
    expect(state().substitutionsHome).toBe(0);
  });

  it('puts the libero back on court when their exit is undone', () => {
    state().applySubstitution('home', 'p5', 'L', 5, true, pair('p5', 'L', true), { playerOut: p5 });
    state().applyLiberoExit('home');
    state().restoreLiberoToBench('home', L);
    state().revertSubstitution('home', {
      playerOutId: 'L', playerInId: 'p5', position: 5, pairId: 'pair-p5', isLibero: true, isExceptional: false,
    }, p5);

    expect(state().onCourtHome[5]).toBe('L');
    expect(state().liberoHome).toEqual({ liberoId: 'L', isOnCourt: true, replacedPlayerId: 'p5', replacedPosition: 5 });
    expect(state().benchHome.map((p) => p.id)).toEqual(['p7']);
  });

  it('only touches its own side', () => {
    state().initLineup('away', { 1: 'a1' }, [], null);
    state().applySubstitution('home', 'p1', 'p7', 1, false, pair('p1', 'p7'), { playerOut: p1 });
    state().revertSubstitution('home', {
      playerOutId: 'p1', playerInId: 'p7', position: 1, pairId: 'pair-p7', isLibero: false, isExceptional: false,
    }, p7);
    expect(state().onCourtAway).toEqual({ 1: 'a1' });
  });
});
