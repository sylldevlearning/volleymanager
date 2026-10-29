// Small formats played through the real services and store, then resumed and
// undone from the (fake) database only — as the arbitrage screen does.

import fs from 'fs';
import path from 'path';
import { FakeSqlDb } from './helpers/fakeSqlDb';

let mockIdCounter = 0;
jest.mock('../src/services/database', () => ({
  getDb: jest.fn(),
  generateId: jest.fn(() => `id-${++mockIdCounter}`),
}));

import { getDb } from '../src/services/database';
import { createAdHocMatch } from '../src/services/adHocMatchService';
import { createSet, updateMatchStatus } from '../src/services/matchService';
import { addEvent, undoLastEvent } from '../src/services/eventService';
import { saveLineup, type LineupEntry } from '../src/services/lineupService';
import { getPlayersByTeam } from '../src/services/playerService';
import { reconstructLiveState } from '../src/services/matchStateReconstruction';
import { recordSubstitution } from '../src/features/match/recordSubstitution';
import { defaultArbitrageConfig, courtSize } from '../src/features/match/formatProfile';
import { smallCourtSlot } from '../src/components/court/FullCourt';
import { useScoringStore, type CourtMap } from '../src/stores/scoringStore';
import type { MatchFormat } from '../src/models/match';
import type { Player } from '../src/models/player';

beforeEach(() => {
  mockIdCounter = 0;
  (getDb as jest.Mock).mockResolvedValue(new FakeSqlDb());
  useScoringStore.getState().reset();
});

const entries = (court: CourtMap): LineupEntry[] => Object.entries(court).map(([pos, playerId]) => ({
  playerId, position: Number(pos) as LineupEntry['position'], isStarter: true, isLibero: false,
}));

async function start(format: MatchFormat, players: number) {
  const side = (name: string, first: number) => ({
    name, color: '#1D4ED8', captainNumber: first,
    players: Array.from({ length: players }, (_, i) => ({ number: first + i })),
  });
  const created = await createAdHocMatch({
    format, mode: 'competition', config: defaultArbitrageConfig(format), home: side('Lyon', 1), away: side('Paris', 21),
  });
  await updateMatchStatus(created.id, 'live');
  const match = { ...created, status: 'live' as const };
  const set1 = await createSet(match.id, 1, match.teamHomeId); // home serves first
  const home = await getPlayersByTeam(match.teamHomeId);
  const away = await getPlayersByTeam(match.teamAwayId);
  const size = courtSize(format);
  const court = (roster: Player[]): CourtMap => Object.fromEntries(roster.slice(0, size).map((p, i) => [i + 1, p.id]));
  const store = useScoringStore.getState();
  store.initMatch(match, set1);
  store.initLineup('home', court(home), home.slice(size), null);
  store.initLineup('away', court(away), away.slice(size), null);
  await saveLineup(match.id, set1.id, match.teamHomeId, entries(court(home)));
  await saveLineup(match.id, set1.id, match.teamAwayId, entries(court(away)));

  const point = async (team: 'home' | 'away') => {
    const s = useScoringStore.getState();
    const e = await addEvent({
      matchId: match.id, setId: set1.id, eventType: team === 'home' ? 'point_home' : 'point_away',
      playerId: null, teamId: team === 'home' ? match.teamHomeId : match.teamAwayId, details: {},
    });
    s.addPointEvent(team, e);
  };
  const substitute = (playerOutId: string, playerInId: string, position: number) => recordSubstitution(
    { matchId: match.id, setId: set1.id, teamId: match.teamHomeId, side: 'home', roster: home },
    { playerOutId, playerInId, position, isLibero: false },
  );
  return { match, set1, home, away, point, substitute };
}

/** What the screen shows, live (store) or rebuilt from the database. */
const snapshot = (s: { onCourtHome: CourtMap; onCourtAway: CourtMap; benchHome: Player[]; scoreHome: number; scoreAway: number; servingTeam: string; rotationHome: number[] }) => ({
  onCourtHome: s.onCourtHome, onCourtAway: s.onCourtAway, bench: s.benchHome.map((p) => p.id).sort(),
  score: [s.scoreHome, s.scoreAway], serving: s.servingTeam, rotation: s.rotationHome,
});

describe('4×4', () => {
  it('rotates over 4 places, free substitution, resume and undo', async () => {
    const { match, set1, home, point, substitute } = await start('indoor_4v4', 6);
    await point('away'); // away wins the serve and rotates
    await point('home'); // home wins it back and rotates: the player in 2 serves
    expect(useScoringStore.getState().onCourtHome).toEqual({ 1: home[1].id, 2: home[2].id, 3: home[3].id, 4: home[0].id });
    expect(useScoringStore.getState().rotationHome).toEqual([2, 3, 4, 1]);

    // Free substitution: the 5th player for the one in 3 (no pair, no quota)
    await substitute(home[3].id, home[4].id, 3);
    const live = snapshot(useScoringStore.getState());
    expect(live.onCourtHome[3]).toBe(home[4].id);
    expect(live.bench).toEqual([home[3].id, home[5].id].sort());

    // Closed and reopened: the same state from the database
    const resumed = await reconstructLiveState(match.id);
    expect(snapshot(resumed!)).toEqual(live);
    expect(resumed!.substitutionsHome).toBe(1);

    // "Annuler" the substitution, then the point
    await undoLastEvent(match.id, set1.id);
    const afterSub = await reconstructLiveState(match.id);
    expect(afterSub!.onCourtHome).toEqual({ 1: home[1].id, 2: home[2].id, 3: home[3].id, 4: home[0].id });
    await undoLastEvent(match.id, set1.id);
    const afterPoint = await reconstructLiveState(match.id);
    expect(afterPoint!.onCourtHome).toEqual({ 1: home[0].id, 2: home[1].id, 3: home[2].id, 4: home[3].id });
    expect([afterPoint!.scoreHome, afterPoint!.scoreAway]).toEqual([0, 1]);
  });
});

describe('3×3', () => {
  it('service order turns over 3 players and survives a resume', async () => {
    const { match, home, point } = await start('indoor_3v3', 4);
    for (const team of ['away', 'home', 'away', 'home'] as const) await point(team);
    // Home won the serve back twice: its 3rd player serves
    expect(useScoringStore.getState().onCourtHome[1]).toBe(home[2].id);
    expect(snapshot((await reconstructLiveState(match.id))!)).toEqual(snapshot(useScoringStore.getState()));
  });
});

describe('2×2', () => {
  it('the two players alternate at the serve, also after a resume', async () => {
    const { match, home, point } = await start('beach_2v2', 2);
    const servers: string[] = [useScoringStore.getState().onCourtHome[1]];
    for (let i = 0; i < 3; i++) {
      await point('away');
      await point('home');
      servers.push(useScoringStore.getState().onCourtHome[1]);
    }
    expect(servers).toEqual([home[0].id, home[1].id, home[0].id, home[1].id]);
    const resumed = await reconstructLiveState(match.id);
    expect(resumed!.onCourtHome[1]).toBe(home[1].id);
    expect(resumed!.rotationHome).toHaveLength(2);
  });
});

describe('court drawing', () => {
  it.each([4, 3, 2])('every place of a %i-a-side court has a spot, both halves facing each other', (size) => {
    for (let pos = 1; pos <= size; pos++) {
      const l = smallCourtSlot(size, pos, true);
      const r = smallCourtSlot(size, pos, false);
      expect(l.x).toBeGreaterThan(0);
      expect(l.x).toBeLessThan(1);
      expect(r.y).toBeCloseTo(1 - l.y);
    }
  });
});

describe('screens wiring', () => {
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

  it('match setup: format chosen first, players and libero by format, rules by format', () => {
    const setup = read('app/arbitrage/new.tsx');
    expect(setup).toContain("['indoor_6v6', 'indoor_4v4', 'indoor_3v3', 'beach_2v2']");
    expect(setup).toContain('validateAdHocTeam(toDraft(home), format)');
    expect(setup).toContain('setConfig(defaultArbitrageConfig(next))');
    expect(setup).toContain('{hasLibero && <Pressable');
    expect(setup).toContain('applyPreset(format, p, config)');
    expect(setup).toMatch(/format,\r?\n\s+mode: 'competition'/);
  });

  it('arbitrage screen: lineup, court, changes of court and technical time-out by format', () => {
    const screen = read('app/match/[id]/arbitrage.tsx');
    expect(screen).toContain('Object.keys(draftHomeCourt).length === lineupSize');
    expect(screen).toContain('format={(match ?? pendingMatch)?.format}');
    expect(screen).toContain('shouldSwitchCourts(match.format, newScoreHome, newScoreAway, setNum, match.config)');
    expect(screen).toContain('isTechnicalTimeout(newScoreHome, newScoreAway, setNum, match.config)');
    const sheet = read('src/components/scoring/SubstitutionSheet.tsx');
    expect(sheet).toContain('validateFreeSubstitution(');
    expect(sheet).toContain('{!allowed ? (');
  });
});
