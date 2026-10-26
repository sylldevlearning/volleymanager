// Integration test for match persistence/resume: plays a realistic sequence
// of referee actions through the REAL service layer (the same calls
// arbitrage.tsx makes) while also driving the REAL scoring store to get the
// "live" expected state, then verifies that reconstructLiveState() — reading
// ONLY from the (fake) database, with no in-memory history — rebuilds an
// identical state. This is what guarantees a referee can close the app
// mid-match and resume exactly where they left off.

import { FakeSqlDb } from './helpers/fakeSqlDb';

let mockIdCounter = 0;
jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => `id-${++mockIdCounter}`),
}));

import { getDb } from '../src/services/database';
import { createMatch, createSet, setMatchRefereeState, updateMatchStatus, updateSet } from '../src/services/matchService';
import { addEvent } from '../src/services/eventService';
import { performSubstitution } from '../src/services/substitutionService';
import { saveLineup, type LineupEntry } from '../src/services/lineupService';
import { createPlayer } from '../src/services/playerService';
import { useScoringStore, type CourtMap } from '../src/stores/scoringStore';
import { reconstructLiveState } from '../src/services/matchStateReconstruction';
import { DEFAULT_INDOOR_CONFIG } from '../src/models/match';
import type { LiberoState } from '../src/models/substitution';

const mockGetDb = getDb as jest.Mock;

beforeEach(() => {
  mockIdCounter = 0;
  mockGetDb.mockResolvedValue(new FakeSqlDb());
  useScoringStore.getState().reset();
});

function toLineupEntries(courtMap: CourtMap): LineupEntry[] {
  return Object.entries(courtMap).map(([pos, playerId]) => ({
    playerId, position: Number(pos) as LineupEntry['position'], isStarter: true, isLibero: false,
  }));
}

test('resuming a live match from the DB reproduces the exact live state', async () => {
  const store = useScoringStore.getState();

  // ── Set up two ad-hoc-style rosters (6 starters + 1 libero each, plus a reserve) ──
  const home = await Promise.all(
    [1, 2, 3, 4, 5, 6].map((n) => createPlayer({ teamId: 't1', firstName: null, lastName: `H${n}`, number: n, position: null, photoUri: null, isActive: true })),
  );
  const homeLibero = await createPlayer({ teamId: 't1', firstName: null, lastName: 'HLib', number: 7, position: 'libero', photoUri: null, isActive: true });
  const homeReserve = await createPlayer({ teamId: 't1', firstName: null, lastName: 'HRes', number: 8, position: null, photoUri: null, isActive: true });
  const homeRoster = [...home, homeLibero, homeReserve];

  const away = await Promise.all(
    [11, 12, 13, 14, 15, 16].map((n) => createPlayer({ teamId: 't2', firstName: null, lastName: `A${n}`, number: n, position: null, photoUri: null, isActive: true })),
  );
  const awayLibero = await createPlayer({ teamId: 't2', firstName: null, lastName: 'ALib', number: 17, position: 'libero', photoUri: null, isActive: true });
  const awayRoster = [...away, awayLibero];

  // ── Create the match + set 1, mirroring handleValidateLineup ──
  const match0 = await createMatch({ format: 'indoor_6v6', mode: 'competition', teamHomeId: 't1', teamAwayId: 't2', config: DEFAULT_INDOOR_CONFIG, firstServeTeamId: 't2' });
  await updateMatchStatus(match0.id, 'live');
  const match = { ...match0, status: 'live' as const };
  const set1 = await createSet(match.id, 1, match.teamAwayId); // away serves first

  store.initMatch(match, set1);

  const homeCourt: CourtMap = { 1: home[0].id, 2: home[1].id, 3: home[2].id, 4: home[3].id, 5: home[4].id, 6: home[5].id };
  const awayCourt: CourtMap = { 1: away[0].id, 2: away[1].id, 3: away[2].id, 4: away[3].id, 5: away[4].id, 6: away[5].id };
  const homeLiberoState: LiberoState = { liberoId: homeLibero.id, isOnCourt: false, replacedPlayerId: null, replacedPosition: null };
  const awayLiberoState: LiberoState = { liberoId: awayLibero.id, isOnCourt: false, replacedPlayerId: null, replacedPosition: null };
  store.initLineup('home', homeCourt, [homeLibero, homeReserve], homeLiberoState);
  store.initLineup('away', awayCourt, [awayLibero], awayLiberoState);
  await saveLineup(match.id, set1.id, match.teamHomeId, toLineupEntries(homeCourt));
  await saveLineup(match.id, set1.id, match.teamAwayId, toLineupEntries(awayCourt));

  // ── Test harness mirroring arbitrage.tsx's action handlers exactly ──
  async function point(team: 'home' | 'away') {
    const s = useScoringStore.getState();
    const event = await addEvent({
      matchId: match.id, setId: s.currentSet!.id,
      eventType: team === 'home' ? 'point_home' : 'point_away',
      playerId: null, teamId: team === 'home' ? match.teamHomeId : match.teamAwayId, details: {},
    });
    const autoExit = s.addPointEvent(team, event);
    if (autoExit) {
      const side = autoExit.side;
      await performSubstitution({
        matchId: match.id, setId: s.currentSet!.id,
        teamId: side === 'home' ? match.teamHomeId : match.teamAwayId, teamSide: side,
        playerOutId: autoExit.liberoId, playerInId: autoExit.replacedPlayerId, position: autoExit.position,
        isLibero: true, isAutomatic: true,
      });
      const roster = side === 'home' ? homeRoster : awayRoster;
      const liberoPlayer = roster.find((p) => p.id === autoExit.liberoId)!;
      useScoringStore.getState().restoreLiberoToBench(side, liberoPlayer);
    }
  }

  async function substitute(side: 'home' | 'away', playerOutId: string, playerInId: string, position: number, isLibero: boolean) {
    const s = useScoringStore.getState();
    const teamId = side === 'home' ? match.teamHomeId : match.teamAwayId;
    const { pair } = await performSubstitution({ matchId: match.id, setId: s.currentSet!.id, teamId, teamSide: side, playerOutId, playerInId, position, isLibero });
    const playerOut = [...home, homeLibero, homeReserve, ...away].find((p) => p.id === playerOutId);
    s.applySubstitution(side, playerOutId, playerInId, position, isLibero, pair, { playerOut });
  }

  async function timeout(team: 'home' | 'away') {
    const s = useScoringStore.getState();
    await addEvent({
      matchId: match.id, setId: s.currentSet!.id,
      eventType: team === 'home' ? 'timeout_home' : 'timeout_away',
      playerId: null, teamId: team === 'home' ? match.teamHomeId : match.teamAwayId, details: {},
    });
    s.requestTimeout(team);
  }

  // ── Play a realistic sequence in set 1 ──
  // initial serving = away (set1.servingTeamId = teamAwayId)
  await point('home'); // side-out: home rotates once → {6:h1,1:h2,2:h3,3:h4,4:h5,5:h6}, gains serve
  await point('away'); // side-out: away rotates once, gains serve
  await point('away'); // away already serving: no rotation
  await substitute('home', home[3].id, homeReserve.id, 3, false); // normal sub — H4 is actually at position 3 now
  await substitute('home', home[0].id, homeLibero.id, 6, true); // libero enters for H1, who is at the back-row position 6
  await timeout('away');
  await point('home'); // side-out: home rotates again (libero's slot shifts 6→5, still back row)

  // Referee swaps the visual sides and designates an acting captain — both must persist too.
  await setMatchRefereeState(match.id, { sidesSwapped: true, actingCaptainHomeId: home[1].id, actingCaptainAwayId: null });

  // ── Reconstruct purely from the DB and compare against the live store ──
  const live = useScoringStore.getState();
  const reconstructed = await reconstructLiveState(match.id);
  expect(reconstructed).not.toBeNull();
  const r = reconstructed!;

  expect(r.currentSet.id).toBe(set1.id);
  expect(r.scoreHome).toBe(live.scoreHome);
  expect(r.scoreAway).toBe(live.scoreAway);
  expect(r.servingTeam).toBe(live.servingTeam);
  expect(r.onCourtHome).toEqual(live.onCourtHome);
  expect(r.onCourtAway).toEqual(live.onCourtAway);
  expect(r.rotationHome).toEqual(live.rotationHome);
  expect(r.rotationAway).toEqual(live.rotationAway);
  expect(r.liberoHome).toEqual(live.liberoHome);
  expect(r.liberoAway).toEqual(live.liberoAway);
  expect(r.benchHome.map((p) => p.id).sort()).toEqual(live.benchHome.map((p) => p.id).sort());
  expect(r.benchAway.map((p) => p.id).sort()).toEqual(live.benchAway.map((p) => p.id).sort());
  expect(r.timeoutsHome).toBe(live.timeoutsHome);
  expect(r.timeoutsAway).toBe(live.timeoutsAway);
  expect(r.substitutionsHome).toBe(live.substitutionsHome);
  expect(r.substitutionsAway).toBe(live.substitutionsAway);
  expect(r.setsHome).toBe(live.setsHome);
  expect(r.setsAway).toBe(live.setsAway);
  expect(r.sidesSwapped).toBe(true);
  expect(r.actingCaptainHomeId).toBe(home[1].id);
  expect(r.actingCaptainAwayId).toBeNull();

  // ── Finish set 1, start set 2 (lineup carried over, rotation + libero reset) ──
  await updateSet(set1.id, 25, 10, match.teamHomeId);
  const finishedSet1 = { ...set1, scoreHome: 25, scoreAway: 10, winnerTeamId: match.teamHomeId };
  live.endCurrentSet('home', finishedSet1);
  const set2 = await createSet(match.id, 2, match.teamHomeId);
  live.startNewSet(set2);
  // Persist set 2's starting lineup — the carried-over on-court state at the moment the new set begins.
  const afterStart = useScoringStore.getState();
  await saveLineup(match.id, set2.id, match.teamHomeId, toLineupEntries(afterStart.onCourtHome));
  await saveLineup(match.id, set2.id, match.teamAwayId, toLineupEntries(afterStart.onCourtAway));

  await point('away'); // set2 initial serving = home (alternates) -> away scoring is a side-out, away rotates
  await point('away'); // away already serving: no rotation

  const live2 = useScoringStore.getState();
  const reconstructed2 = await reconstructLiveState(match.id);
  expect(reconstructed2).not.toBeNull();
  const r2 = reconstructed2!;

  expect(r2.currentSet.id).toBe(set2.id);
  expect(r2.scoreHome).toBe(live2.scoreHome);
  expect(r2.scoreAway).toBe(live2.scoreAway);
  expect(r2.servingTeam).toBe(live2.servingTeam);
  expect(r2.onCourtHome).toEqual(live2.onCourtHome);
  expect(r2.onCourtAway).toEqual(live2.onCourtAway);
  expect(r2.rotationHome).toEqual(live2.rotationHome);
  expect(r2.rotationAway).toEqual(live2.rotationAway);
  expect(r2.liberoHome).toEqual(live2.liberoHome);
  expect(r2.liberoAway).toEqual(live2.liberoAway);
  expect(r2.setsHome).toBe(1);
  expect(r2.setsAway).toBe(0);
  expect(r2.setScores).toEqual([{ home: 25, away: 10 }, { home: 0, away: 0 }]);
  // referee state persists across the set boundary too
  expect(r2.sidesSwapped).toBe(true);
  expect(r2.actingCaptainHomeId).toBe(home[1].id);
});
