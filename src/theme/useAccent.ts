import { StyleSheet } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore';
import { accentOf, type Accent, type AccentId } from './accent';

function stylesOf(a: Accent) {
  return StyleSheet.create({
    /** Filled button / active chip background */
    fill: { backgroundColor: a.fill },
    /** Filled with a matching border */
    fillBorder: { backgroundColor: a.fill, borderColor: a.fill },
    /** Text or icon on a filled background */
    onFill: { color: a.onFill },
    /** Accent text on the dark backgrounds */
    text: { color: a.color },
    border: { borderColor: a.color },
    /** Selected item: accent border on a light tint */
    selected: { borderColor: a.color, backgroundColor: a.muted },
    muted: { backgroundColor: a.muted },
  });
}

export type AccentTheme = Accent & { s: ReturnType<typeof stylesOf> };

const cache = new Map<AccentId, AccentTheme>();

export function accentTheme(id: AccentId): AccentTheme {
  let theme = cache.get(id);
  if (!theme) {
    const a = accentOf(id);
    theme = { ...a, s: stylesOf(a) };
    cache.set(id, theme);
  }
  return theme;
}

/** Main colour chosen in Settings; screens re-render as soon as it changes. */
export function useAccent(): AccentTheme {
  return accentTheme(useSettingsStore((s) => s.accentColor));
}

const styleCache = new WeakMap<object, Map<AccentId, unknown>>();

/**
 * Styles that depend on the main colour: `factory` is a `StyleSheet.create`
 * taking the accent, built once per colour and reused.
 */
export function useThemedStyles<T>(factory: (a: AccentTheme) => T): T {
  const a = useAccent();
  let byAccent = styleCache.get(factory);
  if (!byAccent) {
    byAccent = new Map();
    styleCache.set(factory, byAccent);
  }
  if (!byAccent.has(a.id)) byAccent.set(a.id, factory(a));
  return byAccent.get(a.id) as T;
}
