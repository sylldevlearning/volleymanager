import { useColorScheme } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore';
import { THEMES, resolveScheme, type ColorScheme, type ThemeColors } from './colors';

export type AppTheme = ThemeColors;

/** Colours of the current mode (Settings › Appearance, or the phone); screens re-render when it changes. */
export function useAppTheme(): AppTheme {
  const appearance = useSettingsStore((s) => s.appearance);
  const phone = useColorScheme();
  return THEMES[resolveScheme(appearance, phone === 'light' || phone === 'dark' ? phone : null)];
}

const styleCache = new WeakMap<object, Map<ColorScheme, unknown>>();

/**
 * Styles that depend on the mode: `factory` is a `StyleSheet.create` taking
 * the theme, built once per mode and reused.
 */
export function useThemedStyles<T>(factory: (theme: AppTheme) => T): T {
  const theme = useAppTheme();
  let byScheme = styleCache.get(factory);
  if (!byScheme) {
    byScheme = new Map();
    styleCache.set(factory, byScheme);
  }
  if (!byScheme.has(theme.scheme)) byScheme.set(theme.scheme, factory(theme));
  return byScheme.get(theme.scheme) as T;
}
