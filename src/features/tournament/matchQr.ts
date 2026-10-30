import type { Match, MatchConfig, MatchSet, TournamentRef } from '../../models/match';
import type { SetRules, SetScore, TournamentGameType, TournamentMatch, TournamentTeam } from '../../models/tournament';
import { defaultArbitrageConfig } from '../match/formatProfile';
import { rulesForStage } from './engine/results';
import type { TournamentBundle } from './bundle';

/**
 * QR codes of a tournament, without signature ("VMT1:" + compact JSON).
 * - Match (organiser → referee): {f, h: [name, colour], a: [name, colour],
 *   r: [setsToWin, pointsPerSet, pointsLastSet, winMargin, tieBreak 0/1], t?, m?}
 *   — t/m (tournament and match ids) are absent from the first QRs.
 * - Result (referee → organiser): {k: "r", t, m, h: name, a: name, s: [[home, away], …]}
 */
export const MATCH_QR_PREFIX = 'VMT1:';

export interface MatchQrTeam {
  name: string;
  color: string;
}

export interface MatchQr {
  format: TournamentGameType;
  home: MatchQrTeam;
  away: MatchQrTeam;
  rules: SetRules;
  /** Absent from the first match QRs: no result QR then */
  ref?: TournamentRef;
}

export interface ResultQr {
  ref: TournamentRef;
  home: string;
  away: string;
  sets: SetScore[];
}

type QrError = 'not_volleymanager' | 'unsupported_version' | 'invalid';
export type MatchQrError = QrError | 'result_qr';
export type ResultQrError = QrError | 'match_qr';

export type MatchQrDecoded = { ok: true; qr: MatchQr } | { ok: false; reason: MatchQrError };
export type ResultQrDecoded = { ok: true; result: ResultQr } | { ok: false; reason: ResultQrError };

const FORMATS: TournamentGameType[] = ['indoor_6v6', 'indoor_4v4', 'indoor_3v3', 'beach_2v2'];
const MAX_NAME = 60;
const MAX_ID = 64;

/** Accents and other non-ASCII characters escaped: the QR stays readable by every scanner. */
function encode(body: object): string {
  const json = JSON.stringify(body).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  return MATCH_QR_PREFIX + json;
}

export function encodeMatchQr(qr: MatchQr): string {
  const { rules: r } = qr;
  return encode({
    f: qr.format,
    h: [qr.home.name, qr.home.color],
    a: [qr.away.name, qr.away.color],
    r: [r.setsToWin, r.pointsPerSet, r.pointsLastSet, r.winMargin, r.tieBreak ? 1 : 0],
    ...(qr.ref ? { t: qr.ref.tournamentId, m: qr.ref.matchId } : {}),
  });
}

export function encodeResultQr(result: ResultQr): string {
  return encode({ k: 'r', t: result.ref.tournamentId, m: result.ref.matchId, h: result.home, a: result.away, s: result.sets });
}

function nameOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= MAX_NAME ? trimmed : null;
}

function teamOf(value: unknown): MatchQrTeam | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const name = nameOf(value[0]);
  const color = value[1];
  if (!name || typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) return null;
  return { name, color };
}

function intIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function rulesOf(value: unknown): SetRules | null {
  if (!Array.isArray(value) || value.length !== 5) return null;
  const [setsToWin, pointsPerSet, pointsLastSet, winMargin, tieBreak] = value;
  if (!intIn(setsToWin, 1, 5) || !intIn(pointsPerSet, 1, 99) || !intIn(pointsLastSet, 1, 99)
    || !intIn(winMargin, 1, 10) || (tieBreak !== 0 && tieBreak !== 1)) return null;
  return { setsToWin, pointsPerSet, pointsLastSet, winMargin, tieBreak: tieBreak === 1 };
}

function idOf(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID ? value : null;
}

function setsOf(value: unknown): SetScore[] | null {
  if (!Array.isArray(value) || value.length > 9) return null;
  const sets: SetScore[] = [];
  for (const set of value) {
    if (!Array.isArray(set) || set.length !== 2 || !intIn(set[0], 0, 99) || !intIn(set[1], 0, 99)) return null;
    sets.push([set[0], set[1]]);
  }
  return sets;
}

/** The JSON object of a VMT1 text, or why there is none. */
function bodyOf(text: string): { ok: true; body: Record<string, unknown> } | { ok: false; reason: QrError } {
  if (!text.startsWith(MATCH_QR_PREFIX)) {
    return { ok: false, reason: /^VMT\d+:/.test(text) ? 'unsupported_version' : 'not_volleymanager' };
  }
  let body: unknown;
  try {
    body = JSON.parse(text.slice(MATCH_QR_PREFIX.length));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, reason: 'invalid' };
  return { ok: true, body: body as Record<string, unknown> };
}

/** Reads a scanned match QR; every check fails with a reason the scan screen explains. */
export function decodeMatchQr(text: string): MatchQrDecoded {
  const parsed = bodyOf(text);
  if (!parsed.ok) return parsed;
  const { f, h, a, r, k, t, m } = parsed.body;
  if (k === 'r') return { ok: false, reason: 'result_qr' };
  const home = teamOf(h);
  const away = teamOf(a);
  const rules = rulesOf(r);
  if (!FORMATS.includes(f as TournamentGameType) || !home || !away || !rules) return { ok: false, reason: 'invalid' };
  const tournamentId = idOf(t);
  const matchId = idOf(m);
  const qr: MatchQr = { format: f as TournamentGameType, home, away, rules };
  if (tournamentId && matchId) qr.ref = { tournamentId, matchId };
  return { ok: true, qr };
}

/** Reads a scanned result QR. */
export function decodeResultQr(text: string): ResultQrDecoded {
  const parsed = bodyOf(text);
  if (!parsed.ok) return parsed;
  const { k, t, m, h, a, s } = parsed.body;
  if (k !== 'r') return { ok: false, reason: 'f' in parsed.body ? 'match_qr' : 'invalid' };
  const tournamentId = idOf(t);
  const matchId = idOf(m);
  const home = nameOf(h);
  const away = nameOf(a);
  const sets = setsOf(s);
  if (!tournamentId || !matchId || !home || !away || !sets) return { ok: false, reason: 'invalid' };
  return { ok: true, result: { ref: { tournamentId, matchId }, home, away, sets } };
}

/** QR of an upcoming match whose two teams are known (null otherwise). */
export function matchQrOf(bundle: TournamentBundle, match: TournamentMatch): MatchQr | null {
  if (match.status === 'validated') return null;
  const home = bundle.teams.find((x) => x.id === match.homeId);
  const away = bundle.teams.find((x) => x.id === match.awayId);
  if (!home || !away) return null;
  return {
    format: bundle.tournament.gameType,
    home: { name: home.name, color: home.color },
    away: { name: away.name, color: away.color },
    rules: rulesForStage(bundle.tournament.rules, match.stage),
    ref: { tournamentId: bundle.tournament.id, matchId: match.id },
  };
}

/** Quick match rules: sets, points, tie-break and lead from the QR; the rest is the format's usual setup. */
export function quickMatchConfig(qr: MatchQr): MatchConfig {
  const { rules } = qr;
  const tieBreak = rules.tieBreak && rules.setsToWin > 1;
  const config: MatchConfig = {
    ...defaultArbitrageConfig(qr.format),
    setsToWin: rules.setsToWin,
    pointsPerSet: rules.pointsPerSet,
    pointsLastSet: tieBreak ? rules.pointsLastSet : rules.pointsPerSet,
    winMargin: rules.winMargin,
  };
  if (qr.ref) config.tournamentRef = { ...qr.ref };
  return config;
}

/** Result QR of a finished quick match started from a tournament match QR (null otherwise). */
export function resultQrOf(match: Match, homeName: string, awayName: string, sets: MatchSet[]): ResultQr | null {
  const ref = match.config.tournamentRef;
  if (!ref || match.status !== 'finished') return null;
  const played = sets
    .filter((s) => s.winnerTeamId !== null)
    .sort((x, y) => x.setNumber - y.setNumber)
    .map((s): SetScore => [s.scoreHome, s.scoreAway]);
  return { ref: { ...ref }, home: homeName, away: awayName, sets: played };
}

export type ResultCheckError = 'other_tournament' | 'match_not_found' | 'teams_changed';

export type ResultCheck =
  | {
    ok: true;
    match: TournamentMatch;
    home: TournamentTeam;
    away: TournamentTeam;
    /** A result is already recorded: replacing it needs a confirmation */
    alreadyPlayed: boolean;
    /** …and it is this very score: nothing to do */
    sameResult: boolean;
  }
  | { ok: false; reason: ResultCheckError };

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** Organiser side: is this result for a match of this tournament, with the same teams? */
export function checkResultQr(bundle: TournamentBundle, result: ResultQr): ResultCheck {
  if (result.ref.tournamentId !== bundle.tournament.id) return { ok: false, reason: 'other_tournament' };
  const match = bundle.matches.find((m) => m.id === result.ref.matchId);
  if (!match) return { ok: false, reason: 'match_not_found' };
  const home = bundle.teams.find((x) => x.id === match.homeId);
  const away = bundle.teams.find((x) => x.id === match.awayId);
  // Teams can move when an earlier result is corrected: the result would go to the wrong teams
  if (!home || !away || !sameName(home.name, result.home) || !sameName(away.name, result.away)) {
    return { ok: false, reason: 'teams_changed' };
  }
  const alreadyPlayed = match.status === 'validated';
  const sameResult = alreadyPlayed && !match.forfeitId && JSON.stringify(match.sets) === JSON.stringify(result.sets);
  return { ok: true, match, home, away, alreadyPlayed, sameResult };
}
