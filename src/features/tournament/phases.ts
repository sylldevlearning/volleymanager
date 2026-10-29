import type { TournamentMatch } from '../../models/tournament';
import { engineContext, toEngineMatch, type TournamentBundle } from './bundle';
import { brassageView } from './engine/qualification';
import type { Translate } from './display';

export type PhaseStatus = 'done' | 'live' | 'upcoming';

/** Screen that tells the story of a phase (consultable at any time). */
export type PhaseScreen = { kind: 'round'; round: number } | { kind: 'levels' } | null;

export interface PhaseInfo {
  key: string;
  label: string;
  status: PhaseStatus;
  /** Validated matches / matches of the phase */
  done: number;
  total: number;
  screen: PhaseScreen;
}

/** Gold, silver, bronze, then a fourth level. */
export const LEVEL_COLORS = ['#D4AF37', '#C0C0C0', '#CD7F32', '#5B8DEF'];

const levelName = (level: number, t: Translate) => t(`tournament.level.${Math.min(level, 3)}`);

interface PhaseDef {
  key: string;
  label: string;
  matches: TournamentMatch[];
  /** Phase whose end lets this one start */
  after: string | null;
  screen: PhaseScreen;
}

function phaseDefs(bundle: TournamentBundle, t: Translate): PhaseDef[] {
  const { matches } = bundle;
  const defs: PhaseDef[] = [];
  const add = (def: PhaseDef) => { if (def.matches.length > 0) defs.push(def); };

  add({ key: 'league', label: t('tournament.view.league'), matches: matches.filter((m) => m.stage === 'league'), after: null, screen: null });
  add({ key: 'pools', label: t('tournament.view.pools'), matches: matches.filter((m) => m.stage === 'pool'), after: null, screen: null });

  const rounds = [...new Set(matches.filter((m) => m.stage === 'brassage').map((m) => m.phase!))].sort((a, b) => a - b);
  for (const r of rounds) {
    add({
      key: `round:${r}`, label: t('tournament.view.round', { n: r }), matches: matches.filter((m) => m.phase === r),
      after: r > 1 ? `round:${r - 1}` : null, screen: { kind: 'round', round: r },
    });
  }
  const lastRound = rounds.length > 0 ? `round:${rounds[rounds.length - 1]}` : null;
  const levels = [...new Set(matches.filter((m) => m.level !== null).map((m) => m.level!))].sort((a, b) => a - b);
  for (const l of levels) {
    add({ key: `level:${l}`, label: levelName(l, t), matches: matches.filter((m) => m.level === l), after: lastRound, screen: { kind: 'levels' } });
  }

  add({
    key: 'bracket', label: t('tournament.view.bracket'),
    matches: matches.filter((m) => (m.stage === 'knockout' || m.stage === 'placement') && m.level === null),
    after: defs.some((d) => d.key === 'pools') ? 'pools' : null, screen: null,
  });
  return defs;
}

/** Every phase with its status: done, in progress or to come. */
export function phaseStatuses(bundle: TournamentBundle, t: Translate): PhaseInfo[] {
  const defs = phaseDefs(bundle, t);
  const isDone = (def: PhaseDef) => def.matches.every((m) => m.status === 'validated');
  const byKey = new Map(defs.map((d) => [d.key, d]));
  return defs.map((def) => {
    const done = def.matches.filter((m) => m.status === 'validated').length;
    const before = def.after ? byKey.get(def.after) : undefined;
    const status: PhaseStatus = isDone(def)
      ? 'done'
      : done > 0 || !before || isDone(before) ? 'live' : 'upcoming';
    return { key: def.key, label: def.label, status, done, total: def.matches.length, screen: def.screen };
  });
}

export interface RoundSummary {
  round: number;
  complete: boolean;
  /** Ranking of the round (empty until it is complete) */
  ranking: { rank: number; teamId: string; name: string; pool: string }[];
  next: { kind: 'round'; round: number; pools: { title: string; teams: string[] }[] } | { kind: 'levels' } | null;
}

/** "Tour N terminé": ranking of the round, then the pools of the next round (or the levels). */
export function roundSummary(bundle: TournamentBundle, round: number, t: Translate): RoundSummary | null {
  const inRound = bundle.matches.filter((m) => m.stage === 'brassage' && m.phase === round);
  if (inRound.length === 0) return null;
  const complete = inRound.every((m) => m.status === 'validated');
  if (!complete) return { round, complete, ranking: [], next: null };

  const view = brassageView(engineContext(bundle), bundle.matches.map((m) => toEngineMatch(m, bundle.pools)));
  const name = (id: string) => bundle.teams.find((x) => x.id === id)?.name ?? '?';
  const poolOf = new Map<string, string>();
  for (const m of inRound) {
    const pool = bundle.pools.find((p) => p.id === m.poolId);
    for (const id of [m.homeId, m.awayId]) if (id && pool) poolOf.set(id, t('tournament.view.pool', { name: pool.name }));
  }
  const ranking = (view.ranking(round) ?? []).map((teamId, i) => ({ rank: i + 1, teamId, name: name(teamId), pool: poolOf.get(teamId) ?? '' }));

  const nextPools = bundle.pools
    .map((pool, index) => ({ pool, index }))
    .filter(({ pool }) => pool.phase === round + 1);
  const next: RoundSummary['next'] = nextPools.length > 0
    ? {
      kind: 'round',
      round: round + 1,
      pools: nextPools.map(({ pool, index }) => ({
        title: t('tournament.view.pool', { name: pool.name }),
        teams: (view.poolTeams(index) ?? []).map(name),
      })),
    }
    : bundle.matches.some((m) => m.level !== null) ? { kind: 'levels' } : null;
  return { round, complete, ranking, next };
}

/** The mixing round this validation completed (to show "Tour N terminé" right away), or null. */
export function roundJustCompleted(before: TournamentBundle, after: TournamentBundle, matchId: string): number | null {
  const match = after.matches.find((m) => m.id === matchId);
  if (!match || match.stage !== 'brassage' || match.phase === null) return null;
  const complete = (b: TournamentBundle) => b.matches.filter((m) => m.phase === match.phase).every((m) => m.status === 'validated');
  return complete(after) && !complete(before) ? match.phase : null;
}

export interface LevelSummary {
  level: number;
  name: string;
  color: string;
  teams: string[];
}

/** "Répartition des niveaux": once the mixing is over, the teams of each level, best first. */
export function levelsSummary(bundle: TournamentBundle, t: Translate): LevelSummary[] | null {
  if (bundle.tournament.format !== 'brassage_levels') return null;
  const view = brassageView(engineContext(bundle), bundle.matches.map((m) => toEngineMatch(m, bundle.pools)));
  const levels = view.levels();
  if (!levels) return null;
  const name = (id: string) => bundle.teams.find((x) => x.id === id)?.name ?? '?';
  return levels.map((ids, level) => ({
    level,
    name: levelName(level, t),
    color: LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)],
    teams: ids.map(name),
  }));
}
