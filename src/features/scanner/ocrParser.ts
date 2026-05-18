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

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
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

export function parseNames(blocks: TextBlock[]): DetectedPlayer[] {
  const players: DetectedPlayer[] = [];

  for (const block of blocks) {
    for (const line of block.lines) {
      const text = line.text.trim();

      if (text.length < 3 || text.length > 50) continue;
      // Skip dates (dd/mm/yyyy or dd-mm-yyyy)
      if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(text)) continue;
      // Skip column headers
      if (/^(nom|prénom|prenom|licence|date|club|saison|catégorie|categorie|sexe|équipe|equipe)/i.test(text)) continue;

      // Capture license numbers (6-12 digits) and attach to previous player
      if (/^\d{6,12}$/.test(text)) {
        if (players.length > 0 && players[players.length - 1].licenseNumber === null) {
          players[players.length - 1] = { ...players[players.length - 1], licenseNumber: text };
        }
        continue;
      }
      // Skip purely numeric tokens beyond 12 digits
      if (/^\d{13,}$/.test(text)) continue;

      const parts = text.split(/\s+/);
      if (parts.length >= 2) {
        const lastName =
          parts.find((p) => p === p.toUpperCase() && p.length > 1) ?? parts[0];
        const firstName = parts.filter((p) => p !== lastName).join(' ');
        players.push({
          id: uid(),
          lastName: capitalize(lastName),
          firstName: capitalize(firstName),
          number: null,
          licenseNumber: null,
          isSelected: true,
        });
      }
    }
  }

  return deduplicateByName(players);
}
