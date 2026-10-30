import type { TournamentBundle } from './bundle';
import {
  bracketRounds,
  matchGroups,
  matchTitle,
  rankingRows,
  scoreText,
  sideName,
  slotGroups,
  standingsTables,
  type Translate,
} from './display';
import { levelsSummary, roundSummary } from './phases';
import type { TournamentMatch } from '../../models/tournament';
import { formatClock, formatDate } from '../../i18n/format';

/** What can be exported: 'planning' | 'results' | 'standings' | 'levels' | 'round:<n>' */
export type ExportContent = string;
export type ExportFormat = 'pdf' | 'png';

export type ExportBlock =
  | { kind: 'table'; title?: string; columns: string[]; rows: string[][] }
  | { kind: 'list'; title: string; color?: string; items: string[] }
  | { kind: 'note'; text: string };

/** One document, rendered as an A4 PDF (HTML) or as an image (native view). */
export interface ExportDoc {
  title: string;
  /** Date and place */
  subtitle: string;
  contentTitle: string;
  blocks: ExportBlock[];
  footer: string;
}

/** "samedi 16 mai 2026" — the tournament day in the format of the language. */
export function formatTournamentDate(iso: string, locale: string): string {
  return formatDate(iso, locale, 'long');
}

/** Contents ready to export: rounds once complete, levels once known. */
export function exportOptions(bundle: TournamentBundle, t: Translate): { id: ExportContent; label: string }[] {
  const options = [
    { id: 'planning', label: t('tournament.export.contents.planning') },
    { id: 'results', label: t('tournament.export.contents.results') },
    { id: 'standings', label: t('tournament.export.contents.standings') },
  ];
  const rounds = [...new Set(bundle.matches.filter((m) => m.stage === 'brassage' && m.phase !== null).map((m) => m.phase!))]
    .sort((a, b) => a - b);
  for (const round of rounds) {
    if (roundSummary(bundle, round, t)?.complete) {
      options.push({ id: `round:${round}`, label: t('tournament.round.titleDone', { n: round }) });
    }
  }
  if (levelsSummary(bundle, t)) options.push({ id: 'levels', label: t('tournament.levels.title') });
  return options;
}

function contentTitle(content: ExportContent, t: Translate): string {
  const round = /^round:(\d+)$/.exec(content);
  if (round) return t('tournament.round.titleDone', { n: Number(round[1]) });
  if (content === 'levels') return t('tournament.levels.title');
  return t(`tournament.export.contents.${content}`);
}

export function buildExportDoc(bundle: TournamentBundle, content: ExportContent, t: Translate, locale: string): ExportDoc {
  const { tournament } = bundle;
  const subtitle = [formatTournamentDate(tournament.date, locale), tournament.location].filter(Boolean).join(' · ');
  const side = (m: TournamentMatch, s: 'home' | 'away') => sideName(m, s, bundle, t, locale);
  const score = (m: TournamentMatch) => scoreText(m, t) ?? '';
  const time = (m: TournamentMatch) => formatClock(m.scheduledAt?.slice(11, 16) ?? '', locale);
  const court = (m: TournamentMatch) => (m.court === null ? '' : String(m.court));
  const col = (key: string) => t(`tournament.export.${key}`);
  const blocks: ExportBlock[] = [];

  if (content === 'planning') {
    const rows = slotGroups(bundle.matches).flatMap((g) => g.matches.map((m) => [
      formatClock(g.time, locale), court(m), matchTitle(m, bundle, t), side(m, 'home'), side(m, 'away'), score(m),
    ]));
    blocks.push({ kind: 'table', columns: [col('colTime'), col('colCourt'), col('colMatch'), col('colTeam'), col('colTeam'), col('colScore')], rows });
  } else if (content === 'results') {
    for (const group of matchGroups(bundle, t)) {
      const ids = new Set(group.matchIds);
      const list = bundle.matches
        .filter((m) => ids.has(m.id))
        .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0) || (a.court ?? 0) - (b.court ?? 0));
      blocks.push({
        kind: 'table',
        title: group.label,
        columns: [col('colTime'), col('colCourt'), col('colTeam'), col('colTeam'), col('colScore')],
        rows: list.map((m) => [time(m), court(m), side(m, 'home'), side(m, 'away'), score(m)]),
      });
    }
  } else if (content === 'standings') {
    const view = (key: string) => t(`tournament.view.${key}`);
    const diff = (n: number) => (n > 0 ? `+${n}` : String(n));
    const ranking = rankingRows(bundle);
    if (ranking.length > 0) {
      blocks.push({
        kind: 'table',
        title: view('finalRanking'),
        columns: [col('colRank'), col('colTeam')],
        rows: ranking.map((r) => [String(r.rank), r.name]),
      });
    }
    for (const table of standingsTables(bundle, t)) {
      blocks.push({
        kind: 'table',
        title: table.complete ? table.title : `${table.title} · ${view('tableInProgress')}`,
        columns: ['#', view('colTeam'), view('colPlayed'), view('colWon'), view('colLost'), view('colPoints'), view('colSets'), view('colDiff')],
        rows: table.rows.map((r) => [
          String(r.rank), r.name, String(r.played), String(r.won), String(r.lost), String(r.points),
          diff(r.setsWon - r.setsLost), diff(r.pointsWon - r.pointsLost),
        ]),
      });
    }
    for (const round of bracketRounds(bundle, t)) {
      blocks.push({
        kind: 'table',
        title: round.title,
        columns: [col('colMatch'), col('colTeam'), col('colTeam'), col('colScore')],
        rows: round.matches.map((m) => [matchTitle(m, bundle, t), side(m, 'home'), side(m, 'away'), score(m)]),
      });
    }
  } else if (content === 'levels') {
    for (const level of levelsSummary(bundle, t) ?? []) {
      blocks.push({
        kind: 'list',
        title: `${level.name} · ${t('tournament.levels.count', { count: level.teams.length })}`,
        color: level.color,
        items: level.teams,
      });
    }
  } else {
    const round = Number(/^round:(\d+)$/.exec(content)?.[1] ?? 0);
    const summary = roundSummary(bundle, round, t);
    if (summary?.complete) {
      blocks.push({
        kind: 'table',
        title: t('tournament.round.ranking', { n: round }),
        columns: [col('colRank'), col('colTeam'), col('colPool')],
        rows: summary.ranking.map((r) => [String(r.rank), r.name, r.pool]),
      });
      if (summary.next?.kind === 'round') {
        for (const pool of summary.next.pools) blocks.push({ kind: 'list', title: pool.title, items: pool.teams });
      } else if (summary.next?.kind === 'levels') {
        for (const level of levelsSummary(bundle, t) ?? []) {
          blocks.push({ kind: 'list', title: level.name, color: level.color, items: level.teams });
        }
      }
    }
  }

  return { title: tournament.name, subtitle, contentTitle: contentTitle(content, t), blocks, footer: col('footer') };
}

const escapeHtml = (text: string) => text
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Self-contained HTML for an A4 PDF: readable printed or projected, footer on every page. */
export function exportHtml(doc: ExportDoc, lang: string): string {
  const e = escapeHtml;
  const blocks = doc.blocks.map((b) => {
    if (b.kind === 'note') return `<p class="note">${e(b.text)}</p>`;
    if (b.kind === 'list') {
      const bar = b.color ? ` style="border-left-color: ${e(b.color)}"` : '';
      return `<section class="list"${bar}><h3>${e(b.title)}</h3><ol>${b.items.map((i) => `<li>${e(i)}</li>`).join('')}</ol></section>`;
    }
    // Columns of short values (rank, numbers) stay narrow, names get the room
    const narrow = b.columns.map((c, k) => [c, ...b.rows.map((r) => r[k] ?? '')].every((v) => v.length <= 6));
    const cls = (k: number) => (narrow[k] ? ' class="narrow"' : '');
    const head = b.columns.map((c, k) => `<th${cls(k)}>${e(c)}</th>`).join('');
    const rows = b.rows.map((r) => `<tr>${r.map((c, k) => `<td${cls(k)}>${e(c)}</td>`).join('')}</tr>`).join('');
    return `<section>${b.title ? `<h3>${e(b.title)}</h3>` : ''}<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="${e(lang)}">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 14mm 12mm 18mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif; color: #111; font-size: 11pt; margin: 0; }
  header { border-bottom: 3px solid #E63946; padding-bottom: 8px; margin-bottom: 14px; }
  h1 { font-size: 22pt; margin: 0; }
  .subtitle { color: #444; font-size: 12pt; margin-top: 4px; }
  h2 { font-size: 16pt; margin: 10px 0 0; color: #1D4ED8; }
  h3 { font-size: 13pt; margin: 14px 0 6px; }
  section { break-inside: avoid; page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #EEF1F5; text-align: left; font-size: 10pt; }
  th, td { border: 1px solid #C9CFD8; padding: 5px 6px; }
  .narrow { width: 1%; white-space: nowrap; text-align: center; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #F8F9FB; }
  .list { border-left: 6px solid #1D4ED8; padding-left: 10px; }
  ol { margin: 0; padding-left: 22px; columns: 2; }
  li { padding: 2px 0; }
  .note { color: #444; }
  footer { position: fixed; bottom: -12mm; left: 0; right: 0; text-align: center; font-size: 9pt; color: #666; }
</style>
</head>
<body>
<header>
  <h1>${e(doc.title)}</h1>
  <div class="subtitle">${e(doc.subtitle)}</div>
  <h2>${e(doc.contentTitle)}</h2>
</header>
${blocks}
<footer>${e(doc.footer)}</footer>
</body>
</html>`;
}

/** "Open de Lyon - Planning.pdf": no characters that mail or Drive refuse. */
export function exportFileName(bundle: TournamentBundle, content: ExportContent, t: Translate, format: ExportFormat): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return `${clean(bundle.tournament.name) || 'Tournoi'} - ${clean(contentTitle(content, t))}.${format}`;
}

/** Width of the shared image, in pixels — whatever the phone's density */
export const IMAGE_WIDTH = 1080;
/** Beyond this, the bitmap would take too much memory (1080 × 6000 ≈ 26 MB): the PDF is proposed instead */
export const IMAGE_MAX_HEIGHT = 6000;

/** Output size of the image for a preview of this size (dp), or null when it is too tall for an image. */
export function imageExportSize(contentWidth: number, contentHeight: number): { width: number; height: number } | null {
  if (contentWidth <= 0 || contentHeight <= 0) return null;
  const height = Math.round((contentHeight * IMAGE_WIDTH) / contentWidth);
  return height > IMAGE_MAX_HEIGHT ? null : { width: IMAGE_WIDTH, height };
}
