export const palette = {
  // Backgrounds — dark navy
  background: '#0D1117',
  backgroundSurface: '#161B22',
  backgroundElevated: '#21262D',
  backgroundHover: '#30363D',

  // Accents
  accentPrimary: '#E63946',
  accentSecondary: '#1D4ED8',
  accentPrimaryMuted: 'rgba(230, 57, 70, 0.12)',

  // Text
  textPrimary: '#F0F6FC',
  textSecondary: '#8B949E',
  textMuted: '#484F58',

  // Semantic
  success: '#2EA043',
  warning: '#F59E0B',
  error: '#F85149',
  info: '#58A6FF',
  libero: '#FBBF24',

  // Scoring teams
  teamHome: '#1D4ED8',
  teamAway: '#E63946',

  // Light mode
  lightBackground: '#FFFFFF',
  lightSurface: '#F6F8FA',
  lightElevated: '#EAEEF2',
  lightText: '#1F2328',
  lightTextSecondary: '#656D76',
  lightBorder: '#D0D7DE',
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  full: 9999,
} as const;
