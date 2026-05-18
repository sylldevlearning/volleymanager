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

function capitalize(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function capitalizeName(str: string): string {
  return str.trim().split(/\s+/).map(capitalize).join(' ');
}

function deduplicateByName(players: DetectedPlayer[]): DetectedPlayer[] {
  const seen = new Set<string>();
  return players.filter((p) => {
    const key = `${p.lastName}|${p.firstName}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

let _uid = 0;
function uid(): string {
  return String(++_uid);
}

const DATE_RE = /^\d{2}[\/\-]\d{2}[\/\-]\d{4}/;
const HEADER_RE = /^(nom|pr[eé]nom|licence|date|club|saison|cat[eé]gorie|sexe|[eé]quipe|n°|no\s*lic)/i;
const CIVILITY_RE = /^(?:MME?\.?\s*|MLLE?\.?\s*|M\.?\s+)/i;
const LICENSE_PREFIX_RE = /^(\d{6,12})\s+/;
const STANDALONE_LICENSE_RE = /^\d{6,12}$/;

/**
 * Split "LASTNAME [LASTNAME2] Firstname [Firstname2...]" from text.
 * Rules:
 *  - All-uppercase words (may have hyphens/apostrophes) → lastName
 *  - First mixed/lowercase word and everything after → firstName
 *  - If everything is uppercase (OCR all-caps), last word becomes firstName
 */
function splitNameParts(text: string): [string, string] | null {
  const withoutCiv = text.replace(CIVILITY_RE, '').trim();
  if (!withoutCiv) return null;

  const words = withoutCiv.split(/\s+/);
  const lastWords: string[] = [];
  const firstWords: string[] = [];
  let foundFirst = false;

  for (const w of words) {
    if (/^\d/.test(w) || DATE_RE.test(w)) break; // stop at numbers / dates
    if (foundFirst) {
      firstWords.push(w);
    } else if (/^[A-ZÀ-Ÿ][-A-ZÀ-Ÿ']*$/.test(w)) {
      // Strictly all-uppercase (accented caps included)
      lastWords.push(w);
    } else {
      foundFirst = true;
      firstWords.push(w);
    }
  }

  // All-caps OCR fallback: split at last uppercase word
  if (firstWords.length === 0 && lastWords.length >= 2) {
    const fn = lastWords.pop()!;
    return [lastWords.join(' '), fn];
  }

  if (lastWords.length === 0 || firstWords.length === 0) return null;
  return [lastWords.join(' '), firstWords.join(' ')];
}

/**
 * Parse FFVB license sheet OCR output into DetectedPlayer list.
 *
 * Expected per-player format (one or two lines):
 *   {LICENSE} {MR|MME|MLLE} {LASTNAME} {Firstname} [extra fields...]
 *
 * Scanning starts after the "Ligue ..." header line when present.
 */
export function parseNames(blocks: TextBlock[]): DetectedPlayer[] {
  const allLines = blocks
    .flatMap((b) => b.lines.map((l) => l.text.trim()))
    .filter((l) => l.length >= 2);

  // Skip everything before "Ligue ..." line (federation/club header)
  const startIdx = allLines.findIndex((l) => /^ligue\s/i.test(l));
  const lines = startIdx >= 0 ? allLines.slice(startIdx + 1) : allLines;

  const players: DetectedPlayer[] = [];
  let pendingLicense: string | null = null;

  for (const line of lines) {
    if (DATE_RE.test(line)) continue;
    if (HEADER_RE.test(line)) continue;

    // Full FFVB line: LICENSE [CIVILITY] LASTNAME Firstname [extra...]
    const licMatch = line.match(LICENSE_PREFIX_RE);
    if (licMatch) {
      const rest = line.slice(licMatch[0].length).trim();
      const nameParts = splitNameParts(rest);
      if (nameParts) {
        pendingLicense = null;
        players.push({
          id: uid(),
          licenseNumber: licMatch[1],
          lastName: capitalizeName(nameParts[0]),
          firstName: capitalizeName(nameParts[1]),
          number: null,
          isSelected: true,
        });
        continue;
      }
    }

    // Standalone license number → expect name on next line
    if (STANDALONE_LICENSE_RE.test(line)) {
      pendingLicense = line;
      continue;
    }

    // Name line following a standalone license
    if (pendingLicense) {
      const nameParts = splitNameParts(line);
      if (nameParts) {
        players.push({
          id: uid(),
          licenseNumber: pendingLicense,
          lastName: capitalizeName(nameParts[0]),
          firstName: capitalizeName(nameParts[1]),
          number: null,
          isSelected: true,
        });
      }
      pendingLicense = null;
      continue;
    }

    // Generic fallback: no license number — detect UPPERCASE last name
    if (!/\d{4,}/.test(line)) {
      const nameParts = splitNameParts(line);
      if (nameParts) {
        players.push({
          id: uid(),
          licenseNumber: null,
          lastName: capitalizeName(nameParts[0]),
          firstName: capitalizeName(nameParts[1]),
          number: null,
          isSelected: true,
        });
      }
    }
  }

  return deduplicateByName(players);
}
