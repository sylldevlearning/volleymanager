import type { SetRules, SetScore, TeamRef, TournamentMatch, TournamentPool } from '../../models/tournament';
import { engineContext, toEngineMatch, type TournamentBundle } from './bundle';
import { finalRanking } from './engine/finalRanking';
import type { ScoreError } from './engine/results';
import { computeStandings, type StandingRow } from './engine/standings';

export type Translate = (key: string, opts?: Record<string, unknown>) => string;

/** 1er, 2e… / 1st, 2nd, 3rd, 4th… */
export function ordinal(n: number, lang: string): string {
  if (lang === 'en') {
    const tens = n % 100;
    if (tens >= 11 && tens <= 13) return `${n}th`;
    return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`;
  }
  return n === 1 ? '1er' : `${n}e`;
}

const levelName = (level: number, t: Translate) => t(`tournament.level.${Math.min(level, 3)}`);

function poolsOfLevel(bundle: TournamentBundle, level: number): TournamentPool[] {
  return bundle.pools.filter((p) => p.level === level);
}

/** "Poule A", "Tour 2 · Poule B", "Principale · Poule A", or "Principale" for a level with one pool. */
export function poolTitle(pool: TournamentPool, bundle: TournamentBundle, t: Translate): string {
  if (pool.phase !== null) return t('tournament.view.roundPool', { round: pool.phase, name: pool.name });
  if (pool.level !== null) {
    return poolsOfLevel(bundle, pool.level).length > 1
      ? t('tournament.view.levelPool', { level: levelName(pool.level, t), name: pool.name })
      : levelName(pool.level, t);
  }
  return t('tournament.view.pool', { name: pool.name });
}

/** Name of a bracket match from its label ('ko:8:3', 'third', 'place:5-8:2'). */
function bracketTitle(label: string, t: Translate): string {
  if (label === 'third') return t('tournament.view.third');
  const ko = /^ko:(\d+):(\d+)$/.exec(label);
  const place = /^place:(\d+)-(\d+):(\d+)$/.exec(label);
  let teams: number;
  let n: number;
  if (ko) {
    teams = Number(ko[1]);
    n = Number(ko[2]);
  } else if (place) {
    const [from, to] = [Number(place[1]), Number(place[2])];
    n = Number(place[3]);
    teams = to - from + 1;
    if (from > 1) {
      return teams === 2
        ? t('tournament.view.placeMatch', { place: from })
        : t('tournament.view.placeRange', { from, to, n });
    }
  } else {
    return label;
  }
  if (teams === 2) return t('tournament.view.final');
  if (teams === 4) return t('tournament.view.semi', { n });
  if (teams === 8) return t('tournament.view.quarter', { n });
  return t('tournament.view.roundOf', { size: teams / 2, n });
}

export function matchTitle(match: TournamentMatch, bundle: TournamentBundle, t: Translate): string {
  const prefix = match.level !== null && match.poolId === null ? `${levelName(match.level, t)} · ` : '';
  if (match.label) return prefix + bracketTitle(match.label, t);
  const day = t('tournament.view.matchday', { n: match.round });
  const pool = bundle.pools.find((p) => p.id === match.poolId);
  return pool ? `${poolTitle(pool, bundle, t)} · ${day}` : day;
}

function sourceName(ref: TeamRef, bundle: TournamentBundle, t: Translate, lang: string): string {
  switch (ref.type) {
    case 'team':
      return bundle.teams.find((x) => x.id === ref.id)?.name ?? '?';
    case 'poolRank': {
      const pool = bundle.pools[ref.pool];
      return t('tournament.view.fromPool', { ordinal: ordinal(ref.rank, lang), pool: pool ? poolTitle(pool, bundle, t) : '?' });
    }
    case 'bestOf':
      return t('tournament.view.fromBest', { ordinal: ordinal(ref.rank, lang), index: ref.index });
    case 'winner':
    case 'loser': {
      const from = bundle.matches.find((m) => m.id === ref.match);
      const title = from ? matchTitle(from, bundle, t) : '?';
      return t(ref.type === 'winner' ? 'tournament.view.winnerOf' : 'tournament.view.loserOf', { match: title });
    }
    case 'seat':
      return t('tournament.view.fromRound', { round: ref.phase - 1 });
    case 'levelRank':
      return t('tournament.view.fromLevel', { level: levelName(ref.level, t), rank: ref.rank });
  }
}

/** The team name once known, otherwise where it comes from ("1er Poule A", "Vainqueur Demi-finale 1"). */
export function sideName(match: TournamentMatch, side: 'home' | 'away', bundle: TournamentBundle, t: Translate, lang: string): string {
  const id = side === 'home' ? match.homeId : match.awayId;
  if (id) return bundle.teams.find((x) => x.id === id)?.name ?? '?';
  return sourceName(side === 'home' ? match.homeSource : match.awaySource, bundle, t, lang);
}

export interface SlotGroup {
  slot: number;
  /** 'HH:MM' */
  time: string;
  matches: TournamentMatch[];
}

/** Planning: matches by time slot, then by court. */
export function slotGroups(matches: TournamentMatch[]): SlotGroup[] {
  const bySlot = new Map<number, TournamentMatch[]>();
  for (const m of matches) {
    if (m.slot === null) continue;
    bySlot.set(m.slot, [...(bySlot.get(m.slot) ?? []), m]);
  }
  return [...bySlot.entries()]
    .sort(([a], [b]) => a - b)
    .map(([slot, list]) => {
      const sorted = [...list].sort((a, b) => (a.court ?? 0) - (b.court ?? 0));
      return { slot, time: sorted[0].scheduledAt?.slice(11, 16) ?? '', matches: sorted };
    });
}

export interface MatchGroup {
  key: string;
  label: string;
  matchIds: string[];
}

/** Phases to filter the matches: pools, bracket, mixing rounds, levels. */
export function matchGroups(bundle: TournamentBundle, t: Translate): MatchGroup[] {
  const groups: MatchGroup[] = [];
  const add = (key: string, label: string, list: TournamentMatch[]) => {
    if (list.length > 0) groups.push({ key, label, matchIds: list.map((m) => m.id) });
  };
  const { matches } = bundle;
  add('league', t('tournament.view.league'), matches.filter((m) => m.stage === 'league'));
  for (const pool of bundle.pools.filter((p) => p.phase === null && p.level === null)) {
    add(`pool:${pool.id}`, poolTitle(pool, bundle, t), matches.filter((m) => m.stage === 'pool' && m.poolId === pool.id));
  }
  const rounds = [...new Set(matches.filter((m) => m.phase !== null).map((m) => m.phase!))].sort((a, b) => a - b);
  for (const r of rounds) add(`round:${r}`, t('tournament.view.round', { n: r }), matches.filter((m) => m.phase === r));
  const levels = [...new Set(matches.filter((m) => m.level !== null).map((m) => m.level!))].sort((a, b) => a - b);
  for (const l of levels) add(`level:${l}`, levelName(l, t), matches.filter((m) => m.level === l));
  add('bracket', t('tournament.view.bracket'), matches.filter((m) => (m.stage === 'knockout' || m.stage === 'placement') && m.level === null));
  return groups;
}

/** "2-1 · 25-20, 20-25, 15-12" — null before the result. */
export function scoreText(match: Pick<TournamentMatch, 'sets' | 'forfeitId' | 'homeId' | 'awayId'>, t: Translate): string | null {
  if (!match.sets) return null;
  const home = match.sets.filter(([h, a]) => h > a).length;
  const away = match.sets.length - home;
  const detail = match.forfeitId ? t('tournament.view.forfeitShort') : match.sets.map(([h, a]: SetScore) => `${h}-${a}`).join(', ');
  return `${home}-${away} · ${detail}`;
}

/** A score error in words, with the targets of the match rules. */
export function scoreErrorText(error: ScoreError, rules: SetRules, t: Translate): string {
  const deciding = error.set !== undefined && rules.tieBreak && rules.setsToWin > 1 && error.set === rules.setsToWin * 2 - 1;
  const target = deciding ? rules.pointsLastSet : rules.pointsPerSet;
  return t(`tournament.score.error.${error.code}`, { set: error.set, target, margin: rules.winMargin, count: rules.setsToWin });
}

export interface StandingsTable {
  title: string;
  /** Every match of the group validated */
  complete: boolean;
  rows: (StandingRow & { name: string })[];
}

/** Tables of the groups whose teams are known (pools, mixing rounds, level pools, league). */
export function standingsTables(bundle: TournamentBundle, t: Translate): StandingsTable[] {
  const ctx = engineContext(bundle);
  const engineMatches = bundle.matches.map((m) => toEngineMatch(m, bundle.pools));
  const name = (id: string) => bundle.teams.find((x) => x.id === id)?.name ?? '?';
  const table = (title: string, inGroup: TournamentMatch[], teamIds: string[]): StandingsTable => {
    const ids = new Set(inGroup.map((m) => m.id));
    const rows = computeStandings(teamIds, engineMatches.filter((m) => ids.has(m.key)), ctx);
    return { title, complete: inGroup.every((m) => m.status === 'validated'), rows: rows.map((r) => ({ ...r, name: name(r.teamId) })) };
  };

  const tables: StandingsTable[] = [];
  const league = bundle.matches.filter((m) => m.stage === 'league');
  if (league.length > 0) tables.push(table(t('tournament.view.league'), league, bundle.teams.map((x) => x.id)));
  for (const pool of bundle.pools) {
    const inPool = bundle.matches.filter((m) => m.poolId === pool.id);
    if (inPool.length === 0) continue;
    const staticTeams = bundle.teams.filter((x) => x.poolId === pool.id).map((x) => x.id);
    // Composed from results: shown once every place is filled
    if (staticTeams.length === 0 && inPool.some((m) => !m.homeId || !m.awayId)) continue;
    const teamIds = staticTeams.length > 0
      ? staticTeams
      : [...new Set(inPool.flatMap((m) => [m.homeId!, m.awayId!]))];
    tables.push(table(poolTitle(pool, bundle, t), inPool, teamIds));
  }
  return tables;
}

export interface BracketRound {
  title: string;
  matches: TournamentMatch[];
}

/** Bracket matches round by round (levels separately). */
export function bracketRounds(bundle: TournamentBundle, t: Translate): BracketRound[] {
  const bracket = bundle.matches.filter((m) => m.stage === 'knockout' || m.stage === 'placement');
  const keys = [...new Set(bracket.map((m) => `${m.level ?? -1}:${m.round}`))]
    .map((k) => k.split(':').map(Number))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return keys.map(([level, round]) => {
    const list = bracket
      .filter((m) => (m.level ?? -1) === level && m.round === round)
      .sort((a, b) => (a.stage === 'placement' ? 1 : 0) - (b.stage === 'placement' ? 1 : 0) || (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0));
    if (level >= 0) return { title: `${levelName(level, t)} · ${t('tournament.view.round', { n: round })}`, matches: list };
    const teams = Math.max(...list.map((m) => Number(/^ko:(\d+):/.exec(m.label ?? '')?.[1] ?? 2)));
    const title = teams === 2
      ? t(list.length > 1 ? 'tournament.view.finals' : 'tournament.view.final')
      : teams === 4 ? t('tournament.view.semis')
        : teams === 8 ? t('tournament.view.quarters')
          : t('tournament.view.roundsOf', { size: teams / 2 });
    return { title, matches: list };
  });
}

/** Final ranking with names, decided places only. */
export function rankingRows(bundle: TournamentBundle): { rank: number; name: string; teamId: string }[] {
  const ranking = finalRanking(engineContext(bundle), bundle.matches.map((m) => toEngineMatch(m, bundle.pools)));
  return ranking
    .filter((r): r is { teamId: string; rank: number } => r.rank !== null)
    .map((r) => ({ rank: r.rank, teamId: r.teamId, name: bundle.teams.find((x) => x.id === r.teamId)?.name ?? '?' }));
}
