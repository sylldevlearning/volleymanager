export interface DetectedPlayer {
  id: string;
  lastName: string;
  firstName: string;
  number: number | null;
  licenseNumber: string | null;
  isSelected: boolean;
}

export interface TextLine {
  text: string;
}

export interface TextBlock {
  text: string;
  lines: TextLine[];
}

/**
 * FFVolley licences: each one has a line "1234567 MME NOM PRÉNOM" (or M., MLLE):
 * 7-digit licence number, civility, then last name and first name in capitals.
 * Only those three fields are kept. Everything else is ignored: the club number
 * (7 digits followed by the club name, no civility), headers, season, dates,
 * category, nationality, mentions (MUT.…), sponsors, phone numbers, handwriting.
 *
 * The OCR may cut the line (number, civility or first name on the next line) or
 * read the numbers and the names as separate columns: the text is read as one
 * stream of words, and numbers and names are paired in reading order.
 */

const LICENCE_RE = /^\d{7}$/;
const CIVILITY_RE = /^(MME|MLLE|M)\.?$/;
/** A word of a name in capitals: letters, hyphens, apostrophes (N'DIAYE, JEAN-PIERRE) */
const NAME_WORD_RE = /^[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’-]*$/;
/** Words that end a name on the licence (category, nationality, labels…) */
const STOP_WORDS = new Set([
  'NE', 'NEE', 'NÉ', 'NÉE', 'SENIOR', 'SENIORS', 'JUNIOR', 'JUNIORS', 'ESPOIR', 'ESPOIRS', 'CADET', 'CADETTE',
  'CADETS', 'MINIME', 'MINIMES', 'BENJAMIN', 'BENJAMINE', 'POUSSIN', 'POUSSINE', 'VETERAN', 'VÉTÉRAN',
  'FRANCAISE', 'FRANÇAISE', 'FRANCAIS', 'FRANÇAIS', 'NATIONALITE', 'NATIONALITÉ', 'COMPETITION', 'COMPÉTITION',
  'LIGUE', 'SAISON', 'LICENCE', 'CLUB', 'DHO', 'CATEGORIE', 'CATÉGORIE', 'SEXE', 'MUTATION', 'SURCLASSEMENT',
]);
/** Particles that belong to the last name (DE LA FONTAINE, VAN DAM) */
const PARTICLES = new Set([
  'DE', 'DU', 'DES', 'LE', 'LA', 'LES', 'DI', 'DA', 'DEL', 'DELLA', 'DOS', 'VAN', 'VON', 'DER', 'DEN', 'TEN',
  'EL', 'AL', 'BEN', 'BIN', 'MAC', 'MC', 'SAINT', 'ST',
]);

interface Token {
  word: string;
  line: number;
}

let _uid = 0;
function uid(): string {
  return `ocr_${++_uid}`;
}

/** "N'ECHO" → "N'Echo", "ANNE-SOPHIE" → "Anne-Sophie" */
function capitalizeWord(word: string): string {
  return word
    .toLocaleLowerCase('fr')
    .replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toLocaleUpperCase('fr'));
}

const capitalize = (words: string[]) => words.map(capitalizeWord).join(' ');

/**
 * Most likely split of "NOM [NOM…] PRÉNOM [PRÉNOM…]": particles stay with the
 * last name, then the first word is the last name and the rest the first name.
 */
export function splitFullName(words: string[]): { lastName: string; firstName: string } {
  let i = 0;
  const last: string[] = [];
  while (i < words.length - 1 && PARTICLES.has(words[i])) last.push(words[i++]);
  if (i < words.length) last.push(words[i++]);
  return { lastName: capitalize(last), firstName: capitalize(words.slice(i)) };
}

function isNameWord(word: string): boolean {
  return word.length > 1 && NAME_WORD_RE.test(word) && !STOP_WORDS.has(word);
}

function tokenize(blocks: TextBlock[]): Token[] {
  const lines = blocks.flatMap((b) => b.lines.map((l) => l.text.trim())).filter((l) => l.length > 0);
  return lines.flatMap((text, line) => text.split(/\s+/).map((word) => ({ word: word.toUpperCase(), line })));
}

export function parseNames(blocks: TextBlock[]): DetectedPlayer[] {
  const tokens = tokenize(blocks);
  const licences: string[] = []; // waiting for their name, in reading order
  const names: { words: string[]; licence: string | null }[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const { word, line } = tokens[i];
    const next = tokens[i + 1];

    if (LICENCE_RE.test(word)) {
      if (!next || CIVILITY_RE.test(next.word) || LICENCE_RE.test(next.word)) licences.push(word);
      // Anything else after the number (same line or next one) is a club name: not a player
      continue;
    }

    // A civility starts a name when it follows a licence number or begins a line
    const previous = tokens[i - 1];
    const startsName = !previous || previous.line !== line || LICENCE_RE.test(previous.word);
    if (!CIVILITY_RE.test(word) || !startsName) continue;

    const words: string[] = [];
    let lastLine = line;
    let j = i + 1;
    // The name may continue on the next line only while last name and first name are not both read
    while (j < tokens.length && isNameWord(tokens[j].word) && (tokens[j].line === lastLine || words.length < 2)) {
      words.push(tokens[j].word);
      lastLine = tokens[j].line;
      j++;
    }
    if (words.length === 0) continue;
    names.push({ words, licence: licences.shift() ?? null });
    i = j - 1;
  }

  // Names read before their numbers (columns in the other order): paired in order
  for (const name of names) {
    if (name.licence === null && licences.length > 0) name.licence = licences.shift()!;
  }

  const seen = new Set<string>();
  const players: DetectedPlayer[] = [];
  for (const { words, licence } of names) {
    const { lastName, firstName } = splitFullName(words);
    const key = licence ?? `${lastName}|${firstName}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    players.push({ id: uid(), licenseNumber: licence, lastName, firstName, number: null, isSelected: true });
  }
  return players;
}
