import {
  addQuickTeam,
  dateFromIso,
  dateFromTime,
  isoFromDate,
  timeFromDate,
  applyTemplate,
  displayDate,
  formatHint,
  initialWizardState,
  moveTeam,
  parseDisplayDate,
  previewTournament,
  resolvedCourts,
  resolvedPools,
  setFormat,
  setGameType,
  templatePayload,
  toCreateInput,
  validateStep,
  type WizardState,
} from '../src/features/tournament/wizard';
import { defaultPoolRules, defaultSetRules } from '../src/features/tournament/engine/defaults';
import { PRESET_TEAM_COLORS } from '../src/utils/constants';

const TODAY = new Date(2026, 4, 16, 10, 30); // 16 May 2026

function withTeams(n: number, base: WizardState = initialWizardState(TODAY, 42)): WizardState {
  let s = base;
  for (let i = 0; i < n; i++) s = addQuickTeam(s, `Équipe ${i + 1}`);
  return s;
}

describe('defaults', () => {
  it('a 6×6 tournament today, pools + finals, 9:00, 45 min, 10 min rest', () => {
    const s = initialWizardState(TODAY, 42);
    expect(s).toMatchObject({
      name: '', date: '2026-05-16', location: '', gameType: 'indoor_6v6', format: 'pools_knockout',
      match: defaultSetRules('indoor_6v6'), finalsMatch: null, thirdPlace: true, legs: 1,
      pools: null, courts: null, startTime: '09:00', matchMinutes: 45, restMinutes: 10,
      seeding: 'random', seed: 42, teams: [],
    });
    expect(s.points).toEqual({ winClear: 3, winTight: 2, lossTight: 1, lossClear: 0, forfeitLoss: 0 });
  });

  it('the game type sets its own set rules and match duration', () => {
    const s = setGameType(initialWizardState(TODAY, 1), 'beach_2v2');
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

  it('changing format goes back to automatic pools', () => {
    const s = { ...withTeams(8), pools: { count: 2, qualifiersPerPool: 1, bestOthers: 0 } };
    expect(setFormat(s, 'pools_knockout').pools).toBeNull();
  });
});

describe('teams', () => {
  it('typed by name only: trimmed, a colour each', () => {
    const s = addQuickTeam(addQuickTeam(initialWizardState(TODAY, 1), '  Lyon  '), 'Paris');
    expect(s.teams.map((t) => [t.name, t.teamId, t.color])).toEqual([
      ['Lyon', null, PRESET_TEAM_COLORS[0]],
      ['Paris', null, PRESET_TEAM_COLORS[1]],
    ]);
    expect(new Set(s.teams.map((t) => t.key)).size).toBe(2);
  });

  it('ignores an empty name', () => {
    expect(addQuickTeam(initialWizardState(TODAY, 1), '   ').teams).toEqual([]);
  });

  it('can be moved up and down (seed order)', () => {
    const s = withTeams(3);
    const moved = moveTeam(s, s.teams[2].key, -1);
    expect(moved.teams.map((t) => t.name)).toEqual(['Équipe 1', 'Équipe 3', 'Équipe 2']);
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
    const s = initialWizardState(TODAY, 1);
    expect(validateStep(s, 1)).toEqual(['name_required']);
    expect(validateStep({ ...s, name: 'Open', date: '' }, 1)).toEqual(['date_invalid']);
    expect(validateStep({ ...s, name: 'Open' }, 1)).toEqual([]);
  });

  it('step 2: the set rules make sense', () => {
    const s = { ...initialWizardState(TODAY, 1), name: 'Open' };
    expect(validateStep(s, 2)).toEqual([]);
    expect(validateStep({ ...s, match: { ...s.match, pointsLastSet: 30 } }, 2)).toEqual(['tie_break_too_long']);
  });

  it('step 3: enough teams, distinct names, valid times, a playable format', () => {
    const s = { ...initialWizardState(TODAY, 1), name: 'Open' };
    expect(validateStep(s, 3)).toEqual(['too_few_teams']);
    const dup = withTeams(4, s);
    dup.teams[1] = { ...dup.teams[1], name: 'équipe 1' };
    expect(validateStep(dup, 3)).toContain('team_name_duplicate');
    expect(validateStep({ ...withTeams(8, s), startTime: '25:00' }, 3)).toEqual(['start_time_invalid']);
    expect(validateStep({ ...withTeams(8, s), pools: { count: 4, qualifiersPerPool: 2, bestOthers: 2 } }, 3)).toEqual(['pool_too_small']);
    expect(validateStep(withTeams(8, s), 3)).toEqual([]);
  });

  it('step 4 checks everything', () => {
    expect(validateStep(withTeams(8), 4)).toEqual(['name_required']);
    expect(validateStep({ ...withTeams(8), name: 'Open' }, 4)).toEqual([]);
  });
});

describe('format hint', () => {
  it('suggests a championship for few teams, pools for many', () => {
    expect(formatHint(withTeams(4))).toBe('round_robin');
    expect(formatHint(setFormat(withTeams(4), 'round_robin'))).toBeNull();
    expect(formatHint(setFormat(withTeams(16), 'round_robin'))).toBe('pools_knockout');
    expect(formatHint(withTeams(16))).toBeNull();
    expect(formatHint(setFormat(withTeams(16), 'knockout'))).toBeNull(); // a deliberate choice
    expect(formatHint(initialWizardState(TODAY, 1))).toBeNull();
  });
});

describe('creation input', () => {
  it('builds rules, schedule and teams for the service', () => {
    const s = { ...withTeams(8), name: '  Open de Lyon ', location: ' Gymnase ' };
    const input = toCreateInput(s);
    expect(input).toMatchObject({
      name: 'Open de Lyon', date: '2026-05-16', location: 'Gymnase', gameType: 'indoor_6v6',
      format: 'pools_knockout', seeding: 'random', seed: 42,
      schedule: { courts: 2, startTime: '09:00', matchMinutes: 45, restMinutes: 10 },
    });
    expect(input.rules.pools).toEqual(defaultPoolRules(8));
    expect(input.rules.knockout).toEqual({ thirdPlace: true });
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

describe('preview', () => {
  it('pools, number of matches and estimated end, deterministic', () => {
    const s = { ...withTeams(8), name: 'Open' };
    const p = previewTournament(s);
    expect(p.errors).toEqual([]);
    expect(p.pools).toHaveLength(2);
    expect(p.pools.flat().sort()).toEqual(s.teams.map((t) => t.name).sort());
    expect(p.matchCount).toBe(16);
    expect(p.endTime).toMatch(/^\d\d:\d\d$/);
    expect(previewTournament(s)).toEqual(p);
  });

  it('"Retirer au sort" (another seed) changes the pools', () => {
    const s = { ...withTeams(16), name: 'Open' };
    expect(previewTournament({ ...s, seed: 1 }).pools).not.toEqual(previewTournament({ ...s, seed: 2 }).pools);
  });

  it('reports setup errors instead of a planning', () => {
    const p = previewTournament(withTeams(1));
    expect(p.errors).toEqual(['too_few_teams']);
    expect(p.matchCount).toBe(0);
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

    const fresh = withTeams(5, initialWizardState(TODAY, 9));
    const applied = applyTemplate(fresh, payload);
    expect(applied).toMatchObject({ gameType: 'beach_2v2', courts: 3, restMinutes: 0, pools: null, name: '', seed: 9 });
    expect(applied.teams).toEqual(fresh.teams);
  });

  it('custom pools are kept', () => {
    const s = { ...withTeams(8), pools: { count: 2, qualifiersPerPool: 1, bestOthers: 0 } };
    expect(applyTemplate(initialWizardState(TODAY, 1), templatePayload(s)).pools).toEqual({ count: 2, qualifiersPerPool: 1, bestOthers: 0 });
  });
});
