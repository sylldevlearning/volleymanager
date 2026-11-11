import { FakeSqlDb } from './helpers/fakeSqlDb';

let mockIdCounter = 0;
jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => `id-${++mockIdCounter}`),
}));

import { getDb } from '../src/services/database';
import { createMatchFromQr } from '../src/services/qrMatchService';
import { createQuickMatch, renameQuickMatchTeam } from '../src/services/quickMatchService';
import {
  canRenameTeams,
  normalizeTeamName,
  TEAM_NAME_MAX_LENGTH,
} from '../src/features/match/teamRename';
import { checkResultQr, quickMatchConfig, resultQrOf, type MatchQr } from '../src/features/tournament/matchQr';
import type { TournamentBundle } from '../src/features/tournament/bundle';
import { DEFAULT_INDOOR_CONFIG, type Match, type MatchSet } from '../src/models/match';
import type { TournamentMatch } from '../src/models/tournament';

const baseMatch: Match = {
  id: 'm1',
  format: 'indoor_6v6',
  mode: 'leisure',
  teamHomeId: 'th',
  teamAwayId: 'ta',
  status: 'live',
  config: { ...DEFAULT_INDOOR_CONFIG, quickMatch: true },
} as Match;

describe('normalizeTeamName', () => {
  it('trims and collapses spaces', () => {
    expect(normalizeTeamName('  Les   Aigles  ')).toBe('Les Aigles');
  });

  it('rejects an empty name', () => {
    expect(normalizeTeamName('')).toBeNull();
    expect(normalizeTeamName('   ')).toBeNull();
  });

  it(`accepts ${TEAM_NAME_MAX_LENGTH} characters, not more`, () => {
    expect(normalizeTeamName('a'.repeat(TEAM_NAME_MAX_LENGTH))).toHaveLength(TEAM_NAME_MAX_LENGTH);
    expect(normalizeTeamName('a'.repeat(TEAM_NAME_MAX_LENGTH + 1))).toBeNull();
  });
});

describe('canRenameTeams', () => {
  it('quick match, not finished: yes', () => {
    expect(canRenameTeams(baseMatch)).toBe(true);
    expect(canRenameTeams({ ...baseMatch, status: 'created' })).toBe(true);
  });

  it('finished quick match: no', () => {
    expect(canRenameTeams({ ...baseMatch, status: 'finished' })).toBe(false);
  });

  it('other matches (team library, arbitrage, quick matches before 1.2.0): no', () => {
    expect(canRenameTeams({ ...baseMatch, config: { ...DEFAULT_INDOOR_CONFIG } })).toBe(false);
  });
});

const qr: MatchQr = {
  format: 'beach_2v2',
  home: { name: 'Sable', color: '#F59E0B' },
  away: { name: 'Vagues', color: '#1D4ED8' },
  rules: { setsToWin: 2, pointsPerSet: 21, pointsLastSet: 15, winMargin: 2, tieBreak: true },
};

describe('quick match flag', () => {
  it('the Quick match button creates a renamable match', async () => {
    const db = new FakeSqlDb();
    (getDb as jest.Mock).mockResolvedValue(db);
    const match = await createQuickMatch();
    expect(match.config.quickMatch).toBe(true);
    expect(match).toMatchObject({ format: 'indoor_6v6', mode: 'leisure' });
  });

  it('a match QR creates a renamable match', async () => {
    const db = new FakeSqlDb();
    (getDb as jest.Mock).mockResolvedValue(db);
    const match = await createMatchFromQr(qr);
    expect(match.config.quickMatch).toBe(true);
  });

  it('a tournament match QR keeps the tournament names of the teams', () => {
    const config = quickMatchConfig({ ...qr, ref: { tournamentId: 't', matchId: 'm', homeTeamId: 'h', awayTeamId: 'a' } });
    expect(config.tournamentRef).toMatchObject({ homeName: 'Sable', awayName: 'Vagues' });
  });
});

describe('renameQuickMatchTeam', () => {
  function dbWith(match: Match) {
    const runAsync = jest.fn().mockResolvedValue(undefined);
    const row = {
      id: match.id,
      format: match.format,
      mode: match.mode,
      team_home_id: match.teamHomeId,
      team_away_id: match.teamAwayId,
      status: match.status,
      config_json: JSON.stringify(match.config),
      created_at: '2026-11-11',
      updated_at: '2026-11-11',
    };
    return { runAsync, getFirstAsync: jest.fn().mockResolvedValue(row), getAllAsync: jest.fn().mockResolvedValue([]) };
  }

  it('renames the side team and clears its short name (label follows the new name)', async () => {
    const db = dbWith(baseMatch);
    (getDb as jest.Mock).mockResolvedValue(db);
    await expect(renameQuickMatchTeam('m1', 'away', '  Les Aigles ')).resolves.toBe('Les Aigles');
    const [sql, params] = db.runAsync.mock.calls[0];
    expect(sql).toMatch(/UPDATE teams SET name = \?, short_name = \?/);
    expect(params).toEqual(['Les Aigles', null, expect.any(String), 'ta']);
  });

  it('refuses an invalid name or a match that cannot be renamed', async () => {
    const db = dbWith(baseMatch);
    (getDb as jest.Mock).mockResolvedValue(db);
    await expect(renameQuickMatchTeam('m1', 'home', '   ')).resolves.toBeNull();
    const finished = dbWith({ ...baseMatch, status: 'finished' });
    (getDb as jest.Mock).mockResolvedValue(finished);
    await expect(renameQuickMatchTeam('m1', 'home', 'Nouveau')).resolves.toBeNull();
    expect(db.runAsync).not.toHaveBeenCalled();
    expect(finished.runAsync).not.toHaveBeenCalled();
  });
});

describe('renamed teams and the tournament result QR', () => {
  const sets: MatchSet[] = [
    { setNumber: 1, scoreHome: 21, scoreAway: 18, winnerTeamId: 'th' },
    { setNumber: 2, scoreHome: 21, scoreAway: 15, winnerTeamId: 'th' },
  ] as MatchSet[];

  const bundle = {
    tournament: { id: 't' },
    matches: [{ id: 'm', homeId: 'h', awayId: 'a', status: 'scheduled', sets: [] } as unknown as TournamentMatch],
    teams: [
      { id: 'h', name: 'Sable' },
      { id: 'a', name: 'Vagues' },
    ],
  } as unknown as TournamentBundle;

  it('with team ids: still matched by id after a renaming', () => {
    const config = quickMatchConfig({ ...qr, ref: { tournamentId: 't', matchId: 'm', homeTeamId: 'h', awayTeamId: 'a' } });
    const match = { ...baseMatch, status: 'finished', config } as Match;
    const result = resultQrOf(match, 'Les Aigles', 'Les Requins', sets)!;
    expect(result.ref).toEqual({ tournamentId: 't', matchId: 'm', homeTeamId: 'h', awayTeamId: 'a' });
    expect(checkResultQr(bundle, result)).toMatchObject({ ok: true });
  });

  it('older QR without team ids: the result carries the tournament names, not the new ones', () => {
    const config = quickMatchConfig({ ...qr, ref: { tournamentId: 't', matchId: 'm' } });
    const match = { ...baseMatch, status: 'finished', config } as Match;
    const result = resultQrOf(match, 'Les Aigles', 'Les Requins', sets)!;
    expect(result).toMatchObject({ home: 'Sable', away: 'Vagues' });
    expect(result.ref).toEqual({ tournamentId: 't', matchId: 'm' });
    expect(checkResultQr(bundle, result)).toMatchObject({ ok: true });
  });
});
