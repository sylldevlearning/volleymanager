import { createFont, createTamagui, createTokens } from '@tamagui/core';
import { config as defaultConfig } from '@tamagui/config';
import { palette } from './src/theme/tokens';

const interFont = createFont({
  family: 'Inter',
  size: {
    1: 11, 2: 12, 3: 13, 4: 14, 5: 16, 6: 18,
    7: 20, 8: 22, 9: 28, 10: 32, 11: 48, 12: 64, 13: 96,
    true: 14,
  },
  lineHeight: {
    1: 14, 2: 16, 3: 18, 4: 20, 5: 24, 6: 24,
    7: 28, 8: 28, 9: 34, 10: 40, 11: 56, 12: 72, 13: 96,
    true: 20,
  },
  weight: {
    1: '400', 2: '500', 3: '600', 4: '700', 5: '900',
    true: '400',
  },
  letterSpacing: { 1: 0, 2: 0, true: 0 },
});

const tokens = createTokens({
  ...defaultConfig.tokens,
  color: {
    ...defaultConfig.tokens.color,
    background: palette.background,
    backgroundSurface: palette.backgroundSurface,
    backgroundElevated: palette.backgroundElevated,
    backgroundHover: palette.backgroundHover,
    accentPrimary: palette.accentPrimary,
    accentSecondary: palette.accentSecondary,
    textPrimary: palette.textPrimary,
    textSecondary: palette.textSecondary,
    textMuted: palette.textMuted,
    success: palette.success,
    warning: palette.warning,
    error: palette.error,
    info: palette.info,
    teamHome: palette.teamHome,
    teamAway: palette.teamAway,
  },
  space: { ...defaultConfig.tokens.space, true: 16 },
  radius: { ...defaultConfig.tokens.radius, true: 8 },
});

const darkTheme = {
  background: palette.background,
  backgroundSoft: palette.backgroundSurface,
  backgroundHover: palette.backgroundElevated,
  backgroundPress: palette.backgroundHover,
  borderColor: palette.backgroundElevated,
  color: palette.textPrimary,
  colorMuted: palette.textSecondary,
  placeholderColor: palette.textMuted,
  shadowColor: 'rgba(0,0,0,0.5)',
  accentPrimary: palette.accentPrimary,
  accentSecondary: palette.accentSecondary,
};

const lightTheme = {
  background: palette.lightBackground,
  backgroundSoft: palette.lightSurface,
  backgroundHover: palette.lightElevated,
  backgroundPress: palette.lightElevated,
  borderColor: palette.lightBorder,
  color: palette.lightText,
  colorMuted: palette.lightTextSecondary,
  placeholderColor: palette.lightTextSecondary,
  shadowColor: 'rgba(0,0,0,0.1)',
  accentPrimary: palette.accentPrimary,
  accentSecondary: palette.accentSecondary,
};

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  tokens,
  themes: {
    dark: darkTheme,
    light: lightTheme,
  },
  fonts: {
    heading: interFont,
    body: interFont,
    mono: defaultConfig.fonts.mono,
  },
  defaultTheme: 'dark',
});

export type AppConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig;
