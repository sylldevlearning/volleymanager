// End-to-end integration test: simulates a complete 5-set arbitrage match
// through the REAL store + services + rulesValidator (no mocked business
// logic), against an in-memory fake SQL DB. Mirrors exactly what
// app/match/[id]/arbitrage.tsx's handlers do at each step, so it doubles as
// a regression test for that screen's logic.
//
// Covers: manual serve choice (set 1 and set 5), lineup entry before every
// set, points/rotation, libero (manual entry, automatic exit on V→IV,
// manual exit, never consuming the substitution quota), legal and illegal
// substitutions, in-game acting captain, timeouts with the 3rd rejected,
// sanctions (warning/penalty) with the penalty's awarded point reflected
// live, expulsion blocking re-entry, an exceptional substitution once the
// quota is exhausted, undo after every action type (point-with-rotation,
// substitution, timeout, sanction+point), resuming mid-set-5 from a closed
// app, and the match finishing with the correct winner.

import { FakeSqlDb } from './helpers/fakeSqlDb';

let mockIdCounter = 0;
jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => `id-${++mockIdCounter}`),
}));

import { getDb } from '../src/services/database';
import {
  createMatch, createSet, updateSet, updateMatchStatus, setMatchCaptains, setFirstServeTeam, getMatchById,
} from '../src/services/matchService';
import { addEvent, undoLastEvent } from '../src/services/eventService';
import { performSubstitution } from '../src/services/substitutionService';
import { saveLineup, type LineupEntry } from '../src/services/lineupService';
import { createPlayer, getPlayersByTeam } from '../src/services/playerService';
import { addSanction, getSanctionsForMatch } from '../src/services/sanctionService';
import { reconstructLiveState } from '../src/services/matchStateReconstruction';
import { useScoringStore, resolveInitialServing, type CourtMap } from '../src/stores/scoringStore';
import { isSetWon, isMatchWon, isLastSet } from '../src/utils/volleyball-rules';
import {
  validateRegularSubstitution, validateLiberoSubstitution, checkLiberoRallySinceLastReplacement,
  checkLiberoNotAlreadyActive, getExceptionalSubstitutionEligibility, validateTimeoutRequest,
} from '../src/utils/rulesValidator';
import { getDisplayedCaptainId, needsNewActingCaptain } from '../src/utils/captainTracking';
import { DEFAULT_INDOOR_CONFIG } from '../src/models/match';
import type { Match } from '../src/models/match';
import type { Player } from '../src/models/player';
import type { MatchEvent } from '../src/models/event';

const mockGetDb = getDb as jest.Mock;

beforeEach(() => {
  mockIdCounter = 0;
  mockGetDb.mockResolvedValue(new FakeSqlDb());
  useScoringStore.getState().reset();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

function toLineupEntries(courtMap: CourtMap): LineupEntry[] {
  return Object.entries(courtMap).map(([pos, playerId]) => ({
    playerId, position: Number(pos) as LineupEntry['position'], isStarter: true, isLibero: false,
  }));
}

function buildLineupState(players: Player[], courtMap: CourtMap) {
  const liberoPlayer = players.find((p) => p.position === 'libero') ?? null;
  const assigned = new Set(Object.values(courtMap));
  const bench = players.filter((p) => !assigned.has(p.id));
  const liberoState = liberoPlayer
    ? { liberoId: liberoPlayer.id, isOnCourt: false, replacedPlayerId: null, replacedPosition: null }
    : null;
  return { bench, liberoState };
}

test('full 5-set arbitrage match through the real store + services + rulesValidator', async () => {
  // ─── Rosters ──────────────────────────────────────────────────────────
  const home = await Promise.all(
    [1, 2, 3, 4, 5, 6].map((n) => createPlayer({ teamId: 't1', firstName: null, lastName: `H${n}`, number: n, position: null, photoUri: null, isActive: true })),
  );
  const [H1, H2, H3, H4, H5, H6] = home;
  const HLib = await createPlayer({ teamId: 't1', firstName: null, lastName: 'HLib', number: 7, position: 'libero', photoUri: null, isActive: true });
  const H8 = await createPlayer({ teamId: 't1', firstName: null, lastName: 'H8', number: 8, position: null, photoUri: null, isActive: true });
  const H9 = await createPlayer({ teamId: 't1', firstName: null, lastName: 'H9', number: 9, position: null, photoUri: null, isActive: true });
  const H10 = await createPlayer({ teamId: 't1', firstName: null, lastName: 'H10', number: 10, position: null, photoUri: null, isActive: true });
  const H11 = await createPlayer({ teamId: 't1', firstName: null, lastName: 'H11', number: 11, position: null, photoUri: null, isActive: true });

  const away = await Promise.all(
    [1, 2, 3, 4, 5, 6].map((n) => createPlayer({ teamId: 't2', firstName: null, lastName: `A${n}`, number: n, position: null, photoUri: null, isActive: true })),
  );
  const [A1] = away;
  const ALib = await createPlayer({ teamId: 't2', firstName: null, lastName: 'ALib', number: 7, position: 'libero', photoUri: null, isActive: true });

  const homeRoster = [...home, HLib, H8, H9, H10, H11];
  const awayRoster = [...away, ALib];

  // ─── Match creation + captains ──────────────────────────────────────
  let currentMatch: Match = await createMatch({
    format: 'indoor_6v6', mode: 'competition', teamHomeId: 't1', teamAwayId: 't2', config: DEFAULT_INDOOR_CONFIG,
  });
  await setMatchCaptains(currentMatch.id, H1.id, A1.id);
  currentMatch = (await getMatchById(currentMatch.id))!;

  let sanctionEvents: MatchEvent[] = [];
  let actingCaptainHomeId: string | null = null;

  // ─── Harness: mirrors arbitrage.tsx's handlers exactly ───────────────

  async function enterSet(setNumber: number, servingTeamId: string, homeCourt: CourtMap, awayCourt: CourtMap) {
    const set = await createSet(currentMatch.id, setNumber, servingTeamId);
    if (useScoringStore.getState().match === null) {
      useScoringStore.getState().initMatch(currentMatch, set);
    } else {
      useScoringStore.getState().startNewSet(set);
    }
    const homeState = buildLineupState(homeRoster, homeCourt);
    const awayState = buildLineupState(awayRoster, awayCourt);
    useScoringStore.getState().initLineup('home', homeCourt, homeState.bench, homeState.liberoState);
    useScoringStore.getState().initLineup('away', awayCourt, awayState.bench, awayState.liberoState);
    await saveLineup(currentMatch.id, set.id, currentMatch.teamHomeId, toLineupEntries(homeCourt));
    await saveLineup(currentMatch.id, set.id, currentMatch.teamAwayId, toLineupEntries(awayCourt));
    return set;
  }

  async function applyScoredPointEffects(team: 'home' | 'away', pointEvent: MatchEvent) {
    const s1 = useScoringStore.getState();
    const autoExit = s1.addPointEvent(team, pointEvent);
    if (autoExit) {
      jest.advanceTimersByTime(1);
      const { event } = await performSubstitution({
        matchId: currentMatch.id, setId: s1.currentSet!.id,
        teamId: autoExit.side === 'home' ? currentMatch.teamHomeId : currentMatch.teamAwayId,
        teamSide: autoExit.side, playerOutId: autoExit.liberoId, playerInId: autoExit.replacedPlayerId,
        position: autoExit.position, isLibero: true, isAutomatic: true,
      });
      useScoringStore.getState().recordEvent(event);
      const roster = autoExit.side === 'home' ? homeRoster : awayRoster;
      const liberoPlayer = roster.find((p) => p.id === autoExit.liberoId)!;
      useScoringStore.getState().restoreLiberoToBench(autoExit.side, liberoPlayer);
    }
    const s2 = useScoringStore.getState();
    const setNum = s2.currentSet!.setNumber;
    const lastSet = isLastSet(setNum, currentMatch.config);
    const homeWins = isSetWon(s2.scoreHome, s2.scoreAway, currentMatch.config, lastSet);
    const awayWins = isSetWon(s2.scoreAway, s2.scoreHome, currentMatch.config, lastSet);
    if (!homeWins && !awayWins) return { setWon: false, matchWon: false, winnerSide: null as 'home' | 'away' | null };

    const winnerTeamId = homeWins ? currentMatch.teamHomeId : currentMatch.teamAwayId;
    const winnerSide: 'home' | 'away' = homeWins ? 'home' : 'away';
    await updateSet(s2.currentSet!.id, s2.scoreHome, s2.scoreAway, winnerTeamId);
    s2.endCurrentSet(winnerSide, { ...s2.currentSet!, scoreHome: s2.scoreHome, scoreAway: s2.scoreAway, winnerTeamId });

    const s3 = useScoringStore.getState();
    const matchWon = isMatchWon(s3.setsHome, currentMatch.config) || isMatchWon(s3.setsAway, currentMatch.config);
    if (matchWon) {
      const matchWinnerId = isMatchWon(s3.setsHome, currentMatch.config) ? currentMatch.teamHomeId : currentMatch.teamAwayId;
      await updateMatchStatus(currentMatch.id, 'finished', matchWinnerId);
      currentMatch = (await getMatchById(currentMatch.id))!;
    }
    return { setWon: true, matchWon, winnerSide };
  }

  async function doPoint(team: 'home' | 'away') {
    jest.advanceTimersByTime(1);
    const s = useScoringStore.getState();
    const event = await addEvent({
      matchId: currentMatch.id, setId: s.currentSet!.id,
      eventType: team === 'home' ? 'point_home' : 'point_away',
      playerId: null, teamId: team === 'home' ? currentMatch.teamHomeId : currentMatch.teamAwayId, details: {},
    });
    return applyScoredPointEffects(team, event);
  }

  async function blastUntilSetWon(team: 'home' | 'away') {
    let r;
    do { r = await doPoint(team); } while (!r.setWon);
    return r;
  }

  async function applySubstitutionReal(side: 'home' | 'away', playerOutId: string, playerInId: string, position: number, isLibero: boolean, isExceptional: boolean) {
    jest.advanceTimersByTime(1);
    const s = useScoringStore.getState();
    const teamId = side === 'home' ? currentMatch.teamHomeId : currentMatch.teamAwayId;
    const { pair, event } = await performSubstitution({
      matchId: currentMatch.id, setId: s.currentSet!.id, teamId, teamSide: side,
      playerOutId, playerInId, position, isLibero, isExceptional,
    });
    s.applySubstitution(side, playerOutId, playerInId, position, isLibero, pair);
    s.recordEvent(event);
  }

  function regularSubCheck(side: 'home' | 'away', playerOutId: string, playerInId: string) {
    const s = useScoringStore.getState();
    const roster = side === 'home' ? homeRoster : awayRoster;
    const outPlayer = roster.find((p) => p.id === playerOutId)!;
    const inPlayer = roster.find((p) => p.id === playerInId)!;
    const onCourt = side === 'home' ? s.onCourtHome : s.onCourtAway;
    const pairs = side === 'home' ? s.pairsHome : s.pairsAway;
    const subsUsed = side === 'home' ? s.substitutionsHome : s.substitutionsAway;
    return validateRegularSubstitution({
      playerOut: outPlayer, playerIn: inPlayer, allPlayers: roster, pairs, subsUsed,
      config: currentMatch.config, onCourtPlayerIds: Object.values(onCourt),
      sanctionEventsForSet: sanctionEvents.filter((e) => e.setId === s.currentSet!.id),
      sanctionEventsForMatch: sanctionEvents,
    });
  }

  async function trySubstitute(side: 'home' | 'away', playerOutId: string, playerInId: string, position: number) {
    const result = regularSubCheck(side, playerOutId, playerInId);
    if (result.ok) await applySubstitutionReal(side, playerOutId, playerInId, position, false, false);
    return result;
  }

  function liberoEnterCheck(side: 'home' | 'away', liberoId: string, position: number) {
    const s = useScoringStore.getState();
    const roster = side === 'home' ? homeRoster : awayRoster;
    const libero = side === 'home' ? s.liberoHome : s.liberoAway;
    const activeLiberoNumber = libero ? roster.find((p) => p.id === libero.liberoId)?.number ?? 0 : 0;
    const activeCheck = checkLiberoNotAlreadyActive(liberoId, activeLiberoNumber, libero);
    if (!activeCheck.ok) return activeCheck;
    const rowCheck = validateLiberoSubstitution(position);
    if (!rowCheck.ok) return rowCheck;
    return checkLiberoRallySinceLastReplacement(s.events, side);
  }

  async function tryLiberoEnter(side: 'home' | 'away', playerOutId: string, liberoId: string, position: number) {
    const result = liberoEnterCheck(side, liberoId, position);
    if (result.ok) await applySubstitutionReal(side, playerOutId, liberoId, position, true, false);
    return result;
  }

  async function manualLiberoExit(side: 'home' | 'away') {
    const s = useScoringStore.getState();
    const libero = side === 'home' ? s.liberoHome : s.liberoAway;
    jest.advanceTimersByTime(1);
    const teamId = side === 'home' ? currentMatch.teamHomeId : currentMatch.teamAwayId;
    const { event } = await performSubstitution({
      matchId: currentMatch.id, setId: s.currentSet!.id, teamId, teamSide: side,
      playerOutId: libero!.liberoId, playerInId: libero!.replacedPlayerId!, position: libero!.replacedPosition!,
      isLibero: true, isAutomatic: false,
    });
    s.applyLiberoExit(side);
    s.recordEvent(event);
    const roster = side === 'home' ? homeRoster : awayRoster;
    const liberoPlayer = roster.find((p) => p.id === libero!.liberoId)!;
    s.restoreLiberoToBench(side, liberoPlayer);
  }

  function tryTimeout(team: 'home' | 'away') {
    const s = useScoringStore.getState();
    const used = team === 'home' ? s.timeoutsHome : s.timeoutsAway;
    const result = validateTimeoutRequest(used, currentMatch.config, team);
    return result;
  }

  async function doTimeout(team: 'home' | 'away') {
    const result = tryTimeout(team);
    if (!result.ok) return result;
    jest.advanceTimersByTime(1);
    const s = useScoringStore.getState();
    const event = await addEvent({
      matchId: currentMatch.id, setId: s.currentSet!.id,
      eventType: team === 'home' ? 'timeout_home' : 'timeout_away',
      playerId: null, teamId: team === 'home' ? currentMatch.teamHomeId : currentMatch.teamAwayId, details: {},
    });
    s.recordEvent(event);
    s.requestTimeout(team);
    return result;
  }

  async function doSanction(side: 'home' | 'away', sanctionType: 'warning' | 'penalty' | 'expulsion', playerId: string | null) {
    jest.advanceTimersByTime(1);
    const s = useScoringStore.getState();
    const teamId = side === 'home' ? currentMatch.teamHomeId : currentMatch.teamAwayId;
    const opponentTeamId = side === 'home' ? currentMatch.teamAwayId : currentMatch.teamHomeId;
    const awardsPoint = sanctionType === 'penalty';
    const { sanctionEvent, pointEvent } = await addSanction({
      matchId: currentMatch.id, setId: s.currentSet!.id, teamId, teamSide: side, opponentTeamId,
      sanctionType, playerId, awardsPoint,
    });
    sanctionEvents = [...sanctionEvents, sanctionEvent];
    s.recordEvent(sanctionEvent);
    if (pointEvent) {
      const scoringTeam: 'home' | 'away' = side === 'home' ? 'away' : 'home';
      return applyScoredPointEffects(scoringTeam, pointEvent);
    }
    return { setWon: false, matchWon: false, winnerSide: null as 'home' | 'away' | null };
  }

  async function doUndo() {
    const s = useScoringStore.getState();
    const result = await undoLastEvent(currentMatch.id, s.currentSet!.id);
    if (!result) return null;
    const reconstructed = await reconstructLiveState(currentMatch.id);
    if (reconstructed) useScoringStore.getState().hydrate(reconstructed);
    sanctionEvents = await getSanctionsForMatch(currentMatch.id);
    return result;
  }

  // ════════════════════════════════════════════════════════════════════
  // SET 1 — manual serve choice, rotation, libero, subs, captain, timeouts, undo
  // ════════════════════════════════════════════════════════════════════

  // Manual serve choice: home serves first (mirrors handleValidateLineup's first branch).
  await updateMatchStatus(currentMatch.id, 'live');
  await setFirstServeTeam(currentMatch.id, currentMatch.teamHomeId);
  currentMatch = (await getMatchById(currentMatch.id))!;
  expect(currentMatch.firstServeTeamId).toBe(currentMatch.teamHomeId);

  const initialHomeCourt: CourtMap = { 1: H1.id, 2: H2.id, 3: H3.id, 4: H4.id, 5: H5.id, 6: H6.id };
  const initialAwayCourt: CourtMap = { 1: away[0].id, 2: away[1].id, 3: away[2].id, 4: away[3].id, 5: away[4].id, 6: away[5].id };
  const set1 = await enterSet(1, currentMatch.teamHomeId, initialHomeCourt, initialAwayCourt);
  expect(useScoringStore.getState().servingTeam).toBe('home'); // manual choice actually took effect

  // 1. Home serving already — no rotation.
  await doPoint('home');
  expect(useScoringStore.getState().scoreHome).toBe(1);
  expect(useScoringStore.getState().onCourtHome).toEqual(initialHomeCourt);

  // 2. Away side-out — away rotates.
  await doPoint('away');
  const awayAfterRotation1 = { 6: away[0].id, 1: away[1].id, 2: away[2].id, 3: away[3].id, 4: away[4].id, 5: away[5].id };
  expect(useScoringStore.getState().onCourtAway).toEqual(awayAfterRotation1);
  expect(useScoringStore.getState().servingTeam).toBe('away');

  // 3. Away already serving — no rotation.
  await doPoint('away');
  expect(useScoringStore.getState().scoreAway).toBe(2);

  // 4. Home side-out — home's first rotation. Then UNDO: proves rotation reverts (bug fix).
  await doPoint('home');
  const homeAfterRotation1 = { 6: H1.id, 1: H2.id, 2: H3.id, 3: H4.id, 4: H5.id, 5: H6.id };
  expect(useScoringStore.getState().onCourtHome).toEqual(homeAfterRotation1);
  expect(useScoringStore.getState().scoreHome).toBe(2);

  await doUndo();
  expect(useScoringStore.getState().onCourtHome).toEqual(initialHomeCourt); // rotation reverted
  expect(useScoringStore.getState().scoreHome).toBe(1);
  expect(useScoringStore.getState().servingTeam).toBe('away');

  // Re-apply the same point for real, continuing the match identically.
  await doPoint('home');
  expect(useScoringStore.getState().onCourtHome).toEqual(homeAfterRotation1);
  expect(useScoringStore.getState().servingTeam).toBe('home');

  // 5. Libero ENTERS for the captain (H1, now at back-row position 6) — also
  //    triggers the in-game acting-captain requirement.
  const enterCheck1 = liberoEnterCheck('home', HLib.id, 6);
  expect(enterCheck1.ok).toBe(true);
  await applySubstitutionReal('home', H1.id, HLib.id, 6, true, false);
  expect(useScoringStore.getState().onCourtHome[6]).toBe(HLib.id);
  expect(useScoringStore.getState().substitutionsHome).toBe(0); // libero never counts toward quota

  const onCourtIdsAfterLiberoIn = Object.values(useScoringStore.getState().onCourtHome);
  expect(needsNewActingCaptain({ registeredCaptainId: H1.id, actingCaptainId: null, onCourtPlayerIds: onCourtIdsAfterLiberoIn })).toBe(true);
  actingCaptainHomeId = H2.id; // referee designates H2 as acting captain
  expect(getDisplayedCaptainId({ registeredCaptainId: H1.id, actingCaptainId: actingCaptainHomeId, onCourtPlayerIds: onCourtIdsAfterLiberoIn })).toBe(H2.id);

  // 6. Away side-out.
  await doPoint('away');
  // 7. Home side-out — libero's slot rotates 6→5, still back row, no exit yet.
  await doPoint('home');
  expect(useScoringStore.getState().liberoHome).toMatchObject({ isOnCourt: true, replacedPosition: 5 });
  // 8. Away side-out.
  await doPoint('away');
  // 9. Home side-out — libero's slot rotates 5→4 (front row): AUTOMATIC EXIT (V→IV), captain H1 returns.
  await doPoint('home');
  expect(useScoringStore.getState().liberoHome).toMatchObject({ isOnCourt: false });
  expect(useScoringStore.getState().onCourtHome[4]).toBe(H1.id); // captain restored
  expect(useScoringStore.getState().benchHome.map((p) => p.id)).toContain(HLib.id); // libero back on bench

  const onCourtIdsAfterAutoExit = Object.values(useScoringStore.getState().onCourtHome);
  expect(onCourtIdsAfterAutoExit).toContain(H1.id);
  if (needsNewActingCaptain({ registeredCaptainId: H1.id, actingCaptainId: actingCaptainHomeId, onCourtPlayerIds: onCourtIdsAfterAutoExit }) === false
      && onCourtIdsAfterAutoExit.includes(H1.id)) {
    actingCaptainHomeId = null; // captain resumes automatically
  }
  expect(getDisplayedCaptainId({ registeredCaptainId: H1.id, actingCaptainId: actingCaptainHomeId, onCourtPlayerIds: onCourtIdsAfterAutoExit })).toBe(H1.id);

  // Bug check: re-entering the libero RIGHT NOW (no rally since the auto-exit) must be BLOCKED.
  const rallyBlocked = liberoEnterCheck('home', HLib.id, 6);
  expect(rallyBlocked.ok).toBe(false);
  if (!rallyBlocked.ok) expect(rallyBlocked.code).toBe('libero_rally_required');

  // 10. Away side-out — this is the rally the libero needed before re-entering.
  await doPoint('away');

  // 11. Libero RE-ENTERS, now legal (a rally has been played since the auto-exit).
  const backRowPositions = ([1, 5, 6] as const).filter((p) => useScoringStore.getState().onCourtHome[p]);
  const reentryPosition = backRowPositions[0];
  const reentryOutId = useScoringStore.getState().onCourtHome[reentryPosition];
  const reentryCheck = liberoEnterCheck('home', HLib.id, reentryPosition);
  expect(reentryCheck.ok).toBe(true);
  await applySubstitutionReal('home', reentryOutId, HLib.id, reentryPosition, true, false);
  expect(useScoringStore.getState().onCourtHome[reentryPosition]).toBe(HLib.id);

  // 12. MANUAL libero exit (no rally requirement for leaving).
  await manualLiberoExit('home');
  expect(useScoringStore.getState().onCourtHome[reentryPosition]).toBe(reentryOutId);
  expect(useScoringStore.getState().liberoHome).toMatchObject({ isOnCourt: false });
  expect(useScoringStore.getState().benchHome.map((p) => p.id)).toContain(HLib.id);
  expect(useScoringStore.getState().substitutionsHome).toBe(0); // still zero — only libero moves so far

  // 13. Legal regular substitution: H4 → H8. Then UNDO: proves substitution fully reverts (bug fix).
  const h4Position = Number(Object.entries(useScoringStore.getState().onCourtHome).find(([, id]) => id === H4.id)![0]);
  const legalSub = regularSubCheck('home', H4.id, H8.id);
  expect(legalSub.ok).toBe(true);
  await applySubstitutionReal('home', H4.id, H8.id, h4Position, false, false);
  expect(useScoringStore.getState().onCourtHome[h4Position]).toBe(H8.id);
  expect(useScoringStore.getState().substitutionsHome).toBe(1);

  await doUndo();
  expect(useScoringStore.getState().onCourtHome[h4Position]).toBe(H4.id); // reverted
  expect(useScoringStore.getState().substitutionsHome).toBe(0);
  expect(useScoringStore.getState().benchHome.map((p) => p.id)).toContain(H8.id);
  expect(useScoringStore.getState().pairsHome.filter((p) => !p.isCancelled && !p.isLibero)).toHaveLength(0);

  // Re-apply for real, continuing the match.
  await applySubstitutionReal('home', H4.id, H8.id, h4Position, false, false);
  expect(useScoringStore.getState().substitutionsHome).toBe(1);

  // 14. ILLEGAL substitution attempt: H8 (just entered) can only be replaced by H4 (reciprocity) — H9 is rejected.
  const illegalAttempt = regularSubCheck('home', H8.id, H9.id);
  expect(illegalAttempt.ok).toBe(false);
  if (!illegalAttempt.ok) expect(illegalAttempt.code).toBe('sub_reserve_already_used');
  // Confirm it was NEVER applied — state unchanged.
  expect(useScoringStore.getState().onCourtHome[h4Position]).toBe(H8.id);
  expect(useScoringStore.getState().substitutionsHome).toBe(1);

  // 15. Timeouts: 2 allowed, 3rd rejected. Undo one in between to prove the count reverts (bug fix).
  const t1 = await doTimeout('home');
  expect(t1.ok).toBe(true);
  expect(useScoringStore.getState().timeoutsHome).toBe(1);
  const t2 = await doTimeout('home');
  expect(t2.ok).toBe(true);
  expect(useScoringStore.getState().timeoutsHome).toBe(2);

  await doUndo();
  expect(useScoringStore.getState().timeoutsHome).toBe(1); // reverted

  const t2again = await doTimeout('home');
  expect(t2again.ok).toBe(true);
  expect(useScoringStore.getState().timeoutsHome).toBe(2);

  const t3 = tryTimeout('home');
  expect(t3.ok).toBe(false);
  if (!t3.ok) expect(t3.code).toBe('timeout_quota_reached');
  expect(useScoringStore.getState().timeoutsHome).toBe(2); // unchanged, request never applied

  // Fast-forward: home wins set 1.
  const set1Result = await blastUntilSetWon('home');
  expect(set1Result.winnerSide).toBe('home');
  expect(set1Result.matchWon).toBe(false);
  expect(useScoringStore.getState().setsHome).toBe(1);
  expect(useScoringStore.getState().setsAway).toBe(0);

  // ════════════════════════════════════════════════════════════════════
  // SET 2 — lineup re-entry (carried over from set 1), away wins
  // ════════════════════════════════════════════════════════════════════

  const endOfSet1Home = { ...useScoringStore.getState().onCourtHome };
  const endOfSet1Away = { ...useScoringStore.getState().onCourtAway };
  const set2ServingSide = resolveInitialServing(currentMatch, 2);
  const set2ServingTeamId = set2ServingSide === 'home' ? currentMatch.teamHomeId : currentMatch.teamAwayId;
  await enterSet(2, set2ServingTeamId, endOfSet1Home, endOfSet1Away);
  // The pre-filled lineup round-trips through persistence exactly as entered (no edits this set).
  expect(useScoringStore.getState().onCourtHome).toEqual(endOfSet1Home);
  expect(useScoringStore.getState().onCourtAway).toEqual(endOfSet1Away);

  const set2Result = await blastUntilSetWon('away');
  expect(set2Result.winnerSide).toBe('away');
  expect(useScoringStore.getState().setsHome).toBe(1);
  expect(useScoringStore.getState().setsAway).toBe(1);

  // ════════════════════════════════════════════════════════════════════
  // SET 3 — sanctions: warning (no point), penalty (point awarded + undo cascade)
  // ════════════════════════════════════════════════════════════════════

  const endOfSet2Home = { ...useScoringStore.getState().onCourtHome };
  const endOfSet2Away = { ...useScoringStore.getState().onCourtAway };
  const set3ServingSide = resolveInitialServing(currentMatch, 3);
  const set3ServingTeamId = set3ServingSide === 'home' ? currentMatch.teamHomeId : currentMatch.teamAwayId;
  await enterSet(3, set3ServingTeamId, endOfSet2Home, endOfSet2Away);

  await doPoint('home');
  await doPoint('home');
  const scoreBeforePenalty = useScoringStore.getState().scoreHome;

  const warningResult = await doSanction('away', 'warning', away[1].id);
  expect(warningResult.setWon).toBe(false);
  expect(useScoringStore.getState().scoreHome).toBe(scoreBeforePenalty); // no point for a warning

  const penaltyResult = await doSanction('away', 'penalty', away[2].id);
  expect(penaltyResult.setWon).toBe(false);
  expect(useScoringStore.getState().scoreHome).toBe(scoreBeforePenalty + 1); // penalty awards the opponent a point

  await doUndo(); // undoes the penalty — cascades to cancel its linked point too
  expect(useScoringStore.getState().scoreHome).toBe(scoreBeforePenalty);
  expect(sanctionEvents.some((e) => e.details.sanctionType === 'penalty')).toBe(false);
  expect(sanctionEvents.some((e) => e.details.sanctionType === 'warning')).toBe(true);

  await doSanction('away', 'penalty', away[2].id); // re-apply for real
  expect(useScoringStore.getState().scoreHome).toBe(scoreBeforePenalty + 1);

  const set3Result = await blastUntilSetWon('home');
  expect(set3Result.winnerSide).toBe('home');
  expect(useScoringStore.getState().setsHome).toBe(2);
  expect(useScoringStore.getState().setsAway).toBe(1);

  // ════════════════════════════════════════════════════════════════════
  // SET 4 — expulsion (blocks re-entry), quota exhaustion + exceptional substitution
  // ════════════════════════════════════════════════════════════════════

  const endOfSet3Home = { ...useScoringStore.getState().onCourtHome };
  const endOfSet3Away = { ...useScoringStore.getState().onCourtAway };
  const set4ServingSide = resolveInitialServing(currentMatch, 4);
  const set4ServingTeamId = set4ServingSide === 'home' ? currentMatch.teamHomeId : currentMatch.teamAwayId;
  await enterSet(4, set4ServingTeamId, endOfSet3Home, endOfSet3Away);

  // Note: set 1 ended with H4 already replaced by H8 (a legal sub that stuck),
  // so H4 is on the BENCH here, not on court — H8 is the one on court instead.

  // Expel H9 (on the bench) — they can never legally re-enter for the rest of this set.
  await doSanction('home', 'expulsion', H9.id);
  const expelledCheck = regularSubCheck('home', H2.id, H9.id);
  expect(expelledCheck.ok).toBe(false);
  if (!expelledCheck.ok) expect(expelledCheck.code).toBe('sub_player_expelled');

  // Exhaust the substitution quota (6) with 3 reciprocal out-and-back pairs — all legal.
  // Uses the 3 bench players NOT expelled (H4, H10, H11) against 3 distinct on-court starters.
  async function reciprocalPair(starter: Player, reserve: Player) {
    const pos = Number(Object.entries(useScoringStore.getState().onCourtHome).find(([, id]) => id === starter.id)![0]);
    const out = await trySubstitute('home', starter.id, reserve.id, pos);
    expect(out.ok).toBe(true);
    const back = await trySubstitute('home', reserve.id, starter.id, pos);
    expect(back.ok).toBe(true);
  }
  await reciprocalPair(H2, H4);
  await reciprocalPair(H3, H10);
  await reciprocalPair(H5, H11);
  expect(useScoringStore.getState().substitutionsHome).toBe(6);

  // 7th attempt: quota reached — every bench candidate is blocked the same way, so an
  // exceptional substitution becomes eligible.
  const quotaBlockedPos = Number(Object.entries(useScoringStore.getState().onCourtHome).find(([, id]) => id === H6.id)![0]);
  const quotaBlocked = regularSubCheck('home', H6.id, H10.id);
  expect(quotaBlocked.ok).toBe(false);
  if (!quotaBlocked.ok) {
    expect(quotaBlocked.code).toBe('sub_quota_reached');
    expect(quotaBlocked.allowExceptional).toBe(true);
  }

  const benchCandidates = useScoringStore.getState().benchHome.filter((p) => p.position !== 'libero');
  const eligibility = getExceptionalSubstitutionEligibility(H6, benchCandidates, {
    allPlayers: homeRoster, pairs: useScoringStore.getState().pairsHome, subsUsed: useScoringStore.getState().substitutionsHome,
    config: currentMatch.config, onCourtPlayerIds: Object.values(useScoringStore.getState().onCourtHome),
    sanctionEventsForSet: sanctionEvents.filter((e) => e.setId === useScoringStore.getState().currentSet!.id),
    sanctionEventsForMatch: sanctionEvents,
  });
  expect(eligibility.eligible).toBe(true);

  await applySubstitutionReal('home', H6.id, H10.id, quotaBlockedPos, false, true); // EXCEPTIONAL — bypasses the quota check
  expect(useScoringStore.getState().onCourtHome[quotaBlockedPos]).toBe(H10.id);
  expect(useScoringStore.getState().substitutionsHome).toBe(7);
  expect(useScoringStore.getState().pairsHome.some((p) => p.isExceptional && p.playerOutId === H6.id)).toBe(true);

  const set4Result = await blastUntilSetWon('away');
  expect(set4Result.winnerSide).toBe('away');
  expect(useScoringStore.getState().setsHome).toBe(2);
  expect(useScoringStore.getState().setsAway).toBe(2);

  // ════════════════════════════════════════════════════════════════════
  // SET 5 — manual serve choice (independent of set 1's), resume mid-set, match end
  // ════════════════════════════════════════════════════════════════════

  const endOfSet4Home = { ...useScoringStore.getState().onCourtHome };
  const endOfSet4Away = { ...useScoringStore.getState().onCourtAway };

  // Manual serve choice for the decider, same mechanism as set 1 — away this time.
  const set5ServingTeamId = currentMatch.teamAwayId;
  await enterSet(5, set5ServingTeamId, endOfSet4Home, endOfSet4Away);
  expect(useScoringStore.getState().servingTeam).toBe('away');

  await doPoint('away');
  await doPoint('away');
  await doPoint('home');
  await doPoint('home');
  await doPoint('home');
  await doPoint('home'); // home 4, away 2 — some real rotations along the way, untracked precisely (already covered in set 1)

  // ── Resume after closing the app mid-set ──
  const liveBeforeClose = useScoringStore.getState();
  const reconstructed = await reconstructLiveState(currentMatch.id);
  expect(reconstructed).not.toBeNull();
  expect(reconstructed!.scoreHome).toBe(liveBeforeClose.scoreHome);
  expect(reconstructed!.scoreAway).toBe(liveBeforeClose.scoreAway);
  expect(reconstructed!.servingTeam).toBe(liveBeforeClose.servingTeam);
  expect(reconstructed!.onCourtHome).toEqual(liveBeforeClose.onCourtHome);
  expect(reconstructed!.onCourtAway).toEqual(liveBeforeClose.onCourtAway);
  expect(reconstructed!.setsHome).toBe(2);
  expect(reconstructed!.setsAway).toBe(2);

  useScoringStore.getState().reset(); // simulate the app being fully closed
  useScoringStore.getState().hydrate(reconstructed!);
  sanctionEvents = await getSanctionsForMatch(currentMatch.id);
  expect(useScoringStore.getState().scoreHome).toBe(liveBeforeClose.scoreHome);
  expect(useScoringStore.getState().onCourtHome).toEqual(liveBeforeClose.onCourtHome);

  // Continue the match from the resumed state to its natural conclusion.
  const set5Result = await blastUntilSetWon('home');
  expect(set5Result.winnerSide).toBe('home');
  expect(set5Result.matchWon).toBe(true);
  expect(useScoringStore.getState().setsHome).toBe(3);
  expect(useScoringStore.getState().setsAway).toBe(2);

  const finalMatch = await getMatchById(currentMatch.id);
  expect(finalMatch?.status).toBe('finished');
  expect(finalMatch?.winnerTeamId).toBe(currentMatch.teamHomeId);
});
