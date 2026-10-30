import { FakeSqlDb } from './helpers/fakeSqlDb';

let mockIdCounter = 0;
jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => `id-${++mockIdCounter}`),
}));

import { getDb } from '../src/services/database';
import { createMatchFromQr } from '../src/services/qrMatchService';
import type { MatchQr } from '../src/features/tournament/matchQr';

const qr: MatchQr = {
  format: 'beach_2v2',
  home: { name: 'Sable', color: '#F59E0B' },
  away: { name: 'Vagues', color: '#1D4ED8' },
  rules: { setsToWin: 2, pointsPerSet: 21, pointsLastSet: 15, winMargin: 2, tieBreak: true },
};

describe('quick match from a match QR', () => {
  it('both teams and the match are written in one transaction (no orphan team on failure)', async () => {
    const db = new FakeSqlDb();
    (getDb as jest.Mock).mockResolvedValue(db);
    const match = await createMatchFromQr(qr);

    expect(db.transactions).toHaveLength(1);
    const [tx] = db.transactions;
    expect(tx.kind).toBe('same-connection');
    expect(tx.writes.filter((w) => /^INSERT INTO teams/i.test(w))).toHaveLength(2);
    expect(tx.writes.filter((w) => /^INSERT INTO matches/i.test(w))).toHaveLength(1);
    expect(match).toMatchObject({ format: 'beach_2v2', mode: 'leisure' });
  });
});
