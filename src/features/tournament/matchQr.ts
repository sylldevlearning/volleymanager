import type { MatchConfig } from '../../models/match';
import type { SetRules, TournamentGameType, TournamentMatch } from '../../models/tournament';
import { defaultArbitrageConfig } from '../match/formatProfile';
import { rulesForStage } from './engine/results';
import type { TournamentBundle } from './bundle';

/**
 * QR of a tournament match, scanned by the referee to open a filled quick match.
 * Text: "VMT1:" + compact JSON {f, h: [name, colour], a: [name, colour],
 * r: [setsToWin, pointsPerSet, pointsLastSet, winMargin, tieBreak 0/1]}.
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
}

export type MatchQrError = 'not_volleymanager' | 'unsupported_version' | 'invalid';

export type MatchQrDecoded = { ok: true; qr: MatchQr } | { ok: false; reason: MatchQrError };

const FORMATS: TournamentGameType[] = ['indoor_6v6', 'indoor_4v4', 'indoor_3v3', 'beach_2v2'];
const MAX_NAME = 60;

/** Accents and other non-ASCII characters escaped: the QR stays readable by every scanner. */
export function encodeMatchQr(qr: MatchQr): string {
  const { rules: r } = qr;
  const body = {
    f: qr.format,
    h: [qr.home.name, qr.home.color],
    a: [qr.away.name, qr.away.color],
    r: [r.setsToWin, r.pointsPerSet, r.pointsLastSet, r.winMargin, r.tieBreak ? 1 : 0],
  };
  const json = JSON.stringify(body).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  return MATCH_QR_PREFIX + json;
}

function teamOf(value: unknown): MatchQrTeam | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [name, color] = value;
  if (typeof name !== 'string' || typeof color !== 'string') return null;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > MAX_NAME || !/^#[0-9a-fA-F]{6}$/.test(color)) return null;
  return { name: trimmed, color };
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

/** Reads a scanned text; every check fails with a reason the scan screen explains. */
export function decodeMatchQr(text: string): MatchQrDecoded {
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
  const { f, h, a, r } = body as Record<string, unknown>;
  const home = teamOf(h);
  const away = teamOf(a);
  const rules = rulesOf(r);
  if (!FORMATS.includes(f as TournamentGameType) || !home || !away || !rules) return { ok: false, reason: 'invalid' };
  return { ok: true, qr: { format: f as TournamentGameType, home, away, rules } };
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
  };
}

/** Quick match rules: sets, points, tie-break and lead from the QR; the rest is the format's usual setup. */
export function quickMatchConfig(qr: MatchQr): MatchConfig {
  const { rules } = qr;
  const tieBreak = rules.tieBreak && rules.setsToWin > 1;
  return {
    ...defaultArbitrageConfig(qr.format),
    setsToWin: rules.setsToWin,
    pointsPerSet: rules.pointsPerSet,
    pointsLastSet: tieBreak ? rules.pointsLastSet : rules.pointsPerSet,
    winMargin: rules.winMargin,
  };
}
