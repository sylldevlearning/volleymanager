import fs from 'fs';
import path from 'path';
import { FakeSqlDb } from './helpers/fakeSqlDb';

let mockIdCounter = 0;
jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => `id-${++mockIdCounter}`),
}));

import { getDb } from '../src/services/database';
import { createTournament, getTournamentBundle } from '../src/services/tournamentService';
import { fillRandomResults, randomValidScore } from '../src/features/tournament/devRandomScores';
import { createRng } from '../src/features/tournament/engine/rng';
import { evaluateScore } from '../src/features/tournament/engine/results';
import { defaultRules, defaultSchedule } from '../src/features/tournament/engine/defaults';
import type { SetRules } from '../src/models/tournament';

beforeEach(() => {
  mockIdCounter = 0;
  (getDb as jest.Mock).mockResolvedValue(new FakeSqlDb());
});

describe('random scores (development only)', () => {
  it.each<[string, SetRules]>([
    ['2 sets of 25, tie-break 15', { setsToWin: 2, pointsPerSet: 25, pointsLastSet: 15, winMargin: 2, tieBreak: true }],
    ['3 sets of 25', { setsToWin: 3, pointsPerSet: 25, pointsLastSet: 15, winMargin: 2, tieBreak: true }],
    ['1 set of 21', { setsToWin: 1, pointsPerSet: 21, pointsLastSet: 15, winMargin: 2, tieBreak: false }],
    ['no tie-break, margin 1', { setsToWin: 2, pointsPerSet: 15, pointsLastSet: 15, winMargin: 1, tieBreak: false }],
  ])('always valid: %s', (_, rules) => {
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) expect(evaluateScore(randomValidScore(rules, rng), rules).ok).toBe(true);
  });

  it('fills every match to play, bracket and levels included', async () => {
    const { tournament } = await createTournament({
      name: 'Test', date: '2026-05-16', location: null, gameType: 'indoor_4v4', format: 'brassage_levels',
      rules: defaultRules('indoor_4v4', 'brassage_levels', 16), schedule: defaultSchedule('indoor_4v4', 16),
      seeding: 'random', seed: 7,
      teams: Array.from({ length: 16 }, (_, i) => ({ teamId: null, name: `Équipe ${i + 1}`, color: '#1D4ED8', seedRank: null })),
    });
    const filled = await fillRandomResults(tournament.id, 1);
    const bundle = (await getTournamentBundle(tournament.id))!;
    expect(filled).toBe(bundle.matches.length);
    expect(bundle.matches.every((m) => m.status === 'validated')).toBe(true);
    expect(bundle.tournament.status).toBe('finished');
  });

  it('is only offered in development builds', () => {
    const screen = fs.readFileSync(path.join(__dirname, '../app/tournament/[id]/index.tsx'), 'utf8');
    expect(screen).toMatch(/\{__DEV__ && \(\s*<MenuItem[\s\S]*?fillRandomResults/);
    const dev = fs.readFileSync(path.join(__dirname, '../src/features/tournament/devRandomScores.ts'), 'utf8');
    expect(dev).toContain('if (!__DEV__)');
  });
});
