/**
 * Main colour of the app, chosen in Settings (red by default).
 *
 * - `color`: text, icons, borders and active states on the dark backgrounds (≥ 3:1)
 * - `fill`: filled buttons, with `onFill` text on them (≥ 4.5:1, WCAG AA)
 * - `muted`: light tint behind selected items
 *
 * Team, jersey and sanction colours, chart series and exported documents do
 * not follow this choice: they carry a meaning, not the theme.
 */
export type AccentId = 'red' | 'blue' | 'violet' | 'pink' | 'green' | 'teal' | 'orange' | 'gold';

export interface Accent {
  id: AccentId;
  color: string;
  fill: string;
  onFill: string;
  muted: string;
}

const WHITE = '#FFFFFF';
const DARK = '#0D1117';

function mutedOf(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

function accent(id: AccentId, color: string, onFill: string, fill = color): Accent {
  return { id, color, fill, onFill, muted: mutedOf(color) };
}

export const ACCENTS: readonly Accent[] = [
  // #E63946 with white text is 4.17:1: buttons use a slightly darker red (4.97:1)
  accent('red', '#E63946', WHITE, '#D62839'),
  accent('blue', '#2563EB', WHITE),
  accent('violet', '#7C3AED', WHITE),
  accent('pink', '#DB2777', WHITE),
  accent('green', '#15803D', WHITE),
  accent('teal', '#0F766E', WHITE),
  accent('orange', '#EA580C', DARK),
  accent('gold', '#F59E0B', DARK),
];

export const DEFAULT_ACCENT_ID: AccentId = 'red';

export function isAccentId(value: unknown): value is AccentId {
  return ACCENTS.some((a) => a.id === value);
}

/** The accent with this id, red when unknown */
export function accentOf(id: string | undefined): Accent {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #RRGGBB colours (1 to 21) */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
