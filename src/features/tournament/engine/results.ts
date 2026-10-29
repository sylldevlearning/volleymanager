import { DEFAULT_INDOOR_CONFIG, type MatchConfig } from '../../../models/match';
import type { SetRules, SetScore, TournamentRules, TournamentStage } from '../../../models/tournament';
import { isSetWon } from '../../../utils/volleyball-rules';

export type ScoreErrorCode = 'invalid_points' | 'set_not_finished' | 'set_overshoot' | 'extra_set' | 'match_not_finished';

export interface ScoreError {
  code: ScoreErrorCode;
  /** 1-based set number */
  set?: number;
}

export interface ScoreSummary {
  winner: 'home' | 'away';
  setsHome: number;
  setsAway: number;
  pointsHome: number;
  pointsAway: number;
  /** Decided in the deciding set (3-2, 2-1) */
  tight: boolean;
}

export type ScoreEvaluation = { ok: true; summary: ScoreSummary } | { ok: false; errors: ScoreError[] };

export function rulesForStage(rules: TournamentRules, stage: TournamentStage): SetRules {
  const finals = stage === 'knockout' || stage === 'placement' || stage === 'level';
  return finals && rules.finalsMatch ? rules.finalsMatch : rules.match;
}

function asMatchConfig(rules: SetRules): MatchConfig {
  return {
    ...DEFAULT_INDOOR_CONFIG,
    setsToWin: rules.setsToWin,
    pointsPerSet: rules.pointsPerSet,
    pointsLastSet: rules.tieBreak ? rules.pointsLastSet : rules.pointsPerSet,
    winMargin: rules.winMargin,
  };
}

function isDecidingSet(setNumber: number, rules: SetRules): boolean {
  return rules.setsToWin > 1 && setNumber === rules.setsToWin * 2 - 1;
}

function setTarget(setNumber: number, rules: SetRules): number {
  return rules.tieBreak && isDecidingSet(setNumber, rules) ? rules.pointsLastSet : rules.pointsPerSet;
}

/** Validates a set-by-set score with the volleyball rules and computes the winner. */
export function evaluateScore(sets: SetScore[], rules: SetRules): ScoreEvaluation {
  const config = asMatchConfig(rules);
  let setsHome = 0;
  let setsAway = 0;
  for (let i = 0; i < sets.length; i++) {
    const n = i + 1;
    const [h, a] = sets[i];
    if (![h, a].every((p) => Number.isInteger(p) && p >= 0)) return { ok: false, errors: [{ code: 'invalid_points', set: n }] };
    if (setsHome === rules.setsToWin || setsAway === rules.setsToWin) return { ok: false, errors: [{ code: 'extra_set', set: n }] };
    const last = isDecidingSet(n, rules);
    const homeWon = isSetWon(h, a, config, last);
    const awayWon = isSetWon(a, h, config, last);
    if (!homeWon && !awayWon) return { ok: false, errors: [{ code: 'set_not_finished', set: n }] };
    // Beyond the target, the set ends as soon as the margin is reached
    const [w, l] = homeWon ? [h, a] : [a, h];
    if (w > setTarget(n, rules) && w - l !== rules.winMargin) return { ok: false, errors: [{ code: 'set_overshoot', set: n }] };
    if (homeWon) setsHome++; else setsAway++;
  }
  if (setsHome < rules.setsToWin && setsAway < rules.setsToWin) return { ok: false, errors: [{ code: 'match_not_finished' }] };
  return {
    ok: true,
    summary: {
      winner: setsHome > setsAway ? 'home' : 'away',
      setsHome,
      setsAway,
      pointsHome: sets.reduce((s, [h]) => s + h, 0),
      pointsAway: sets.reduce((s, [, a]) => s + a, 0),
      tight: isDecidingSet(sets.length, rules),
    },
  };
}

/** Score of a forfeit: every set to the other team, at the set target. */
export function forfeitSets(rules: SetRules, forfeitSide: 'home' | 'away'): SetScore[] {
  return Array.from({ length: rules.setsToWin }, (_, i) => {
    const target = setTarget(i + 1, rules);
    return forfeitSide === 'home' ? [0, target] : [target, 0];
  });
}
