import fs from 'fs';
import path from 'path';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';
import {
  checkResultQr,
  decodeMatchQr,
  decodeResultQr,
  encodeMatchQr,
  encodeResultQr,
  quickMatchConfig,
  resultQrOf,
  type MatchQr,
  type ResultQr,
} from '../src/features/tournament/matchQr';
import { resultRoute } from '../src/features/tournament/phases';
import type { TournamentBundle } from '../src/features/tournament/bundle';
import type { Match, MatchSet } from '../src/models/match';
import type { TournamentMatch } from '../src/models/tournament';

const ref = { tournamentId: 'tour-1', matchId: 'tm-7' };
const matchQr: MatchQr = {
  format: 'beach_2v2',
  home: { name: 'Sable', color: '#F59E0B' },
  away: { name: 'Vagues', color: '#1D4ED8' },
  rules: { setsToWin: 2, pointsPerSet: 21, pointsLastSet: 15, winMargin: 2, tieBreak: true },
  ref,
};
const result: ResultQr = { ref, home: 'Sable', away: 'Vagues', sets: [[21, 18], [19, 21], [15, 12]] };

describe('match QR with the tournament and match ids', () => {
  it('the ids travel in the QR', () => {
    expect(encodeMatchQr(matchQr)).toContain('"t":"tour-1"');
    expect(decodeMatchQr(encodeMatchQr(matchQr))).toEqual({ ok: true, qr: matchQr });
  });

  it('the quick match keeps the link, to show the result QR at the end', () => {
    expect(quickMatchConfig(matchQr).tournamentRef).toEqual(ref);
  });

  it('an older match QR without ids still opens the quick match, without result QR', () => {
    const old = 'VMT1:{"f":"beach_2v2","h":["Sable","#F59E0B"],"a":["Vagues","#1D4ED8"],"r":[2,21,15,2,1]}';
    const decoded = decodeMatchQr(old);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.qr.ref).toBeUndefined();
    expect(quickMatchConfig(decoded.qr).tournamentRef).toBeUndefined();
  });
});

describe('result QR (referee → organiser)', () => {
  it('teams and set scores, back and forth', () => {
    const text = encodeResultQr(result);
    expect(text.startsWith('VMT1:')).toBe(true);
    expect(text).toMatch(/^[\x20-\x7e]+$/);
    expect(decodeResultQr(text)).toEqual({ ok: true, result });
  });

  it('a match QR scanned as a result, or the other way round, says so', () => {
    expect(decodeResultQr(encodeMatchQr(matchQr))).toEqual({ ok: false, reason: 'match_qr' });
    expect(decodeMatchQr(encodeResultQr(result))).toEqual({ ok: false, reason: 'result_qr' });
  });

  it('a damaged, foreign or newer QR is refused', () => {
    expect(decodeResultQr('hello')).toEqual({ ok: false, reason: 'not_volleymanager' });
    expect(decodeResultQr('VMT2:{}')).toEqual({ ok: false, reason: 'unsupported_version' });
    expect(decodeResultQr(encodeResultQr(result).slice(0, -3))).toEqual({ ok: false, reason: 'invalid' });
    expect(decodeResultQr('VMT1:{"k":"r","t":"a","m":"b","h":"A","a":"B","s":[[21,"x"]]}')).toEqual({ ok: false, reason: 'invalid' });
  });

  describe('made by the referee at the end of the quick match', () => {
    const quick = (patch: Partial<Match>) => ({
      id: 'q', status: 'finished', teamHomeId: 'h', teamAwayId: 'a',
      config: quickMatchConfig(matchQr), ...patch,
    }) as Match;
    const set = (setNumber: number, scoreHome: number, scoreAway: number, winnerTeamId: string | null): MatchSet => ({
      id: `s${setNumber}`, matchId: 'q', setNumber, scoreHome, scoreAway, winnerTeamId,
      servingTeamId: null, startedAt: '', finishedAt: winnerTeamId ? 'x' : null,
    });
    const sets = [set(2, 19, 21, 'a'), set(1, 21, 18, 'h'), set(3, 15, 12, 'h')];

    it('the played sets in order, with the team names', () => {
      expect(resultQrOf(quick({}), 'Sable', 'Vagues', sets)).toEqual(result);
    });

    it('nothing before the end, nor for a match not started from a tournament QR', () => {
      expect(resultQrOf(quick({ status: 'live' }), 'Sable', 'Vagues', sets)).toBeNull();
      expect(resultQrOf(quick({ config: quickMatchConfig({ ...matchQr, ref: undefined }) }), 'Sable', 'Vagues', sets)).toBeNull();
    });

    it('a set not finished is left out', () => {
      expect(resultQrOf(quick({}), 'Sable', 'Vagues', [...sets, set(4, 3, 1, null)])!.sets).toHaveLength(3);
    });
  });
});

describe('organiser check before recording', () => {
  const team = (id: string, name: string) => ({
    id, tournamentId: 'tour-1', teamId: null, name, color: '#000000', seedRank: null, poolId: null, position: 0,
  });
  const tm = (patch: Partial<TournamentMatch>) => ({
    id: 'tm-7', stage: 'pool', homeId: 'x', awayId: 'y', status: 'scheduled', sets: null, forfeitId: null, ...patch,
  }) as TournamentMatch;
  const bundle = (match: TournamentMatch) => ({
    tournament: { id: 'tour-1', name: 'Open' },
    teams: [team('x', 'Sable'), team('y', 'Vagues')],
    matches: [match],
  }) as unknown as TournamentBundle;

  it('the match, its teams and the score to check', () => {
    const check = checkResultQr(bundle(tm({})), result);
    expect(check).toMatchObject({ ok: true, alreadyPlayed: false, sameResult: false });
    if (check.ok) expect([check.home.name, check.away.name]).toEqual(['Sable', 'Vagues']);
  });

  it('a result from another tournament', () => {
    expect(checkResultQr(bundle(tm({})), { ...result, ref: { ...ref, tournamentId: 'other' } }))
      .toEqual({ ok: false, reason: 'other_tournament' });
  });

  it('a match that is not in this tournament', () => {
    expect(checkResultQr(bundle(tm({ id: 'tm-8' })), result)).toEqual({ ok: false, reason: 'match_not_found' });
  });

  it('teams changed since the match QR (a result corrected before)', () => {
    expect(checkResultQr(bundle(tm({ awayId: null })), result)).toEqual({ ok: false, reason: 'teams_changed' });
    expect(checkResultQr(bundle(tm({})), { ...result, away: 'Autre' })).toEqual({ ok: false, reason: 'teams_changed' });
  });

  it('a match already played: replace after confirmation, or nothing to do if it is the same score', () => {
    expect(checkResultQr(bundle(tm({ status: 'validated', sets: [[21, 10], [21, 10]] })), result))
      .toMatchObject({ ok: true, alreadyPlayed: true, sameResult: false });
    expect(checkResultQr(bundle(tm({ status: 'validated', sets: result.sets })), result))
      .toMatchObject({ ok: true, alreadyPlayed: true, sameResult: true });
  });
});

describe('after a recorded result', () => {
  const m = (id: string, phase: number, status: TournamentMatch['status']) =>
    ({ id, stage: 'brassage', phase, status }) as TournamentMatch;
  const b = (matches: TournamentMatch[]) => ({ matches }) as unknown as TournamentBundle;

  it('end of a round → its screen; last round → levels; otherwise back', () => {
    const before = b([m('a', 1, 'validated'), m('b', 1, 'scheduled'), m('c', 2, 'scheduled')]);
    const after = b([m('a', 1, 'validated'), m('b', 1, 'validated'), m('c', 2, 'scheduled')]);
    expect(resultRoute('T', before, after, 'b')).toBe('/tournament/T/round/1');
    const lastBefore = b([m('a', 1, 'scheduled')]);
    const lastAfter = b([m('a', 1, 'validated')]);
    expect(resultRoute('T', lastBefore, lastAfter, 'a')).toBe('/tournament/T/levels');
    expect(resultRoute('T', before, before, 'c')).toBeNull();
  });
});

describe('screens wiring', () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

  it('referee: the result QR on the match summary (end of match and history)', () => {
    const summary = read('app/match/[id]/summary.tsx');
    expect(summary).toContain('resultQrOf(match, homeTeam.name, awayTeam.name, sets)');
    expect(summary).toContain('encodeResultQr(');
    expect(fr.resultQr.title).toBe('QR du résultat');
  });

  it('organiser: scan from the tournament, check, then record like a typed score', () => {
    const view = read('app/tournament/[id]/index.tsx');
    expect(view).toContain('/tournament/${id}/scan-result');
    const screen = read('app/tournament/[id]/scan-result.tsx');
    expect(screen).toContain('<QrScanner');
    expect(screen).toContain('decodeResultQr(');
    expect(screen).toContain('checkResultQr(');
    expect(screen).toContain('recordTournamentResult(');
    expect(screen).toContain("t('scanResult.checkWarning')");
    expect(screen).toContain('resultRoute(');
    expect(fr.scanResult.checkWarning).toBe('Vérifiez que ce résultat correspond bien au match joué avant de valider');
  });

  it('the typed score goes the same way after the result', () => {
    expect(read('app/tournament/[id]/match/[matchId].tsx')).toContain('resultRoute(');
  });

  it('a clear message for every refused result', () => {
    for (const dict of [fr, en]) {
      for (const reason of ['other_tournament', 'match_not_found', 'teams_changed', 'match_qr', 'not_volleymanager', 'unsupported_version', 'invalid']) {
        expect((dict.scanResult.errors as Record<string, string>)[reason]).toBeTruthy();
      }
      expect(dict.scanResult.replaceTitle).toBeTruthy();
      expect(dict.scanResult.same).toBeTruthy();
      expect((dict.scan.errors as Record<string, string>).result_qr).toBeTruthy();
    }
  });

  it('one camera component for both scans', () => {
    const scanner = read('src/components/qr/QrScanner.tsx');
    expect(scanner).toContain('CameraView');
    expect(scanner).toContain("barcodeTypes: ['qr']");
    expect(read('app/scan.tsx')).toContain('<QrScanner');
  });

  it('a "?" for each tab of the tournament screen, and bubbles on first use', () => {
    const view = read('app/tournament/[id]/index.tsx');
    expect(view).toContain('textKey={TAB_HELP[tab]}');
    expect(view).toContain('tipId="tournament"');
    for (const dict of [fr, en]) {
      for (const key of ['tournamentPlanning', 'tournamentMatches', 'tournamentStandings']) {
        expect((dict.help as Record<string, string>)[key]).toBeTruthy();
      }
    }
    expect(fr.help.tournamentMatches).toMatch(/QR/);
  });
});
