import fs from 'fs';
import path from 'path';
import { act } from '@testing-library/react-native';
import { THEMES, contrastRatio, resolveScheme, type ThemeColors } from '../src/theme/colors';
import { useSettingsStore } from '../src/stores/settingsStore';
import { LANGUAGES } from '../src/i18n/languages';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe.each(['dark', 'light'] as const)('%s colours', (scheme) => {
  const c: ThemeColors = THEMES[scheme];
  const backgrounds = [c.background, c.backgroundSurface];

  it.each([
    'textPrimary', 'textSecondary', 'textMuted', 'success', 'warning', 'error', 'info', 'accentSecondary',
  ] as const)('%s text: at least 4.5:1 on the background and on surfaces', (key) => {
    for (const bg of backgrounds) expect(contrastRatio(c[key], bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('red as text, icon or border: at least 3:1 (4.5:1 in light mode)', () => {
    for (const bg of backgrounds) {
      expect(contrastRatio(c.color, bg)).toBeGreaterThanOrEqual(scheme === 'light' ? 4.5 : 3);
    }
  });

  it('text on red and blue buttons: at least 4.5:1', () => {
    expect(contrastRatio(c.onFill, c.fill)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#FFFFFF', c.secondaryFill)).toBeGreaterThanOrEqual(4.5);
  });

  it('red buttons stay #D62839', () => {
    expect(c.fill).toBe('#D62839');
  });
});

describe('choices from the plan', () => {
  it('dark: muted text #7D8590, secondary blue #58A6FF, red text #E63946', () => {
    expect(THEMES.dark).toMatchObject({ textMuted: '#7D8590', accentSecondary: '#58A6FF', color: '#E63946' });
  });

  it('light: red text #D62839, secondary blue #1D4ED8', () => {
    expect(THEMES.light).toMatchObject({ color: '#D62839', accentSecondary: '#1D4ED8', background: '#FFFFFF' });
  });

  it('status bar text: light in dark mode, dark in light mode', () => {
    expect(THEMES.dark.statusBar).toBe('light-content');
    expect(THEMES.light.statusBar).toBe('dark-content');
  });
});

describe('appearance setting', () => {
  it('Automatique follows the phone; Clair and Sombre force it', () => {
    expect(resolveScheme('system', 'light')).toBe('light');
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('system', null)).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('Automatique by default, remembered when changed', () => {
    expect(useSettingsStore.getState().appearance).toBe('system');
    act(() => useSettingsStore.getState().setAppearance('light'));
    expect(useSettingsStore.getState().appearance).toBe('light');
    act(() => useSettingsStore.getState().setAppearance('system'));
  });

  it('settings saved before (theme, accent colour) come back in Automatique, old fields dropped', () => {
    const options = useSettingsStore.persist.getOptions();
    const merged = options.merge!(
      { theme: 'dark', accentColor: 'teal', hapticsEnabled: false },
      useSettingsStore.getInitialState(),
    ) as unknown as Record<string, unknown>;
    expect(merged).toMatchObject({ appearance: 'system', hapticsEnabled: false });
    expect(merged).not.toHaveProperty('theme');
    expect(merged).not.toHaveProperty('accentColor');
  });

  it('an unknown saved value falls back to Automatique', () => {
    const options = useSettingsStore.persist.getOptions();
    const merged = options.merge!({ appearance: 'sepia' }, useSettingsStore.getInitialState());
    expect(merged).toMatchObject({ appearance: 'system' });
  });

  it('Settings: three choices instead of the colour palette, in every language', () => {
    const settings = read('app/(tabs)/settings.tsx');
    expect(settings).not.toContain('ACCENTS');
    for (const choice of ['system', 'light', 'dark']) expect(settings).toContain(`'${choice}'`);
    for (const { code } of LANGUAGES) {
      const dict = JSON.parse(read(`src/i18n/${code}.json`));
      for (const key of ['title', 'system', 'light', 'dark']) expect(typeof dict.settings.appearance[key]).toBe('string');
      expect(dict.settings.accentColors).toBeUndefined();
      expect(dict.settings.accentTitle).toBeUndefined();
    }
  });

  it('Android reports the phone setting (app.json)', () => {
    expect(JSON.parse(read('app.json')).expo.userInterfaceStyle).toBe('automatic');
  });
});

describe('every screen follows the appearance', () => {
  // Fixed on purpose: team / jersey / sanction colours and exported documents
  const THEMABLE = /palette\.(background|backgroundSurface|backgroundElevated|backgroundHover|textPrimary|textSecondary|textMuted|accentPrimary|accentPrimaryMuted|accentSecondary|success|warning|error|info)\b/;
  const ALLOWED = new Set([
    'src/theme/tokens.ts',
    'src/theme/colors.ts',
    'src/components/tournament/ExportView.tsx',
    'src/features/tournament/exportDoc.ts',
  ]);

  function files(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? files(p) : /\.tsx?$/.test(e.name) ? [p] : [];
    });
  }

  it('no screen or component reads the fixed dark palette', () => {
    const offenders = [...files(path.join(root, 'app')), ...files(path.join(root, 'src'))]
      .map((f) => path.relative(root, f).replace(/\\/g, '/'))
      .filter((f) => !ALLOWED.has(f) && THEMABLE.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('the colour palette code is gone', () => {
    expect(fs.existsSync(path.join(root, 'src/theme/accent.ts'))).toBe(false);
  });
});
