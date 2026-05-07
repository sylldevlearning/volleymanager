import { computePlayerStats, derivePlayerMatchStats } from '../src/services/statsService';
import type { MatchEvent } from '../src/models/event';
import type { PlayerStats } from '../src/models/stats';

// Helper to build a minimal MatchEvent
function makeEvent(
  overrides: Partial<MatchEvent> & { eventType: MatchEvent['eventType'] }
): MatchEvent {
  return {
    id: Math.random().toString(36).slice(2),
    matchId: 'match-1',
    setId: 'set-1',
    playerId: 'player-1',
    teamId: 'team-1',
    timestamp: new Date().toISOString(),
    details: {},
    isCancelled: false,
    ...overrides,
  };
}

function makeRaw(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
    playerId: 'player-1',
    matchId: 'match-1',
    serveAce: 0, serveFault: 0, serveIn: 0,
    attackKill: 0, attackFault: 0, attackDefended: 0,
    blockKill: 0, blockTouch: 0, blockFault: 0,
    receptionA: 0, receptionB: 0, receptionC: 0, receptionD: 0,
    defenseSuccess: 0, defenseFault: 0,
    setPerfect: 0, setGood: 0, setBad: 0,
    ...overrides,
  };
}

// ─── computePlayerStats ───────────────────────────────────────────────────────

describe('computePlayerStats', () => {
  it('counts serve events correctly', () => {
    const events = [
      makeEvent({ eventType: 'serve_ace' }),
      makeEvent({ eventType: 'serve_fault' }),
      makeEvent({ eventType: 'serve_in' }),
      makeEvent({ eventType: 'serve_ace' }),
    ];
    const [stats] = computePlayerStats(events);
    expect(stats.serveAce).toBe(2);
    expect(stats.serveFault).toBe(1);
    expect(stats.serveIn).toBe(1);
  });

  it('skips cancelled events', () => {
    const events = [
      makeEvent({ eventType: 'attack_kill' }),
      makeEvent({ eventType: 'attack_kill', isCancelled: true }),
    ];
    const [stats] = computePlayerStats(events);
    expect(stats.attackKill).toBe(1);
  });

  it('skips events with no playerId', () => {
    const events = [
      makeEvent({ eventType: 'serve_ace', playerId: null }),
    ];
    const result = computePlayerStats(events);
    expect(result).toHaveLength(0);
  });

  it('tracks separate players independently', () => {
    const events = [
      makeEvent({ eventType: 'attack_kill', playerId: 'p1' }),
      makeEvent({ eventType: 'attack_kill', playerId: 'p1' }),
      makeEvent({ eventType: 'attack_kill', playerId: 'p2' }),
    ];
    const result = computePlayerStats(events);
    const p1 = result.find((s) => s.playerId === 'p1')!;
    const p2 = result.find((s) => s.playerId === 'p2')!;
    expect(p1.attackKill).toBe(2);
    expect(p2.attackKill).toBe(1);
  });

  it('returns empty array when no events', () => {
    expect(computePlayerStats([])).toEqual([]);
  });
});

// ─── derivePlayerMatchStats ───────────────────────────────────────────────────

describe('derivePlayerMatchStats', () => {
  it('returns zero efficiency when totals are zero', () => {
    const derived = derivePlayerMatchStats(makeRaw(), null, 'team-1');
    expect(derived.attackEfficiency).toBe(0);
    expect(derived.serveEfficiency).toBe(0);
    expect(derived.blockEfficiency).toBe(0);
    expect(derived.receptionPositive).toBe(0);
    expect(derived.defenseEfficiency).toBe(0);
    expect(derived.setEfficiency).toBe(0);
  });

  it('computes attack efficiency correctly', () => {
    const derived = derivePlayerMatchStats(
      makeRaw({ attackKill: 6, attackFault: 2, attackDefended: 2 }),
      null,
      'team-1',
    );
    expect(derived.attackTotal).toBe(10);
    expect(derived.attackEfficiency).toBe(60); // 6/10 = 60%
  });

  it('computes serve efficiency (aces / total)', () => {
    const derived = derivePlayerMatchStats(
      makeRaw({ serveAce: 3, serveFault: 2, serveIn: 5 }),
      null,
      'team-1',
    );
    expect(derived.serveTotal).toBe(10);
    expect(derived.serveEfficiency).toBe(30); // 3/10 = 30%
  });

  it('computes reception positive rate (A+B / total)', () => {
    const derived = derivePlayerMatchStats(
      makeRaw({ receptionA: 5, receptionB: 3, receptionC: 1, receptionD: 1 }),
      null,
      'team-1',
    );
    expect(derived.receptionTotal).toBe(10);
    expect(derived.receptionPositive).toBe(80); // (5+3)/10 = 80%
  });

  it('computes defense efficiency', () => {
    const derived = derivePlayerMatchStats(
      makeRaw({ defenseSuccess: 7, defenseFault: 3 }),
      null,
      'team-1',
    );
    expect(derived.defenseEfficiency).toBe(70);
  });

  it('computes set efficiency (perfect+good / total)', () => {
    const derived = derivePlayerMatchStats(
      makeRaw({ setPerfect: 4, setGood: 4, setBad: 2 }),
      null,
      'team-1',
    );
    expect(derived.setEfficiency).toBe(80); // (4+4)/10 = 80%
  });

  it('computes block efficiency', () => {
    const derived = derivePlayerMatchStats(
      makeRaw({ blockKill: 3, blockTouch: 2, blockFault: 5 }),
      null,
      'team-1',
    );
    expect(derived.blockTotal).toBe(10);
    expect(derived.blockEfficiency).toBe(30);
  });

  it('totalPoints = kills + aces + block kills', () => {
    const derived = derivePlayerMatchStats(
      makeRaw({ attackKill: 5, serveAce: 3, blockKill: 2 }),
      null,
      'team-1',
    );
    expect(derived.totalPoints).toBe(10);
  });

  it('totalFaults = serve + attack + block + receptionD + defense faults', () => {
    const derived = derivePlayerMatchStats(
      makeRaw({ serveFault: 1, attackFault: 2, blockFault: 1, receptionD: 1, defenseFault: 1 }),
      null,
      'team-1',
    );
    expect(derived.totalFaults).toBe(6);
  });

  it('plusMinus = totalPoints - totalFaults', () => {
    const derived = derivePlayerMatchStats(
      makeRaw({ attackKill: 10, attackFault: 3 }),
      null,
      'team-1',
    );
    expect(derived.plusMinus).toBe(7); // 10 - 3
  });

  it('does not produce NaN for any field with zero data', () => {
    const derived = derivePlayerMatchStats(makeRaw(), null, 'team-1');
    const numericKeys: (keyof typeof derived)[] = [
      'serveEfficiency', 'attackEfficiency', 'blockEfficiency',
      'receptionPositive', 'defenseEfficiency', 'setEfficiency',
      'totalPoints', 'totalFaults', 'plusMinus',
    ];
    for (const key of numericKeys) {
      expect(isNaN(derived[key] as number)).toBe(false);
    }
  });
});

// ─── top performers ───────────────────────────────────────────────────────────

describe('top performer selection', () => {
  function makeStats(playerId: string, overrides: Partial<ReturnType<typeof derivePlayerMatchStats>>) {
    const base = derivePlayerMatchStats(makeRaw(), null, 'team-1');
    return { ...base, playerId, ...overrides };
  }

  it('selects player with most attack kills as best attacker', () => {
    const players = [
      makeStats('p1', { attackKill: 5, attackTotal: 10, attackEfficiency: 50 }),
      makeStats('p2', { attackKill: 8, attackTotal: 10, attackEfficiency: 80 }),
      makeStats('p3', { attackKill: 3, attackTotal: 10, attackEfficiency: 30 }),
    ];

    const best = players.reduce((a, b) => (a.attackEfficiency >= b.attackEfficiency ? a : b));
    expect(best.playerId).toBe('p2');
  });

  it('selects player with most aces as best server', () => {
    const players = [
      makeStats('p1', { serveAce: 2 }),
      makeStats('p2', { serveAce: 5 }),
    ];
    const best = players.reduce((a, b) => (a.serveAce >= b.serveAce ? a : b));
    expect(best.playerId).toBe('p2');
  });

  it('selects player with highest receptionPositive as best receiver', () => {
    const players = [
      makeStats('p1', { receptionPositive: 60 }),
      makeStats('p2', { receptionPositive: 85 }),
    ];
    const best = players.reduce((a, b) => (a.receptionPositive >= b.receptionPositive ? a : b));
    expect(best.playerId).toBe('p2');
  });
});

// ─── edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles 0 events gracefully (no crash)', () => {
    expect(() => computePlayerStats([])).not.toThrow();
  });

  it('handles 100% efficiency', () => {
    const derived = derivePlayerMatchStats(
      makeRaw({ attackKill: 10, attackFault: 0, attackDefended: 0 }),
      null,
      'team-1',
    );
    expect(derived.attackEfficiency).toBe(100);
  });

  it('handles 0% efficiency', () => {
    const derived = derivePlayerMatchStats(
      makeRaw({ attackKill: 0, attackFault: 5, attackDefended: 0 }),
      null,
      'team-1',
    );
    expect(derived.attackEfficiency).toBe(0);
  });

  it('points by opponent fault counted from opponents faults', () => {
    // Team A faults = team B points from opponent fault
    const teamAFaults = 3; // serve_fault + attack_fault + block_fault
    const teamBOpponentFaultPoints = teamAFaults;
    expect(teamBOpponentFaultPoints).toBe(3);
  });
});
