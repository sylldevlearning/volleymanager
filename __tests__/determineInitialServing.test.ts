// Covers the fix for a real bug found while implementing the set-5 manual
// serve choice: the referee's choice (persisted as sets.serving_team_id) was
// never actually consulted to set the live serving team — only the parity
// fallback (match.firstServeTeamId) was used, so set 1 always silently
// started with home serving regardless of what was tapped.

import { determineInitialServing, resolveInitialServing } from '../src/stores/scoringStore';
import { DEFAULT_INDOOR_CONFIG } from '../src/models/match';
import type { Match, MatchSet } from '../src/models/match';

const MATCH: Match = {
  id: 'm1', date: '2026-01-01', format: 'indoor_6v6', mode: 'competition',
  teamHomeId: 't1', teamAwayId: 't2', status: 'live', config: DEFAULT_INDOOR_CONFIG,
  winnerTeamId: null, firstServeTeamId: null, captainHomeId: null, captainAwayId: null,
  sidesSwapped: false, actingCaptainHomeId: null, actingCaptainAwayId: null,
  createdAt: '2026-01-01', finishedAt: null,
};

function set(overrides: Partial<MatchSet>): MatchSet {
  return {
    id: 's1', matchId: 'm1', setNumber: 1, scoreHome: 0, scoreAway: 0,
    winnerTeamId: null, servingTeamId: null, startedAt: '2026-01-01', finishedAt: null,
    ...overrides,
  };
}

describe('determineInitialServing', () => {
  it('uses the set\'s persisted servingTeamId (the manual choice) when present, even if it disagrees with parity', () => {
    // firstServeTeamId is null, so the parity fallback would say 'home' for set 1 —
    // but the referee explicitly chose away to serve first.
    const s = set({ setNumber: 1, servingTeamId: 't2' });
    expect(determineInitialServing(MATCH, s)).toBe('away');
  });

  it('maps the home team id to "home"', () => {
    const s = set({ setNumber: 1, servingTeamId: 't1' });
    expect(determineInitialServing(MATCH, s)).toBe('home');
  });

  it('falls back to the parity computation when servingTeamId is null (auto-resolved sets)', () => {
    const matchWithFirstServe = { ...MATCH, firstServeTeamId: 't2' };
    const s = set({ setNumber: 2, servingTeamId: null });
    expect(determineInitialServing(matchWithFirstServe, s)).toBe(resolveInitialServing(matchWithFirstServe, 2));
  });

  it('a manual choice for set 5 overrides what parity alone would have computed', () => {
    const matchWithFirstServe = { ...MATCH, firstServeTeamId: 't1' };
    // Parity for set 5 (odd) would give 'home' (same as set 1) — the referee instead chose away.
    expect(resolveInitialServing(matchWithFirstServe, 5)).toBe('home');
    const s = set({ setNumber: 5, servingTeamId: 't2' });
    expect(determineInitialServing(matchWithFirstServe, s)).toBe('away');
  });
});
