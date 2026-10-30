import fs from 'fs';
import path from 'path';
import i18n from 'i18next';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';
import {
  buildExportDoc,
  exportFileName,
  exportHtml,
  exportOptions,
  formatTournamentDate,
  imageExportSize,
  IMAGE_MAX_HEIGHT,
} from '../src/features/tournament/exportDoc';
import { build, bundleFrom, playAll } from './helpers/tournamentFixtures';

const tr = i18n.createInstance();
beforeAll(async () => {
  await tr.init({ lng: 'fr', resources: { fr: { translation: fr } } });
});
const t = (key: string, opts?: Record<string, unknown>) => tr.t(key, opts) as string;
const enT = i18n.createInstance();
beforeAll(async () => {
  await enT.init({ lng: 'en', resources: { en: { translation: en } } });
});
const tEn = (key: string, opts?: Record<string, unknown>) => enT.t(key, opts) as string;

const withPlace = <T extends { tournament: object }>(b: T) =>
  ({ ...b, tournament: { ...b.tournament, name: 'Open de Lyon', location: 'Gymnase Jean Macé' } }) as T;

describe('what can be exported', () => {
  it('planning, matches and standings always; round and levels screens for brassage', () => {
    const pools = withPlace(bundleFrom(build('pools_knockout', 8)));
    expect(exportOptions(pools, t).map((o) => o.id)).toEqual(['planning', 'results', 'standings']);

    const built = build('brassage_levels', 16);
    const brassage = withPlace(bundleFrom(built, playAll(built)));
    const ids = exportOptions(brassage, t).map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(['planning', 'results', 'standings', 'round:1', 'round:2', 'levels']));
  });

  it('a round still in progress or levels not known yet are not offered', () => {
    const fresh = withPlace(bundleFrom(build('brassage_levels', 16)));
    expect(exportOptions(fresh, t).map((o) => o.id)).toEqual(['planning', 'results', 'standings']);
  });
});

describe('the exported document', () => {
  const built = build('pools_knockout', 8);
  const played = withPlace(bundleFrom(built, playAll(built)));

  it('name, date and place of the tournament, and the content title', () => {
    const doc = buildExportDoc(played, 'planning', t, 'fr');
    expect(doc.title).toBe('Open de Lyon');
    expect(doc.subtitle).toBe('samedi 16 mai 2026 · Gymnase Jean Macé');
    expect(doc.contentTitle).toBe(fr.tournament.export.contents.planning);
    expect(doc.footer).toBe('Réalisé avec VolleyManager');
  });

  it('the date in the format of the language', () => {
    expect(formatTournamentDate('2026-05-16', 'fr')).toBe('samedi 16 mai 2026');
    expect(formatTournamentDate('2026-05-16', 'en')).toBe('Saturday, May 16, 2026');
    expect(formatTournamentDate('2026-05-16', 'de')).toBe('Samstag, 16. Mai 2026');
  });

  it('planning: every match, by time and court', () => {
    const doc = buildExportDoc(played, 'planning', t, 'fr');
    const rows = doc.blocks.flatMap((b) => (b.kind === 'table' ? b.rows : []));
    expect(rows).toHaveLength(played.matches.length);
    expect(rows[0][0]).toBe('09:00');
  });

  it('matches with results: the score of every played match, by phase', () => {
    const doc = buildExportDoc(played, 'results', t, 'fr');
    const tables = doc.blocks.filter((b) => b.kind === 'table');
    expect(tables.length).toBeGreaterThanOrEqual(3);
    const rows = tables.flatMap((b) => (b.kind === 'table' ? b.rows : []));
    expect(rows).toHaveLength(played.matches.length);
    for (const row of rows) expect(row[row.length - 1]).toMatch(/^\d-\d/);
  });

  it('standings: pool tables, bracket and final ranking', () => {
    const doc = buildExportDoc(played, 'standings', t, 'fr');
    const titles = doc.blocks.map((b) => ('title' in b ? b.title : ''));
    expect(titles).toContain(fr.tournament.view.finalRanking);
    expect(titles.some((x) => x?.startsWith('Poule A'))).toBe(true);
    const ranking = doc.blocks.find((b) => b.kind === 'table' && b.title === fr.tournament.view.finalRanking);
    expect(ranking && ranking.kind === 'table' ? ranking.rows : []).toHaveLength(8);
  });

  it('"Tour N terminé" and "Répartition des niveaux"', () => {
    const b16 = build('brassage_levels', 16);
    const done = withPlace(bundleFrom(b16, playAll(b16)));
    const round = buildExportDoc(done, 'round:1', t, 'fr');
    expect(round.contentTitle).toBe('Tour 1 terminé');
    expect(round.blocks.some((b) => b.kind === 'table' && b.rows.length === 16)).toBe(true);
    const levels = buildExportDoc(done, 'levels', t, 'fr');
    expect(levels.contentTitle).toBe(fr.tournament.levels.title);
    const lists = levels.blocks.filter((b) => b.kind === 'list');
    expect(lists.flatMap((b) => (b.kind === 'list' ? b.items : []))).toHaveLength(16);
  });
});

describe('PDF (HTML for A4) and file name', () => {
  const built = build('round_robin', 4);
  const bundle = withPlace(bundleFrom(built, playAll(built)));

  it('A4 page, the footer on every page, the content escaped', () => {
    const doc = buildExportDoc({ ...bundle, tournament: { ...bundle.tournament, name: 'Open <A&B>' } }, 'standings', t, 'fr');
    const html = exportHtml(doc, 'fr');
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('@page { size: A4;');
    expect(html).toContain('position: fixed');
    expect(html).toContain('Réalisé avec VolleyManager');
    expect(html).toContain('Open &lt;A&amp;B&gt;');
    expect(html).not.toContain('<A&B>');
  });

  it('time, court, rank and numbers never wrap, whatever the language; a score breaks only between sets', () => {
    const played = withPlace(bundleFrom(built, playAll(built)));
    for (const [lang, tl] of [['fr', t], ['en', tEn]] as const) {
      for (const content of ['planning', 'results', 'standings']) {
        const doc = buildExportDoc(played, content, tl, lang);
        const html = exportHtml(doc, lang);
        for (const b of doc.blocks) {
          if (b.kind !== 'table') continue;
          expect(b.kinds).toHaveLength(b.columns.length);
          b.columns.forEach((c, k) => {
            if (c === tl('tournament.export.colTime') || c === tl('tournament.export.colCourt') || c === '#') expect(b.kinds[k]).toBe('short');
            if (c === tl('tournament.export.colScore')) expect(b.kinds[k]).toBe('score');
          });
        }
        // Every time of the planning sits in a cell that does not wrap ("2:30 PM" in English)
        if (content === 'planning') {
          const table = doc.blocks[0];
          if (table.kind !== 'table') throw new Error('table expected');
          for (const row of table.rows) expect(html).toContain(`<td class="short">${row[0]}</td>`);
        }
      }
    }
    expect(exportHtml(buildExportDoc(played, 'planning', tEn, 'en'), 'en')).toMatch(/<td class="short">\d{1,2}:\d{2} [AP]M<\/td>/);
    const html = exportHtml(buildExportDoc(played, 'planning', t, 'fr'), 'fr');
    expect(html).toMatch(/\.short \{[^}]*white-space: nowrap/);
    expect(html).toMatch(/\.nw \{[^}]*white-space: nowrap/);
    // "25-20" never splits at its hyphen: each part of the score is a block that does not wrap
    expect(html).toMatch(/<td class="score"><span class="nw">\d-\d ·<\/span> <span class="nw">\d+-\d+,?<\/span>/);
  });

  it('a readable file name, without characters the share targets refuse', () => {
    expect(exportFileName(bundle, 'planning', t, 'pdf')).toBe('Open de Lyon - Planning.pdf');
    expect(exportFileName({ ...bundle, tournament: { ...bundle.tournament, name: 'A/B: "C"?' } }, 'round:2', t, 'png'))
      .toBe('A B C - Tour 2 terminé.png');
  });
});

describe('screens wiring and texts', () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

  it('"Exporter" in the ⋯ menu, content and format to choose, system share sheet', () => {
    expect(read('app/tournament/[id]/index.tsx')).toContain('/tournament/${id}/export');
    const screen = read('app/tournament/[id]/export.tsx');
    expect(screen).toContain('exportOptions(bundle, t)');
    expect(screen).toContain("Print.printToFileAsync({ html: exportHtml(doc, lang), width: 595, height: 842 })");
    expect(screen).toContain("captureRef(");
    expect(screen).toContain('Sharing.shareAsync(');
    expect(fr.tournament.view.menuExport).toBe('Exporter');
  });

  it('every export text exists in French and English', () => {
    for (const dict of [fr, en]) {
      const e = dict.tournament.export as Record<string, unknown>;
      for (const key of ['title', 'content', 'format', 'pdf', 'image', 'share', 'footer', 'colTime', 'colCourt', 'colMatch', 'colScore', 'colTeam', 'colRank', 'colPool']) {
        expect(e[key]).toBeTruthy();
      }
    }
  });
});

describe('image export size', () => {
  it('the image is 1080 px wide, height in proportion', () => {
    expect(imageExportSize(360, 900)).toEqual({ width: 1080, height: 2700 });
    expect(imageExportSize(540, 540)).toEqual({ width: 1080, height: 1080 });
  });

  it('too tall for an image (memory): no image, the PDF is proposed', () => {
    expect(IMAGE_MAX_HEIGHT).toBe(6000);
    expect(imageExportSize(360, 2000)).toEqual({ width: 1080, height: 6000 });
    expect(imageExportSize(360, 2001)).toBeNull();
    expect(imageExportSize(0, 100)).toBeNull();
  });

  it('the screen uses it and says so', () => {
    const screen = fs.readFileSync(path.join(__dirname, '../app/tournament/[id]/export.tsx'), 'utf8');
    expect(screen).toContain('imageExportSize(');
    expect(screen).toContain("t('tournament.export.imageTooTall')");
    expect(screen).toContain('width: size.width, height: size.height');
    for (const dict of [fr, en]) expect((dict.tournament.export as Record<string, unknown>).imageTooTall).toBeTruthy();
  });
});
