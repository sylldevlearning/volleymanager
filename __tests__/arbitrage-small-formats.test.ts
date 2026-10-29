import {
  FORMAT_PROFILES,
  applyPreset,
  courtSize,
  defaultArbitrageConfig,
  isTechnicalTimeout,
  presetOf,
  shouldSwitchCourts,
  substitutionsAllowed,
} from '../src/features/match/formatProfile';
import { rotateCourt, rotateSideOnSideOut, replayCourtState } from '../src/utils/courtRotation';
import { shouldChangeEndsIndoor } from '../src/utils/volleyball-rules';
import { validateFreeSubstitution } from '../src/utils/rulesValidator';
import { validateAdHocTeam } from '../src/utils/adHocSetupValidation';
import { DEFAULT_INDOOR_CONFIG, type MatchConfig, type MatchFormat } from '../src/models/match';
import type { Player } from '../src/models/player';
import type { MatchEvent } from '../src/models/event';

const player = (id: string, number: number): Player => ({
  id, teamId: 't', firstName: null, lastName: id, number, position: 'outside', isActive: true, createdAt: '',
} as unknown as Player);

let seq = 0;
const event = (eventType: string, extra: Partial<MatchEvent> = {}): MatchEvent => ({
  id: `e${++seq}`, matchId: 'm', setId: 's', eventType, playerId: null, teamId: null, details: {},
  timestamp: new Date(2026, 0, 1, 10, 0, seq).toISOString(), isCancelled: false, ...extra,
} as unknown as MatchEvent);

describe('format profiles', () => {
  it('players on court, libero, roster', () => {
    expect([6, 4, 3, 2]).toEqual((['indoor_6v6', 'indoor_4v4', 'indoor_3v3', 'beach_2v2'] as MatchFormat[]).map(courtSize));
    expect(FORMAT_PROFILES.indoor_6v6).toMatchObject({ hasLibero: true, maxRoster: 14 });
    for (const f of ['indoor_4v4', 'indoor_3v3', 'beach_2v2'] as MatchFormat[]) expect(FORMAT_PROFILES[f].hasLibero).toBe(false);
  });

  it('6×6 keeps its configuration exactly', () => {
    expect(defaultArbitrageConfig('indoor_6v6')).toEqual(DEFAULT_INDOOR_CONFIG);
    expect(presetOf('indoor_6v6')).toBeNull();
  });

  it.each(['indoor_4v4', 'indoor_3v3', 'beach_2v2'] as MatchFormat[])('%s leisure defaults: free unlimited substitutions, no positional faults, 1 time-out of 30 s', (format) => {
    const c = defaultArbitrageConfig(format);
    expect(c).toMatchObject({
      substitutionMode: 'free', unlimitedSubstitutions: true, positionalFaults: false,
      timeoutsPerSet: 1, unlimitedTimeouts: false, timeoutDurationSec: 30, technicalTimeout: false, m13Substitutions: false,
    });
  });

  it('court switch by default: 2×2 every 7 (5 in the deciding set), 3×3 and 4×4 between sets only', () => {
    expect(defaultArbitrageConfig('beach_2v2').courtSwitch).toEqual({ every: 7, everyDecidingSet: 5 });
    expect(defaultArbitrageConfig('indoor_3v3').courtSwitch).toBeNull();
    expect(defaultArbitrageConfig('indoor_4v4').courtSwitch).toBeNull();
  });
});

describe('official presets', () => {
  it('4×4 "Officiel M13 (FFVolley)": 4 substitutions with the M13 limits, 2 time-outs, positional faults; set rules untouched', () => {
    const preset = presetOf('indoor_4v4')!;
    expect(preset.labelKey).toBe('arbitrageSetup.presetM13');
    const leisure = defaultArbitrageConfig('indoor_4v4');
    const c = applyPreset('indoor_4v4', 'official', { ...leisure, pointsPerSet: 23 });
    expect(c).toMatchObject({
      substitutionMode: 'free', unlimitedSubstitutions: false, substitutionsPerSet: 4, m13Substitutions: true,
      timeoutsPerSet: 2, timeoutDurationSec: 30, positionalFaults: true, pointsPerSet: 23,
    });
  });

  it('2×2 official beach (FIVB): no substitution, technical time-out, 21/15', () => {
    const c = applyPreset('beach_2v2', 'official', defaultArbitrageConfig('beach_2v2'));
    expect(c).toMatchObject({
      substitutionMode: 'none', technicalTimeout: true, timeoutsPerSet: 1, courtSwitch: { every: 7, everyDecidingSet: 5 },
      setsToWin: 2, pointsPerSet: 21, pointsLastSet: 15,
    });
    expect(substitutionsAllowed('beach_2v2', c)).toBe(false);
    expect(substitutionsAllowed('beach_2v2', defaultArbitrageConfig('beach_2v2'))).toBe(true);
  });

  it('3×3 official (FIVB snow volleyball): 2 substitutions, switch every 5, sets of 15', () => {
    const c = applyPreset('indoor_3v3', 'official', defaultArbitrageConfig('indoor_3v3'));
    expect(c).toMatchObject({
      substitutionMode: 'fivb', substitutionsPerSet: 2, unlimitedSubstitutions: false,
      courtSwitch: { every: 5, everyDecidingSet: 5 }, setsToWin: 2, pointsPerSet: 15, pointsLastSet: 15, timeoutsPerSet: 1,
    });
  });

  it('back to leisure restores the leisure rules', () => {
    const official = applyPreset('beach_2v2', 'official', defaultArbitrageConfig('beach_2v2'));
    expect(applyPreset('beach_2v2', 'leisure', official)).toEqual(defaultArbitrageConfig('beach_2v2'));
  });

  it('an older beach match (no substitution mode stored) still has no substitution', () => {
    const legacy = { ...DEFAULT_INDOOR_CONFIG } as MatchConfig;
    expect(substitutionsAllowed('beach_2v2', legacy)).toBe(false);
    expect(substitutionsAllowed('indoor_6v6', legacy)).toBe(true);
  });
});

describe('change of courts and technical time-out', () => {
  const c2 = defaultArbitrageConfig('beach_2v2');
  it('2×2: every 7 points, every 5 in the deciding set', () => {
    expect([[4, 3], [7, 7], [10, 4], [5, 1]].map(([h, a]) => shouldSwitchCourts('beach_2v2', h, a, 1, c2))).toEqual([true, true, true, false]);
    expect(shouldSwitchCourts('beach_2v2', 3, 2, 3, c2)).toBe(true);
    expect(shouldSwitchCourts('beach_2v2', 0, 0, 1, c2)).toBe(false);
  });

  it('3×3 / 4×4 leisure: never during a set', () => {
    for (const f of ['indoor_3v3', 'indoor_4v4'] as MatchFormat[]) {
      for (let total = 1; total < 30; total++) expect(shouldSwitchCourts(f, total, 0, 1, defaultArbitrageConfig(f))).toBe(false);
    }
  });

  it('6×6 unchanged: at 8 points in the deciding set only', () => {
    for (const [h, a, set] of [[8, 3, 5], [3, 8, 5], [8, 3, 1], [7, 7, 5], [14, 0, 2]]) {
      expect(shouldSwitchCourts('indoor_6v6', h, a, set, DEFAULT_INDOOR_CONFIG)).toBe(shouldChangeEndsIndoor(h, a, set, DEFAULT_INDOOR_CONFIG));
    }
  });

  it('technical time-out at 21 points in sets 1 and 2, only when enabled', () => {
    const official = applyPreset('beach_2v2', 'official', c2);
    expect(isTechnicalTimeout(11, 10, 1, official)).toBe(true);
    expect(isTechnicalTimeout(11, 10, 3, official)).toBe(false);
    expect(isTechnicalTimeout(12, 10, 1, official)).toBe(false);
    expect(isTechnicalTimeout(11, 10, 1, c2)).toBe(false);
  });
});

describe('rotation', () => {
  it('6×6 unchanged: P2→P1 … P1→P6', () => {
    const court = { 1: 'a', 2: 'b', 3: 'c', 4: 'd', 5: 'e', 6: 'f' };
    expect(rotateCourt(court)).toEqual({ 6: 'a', 1: 'b', 2: 'c', 3: 'd', 4: 'e', 5: 'f' });
    expect(rotateCourt(court, 6)).toEqual(rotateCourt(court));
  });

  it('4×4 (M13: 1 back, 2-3-4 front): the player in 2 serves next', () => {
    expect(rotateCourt({ 1: 'a', 2: 'b', 3: 'c', 4: 'd' }, 4)).toEqual({ 4: 'a', 1: 'b', 2: 'c', 3: 'd' });
  });

  it('3×3 and 2×2: service order turns; in 2×2 the two players alternate', () => {
    expect(rotateCourt({ 1: 'a', 2: 'b', 3: 'c' }, 3)).toEqual({ 3: 'a', 1: 'b', 2: 'c' });
    const once = rotateCourt({ 1: 'a', 2: 'b' }, 2);
    expect(once).toEqual({ 2: 'a', 1: 'b' });
    expect(rotateCourt(once, 2)).toEqual({ 1: 'a', 2: 'b' });
  });

  it('side-out keeps the rotation list in the court size', () => {
    const r = rotateSideOnSideOut('home', { onCourt: { 1: 'a', 2: 'b', 3: 'c', 4: 'd' }, rotation: [1, 2, 3, 4], libero: null }, 4);
    expect(r.state.rotation).toEqual([2, 3, 4, 1]);
    expect(r.autoExit).toBeNull();
  });

  it('replay (resume, undo) rotates in the court size', () => {
    const roster = ['a', 'b'].map((id, i) => player(id, i + 1));
    const away = ['x', 'y'].map((id, i) => player(id, i + 10));
    const result = replayCourtState({
      startingOnCourtHome: { 1: 'a', 2: 'b' }, startingOnCourtAway: { 1: 'x', 2: 'y' },
      homeRoster: roster, awayRoster: away, initialServingTeam: 'home', courtSize: 2,
      events: [event('point_away'), event('point_home'), event('point_away')],
    });
    // Away served twice (x then y), home once (b after a)
    expect(result.onCourtAway).toEqual({ 1: 'x', 2: 'y' });
    expect(result.onCourtHome).toEqual({ 1: 'b', 2: 'a' });
    expect(result.rotationHome).toHaveLength(2);
  });
});

describe('free substitutions (small formats)', () => {
  const roster = [1, 2, 3, 4, 5, 6].map((n) => player(`p${n}`, n));
  const base = (over: Partial<Parameters<typeof validateFreeSubstitution>[0]> = {}) => ({
    playerOut: roster[0], playerIn: roster[4], position: 1, allPlayers: roster, subsUsed: 0,
    config: defaultArbitrageConfig('indoor_4v4'), onCourtPlayerIds: ['p1', 'p2', 'p3', 'p4'],
    setEvents: [] as MatchEvent[], side: 'home' as const, sanctionEventsForSet: [], sanctionEventsForMatch: [],
    ...over,
  });

  it('any bench player for any court player, any number of times', () => {
    expect(validateFreeSubstitution(base())).toEqual({ ok: true });
    expect(validateFreeSubstitution(base({ subsUsed: 40 }))).toEqual({ ok: true });
  });

  it('never a player already on court', () => {
    expect(validateFreeSubstitution(base({ playerIn: roster[1] }))).toMatchObject({ ok: false, code: 'sub_player_on_court' });
  });

  it('follows a quota when set', () => {
    const config = { ...defaultArbitrageConfig('indoor_4v4'), unlimitedSubstitutions: false, substitutionsPerSet: 4 };
    expect(validateFreeSubstitution(base({ config, subsUsed: 3 })).ok).toBe(true);
    expect(validateFreeSubstitution(base({ config, subsUsed: 4 }))).toMatchObject({ ok: false, code: 'sub_quota_reached' });
  });

  describe('M13 limits (FFVolley 4×4)', () => {
    const config = applyPreset('indoor_4v4', 'official', defaultArbitrageConfig('indoor_4v4'));
    const left = (playerId: string, from: number) => event('substitution_home', {
      playerId: 'p6', details: { playerOutId: playerId, position: from } as never,
    });

    it('a player who left cannot come back before one rally', () => {
      const r = validateFreeSubstitution(base({ config, playerIn: roster[4], setEvents: [left('p5', 3)], position: 3 }));
      expect(r).toMatchObject({ ok: false, code: 'sub_m13_rally_required' });
      const after = validateFreeSubstitution(base({ config, playerIn: roster[4], setEvents: [left('p5', 3), event('point_away')], position: 3 }));
      expect(after.ok).toBe(true);
    });

    it('the player who left from position 1 cannot come back at position 2 before the team rotates', () => {
      const events = [event('point_home'), left('p5', 1), event('point_home')];
      expect(validateFreeSubstitution(base({ config, playerIn: roster[4], position: 2, setEvents: events })))
        .toMatchObject({ ok: false, code: 'sub_m13_server_to_2' });
      expect(validateFreeSubstitution(base({ config, playerIn: roster[4], position: 3, setEvents: events })).ok).toBe(true);
      // The team lost the serve then won it back: it rotated, the limit no longer applies
      const rotated = [...events, event('point_away'), event('point_home')];
      expect(validateFreeSubstitution(base({ config, playerIn: roster[4], position: 2, setEvents: rotated })).ok).toBe(true);
    });

    it('leisure 4×4 has none of these limits', () => {
      expect(validateFreeSubstitution(base({ playerIn: roster[4], setEvents: [left('p5', 1)], position: 2 })).ok).toBe(true);
    });
  });
});

describe('match setup: players needed by format', () => {
  const draft = (count: number) => ({
    name: 'Lyon', players: Array.from({ length: count }, (_, i) => ({ number: i + 1, name: '' })), captainNumber: 1, liberoNumbers: [],
  });
  it('6×6 still needs 6 players', () => {
    expect(validateAdHocTeam(draft(5))).toContain('Il faut au moins 6 joueurs sélectionnés.');
    expect(validateAdHocTeam(draft(6))).toEqual([]);
  });
  it.each([['indoor_4v4', 4], ['indoor_3v3', 3], ['beach_2v2', 2]] as [MatchFormat, number][])('%s needs %i players, at most the roster size, no libero', (format, n) => {
    expect(validateAdHocTeam(draft(n - 1), format)).toContain(`Il faut au moins ${n} joueurs sélectionnés.`);
    expect(validateAdHocTeam(draft(n), format)).toEqual([]);
    expect(validateAdHocTeam(draft(FORMAT_PROFILES[format].maxRoster + 1), format))
      .toContain(`${FORMAT_PROFILES[format].maxRoster} joueurs au maximum.`);
    expect(validateAdHocTeam({ ...draft(n + 1), liberoNumbers: [n + 1] }, format)).toContain('Pas de libéro dans ce format.');
  });
});
