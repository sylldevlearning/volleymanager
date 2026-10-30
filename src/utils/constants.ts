export const APP_VERSION = "1.1.0";

// Real AdMob banner unit IDs, read from EAS environment variables (never
// committed). Only used in the "production" build; everywhere else, or when a
// variable is missing, AdBanner falls back to Google's test unit.
// See docs/plans/admob-consent.md for the variable list.
export const ADMOB_IDS = {
  BANNER_HOME: process.env.EXPO_PUBLIC_ADMOB_BANNER_HOME_ID,
  BANNER_HISTORY: process.env.EXPO_PUBLIC_ADMOB_BANNER_HISTORY_ID,
  BANNER_SETTINGS: process.env.EXPO_PUBLIC_ADMOB_BANNER_SETTINGS_ID,
};
export const COMPANY = "SyllDevLearning";

export const SCORE_BUTTON_SIZE = 88;
export const SCORE_FONT_SIZE = 96;

export const ANIMATION_DURATION_SHORT = 100;
export const ANIMATION_DURATION_MEDIUM = 200;
export const ANIMATION_DURATION_LONG = 300;

export const SCALE_PRESSED = 0.93;
export const SCALE_DEFAULT = 1;

export const PRESET_TEAM_COLORS = [
  '#1D4ED8', '#E63946', '#2EA043', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

export const LIBERO_PRESET_COLORS = ['#F59E0B', '#06B6D4'];
