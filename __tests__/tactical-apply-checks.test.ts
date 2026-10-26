import { checkBoardSubstitutions, type TeamRulesContext } from '../src/features/tactical/applyToMatch';
import type { BoardSubstitution } from '../src/features/tactical/matchDiff';
import { DEFAULT_INDOOR_CONFIG } from '../src/models/match';
import type { Player } from '../src/models/player';
import type { SubstitutionPair } from '../src/models/substitution';
import type { MatchEvent } from '../src/models/event';

jest.mock('../src/services/database', () => ({ generateId: () => 'id', getDb: jest.fn() }));

const player = (id: string, number: number, position: Player['position'] = null): Player => ({
  id, teamId: 'H', firstName: null, lastName: id, number, position, photoUri: null, isActive: true, createdAt: '',
});
const players = [...Array.from({ length: 12 }, (_, i) => player(`p${i + 1}`, i + 1)), player('L', 13, 'libero')];
const court = { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' };

function ctx(overrides: Partial<TeamRulesContext> = {}): TeamRulesContext {
  return {
    side: 'home',
    team: { court, libero: { liberoId: 'L', isOnCourt: false, replacedPlayerId: null, replacedPosition: null }, players },
    pairs: [],
    subsUsed: 0,
    config: { ...DEFAULT_INDOOR_CONFIG, substitutionsPerSet: 6, unlimitedSubstitutions: false },
    isTeamServing: false,
    setEvents: [],
    sanctionEventsForSet: [],
    sanctionEventsForMatch: [],
    ...overrides,
  };
}
const sub = (outId: string, inId: string, position: number, isLibero = false): BoardSubstitution => ({
  isHome: true, playerOutId: outId, playerInId: inId, position, isLibero,
});
const pairOf = (outId: string, inId: string): SubstitutionPair => ({
  id: `pair-${inId}`, matchId: 'm', setId: 's', teamId: 'H', playerOutId: outId, playerInId: inId,
  isLibero: false, isExceptional: false, isCancelled: false,
});

describe('checkBoardSubstitutions', () => {
  it('accepts a legal substitution and gives the jersey numbers for the recap', () => {
    const result = checkBoardSubstitutions([sub('p12', 'p7', 4)], ctx());
    expect(result).toEqual({
      ok: true,
      items: [expect.objectContaining({ playerOutId: 'p12', playerInId: 'p7', outNumber: 12, inNumber: 7, error: null })],
    });
  });

  it('checks each substitution after the previous ones — the 7th one is over the quota', () => {
    const subs = [1, 2, 3, 4, 5, 6].map((n) => sub(`p${n}`, `p${n + 6}`, n));
    expect(checkBoardSubstitutions(subs, ctx()).ok).toBe(true);

    const result = checkBoardSubstitutions(subs, ctx({ subsUsed: 1, pairs: [pairOf('p12', 'p11')] }));
    expect(result.ok).toBe(false);
    expect(result.items.slice(0, 5).every((i) => i.error === null)).toBe(true);
    expect(result.items[5].error).toBe('6 remplacements déjà effectués dans ce set.');
  });

  it('enforces the return to the same place with the rulesValidator message', () => {
    // 7 replaced 2 earlier in the set: 2 may only come back for 7
    const context = ctx({
      team: { ...ctx().team, court: { ...court, 2: 'p7' } },
      pairs: [pairOf('p2', 'p7')],
      subsUsed: 1,
    });
    const result = checkBoardSubstitutions([sub('p3', 'p2', 3)], context);
    expect(result.items[0].error).toBe('Le n°2 ne peut revenir qu\'à la place du n°7.');
  });

  it('sees a substitution made earlier in the same batch (reciprocity inside the recap)', () => {
    const result = checkBoardSubstitutions([sub('p2', 'p7', 2), sub('p3', 'p2', 3)], ctx());
    expect(result.items[1].error).toBe('Le n°2 ne peut revenir qu\'à la place du n°7.');
  });

  it('applies the libero rules: back row only', () => {
    const result = checkBoardSubstitutions([sub('p4', 'L', 4, true)], ctx());
    expect(result.items[0].error).toBe('Le libéro ne peut pas entrer en zone avant.');
  });

  it('applies the libero rules: no serving', () => {
    const result = checkBoardSubstitutions([sub('p1', 'L', 1, true)], ctx({ isTeamServing: true }));
    expect(result.items[0].error).toBe('Le libéro ne peut pas servir.');
  });

  it('a libero entry does not use the quota', () => {
    const subs = [sub('p5', 'L', 5, true), ...[1, 2, 3, 4, 6].map((n) => sub(`p${n}`, `p${n + 6}`, n))];
    expect(checkBoardSubstitutions(subs, ctx({ subsUsed: 1 })).ok).toBe(true);
  });

  it('needs a rally between two libero replacements, also inside the batch', () => {
    const lastLiberoSub = {
      id: 'e1', matchId: 'm', setId: 's', eventType: 'substitution_home', playerId: 'L', teamId: 'H',
      timestamp: 't', details: { isLibero: true }, isCancelled: false,
    } as MatchEvent;
    const rally = 'Il doit y avoir au moins un échange de jeu entre deux remplacements de libéro.';
    expect(checkBoardSubstitutions([sub('p5', 'L', 5, true)], ctx({ setEvents: [lastLiberoSub] })).items[0].error).toBe(rally);

    const inBatch = checkBoardSubstitutions([sub('p5', 'L', 5, true), sub('L', 'p5', 5, true)], ctx());
    expect(inBatch.items[1].error).toBe(rally);
  });

  it('lets the libero leave only for the player they replaced', () => {
    const liberoOn = ctx({
      team: { court, libero: { liberoId: 'L', isOnCourt: true, replacedPlayerId: 'p5', replacedPosition: 5 }, players },
    });
    expect(checkBoardSubstitutions([sub('L', 'p5', 5, true)], liberoOn).ok).toBe(true);
    expect(checkBoardSubstitutions([sub('L', 'p8', 5, true)], liberoOn).items[0].error)
      .toBe('Le libéro ne peut sortir que pour le n°5, qu\'il avait remplacé.');
  });

  it('nothing to check, nothing to refuse', () => {
    expect(checkBoardSubstitutions([], ctx())).toEqual({ ok: true, items: [] });
  });
});
