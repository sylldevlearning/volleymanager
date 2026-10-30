import {
  DEFAULT_TEAM_COUNT,
  addLibraryTeams,
  applyTemplate,
  dateFromIso,
  dateFromTime,
  displayDate,
  displayName,
  duplicateTeamKeys,
  formatHint,
  initialWizardState,
  isoFromDate,
  moveTeam,
  parseDisplayDate,
  previewTournament,
  renameTeam,
  resolvedBrassage,
  resolvedCourts,
  resolvedPools,
  setFormat,
  setGameType,
  setTeamCount,
  templatePayload,
  timeFromDate,
  toCreateInput,
  validateStep,
  type WizardState,
} from '../src/features/tournament/wizard';
import { POINTS_PRESETS, defaultBrassageRules, defaultPoolRules, defaultSetRules } from '../src/features/tournament/engine/defaults';
import { PRESET_TEAM_COLORS } from '../src/utils/constants';

const TODAY = new Date(2026, 4, 16, 10, 30); // 16 May 2026
const label = (n: number) => `Équipe ${n}`;
const initial = (seed = 42) => initialWizardState(TODAY, seed, label);

function withTeams(n: number, base: WizardState = initial()): WizardState {
  return setTeamCount(base, n, label);
}

describe('defaults', () => {
  it('a 6×6 tournament today, 8 teams, pools + finals, 9:00, 45 min, no rest', () => {
    const s = initial();
    expect(s).toMatchObject({
      name: '', date: '2026-05-16', location: '', gameType: 'indoor_6v6', format: 'pools_knockout',
      match: defaultSetRules('indoor_6v6'), finalsMatch: null, thirdPlace: true, legs: 1,
      pools: null, courts: null, startTime: '09:00', matchMinutes: 45, restMinutes: 0,
      seeding: 'random', seed: 42,
    });
    expect(DEFAULT_TEAM_COUNT).toBe(8);
    expect(s.teams.map(displayName)).toEqual(['Équipe 1', 'Équipe 2', 'Équipe 3', 'Équipe 4', 'Équipe 5', 'Équipe 6', 'Équipe 7', 'Équipe 8']);
  });

  it('ranking: a win is worth 1 point; tie-breakers head-to-head, sets, points, points scored', () => {
    const s = initial();
    expect(s.points).toEqual(POINTS_PRESETS.simple);
    expect(s.tiebreakers).toEqual(['headToHead', 'setDifference', 'pointDifference', 'pointsScored']);
  });

  it('the game type sets its own set rules and match duration', () => {
    const s = setGameType(initial(1), 'beach_2v2');
    expect(s.match).toEqual(defaultSetRules('beach_2v2'));
    expect(s.matchMinutes).toBe(35);
    expect(setGameType(s, 'indoor_3v3').match.setsToWin).toBe(1);
  });

  it('pools and courts follow the number of teams until set by hand', () => {
    const s = withTeams(12);
    expect(resolvedPools(s)).toEqual(defaultPoolRules(12));
    expect(resolvedCourts(s)).toBe(2);
    const custom = { ...s, pools: { count: 2, qualifiersPerPool: 4, bestOthers: 0 }, courts: 3 };
    expect(resolvedPools(custom)).toEqual({ count: 2, qualifiersPerPool: 4, bestOthers: 0 });
    expect(resolvedCourts(custom)).toBe(3);
  });

  it('pools of 4 first, completed with pools of 3', () => {
    const sizes = (n: number) => previewTournament({ ...withTeams(n), name: 'Open' }).pools.map((p) => p.length).sort();
    expect(sizes(10)).toEqual([3, 3, 4]);
    expect(sizes(13)).toEqual([3, 3, 3, 4]);
    expect(sizes(21)).toEqual([3, 3, 3, 4, 4, 4]);
    expect(sizes(16)).toEqual([4, 4, 4, 4]);
  });

  it('changing format goes back to automatic pools', () => {
    const s = { ...withTeams(8), pools: { count: 2, qualifiersPerPool: 1, bestOthers: 0 } };
    expect(setFormat(s, 'pools_knockout').pools).toBeNull();
  });
});

describe('teams', () => {
  it('the count adds "Équipe N" at the end and removes from the end, keeping names', () => {
    let s = withTeams(3);
    s = renameTeam(s, s.teams[1].key, 'Lyon');
    s = setTeamCount(s, 5, label);
    expect(s.teams.map(displayName)).toEqual(['Équipe 1', 'Lyon', 'Équipe 3', 'Équipe 4', 'Équipe 5']);
    expect(s.teams.map((t) => t.color)).toEqual(PRESET_TEAM_COLORS.slice(0, 5));
    s = setTeamCount(s, 2, label);
    expect(s.teams.map(displayName)).toEqual(['Équipe 1', 'Lyon']);
    expect(setTeamCount(s, 1, label).teams).toHaveLength(2); // at least 2
  });

  it('a new team takes the first free number', () => {
    let s = withTeams(3);
    s = { ...s, teams: s.teams.filter((t) => displayName(t) !== 'Équipe 2') };
    expect(setTeamCount(s, 3, label).teams.map(displayName)).toEqual(['Équipe 1', 'Équipe 3', 'Équipe 2']);
  });

  it('names are optional: an empty name falls back to "Équipe N"', () => {
    const s = withTeams(2);
    const cleared = renameTeam(s, s.teams[0].key, '   ');
    expect(displayName(cleared.teams[0])).toBe('Équipe 1');
    expect(toCreateInput({ ...cleared, name: 'Open' }).teams[0].name).toBe('Équipe 1');
  });

  it('"Mes équipes" fills the teams still unnamed, then adds more', () => {
    let s = withTeams(3);
    s = renameTeam(s, s.teams[0].key, 'Lyon');
    s = addLibraryTeams(s, [
      { id: 'a', name: 'Paris', color: '#000001' },
      { id: 'b', name: 'Nice', color: '#000002' },
      { id: 'c', name: 'Caen', color: '#000003' },
    ], label);
    expect(s.teams.map((t) => [displayName(t), t.teamId])).toEqual([
      ['Lyon', null], ['Paris', 'a'], ['Nice', 'b'], ['Caen', 'c'],
    ]);
    expect(s.teams[1].color).toBe('#000001');
    // Already in the tournament: ignored
    expect(addLibraryTeams(s, [{ id: 'a', name: 'Paris', color: '#000001' }], label).teams).toHaveLength(4);
  });

  it('duplicate names point at every team concerned', () => {
    let s = withTeams(4);
    s = renameTeam(s, s.teams[3].key, ' équipe 1 ');
    expect(duplicateTeamKeys(s)).toEqual(new Set([s.teams[0].key, s.teams[3].key]));
    expect(duplicateTeamKeys(withTeams(4)).size).toBe(0);
  });

  it('can be moved up and down (seed order)', () => {
    const s = withTeams(3);
    const moved = moveTeam(s, s.teams[2].key, -1);
    expect(moved.teams.map(displayName)).toEqual(['Équipe 1', 'Équipe 3', 'Équipe 2']);
    expect(moveTeam(s, s.teams[0].key, -1)).toBe(s);
  });
});

describe('dates', () => {
  it('reads and writes DD/MM/YYYY', () => {
    expect(parseDisplayDate('16/05/2026')).toBe('2026-05-16');
    expect(parseDisplayDate('1/5/2026')).toBe('2026-05-01');
    expect(parseDisplayDate('31/02/2026')).toBeNull();
    expect(parseDisplayDate('2026-05-16')).toBeNull();
    expect(displayDate('2026-05-16')).toBe('16/05/2026');
  });

  it('converts to and from the native picker values (local time)', () => {
    const d = dateFromIso('2026-05-16');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 4, 16]);
    expect(isoFromDate(new Date(2026, 0, 3, 23, 59))).toBe('2026-01-03');
    const t = dateFromTime('09:05');
    expect([t.getHours(), t.getMinutes()]).toEqual([9, 5]);
    expect(timeFromDate(new Date(2026, 4, 16, 7, 30))).toBe('07:30');
    expect(timeFromDate(dateFromTime('18:45'))).toBe('18:45');
  });
});

describe('validation by step', () => {
  it('step 1: a name and a valid date', () => {
    const s = initial(1);
    expect(validateStep(s, 1)).toEqual(['name_required']);
    expect(validateStep({ ...s, name: 'Open', date: '' }, 1)).toEqual(['date_invalid']);
    expect(validateStep({ ...s, name: 'Open' }, 1)).toEqual([]);
  });

  it('step 2: the set rules make sense', () => {
    const s = { ...initial(1), name: 'Open' };
    expect(validateStep(s, 2)).toEqual([]);
    expect(validateStep({ ...s, match: { ...s.match, pointsLastSet: 30 } }, 2)).toEqual(['tie_break_too_long']);
  });

  it('step 3: distinct names, valid times, a playable format', () => {
    const s = { ...initial(1), name: 'Open' };
    const dup = renameTeam(s, s.teams[1].key, 'équipe 1');
    expect(validateStep(dup, 3)).toEqual(['team_name_duplicate']);
    expect(validateStep({ ...s, startTime: '25:00' }, 3)).toEqual(['start_time_invalid']);
    expect(validateStep({ ...s, pools: { count: 4, qualifiersPerPool: 2, bestOthers: 2 } }, 3)).toEqual(['pool_too_small']);
    expect(validateStep(s, 3)).toEqual([]);
  });

  it('step 4 checks everything', () => {
    expect(validateStep(initial(), 4)).toEqual(['name_required']);
    expect(validateStep({ ...initial(), name: 'Open' }, 4)).toEqual([]);
  });
});

describe('format hint', () => {
  it('suggests a championship for few teams, pools for many', () => {
    expect(formatHint(withTeams(4))).toBe('round_robin');
    expect(formatHint(setFormat(withTeams(4), 'round_robin'))).toBeNull();
    expect(formatHint(setFormat(withTeams(16), 'round_robin'))).toBe('pools_knockout');
    expect(formatHint(withTeams(16))).toBeNull();
    expect(formatHint(setFormat(withTeams(16), 'knockout'))).toBeNull(); // a deliberate choice
  });
});

describe('creation input', () => {
  it('builds rules, schedule and teams for the service', () => {
    const s = { ...withTeams(8), name: '  Open de Lyon ', location: ' Gymnase ' };
    const input = toCreateInput(s);
    expect(input).toMatchObject({
      name: 'Open de Lyon', date: '2026-05-16', location: 'Gymnase', gameType: 'indoor_6v6',
      format: 'pools_knockout', seeding: 'random', seed: 42,
      schedule: { courts: 2, startTime: '09:00', matchMinutes: 45, restMinutes: 0 },
    });
    expect(input.rules.pools).toEqual(defaultPoolRules(8));
    expect(input.rules.knockout).toEqual({ thirdPlace: true });
    expect(input.teams.map((t) => t.name)).toEqual(s.teams.map(displayName));
    expect(input.teams.every((t) => t.seedRank === null)).toBe(true);
    expect(toCreateInput({ ...s, location: '  ' }).location).toBeNull();
  });

  it('seeded: the order of the list is the seed order', () => {
    const input = toCreateInput({ ...withTeams(4), name: 'Open', seeding: 'seeded' });
    expect(input.teams.map((t) => t.seedRank)).toEqual([1, 2, 3, 4]);
  });

  it('no pools outside "pools + finals"', () => {
    expect(toCreateInput(setFormat({ ...withTeams(6), name: 'Open' }, 'round_robin')).rules.pools).toBeNull();
  });
});

describe('preview (estimate shown with the number of teams)', () => {
  it('pools, number of matches, estimated end and duration, deterministic', () => {
    const s = { ...withTeams(8), name: 'Open' };
    const p = previewTournament(s);
    expect(p.errors).toEqual([]);
    expect(p.pools).toHaveLength(2);
    expect(p.pools.flat().sort()).toEqual(s.teams.map(displayName).sort());
    expect(p.matchCount).toBe(16);
    expect(p.endTime).toMatch(/^\d\d:\d\d$/);
    expect(p.durationMinutes! % 45).toBe(0);
    expect(previewTournament(s)).toEqual(p);
  });

  it('more courts, shorter tournament', () => {
    const s = withTeams(16);
    expect(previewTournament({ ...s, courts: 4 }).durationMinutes!).toBeLessThan(previewTournament({ ...s, courts: 1 }).durationMinutes!);
  });

  it('"Retirer au sort" (another seed) changes the pools', () => {
    const s = { ...withTeams(16), name: 'Open' };
    expect(previewTournament({ ...s, seed: 1 }).pools).not.toEqual(previewTournament({ ...s, seed: 2 }).pools);
  });

  it('reports setup errors instead of a planning', () => {
    const p = previewTournament({ ...withTeams(8), pools: { count: 4, qualifiersPerPool: 2, bestOthers: 2 } });
    expect(p.errors).toEqual(['pool_too_small']);
    expect([p.matchCount, p.durationMinutes]).toEqual([0, null]);
  });
});

describe('templates', () => {
  it('keep the rules and planning settings, not the teams or the name', () => {
    const s = { ...withTeams(8), name: 'Open', gameType: 'beach_2v2' as const, courts: 3, restMinutes: 0 };
    const payload = templatePayload(s);
    expect(payload).toMatchObject({ gameType: 'beach_2v2', format: 'pools_knockout', seeding: 'random' });
    expect(payload.schedule).toEqual({ courts: 3, startTime: '09:00', matchMinutes: 45, restMinutes: 0 });
    // Automatic pools stay automatic
    expect(payload.rules.pools).toBeNull();

    const fresh = withTeams(5, initial(9));
    const applied = applyTemplate(fresh, payload);
    expect(applied).toMatchObject({ gameType: 'beach_2v2', courts: 3, restMinutes: 0, pools: null, name: '', seed: 9 });
    expect(applied.teams).toEqual(fresh.teams);
  });

  it('custom pools are kept', () => {
    const s = { ...withTeams(8), pools: { count: 2, qualifiersPerPool: 1, bestOthers: 0 } };
    expect(applyTemplate(initial(1), templatePayload(s)).pools).toEqual({ count: 2, qualifiersPerPool: 1, bestOthers: 0 });
  });
});

describe('Brassage + niveaux', () => {
  it('is the default format in 4×4, 3×3 and 2×2; 6×6 keeps pools + finals', () => {
    expect(initial().format).toBe('pools_knockout');
    for (const type of ['indoor_4v4', 'indoor_3v3', 'beach_2v2'] as const) {
      expect(setGameType(initial(), type).format).toBe('brassage_levels');
    }
    expect(setGameType(setGameType(initial(), 'indoor_4v4'), 'indoor_6v6').format).toBe('pools_knockout');
  });

  it('rounds and levels follow the number of teams until set by hand', () => {
    const s = setGameType(initial(), 'indoor_4v4');
    expect(resolvedBrassage(withTeams(10, s))).toEqual({ rounds: 1, levels: 2 });
    expect(resolvedBrassage(withTeams(16, s))).toEqual({ rounds: 2, levels: 2 });
    expect(resolvedBrassage(withTeams(24, s))).toEqual({ rounds: 2, levels: 3 });
    expect(resolvedBrassage({ ...withTeams(24, s), brassage: { rounds: 3, levels: 2 } })).toEqual({ rounds: 3, levels: 2 });
    expect(toCreateInput({ ...withTeams(24, s), name: 'Open' }).rules.brassage).toEqual(defaultBrassageRules(24));
    expect(toCreateInput({ ...withTeams(8), name: 'Open' }).rules.brassage).toBeNull();
  });

  it('the estimate tells how many matches each team plays', () => {
    const s = { ...withTeams(16, setGameType(initial(), 'indoor_4v4')), name: 'Open' };
    const p = previewTournament(s);
    expect(p.errors).toEqual([]);
    expect(p.matchesPerTeam).toEqual({ min: 9, max: 9 });
    // Round 1 pools only: the next ones depend on the results
    expect(p.pools).toHaveLength(4);
    expect(previewTournament({ ...withTeams(6), name: 'Open', format: 'round_robin' }).matchesPerTeam).toEqual({ min: 5, max: 5 });
  });

  it('too few teams: an error, and a championship is suggested', () => {
    const s = withTeams(4, setGameType(initial(), 'indoor_3v3'));
    expect(validateStep(s, 3)).toEqual(['brassage_too_few_teams']);
    expect(formatHint(s)).toBe('round_robin');
    expect(formatHint(withTeams(8, setGameType(initial(), 'indoor_3v3')))).toBeNull();
  });

  it('templates keep automatic rounds and levels automatic', () => {
    const s = withTeams(16, setGameType(initial(), 'indoor_4v4'));
    expect(templatePayload(s).rules.brassage).toBeNull();
    const custom = { ...s, brassage: { rounds: 3, levels: 2 } };
    expect(applyTemplate(initial(), templatePayload(custom)).brassage).toEqual({ rounds: 3, levels: 2 });
  });
});
