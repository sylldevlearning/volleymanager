/**
 * Colours of the app in dark and light mode (Settings › Appearance).
 *
 * Same names as the dark `palette` of tokens.ts, plus the red of the app:
 * - `color`: red text, icons, borders and active states
 * - `fill`: red buttons (#D62839 in both modes), with `onFill` text on them
 * - `muted`: light red tint behind selected items
 * - `secondaryFill`: blue buttons and switches, white text on them
 *
 * Team, jersey and sanction colours, chart series and exported documents do
 * not change with the mode: they stay in `palette`.
 */
export type ColorScheme = 'dark' | 'light';
export type Appearance = 'system' | ColorScheme;

export interface ThemeColors {
  scheme: ColorScheme;
  /** StatusBar barStyle */
  statusBar: 'light-content' | 'dark-content';
  background: string;
  backgroundSurface: string;
  backgroundElevated: string;
  backgroundHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentSecondary: string;
  secondaryFill: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  color: string;
  fill: string;
  onFill: string;
  muted: string;
}

const RED_FILL = '#D62839';

export const THEMES: Record<ColorScheme, ThemeColors> = {
  dark: {
    scheme: 'dark',
    statusBar: 'light-content',
    background: '#0D1117',
    backgroundSurface: '#161B22',
    backgroundElevated: '#21262D',
    backgroundHover: '#30363D',
    textPrimary: '#F0F6FC',
    textSecondary: '#8B949E',
    textMuted: '#7D8590',
    accentSecondary: '#58A6FF',
    secondaryFill: '#1D4ED8',
    success: '#2EA043',
    warning: '#F59E0B',
    error: '#F85149',
    info: '#58A6FF',
    color: '#E63946',
    fill: RED_FILL,
    onFill: '#FFFFFF',
    muted: 'rgba(230, 57, 70, 0.12)',
  },
  light: {
    scheme: 'light',
    statusBar: 'dark-content',
    background: '#FFFFFF',
    backgroundSurface: '#F6F8FA',
    backgroundElevated: '#EAEEF2',
    backgroundHover: '#D0D7DE',
    textPrimary: '#1F2328',
    textSecondary: '#656D76',
    textMuted: '#6A737D',
    accentSecondary: '#1D4ED8',
    secondaryFill: '#1D4ED8',
    success: '#1A7F37',
    warning: '#9A6700',
    error: '#CF222E',
    info: '#0969DA',
    color: RED_FILL,
    fill: RED_FILL,
    onFill: '#FFFFFF',
    muted: 'rgba(214, 40, 57, 0.10)',
  },
};

export function isAppearance(value: unknown): value is Appearance {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** "Automatique" follows the phone; dark when the phone does not say */
export function resolveScheme(appearance: Appearance, phone: ColorScheme | null | undefined): ColorScheme {
  if (appearance !== 'system') return appearance;
  return phone === 'light' ? 'light' : 'dark';
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
