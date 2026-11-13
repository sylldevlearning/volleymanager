/**
 * Match summary: a match ended before its end is "stopped" (no winner, score
 * at the moment it stopped, current set included); the team chart groups its
 * bars by skill and says when no statistic was recorded; no English
 * abbreviation is hard-coded.
 */
import fs from 'fs';
import path from 'path';
import { FakeSqlDb } from './helpers/fakeSqlDb';

let mockIdCounter = 0;
jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => `id-${++mockIdCounter}`),
}));

import { getDb } from '../src/services/database';
import { createMatch, createSet, updateSet, getMatchById, getSetsForMatch } from '../src/services/matchService';
import { addEvent } from '../src/services/eventService';
import { stopMatch } from '../src/services/stopMatchService';
import { summarizeMatch } from '../src/features/match/matchSummary';
import { resultQrOf } from '../src/features/tournament/matchQr';
import { DEFAULT_INDOOR_CONFIG, type Match, type MatchSet } from '../src/models/match';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LOCALES = fs.readdirSync(path.join(ROOT, 'src/i18n')).filter((f) => f.endsWith('.json'));

const mockGetDb = getDb as jest.Mock;
beforeEach(() => {
  mockIdCounter = 0;
  mockGetDb.mockResolvedValue(new FakeSqlDb());
});

function set(n: number, home: number, away: number, winner: string | null): MatchSet {
  return {
    id: `s${n}`, matchId: 'm', setNumber: n, scoreHome: home, scoreAway: away, winnerTeamId: winner,
    servingTeamId: null, startedAt: '', finishedAt: winner ? 'x' : null,
  };
}
const base = { id: 'm', teamHomeId: 'H', teamAwayId: 'A', status: 'finished' } as Match;

describe('summarizeMatch', () => {
  it('a won match: winner, sets won, every set', () => {
    const s = summarizeMatch({ ...base, winnerTeamId: 'H' }, [set(1, 25, 20, 'H'), set(2, 25, 22, 'H'), set(3, 25, 18, 'H')], {});
    expect(s).toMatchObject({ stopped: false, winnerTeamId: 'H', setsHome: 3, setsAway: 0 });
    expect(s.sets.map((x) => [x.scoreHome, x.scoreAway, x.stopped])).toEqual([[25, 20, false], [25, 22, false], [25, 18, false]]);
  });

  it('a stopped match: no winner, the current set at its score when stopped', () => {
    const s = summarizeMatch({ ...base, winnerTeamId: null }, [set(1, 25, 20, 'H'), set(2, 0, 0, null)], { s2: { home: 12, away: 9 } });
    expect(s.stopped).toBe(true);
    expect(s.winnerTeamId).toBeNull();
    expect(s.setsHome).toBe(1);
    expect(s.sets[1]).toMatchObject({ setNumber: 2, scoreHome: 12, scoreAway: 9, stopped: true });
  });

  it('an empty set opened just before stopping is not listed', () => {
    const s = summarizeMatch({ ...base, winnerTeamId: null }, [set(1, 25, 20, 'H'), set(2, 0, 0, null)], { s2: { home: 0, away: 0 } });
    expect(s.sets).toHaveLength(1);
  });

  it('a live match is not stopped', () => {
    expect(summarizeMatch({ ...base, status: 'live', winnerTeamId: null }, [set(1, 3, 2, null)], {}).stopped).toBe(false);
  });
});

describe('stopMatch', () => {
  it('saves the current set score, no winner, match finished', async () => {
    const m = await createMatch({ format: 'indoor_6v6', mode: 'competition', teamHomeId: 'H', teamAwayId: 'A', config: DEFAULT_INDOOR_CONFIG });
    const s1 = await createSet(m.id, 1);
    await updateSet(s1.id, 25, 21, 'H');
    const s2 = await createSet(m.id, 2);
    for (const type of ['point_home', 'point_away', 'point_home'] as const) {
      await addEvent({ matchId: m.id, setId: s2.id, eventType: type, playerId: null, teamId: null, details: {} });
    }

    await stopMatch(m.id);

    const after = (await getMatchById(m.id))!;
    expect(after.status).toBe('finished');
    expect(after.winnerTeamId).toBeNull();
    const sets = await getSetsForMatch(m.id);
    expect(sets.map((s) => [s.scoreHome, s.scoreAway, s.winnerTeamId])).toEqual([[25, 21, 'H'], [2, 1, null]]);
  });

  it('both end-match buttons stop the match', () => {
    for (const screen of ['app/match/[id]/referee.tsx', 'app/match/[id]/arbitrage.tsx']) {
      const src = read(screen);
      expect(src).toMatch(/await stopMatch\(match\.id\)/);
      expect(src).not.toMatch(/updateMatchStatus\(match\.id, 'finished'\);/);
    }
  });
});

describe('result QR', () => {
  it('a stopped tournament match gives no result QR', () => {
    const match = {
      ...base, winnerTeamId: null,
      config: { ...DEFAULT_INDOOR_CONFIG, tournamentRef: { tournamentId: 't', matchId: 'tm', secret: 'x' } },
    } as unknown as Match;
    expect(resultQrOf(match, 'A', 'B', [set(1, 25, 20, 'H'), set(2, 10, 8, null)])).toBeNull();
  });
});

describe('summary screen', () => {
  const src = read('app/match/[id]/summary.tsx');

  it('uses the summary (stopped state, set scores from the events)', () => {
    expect(src).toMatch(/summarizeMatch\(/);
    expect(src).toMatch(/t\('summary\.stopped'\)/);
    expect(src).not.toMatch(/match\.winnerTeamId === match\.teamHomeId \? homeTeam : awayTeam/);
  });

  it('no hard-coded English abbreviation', () => {
    for (const label of ['"Ace"', '"Kill"', '"Srv%"', '"Atk%"', '"Rec%"', '>Set {']) expect(src).not.toContain(label);
    expect(src).toMatch(/t\('stats\.short\.points'\)/);
  });

  it('a message when no player stat was recorded', () => {
    expect(src).toMatch(/t\('summary\.noTeamStats'\)/);
  });
});

describe('texts in the 11 languages', () => {
  const KEYS = [
    'summary.stopped', 'summary.stoppedHint', 'summary.setNumber', 'summary.setStopped', 'summary.noTeamStats',
    'stats.short.aces', 'stats.short.points', 'stats.short.serve', 'stats.short.attack', 'stats.short.reception',
  ];
  it.each(LOCALES)('%s', (f) => {
    const json = JSON.parse(read(`src/i18n/${f}`));
    for (const key of KEYS) {
      const value = key.split('.').reduce((o: Record<string, unknown>, k) => o?.[k] as Record<string, unknown>, json) as unknown;
      expect(typeof value).toBe('string');
    }
    expect(json.stats.short.serve).not.toBe('Srv%');
  });
});
