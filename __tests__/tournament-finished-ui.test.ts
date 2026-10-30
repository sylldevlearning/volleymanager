import fs from 'fs';
import path from 'path';
import i18n from 'i18next';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';
import { finishedMessage, finishedTeamIds, justFinished } from '../src/features/tournament/phases';
import { recordResult } from '../src/features/tournament/engine/cascade';
import { rulesForStage } from '../src/features/tournament/engine/results';
import type { SetScore } from '../src/models/tournament';
import { build, bundleFrom, playAll } from './helpers/tournamentFixtures';

const tr = i18n.createInstance();
beforeAll(async () => {
  await tr.init({ lng: 'fr', resources: { fr: { translation: fr } } });
});
const t = (key: string, opts?: Record<string, unknown>) => tr.t(key, opts) as string;

describe('teams that just finished, with their final place when known', () => {
  it('knockout without 3rd place match: the semi-final losers leave, places known at the end', () => {
    const built = build('knockout', 4, { rules: { knockout: { thirdPlace: false } } });
    let matches = built.matches;
    const semi = matches.find((m) => m.label === 'ko:4:1')!;
    const sets: SetScore[] = Array.from({ length: rulesForStage(built.ctx.rules, semi.stage).setsToWin }, (): SetScore => [25, 10]);
    const before = bundleFrom(built, matches);
    const outcome = recordResult(built.ctx, matches, semi.key, { sets, forfeitId: null });
    if (!outcome.ok) throw new Error('semi');
    matches = outcome.matches;
    const after = bundleFrom(built, matches);
    const loser = after.teams.find((x) => x.id === semi.awayId)!;
    expect(justFinished(before, after)).toEqual([{ teamId: loser.id, name: loser.name, rank: 3 }]);
    expect(finishedTeamIds(after)).toEqual(new Set([loser.id]));
  });

  it('nothing new: an empty list', () => {
    const built = build('round_robin', 4);
    const b = bundleFrom(built);
    expect(justFinished(b, b)).toEqual([]);
  });

  it('at the very end of a championship, everyone with their place', () => {
    const built = build('round_robin', 4);
    const played = playAll(built);
    const last = [...built.matches].sort((x, y) => (y.slot! - x.slot!) || (y.court! - x.court!))[0];
    const before = bundleFrom(built, played.map((m) => (m.key === last.key ? { ...built.matches.find((x) => x.key === m.key)! } : m)));
    const fresh = justFinished(before, bundleFrom(built, played));
    expect(fresh.length).toBeGreaterThanOrEqual(2);
    for (const f of fresh) expect(f.rank).not.toBeNull();
  });
});

describe('the message', () => {
  it('one team: "L\'équipe X a terminé son tournoi (place finale N). Elle peut partir."', () => {
    expect(finishedMessage([{ teamId: 'a', name: 'Sable', rank: 3 }], t)).toEqual({
      title: 'Fin de tournoi',
      message: "L'équipe Sable a terminé son tournoi (place finale 3). Elle peut partir.",
    });
    expect(finishedMessage([{ teamId: 'a', name: 'Sable', rank: null }], t).message)
      .toBe("L'équipe Sable a terminé son tournoi. Elle peut partir.");
  });

  it('several teams: the list', () => {
    const { message } = finishedMessage([
      { teamId: 'a', name: 'Sable', rank: 3 },
      { teamId: 'b', name: 'Vagues', rank: null },
    ], t);
    expect(message).toBe('Ces équipes ont terminé leur tournoi et peuvent partir :\n• Sable (place finale 3)\n• Vagues');
  });

  it('in English too', () => {
    for (const key of ['title', 'one', 'place', 'many', 'line', 'badge']) {
      expect((en.tournament.finished as Record<string, string>)[key]).toBeTruthy();
    }
  });
});

describe('screens wiring', () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

  it('after a typed score and after a scanned result', () => {
    for (const p of ['app/tournament/[id]/match/[matchId].tsx', 'app/tournament/[id]/scan-result.tsx']) {
      const screen = read(p);
      expect(screen).toContain('justFinished(');
      expect(screen).toContain('showFinished(');
    }
  });

  it('"Terminé" in the standings and the team list', () => {
    expect(read('app/tournament/[id]/index.tsx')).toContain('finishedTeamIds(bundle)');
    expect(read('src/components/tournament/StandingsTableView.tsx')).toContain("t('tournament.finished.badge')");
    const teams = read('app/tournament/[id]/teams.tsx');
    expect(teams).toContain('finishedTeamIds(');
    expect(teams).toContain("t('tournament.finished.badge')");
    expect(fr.tournament.finished.badge).toBe('Terminé');
  });
});
