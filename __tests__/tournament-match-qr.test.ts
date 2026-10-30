import fs from 'fs';
import path from 'path';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';
import {
  MATCH_QR_PREFIX,
  decodeMatchQr,
  encodeMatchQr,
  matchQrOf,
  quickMatchConfig,
  type MatchQr,
} from '../src/features/tournament/matchQr';
import type { TournamentBundle } from '../src/features/tournament/bundle';
import type { TournamentGameType, TournamentMatch, TournamentRules } from '../src/models/tournament';

const qr: MatchQr = {
  format: 'indoor_4v4',
  home: { name: 'Les Étoiles', color: '#E63946' },
  away: { name: 'Équipe 2', color: '#1D4ED8' },
  rules: { setsToWin: 2, pointsPerSet: 21, pointsLastSet: 15, winMargin: 2, tieBreak: true },
};

describe('QR of a match: VMT1 format', () => {
  it('starts with the version and decodes back to the same match', () => {
    const text = encodeMatchQr(qr);
    expect(MATCH_QR_PREFIX).toBe('VMT1:');
    expect(text.startsWith('VMT1:')).toBe(true);
    expect(decodeMatchQr(text)).toEqual({ ok: true, qr });
  });

  it('only plain characters (accents escaped), short enough for an easy scan', () => {
    const text = encodeMatchQr(qr);
    expect(text).toMatch(/^[\x20-\x7e]+$/);
    const long = encodeMatchQr({ ...qr, home: { name: 'É'.repeat(40), color: '#000000' }, away: { name: 'A'.repeat(40), color: '#FFFFFF' } });
    expect(long.length).toBeLessThan(400);
    expect(decodeMatchQr(long)).toMatchObject({ ok: true });
  });

  it('works for every format', () => {
    for (const format of ['indoor_6v6', 'indoor_4v4', 'indoor_3v3', 'beach_2v2'] as TournamentGameType[]) {
      expect(decodeMatchQr(encodeMatchQr({ ...qr, format }))).toEqual({ ok: true, qr: { ...qr, format } });
    }
  });

  it('a QR from elsewhere is not recognised', () => {
    expect(decodeMatchQr('https://example.com')).toEqual({ ok: false, reason: 'not_volleymanager' });
    expect(decodeMatchQr('')).toEqual({ ok: false, reason: 'not_volleymanager' });
  });

  it('a newer version asks to update the app', () => {
    expect(decodeMatchQr('VMT2:{"f":"indoor_6v6"}')).toEqual({ ok: false, reason: 'unsupported_version' });
  });

  it('a damaged or incomplete QR is unreadable', () => {
    const text = encodeMatchQr(qr);
    expect(decodeMatchQr(text.slice(0, -5))).toEqual({ ok: false, reason: 'invalid' });
    expect(decodeMatchQr('VMT1:not json')).toEqual({ ok: false, reason: 'invalid' });
    expect(decodeMatchQr('VMT1:[]')).toEqual({ ok: false, reason: 'invalid' });
    const bad = (patch: Record<string, unknown>) => {
      const body = { ...JSON.parse(text.slice(5)), ...patch };
      return decodeMatchQr(`VMT1:${JSON.stringify(body)}`);
    };
    expect(bad({ f: 'indoor_5v5' })).toMatchObject({ ok: false, reason: 'invalid' });
    expect(bad({ h: ['', '#E63946'] })).toMatchObject({ ok: false, reason: 'invalid' });
    expect(bad({ a: ['B', 'red'] })).toMatchObject({ ok: false, reason: 'invalid' });
    expect(bad({ r: [0, 21, 15, 2, 1] })).toMatchObject({ ok: false, reason: 'invalid' });
    expect(bad({ r: [2, 21, 15, 2] })).toMatchObject({ ok: false, reason: 'invalid' });
  });
});

describe('QR content from a tournament match', () => {
  const rules = {
    match: { setsToWin: 2, pointsPerSet: 21, pointsLastSet: 15, winMargin: 2, tieBreak: true },
    finalsMatch: { setsToWin: 3, pointsPerSet: 25, pointsLastSet: 15, winMargin: 2, tieBreak: true },
  } as TournamentRules;
  const team = (id: string, name: string, color: string) => ({
    id, tournamentId: 't', teamId: null, name, color, seedRank: null, poolId: null, position: 0,
  });
  const match = (patch: Partial<TournamentMatch>) => ({
    id: 'm', stage: 'pool', homeId: 'a', awayId: 'b', status: 'scheduled', ...patch,
  }) as TournamentMatch;
  const bundle = {
    tournament: { id: 'tour', gameType: 'beach_2v2', rules },
    teams: [team('a', 'Sable', '#F59E0B'), team('b', 'Vagues', '#1D4ED8')],
    matches: [],
  } as unknown as TournamentBundle;

  it('only the teams (names, colours), the format and the rules of this stage', () => {
    expect(matchQrOf(bundle, match({}))).toEqual({
      format: 'beach_2v2',
      home: { name: 'Sable', color: '#F59E0B' },
      away: { name: 'Vagues', color: '#1D4ED8' },
      rules: rules.match,
      ref: { tournamentId: 'tour', matchId: 'm' },
    });
    expect(matchQrOf(bundle, match({ stage: 'knockout' }))!.rules).toEqual(rules.finalsMatch);
  });

  it('no QR while a team is not known yet, nor once the match is played', () => {
    expect(matchQrOf(bundle, match({ awayId: null }))).toBeNull();
    expect(matchQrOf(bundle, match({ status: 'validated' }))).toBeNull();
  });
});

describe('quick match rules from the QR', () => {
  it('sets, points, tie-break and lead from the QR, the rest from the format', () => {
    const config = quickMatchConfig(qr);
    expect(config).toMatchObject({ setsToWin: 2, pointsPerSet: 21, pointsLastSet: 15, winMargin: 2 });
    // 4×4 leisure: free substitutions
    expect(config.substitutionMode).toBe('free');
  });

  it('without tie-break, or in one set, the last set is played to the usual points', () => {
    expect(quickMatchConfig({ ...qr, rules: { ...qr.rules, tieBreak: false } }).pointsLastSet).toBe(21);
    expect(quickMatchConfig({ ...qr, rules: { ...qr.rules, setsToWin: 1 } }).pointsLastSet).toBe(21);
  });

  it('6×6: the usual quick match rules', () => {
    const config = quickMatchConfig({ ...qr, format: 'indoor_6v6', rules: { ...qr.rules, setsToWin: 3, pointsPerSet: 25 } });
    expect(config).toMatchObject({ setsToWin: 3, pointsPerSet: 25, substitutionsPerSet: 6 });
  });
});

describe('screens wiring', () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

  it('organiser: "QR du match" on an upcoming match, with the Play Store line', () => {
    const matchScreen = read('app/tournament/[id]/match/[matchId].tsx');
    expect(matchScreen).toContain('/tournament/${id}/qr/${matchId}');
    expect(matchScreen).toContain('matchQrOf(bundle, match)');
    const qrScreen = read('app/tournament/[id]/qr/[matchId].tsx');
    expect(qrScreen).toContain("from 'react-native-qrcode-svg'");
    expect(qrScreen).toContain('encodeMatchQr(');
    expect(fr.tournament.qr.scanWith).toBe("À scanner avec l'app VolleyManager (Play Store)");
    expect(en.tournament.qr.scanWith).toBeTruthy();
  });

  it('referee: "Scanner un QR de match" next to Match rapide, opens a filled quick match', () => {
    const home = read('app/(tabs)/index.tsx');
    expect(home).toContain("router.push('/scan')");
    expect(fr.home.scanMatchQr).toBe('Scanner un QR de match');
    const scan = read('app/scan.tsx');
    expect(scan).toContain('<QrScanner');
    expect(scan).toContain('decodeMatchQr(');
    expect(scan).toContain('createMatchFromQr(');
    expect(scan).toContain('/referee');
  });

  it('a clear message for each unreadable QR', () => {
    for (const dict of [fr, en]) {
      for (const reason of ['not_volleymanager', 'unsupported_version', 'invalid'] as const) {
        expect(dict.scan.errors[reason]).toBeTruthy();
      }
    }
    expect(fr.scan.errors.not_volleymanager).toMatch(/VolleyManager/);
  });

  it('the camera does not record sound', () => {
    const app = read('app.json');
    expect(app).toContain('"expo-camera"');
    expect(app).toMatch(/"expo-camera",\s*\{[^}]*"recordAudioAndroid": false/);
  });
});
