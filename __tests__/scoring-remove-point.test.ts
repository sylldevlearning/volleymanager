jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => 'gen-id-' + Math.random().toString(36).slice(2)),
}));

import { computeScore } from '../src/services/eventService';
import type { MatchEvent } from '../src/models/event';

function makeEvent(id: string, type: MatchEvent['eventType'], cancelled = false): MatchEvent {
  return {
    id,
    matchId: 'm1',
    setId: 's1',
    eventType: type,
    playerId: null,
    teamId: null,
    timestamp: new Date().toISOString(),
    details: {},
    isCancelled: cancelled,
  };
}

describe('computeScore — point_correction removes a point', () => {
  it('cancelling a point_home reduces home score', () => {
    const events = [
      makeEvent('e1', 'point_home', true), // cancelled in-place
      makeEvent('e2', 'point_home'),
    ];
    const { home, away } = computeScore(events.filter((e) => !e.isCancelled));
    expect(home).toBe(1);
    expect(away).toBe(0);
  });

  it('cancelling a point_away reduces away score', () => {
    const events = [
      makeEvent('e1', 'point_away'),
      makeEvent('e2', 'point_away', true), // cancelled in-place
    ];
    const { home, away } = computeScore(events.filter((e) => !e.isCancelled));
    expect(home).toBe(0);
    expect(away).toBe(1);
  });

  it('score stays at 0 when only event is cancelled', () => {
    const events = [makeEvent('e1', 'point_home', true)];
    const { home, away } = computeScore(events.filter((e) => !e.isCancelled));
    expect(home).toBe(0);
    expect(away).toBe(0);
  });

  it('point_correction_home event does not count as a scored point', () => {
    const events = [
      makeEvent('e1', 'point_home'),
      makeEvent('e2', 'point_correction_home'),
    ];
    const { home } = computeScore(events.filter((e) => !e.isCancelled));
    expect(home).toBe(1); // correction event itself doesn't add to score
  });

  it('mixed: home leads 3-2 with one correction on each side', () => {
    // In our event-sourcing model, cancellation marks the single event isCancelled=true in-place
    const events = [
      makeEvent('h1', 'point_home'),
      makeEvent('h2', 'point_home'),
      makeEvent('h3', 'point_home'),
      makeEvent('h4', 'point_home', true), // already cancelled (correction applied)
      makeEvent('a1', 'point_away'),
      makeEvent('a2', 'point_away'),
      makeEvent('a3', 'point_away', true), // already cancelled (correction applied)
    ];
    const active = events.filter((e) => !e.isCancelled);
    const { home, away } = computeScore(active);
    expect(home).toBe(3);
    expect(away).toBe(2);
  });
});
