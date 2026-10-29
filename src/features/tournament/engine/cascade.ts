import type { SetScore } from '../../../models/tournament';
import { resolveTeams } from './qualification';
import { evaluateScore, forfeitSets, rulesForStage, type ScoreError } from './results';
import type { EngineContext, EngineMatch } from './types';

export interface ResultInput {
  sets: SetScore[];
  /** Team that forfeits — the score is then filled in. */
  forfeitId: string | null;
}

export type RecordOutcome =
  | { ok: true; matches: EngineMatch[]; changed: string[] }
  | { ok: false; reason: 'invalid_score'; errors: ScoreError[] }
  /** A played bracket match would change teams: correct it first. */
  | { ok: false; reason: 'blocked'; blockedBy: string[] }
  | { ok: false; reason: 'unknown_match' | 'teams_unknown' | 'not_in_match' };

/**
 * Validates (or corrects) a result, then updates the teams of every match it
 * decides. Matches being played or already validated never change teams: if a
 * correction would require it, nothing is saved. The list given is not modified.
 */
export function recordResult(ctx: EngineContext, matches: EngineMatch[], key: string, input: ResultInput): RecordOutcome {
  const match = matches.find((m) => m.key === key);
  if (!match) return { ok: false, reason: 'unknown_match' };
  const { homeId, awayId } = match;
  if (!homeId || !awayId) return { ok: false, reason: 'teams_unknown' };
  if (input.forfeitId !== null && input.forfeitId !== homeId && input.forfeitId !== awayId) {
    return { ok: false, reason: 'not_in_match' };
  }

  const rules = rulesForStage(ctx.rules, match.stage);
  const sets = input.forfeitId === null ? input.sets : forfeitSets(rules, input.forfeitId === homeId ? 'home' : 'away');
  const evaluation = evaluateScore(sets, rules);
  if (!evaluation.ok) return { ok: false, reason: 'invalid_score', errors: evaluation.errors };

  const winnerId = evaluation.summary.winner === 'home' ? homeId : awayId;
  const updated = matches.map((m) =>
    m.key === key ? { ...m, status: 'validated' as const, sets, forfeitId: input.forfeitId, winnerId } : m);

  const resolved = resolveTeams(ctx, updated);
  const blockedBy: string[] = [];
  const changed = [key];
  const final = updated.map((m) => {
    const r = resolved.get(m.key)!;
    if (r.homeId === m.homeId && r.awayId === m.awayId) return m;
    if (m.status !== 'scheduled') {
      blockedBy.push(m.key);
      return m;
    }
    changed.push(m.key);
    return { ...m, homeId: r.homeId, awayId: r.awayId };
  });
  if (blockedBy.length > 0) return { ok: false, reason: 'blocked', blockedBy };
  return { ok: true, matches: final, changed };
}
