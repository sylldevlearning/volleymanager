jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => 'gen-id'),
}));

jest.mock('../src/services/eventService', () => ({
  addEvent: jest.fn(),
  getEventsForMatch: jest.fn(),
}));

import { addSanction, getSanctionsForMatch } from '../src/services/sanctionService';
import { getDb } from '../src/services/database';
import { addEvent, getEventsForMatch } from '../src/services/eventService';
import type { MatchEvent } from '../src/models/event';

const mockGetDb = getDb as jest.Mock;
const mockAddEvent = addEvent as jest.Mock;
const mockGetEventsForMatch = getEventsForMatch as jest.Mock;

function makeMockDb() {
  return {
    withExclusiveTransactionAsync: jest.fn(async (cb: () => Promise<void>) => {
      await cb();
    }),
  };
}

function event(overrides: Partial<MatchEvent> & { eventType: MatchEvent['eventType'] }): MatchEvent {
  return {
    id: 'e1', matchId: 'm1', setId: 's1', playerId: null, teamId: 't1',
    timestamp: '2026-01-01T00:00:00.000Z', isCancelled: false, details: {},
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── addSanction ────────────────────────────────────────────────────────────

describe('addSanction (no point awarded)', () => {
  it('records only the sanction event, no point event', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);
    mockAddEvent.mockResolvedValue(event({ id: 'sanction-1', eventType: 'sanction_home', playerId: 'P5' }));

    const result = await addSanction({
      matchId: 'm1', setId: 's1', teamId: 't1', teamSide: 'home', opponentTeamId: 't2',
      sanctionType: 'warning', playerId: 'P5', awardsPoint: false,
    });

    expect(mockAddEvent).toHaveBeenCalledTimes(1);
    expect(mockAddEvent).toHaveBeenCalledWith(expect.objectContaining({
      matchId: 'm1', setId: 's1', eventType: 'sanction_home', playerId: 'P5', teamId: 't1',
      details: { sanctionType: 'warning', awardsPoint: false, pointEventId: null },
    }));
    expect(result.sanctionEvent.id).toBe('sanction-1');
    expect(result.pointEvent).toBeNull();
  });
});

describe('addSanction (penalty — awards a point to the opponent)', () => {
  it('records the point event for the OPPONENT then links it in the sanction details', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);
    mockAddEvent
      .mockResolvedValueOnce(event({ id: 'point-1', eventType: 'point_away', teamId: 't2' }))
      .mockResolvedValueOnce(event({ id: 'sanction-1', eventType: 'sanction_home', playerId: 'P5' }));

    const result = await addSanction({
      matchId: 'm1', setId: 's1', teamId: 't1', teamSide: 'home', opponentTeamId: 't2',
      sanctionType: 'penalty', playerId: 'P5', awardsPoint: true,
    });

    expect(mockAddEvent).toHaveBeenCalledTimes(2);
    // 1st call: the opponent's point
    expect(mockAddEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      matchId: 'm1', setId: 's1', eventType: 'point_away', teamId: 't2',
    }));
    // 2nd call: the sanction, linked to the point event
    expect(mockAddEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      eventType: 'sanction_home',
      details: { sanctionType: 'penalty', awardsPoint: true, pointEventId: 'point-1' },
    }));
    expect(result.pointEvent?.id).toBe('point-1');
  });

  it('awards the point to point_home when the AWAY team is sanctioned', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);
    mockAddEvent
      .mockResolvedValueOnce(event({ id: 'point-2', eventType: 'point_home', teamId: 't1' }))
      .mockResolvedValueOnce(event({ id: 'sanction-2', eventType: 'sanction_away' }));

    await addSanction({
      matchId: 'm1', setId: 's1', teamId: 't2', teamSide: 'away', opponentTeamId: 't1',
      sanctionType: 'delay', playerId: null, awardsPoint: true,
    });

    expect(mockAddEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({ eventType: 'point_home', teamId: 't1' }));
  });

  it('wraps the point + sanction events in a single transaction', async () => {
    const db = makeMockDb();
    mockGetDb.mockResolvedValue(db);
    mockAddEvent
      .mockResolvedValueOnce(event({ id: 'point-3', eventType: 'point_away' }))
      .mockResolvedValueOnce(event({ id: 'sanction-3', eventType: 'sanction_home' }));

    await addSanction({
      matchId: 'm1', setId: 's1', teamId: 't1', teamSide: 'home', opponentTeamId: 't2',
      sanctionType: 'penalty', playerId: 'P5', awardsPoint: true,
    });

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });
});

// ─── getSanctionsForMatch ───────────────────────────────────────────────────

describe('getSanctionsForMatch', () => {
  it('filters to only sanction_home/away events', async () => {
    mockGetEventsForMatch.mockResolvedValue([
      event({ eventType: 'point_home' }),
      event({ eventType: 'sanction_home', id: 's-1' }),
      event({ eventType: 'timeout_away' }),
      event({ eventType: 'sanction_away', id: 's-2' }),
    ]);

    const result = await getSanctionsForMatch('m1');
    expect(result.map((e) => e.id)).toEqual(['s-1', 's-2']);
  });

  it('returns empty array when there are no sanctions', async () => {
    mockGetEventsForMatch.mockResolvedValue([event({ eventType: 'point_home' })]);
    expect(await getSanctionsForMatch('m1')).toEqual([]);
  });
});
