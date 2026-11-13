/**
 * Sample data (« Exemple »): created once on a fresh install so every screen
 * has something to show, written through the app's own services (the match
 * is replayed event by event), flagged `is_sample`, and removed in one go from
 * the Settings without touching the user's data.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from './database';
import { createTeam } from './teamService';
import { createPlayer } from './playerService';
import {
  createMatch, createSet, setFirstServeTeam, setMatchCaptains, updateMatchStatus, updateSet,
} from './matchService';
import { addEvent } from './eventService';
import { performSubstitution } from './substitutionService';
import { saveLineup } from './lineupService';
import { createTournament, deleteTournament, getTournamentBundle, recordTournamentResult } from './tournamentService';
import { DEFAULT_INDOOR_CONFIG } from '../models/match';
import {
  SAMPLE_AWAY, SAMPLE_HOME, SAMPLE_MATCH_SEED, SAMPLE_SETS, SAMPLE_TOURNAMENT, type SampleTeam, type SampleTeamNames,
} from '../features/sample/sampleData';
import { buildSampleSets, keyOf, type Side } from '../features/sample/sampleMatch';
import { initialWizardState, toCreateInput } from '../features/tournament/wizard';
import { randomValidScore } from '../features/tournament/devRandomScores';
import { rulesForStage } from '../features/tournament/engine/results';
import { createRng } from '../features/tournament/engine/rng';

/** Set once the fresh-install check ran: samples never come back after being removed. */
export const SAMPLE_CHECKED_KEY = '@volleymanager/sample_data_checked';

type Row = Record<string, unknown>;

async function isAppEmpty(): Promise<boolean> {
  const db = await getDb();
  for (const table of ['teams', 'matches', 'tournaments']) {
    if (await db.getFirstAsync<Row>(`SELECT id FROM ${table} LIMIT 1`)) return false;
  }
  return true;
}

/** Names in the phone language at first launch (sample.tournamentName, sample.teams) */
export interface SampleTexts {
  tournamentName: string;
  teamNames: SampleTeamNames;
}

/** Fresh install only (no team, match nor tournament), and only once. */
export async function createSampleDataIfEmpty(opts: SampleTexts): Promise<boolean> {
  if (await AsyncStorage.getItem(SAMPLE_CHECKED_KEY)) return false;
  const empty = await isAppEmpty();
  await AsyncStorage.setItem(SAMPLE_CHECKED_KEY, '1');
  if (!empty) return false;
  await createSampleData(opts);
  return true;
}

async function createSampleTeam(def: SampleTeam, names: SampleTeamNames): Promise<{ id: string; ids: Map<number, string> }> {
  const db = await getDb();
  const { name, short } = names[def.key];
  const team = await createTeam({ name, shortName: short, logoUri: null, color: def.color });
  await db.runAsync('UPDATE teams SET is_sample = 1 WHERE id = ?', [team.id]);
  const ids = new Map<number, string>();
  for (const p of def.players) {
    const player = await createPlayer({
      teamId: team.id, firstName: p.firstName, lastName: p.lastName, number: p.number,
      position: p.position, photoUri: null, isActive: true,
    });
    ids.set(p.number, player.id);
  }
  return { id: team.id, ids };
}

export async function createSampleData(opts: SampleTexts): Promise<void> {
  const db = await getDb();
  const home = await createSampleTeam(SAMPLE_HOME, opts.teamNames);
  const away = await createSampleTeam(SAMPLE_AWAY, opts.teamNames);
  const teamId: Record<Side, string> = { home: home.id, away: away.id };
  const playerId = (key: string) => {
    const [side, number] = key.split(':');
    return (side === 'home' ? home : away).ids.get(Number(number))!;
  };

  // ─── The 3-1 match, replayed event by event ───
  const match = await createMatch({
    format: 'indoor_6v6', mode: 'competition', teamHomeId: home.id, teamAwayId: away.id,
    config: DEFAULT_INDOOR_CONFIG,
  });
  await db.runAsync('UPDATE matches SET is_sample = 1 WHERE id = ?', [match.id]);
  await setFirstServeTeam(match.id, home.id);
  await setMatchCaptains(match.id, home.ids.get(SAMPLE_HOME.captain)!, away.ids.get(SAMPLE_AWAY.captain)!);

  // Played two days ago, one action every 12 seconds
  let clock = Date.now() - 2 * 24 * 3600 * 1000;
  const at = () => new Date((clock += 12_000)).toISOString();

  for (const set of buildSampleSets({ home: SAMPLE_HOME, away: SAMPLE_AWAY }, SAMPLE_SETS, SAMPLE_MATCH_SEED)) {
    const row = await createSet(match.id, set.setNumber, teamId[set.serve]);
    for (const side of ['home', 'away'] as const) {
      await saveLineup(match.id, row.id, teamId[side], Object.entries(set.lineup[side]).map(([pos, key]) => ({
        playerId: playerId(key), position: Number(pos) as 1 | 2 | 3 | 4 | 5 | 6, isStarter: true, isLibero: false,
      })));
    }
    for (const e of set.events) {
      const base = { matchId: match.id, setId: row.id, teamId: teamId[e.side], timestamp: at() };
      if (e.kind === 'point') {
        await addEvent({ ...base, eventType: e.side === 'home' ? 'point_home' : 'point_away', playerId: null, details: {} });
      } else if (e.kind === 'stat') {
        await addEvent({ ...base, eventType: e.type, playerId: playerId(e.player), details: {} });
      } else if (e.kind === 'timeout') {
        await addEvent({ ...base, eventType: e.side === 'home' ? 'timeout_home' : 'timeout_away', playerId: null, details: {} });
      } else {
        await performSubstitution({
          matchId: match.id, setId: row.id, teamId: teamId[e.side], teamSide: e.side,
          playerOutId: playerId(e.playerOut), playerInId: playerId(e.playerIn), position: e.position,
          isLibero: e.isLibero, isAutomatic: e.isAutomatic, timestamp: base.timestamp,
        });
      }
    }
    await updateSet(row.id, set.scoreHome, set.scoreAway, teamId[set.winner]);
  }
  await updateMatchStatus(match.id, 'finished', home.id);

  // ─── Tournament of 8 teams, pools + finals, half played ───
  const wizard = initialWizardState(new Date(), SAMPLE_TOURNAMENT.seed, (n) => `#${n}`);
  const input = toCreateInput({
    ...wizard,
    name: opts.tournamentName,
    teams: wizard.teams.map((t, i) => ({
      ...t, name: opts.teamNames[SAMPLE_TOURNAMENT.teams[i].key].name, color: SAMPLE_TOURNAMENT.teams[i].color,
    })),
  });
  const created = await createTournament(input);
  await db.runAsync('UPDATE tournaments SET is_sample = 1 WHERE id = ?', [created.tournament.id]);
  const rng = createRng(SAMPLE_TOURNAMENT.seed);
  const half = Math.floor(created.matches.length / 2);
  for (let played = 0; played < half; played++) {
    const bundle = (await getTournamentBundle(created.tournament.id))!;
    const next = bundle.matches
      .filter((m) => m.status === 'scheduled' && m.homeId && m.awayId)
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0) || (a.court ?? 0) - (b.court ?? 0))[0];
    if (!next) break;
    const sets = randomValidScore(rulesForStage(bundle.tournament.rules, next.stage), rng);
    const outcome = await recordTournamentResult(created.tournament.id, next.id, { sets, forfeitId: null, source: 'manual' });
    if (!outcome.ok) break;
  }
}

export async function hasSampleData(): Promise<boolean> {
  const db = await getDb();
  for (const table of ['teams', 'matches', 'tournaments']) {
    if (await db.getFirstAsync<Row>(`SELECT id FROM ${table} WHERE is_sample = 1 LIMIT 1`)) return true;
  }
  return false;
}

/**
 * Removes every sample and nothing else. A sample team the user went on to use
 * in one of their own matches or tournaments is kept and becomes theirs.
 */
export async function deleteSampleData(): Promise<void> {
  const db = await getDb();
  for (const t of await db.getAllAsync<Row>('SELECT id FROM tournaments WHERE is_sample = 1')) {
    await deleteTournament(t.id as string);
  }
  const matches = await db.getAllAsync<Row>('SELECT id FROM matches WHERE is_sample = 1');
  await db.withTransactionAsync(async () => {
    for (const m of matches) {
      const id = m.id as string;
      for (const child of ['match_events', 'lineups', 'substitution_pairs', 'sets']) {
        await db.runAsync(`DELETE FROM ${child} WHERE match_id = ?`, [id]);
      }
      await db.runAsync('DELETE FROM matches WHERE id = ?', [id]);
    }
  });
  for (const t of await db.getAllAsync<Row>('SELECT id FROM teams WHERE is_sample = 1')) {
    const id = t.id as string;
    const used = (await db.getFirstAsync<Row>('SELECT id FROM matches WHERE team_home_id = ?', [id]))
      ?? (await db.getFirstAsync<Row>('SELECT id FROM matches WHERE team_away_id = ?', [id]))
      ?? (await db.getFirstAsync<Row>('SELECT id FROM tournament_teams WHERE team_id = ?', [id]));
    if (used) {
      await db.runAsync('UPDATE teams SET is_sample = 0 WHERE id = ?', [id]);
      continue;
    }
    await db.runAsync('DELETE FROM players WHERE team_id = ?', [id]);
    await db.runAsync('DELETE FROM teams WHERE id = ?', [id]);
  }
}
