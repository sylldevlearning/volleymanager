import { FakeSqlDb } from './helpers/fakeSqlDb';

let mockIdCounter = 0;
jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => `id-${++mockIdCounter}`),
}));

import { getDb } from '../src/services/database';
import {
  createTournament,
  deleteTournament,
  getTournamentBundle,
  getTournaments,
  recordTournamentResult,
  rescheduleTournament,
  renameTournamentTeam,
  saveTemplate,
  getTemplates,
  deleteTemplate,
  TournamentSetupError,
  type CreateTournamentInput,
} from '../src/services/tournamentService';
import { defaultRules, defaultSchedule } from '../src/features/tournament/engine/defaults';
import type { SetScore } from '../src/models/tournament';

const mockGetDb = getDb as jest.Mock;
let db: FakeSqlDb;

beforeEach(() => {
  mockIdCounter = 0;
  db = new FakeSqlDb();
  mockGetDb.mockResolvedValue(db);
});

function input(n: number, overrides: Partial<CreateTournamentInput> = {}): CreateTournamentInput {
  return {
    name: 'Tournoi de printemps',
    date: '2026-05-16',
    location: 'Gymnase Jean Moulin',
    gameType: 'indoor_6v6',
    format: 'pools_knockout',
    rules: defaultRules('indoor_6v6', 'pools_knockout', n),
    schedule: defaultSchedule('indoor_6v6', n),
    seeding: 'random',
    seed: 1234,
    teams: Array.from({ length: n }, (_, i) => ({
      teamId: i === 0 ? 'my-team' : null,
      name: `Équipe ${i + 1}`,
      color: '#1D4ED8',
      seedRank: null,
    })),
    ...overrides,
  };
}

const WIN: SetScore[] = [[25, 10], [25, 10]];

test('creates a tournament with its pools, teams and planned matches', async () => {
  const bundle = await createTournament(input(8));
  expect(bundle.tournament).toMatchObject({ name: 'Tournoi de printemps', location: 'Gymnase Jean Moulin', seed: 1234, status: 'live' });
  expect(bundle.tournament.secret).toHaveLength(32);
  expect(bundle.pools.map((p) => p.name)).toEqual(['A', 'B']);
  expect(bundle.teams).toHaveLength(8);
  expect(bundle.teams[0]).toMatchObject({ teamId: 'my-team', name: 'Équipe 1' });
  expect(bundle.teams.every((t) => t.poolId !== null)).toBe(true);
  // 2 pools of 4 (12 matches) + 2 semis, final, 3rd place
  expect(bundle.matches).toHaveLength(16);
  expect(bundle.matches.every((m) => m.court !== null && m.scheduledAt !== null)).toBe(true);
  expect(bundle.matches.find((m) => m.label === 'ko:2:1')!.homeSource).toEqual({ type: 'winner', match: expect.stringContaining(bundle.tournament.id) });
  expect(bundle.matches.filter((m) => m.slot === 0).every((m) => m.scheduledAt === '2026-05-16T09:00')).toBe(true);
});

test('reads it back identically', async () => {
  const created = await createTournament(input(8));
  expect(await getTournamentBundle(created.tournament.id)).toEqual(created);
  expect((await getTournaments()).map((t) => t.id)).toEqual([created.tournament.id]);
});

test('the same seed draws the same pools', async () => {
  const a = await createTournament(input(16));
  const b = await createTournament(input(16));
  const poolsOf = (bundle: typeof a) => bundle.pools.map((p) => bundle.teams.filter((t) => t.poolId === p.id).map((t) => t.name).sort());
  expect(poolsOf(a)).toEqual(poolsOf(b));
});

test('refuses an invalid setup without saving anything', async () => {
  await expect(createTournament(input(1, { format: 'round_robin', rules: defaultRules('indoor_6v6', 'round_robin', 1) })))
    .rejects.toEqual(new TournamentSetupError(['too_few_teams']));
  expect(await getTournaments()).toEqual([]);
});

test('records a result, fills the bracket, keeps it after reload', async () => {
  const { tournament, matches } = await createTournament(input(8, { format: 'knockout', rules: defaultRules('indoor_6v6', 'knockout', 8) }));
  const quarter = matches.find((m) => m.label === 'ko:8:1')!;
  const outcome = await recordTournamentResult(tournament.id, quarter.id, { sets: WIN, forfeitId: null, source: 'manual' });
  expect(outcome.ok).toBe(true);

  const reloaded = (await getTournamentBundle(tournament.id))!;
  const saved = reloaded.matches.find((m) => m.id === quarter.id)!;
  expect(saved).toMatchObject({ status: 'validated', sets: WIN, winnerId: quarter.homeId, resultSource: 'manual' });
  expect(saved.validatedAt).not.toBeNull();
  const semi = reloaded.matches.find((m) => m.homeSource?.type === 'winner' && m.homeSource.match === quarter.id)!;
  expect(semi.homeId).toBe(quarter.homeId);
});

test('an invalid score or a blocked correction saves nothing', async () => {
  const { tournament, matches } = await createTournament(input(4, { format: 'knockout', rules: defaultRules('indoor_6v6', 'knockout', 4) }));
  const semi = matches.find((m) => m.label === 'ko:4:1')!;
  expect(await recordTournamentResult(tournament.id, semi.id, { sets: [[25, 24]], forfeitId: null, source: 'manual' }))
    .toEqual({ ok: false, reason: 'invalid_score', errors: [{ code: 'set_not_finished', set: 1 }] });

  await recordTournamentResult(tournament.id, semi.id, { sets: WIN, forfeitId: null, source: 'manual' });
  await recordTournamentResult(tournament.id, matches.find((m) => m.label === 'ko:4:2')!.id, { sets: WIN, forfeitId: null, source: 'manual' });
  const final = (await getTournamentBundle(tournament.id))!.matches.find((m) => m.label === 'ko:2:1')!;
  await recordTournamentResult(tournament.id, final.id, { sets: WIN, forfeitId: null, source: 'manual' });

  // Turning the semi around would change the finalists of a played final
  const before = await getTournamentBundle(tournament.id);
  const outcome = await recordTournamentResult(tournament.id, semi.id, { sets: [[10, 25], [10, 25]], forfeitId: null, source: 'manual' });
  expect(outcome).toEqual({ ok: false, reason: 'blocked', blockedBy: [final.id] });
  expect(await getTournamentBundle(tournament.id)).toEqual(before);
});

test('the tournament is finished when every match is validated', async () => {
  const { tournament } = await createTournament(input(4, { format: 'knockout', rules: { ...defaultRules('indoor_6v6', 'knockout', 4), knockout: { thirdPlace: false } } }));
  for (const label of ['ko:4:1', 'ko:4:2', 'ko:2:1']) {
    const m = (await getTournamentBundle(tournament.id))!.matches.find((x) => x.label === label)!;
    await recordTournamentResult(tournament.id, m.id, { sets: WIN, forfeitId: null, source: 'manual' });
  }
  expect((await getTournamentBundle(tournament.id))!.tournament.status).toBe('finished');
});

test('rescheduling moves only the matches still to play', async () => {
  const { tournament, matches } = await createTournament(input(8));
  const first = matches.find((m) => m.slot === 0 && m.court === 2)!;
  await recordTournamentResult(tournament.id, first.id, { sets: WIN, forfeitId: null, source: 'manual' });

  const bundle = await rescheduleTournament(tournament.id, { ...tournament.schedule, courts: 1, startTime: '10:00' });
  expect(bundle.tournament.schedule).toMatchObject({ courts: 1, startTime: '10:00' });
  const kept = bundle.matches.find((m) => m.id === first.id)!;
  expect([kept.slot, kept.court, kept.scheduledAt]).toEqual([first.slot, first.court, first.scheduledAt]);
  const moved = bundle.matches.filter((m) => m.status === 'scheduled');
  expect(moved.every((m) => m.court === 1)).toBe(true);
  expect(await getTournamentBundle(tournament.id)).toEqual(bundle);
});

test('deleting a tournament deletes everything in it', async () => {
  const a = await createTournament(input(8));
  const b = await createTournament(input(4, { format: 'round_robin', rules: defaultRules('indoor_6v6', 'round_robin', 4) }));
  await deleteTournament(a.tournament.id);
  expect(await getTournamentBundle(a.tournament.id)).toBeNull();
  expect(db.tables.get('tournament_matches')!.every((r) => r.tournament_id === b.tournament.id)).toBe(true);
  expect(db.tables.get('tournament_teams')!.every((r) => r.tournament_id === b.tournament.id)).toBe(true);
  expect(db.tables.get('tournament_pools')!.every((r) => r.tournament_id === b.tournament.id)).toBe(true);
});

test('templates: saved without the teams, listed, deleted', async () => {
  const i = input(8);
  const tpl = await saveTemplate('Plateau 6×6 du samedi', { gameType: i.gameType, format: i.format, rules: i.rules, schedule: i.schedule, seeding: i.seeding });
  expect(await getTemplates()).toEqual([tpl]);
  expect(tpl.payload).toEqual({ gameType: 'indoor_6v6', format: 'pools_knockout', rules: i.rules, schedule: i.schedule, seeding: 'random' });
  await deleteTemplate(tpl.id);
  expect(await getTemplates()).toEqual([]);
});

test('a team can be renamed after creation — not empty, not like another team', async () => {
  const { tournament, teams } = await createTournament(input(4, { format: 'round_robin', rules: defaultRules('indoor_6v6', 'round_robin', 4) }));
  expect(await renameTournamentTeam(tournament.id, teams[0].id, '  Les Requins ')).toEqual({ ok: true });
  expect((await getTournamentBundle(tournament.id))!.teams[0].name).toBe('Les Requins');
  expect(await renameTournamentTeam(tournament.id, teams[1].id, '   ')).toEqual({ ok: false, reason: 'empty' });
  expect(await renameTournamentTeam(tournament.id, teams[1].id, 'les requins')).toEqual({ ok: false, reason: 'duplicate' });
  expect((await getTournamentBundle(tournament.id))!.teams[1].name).toBe('Équipe 2');
});
