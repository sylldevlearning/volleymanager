import fs from 'fs';
import path from 'path';
import { act } from '@testing-library/react-native';
import {
  ACCENTS,
  DEFAULT_ACCENT_ID,
  accentOf,
  contrastRatio,
} from '../src/theme/accent';
import { palette } from '../src/theme/tokens';
import { useSettingsStore } from '../src/stores/settingsStore';

describe('accent palette', () => {
  it('6 to 8 colours, red first and by default', () => {
    expect(ACCENTS.length).toBeGreaterThanOrEqual(6);
    expect(ACCENTS.length).toBeLessThanOrEqual(8);
    expect(ACCENTS[0].id).toBe('red');
    expect(DEFAULT_ACCENT_ID).toBe('red');
    expect(new Set(ACCENTS.map((a) => a.id)).size).toBe(ACCENTS.length);
  });

  it('red keeps #E63946 for text and icons, buttons are darkened to #D62839', () => {
    expect(accentOf('red')).toMatchObject({ color: '#E63946', fill: '#D62839', onFill: '#FFFFFF' });
  });

  it('unknown or missing id falls back to red', () => {
    expect(accentOf(undefined).id).toBe('red');
    expect(accentOf('purple-ish').id).toBe('red');
  });

  it('contrast ratio follows WCAG', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#D62839', '#FFFFFF')).toBeCloseTo(4.97, 1);
  });

  describe.each(ACCENTS.map((a) => [a.id, a] as const))('%s', (_id, accent) => {
    it('text on a filled button: at least 4.5:1 (WCAG AA)', () => {
      expect(contrastRatio(accent.onFill, accent.fill)).toBeGreaterThanOrEqual(4.5);
    });

    it('as text, icon or border on the dark backgrounds: at least 3:1', () => {
      for (const bg of [palette.background, palette.backgroundSurface]) {
        expect(contrastRatio(accent.color, bg)).toBeGreaterThanOrEqual(3);
      }
    });

    it('muted tint is the colour at low opacity', () => {
      expect(accent.muted).toMatch(/^rgba\(\d+, \d+, \d+, 0\.12\)$/);
    });

    it('has a name in every language', () => {
      const dir = path.join(__dirname, '../src/i18n');
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        const dict = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        expect(typeof dict.settings.accentColors[accent.id]).toBe('string');
      }
    });
  });
});

describe('settings: accent colour', () => {
  it('red by default, remembered when changed', () => {
    expect(useSettingsStore.getState().accentColor).toBe('red');
    act(() => useSettingsStore.getState().setAccentColor('teal'));
    expect(useSettingsStore.getState().accentColor).toBe('teal');
    act(() => useSettingsStore.getState().setAccentColor('red'));
  });

  it('persisted with the other settings', () => {
    const options = useSettingsStore.persist.getOptions();
    const saved = options.partialize
      ? options.partialize(useSettingsStore.getState())
      : useSettingsStore.getState();
    expect(saved).toHaveProperty('accentColor');
  });

  it('settings saved by 1.1.0 (no accent) come back in red', async () => {
    const options = useSettingsStore.persist.getOptions();
    const merged = options.merge!({ language: 'fr', hapticsEnabled: false }, useSettingsStore.getInitialState());
    expect(merged).toMatchObject({ accentColor: 'red', hapticsEnabled: false });
  });
});

describe('screens use the chosen colour', () => {
  // Fixed on purpose: team, jersey and sanction colours, chart series and exported documents
  const ALLOWED = new Set([
    'src/theme/tokens.ts',
    'src/theme/accent.ts',
    // Away half of the tactical court: team colour
    'src/components/tactical/CourtSVG.tsx',
  ]);

  function files(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? files(p) : /\.tsx?$/.test(e.name) ? [p] : [];
    });
  }

  it('no screen or component reads the fixed accent from the palette', () => {
    const root = path.join(__dirname, '..');
    const offenders = [...files(path.join(root, 'app')), ...files(path.join(root, 'src'))]
      .map((f) => path.relative(root, f).replace(/\\/g, '/'))
      .filter((f) => !ALLOWED.has(f))
      .filter((f) => /palette\.accentPrimary|rgba\(\s*230,\s*57,\s*70/.test(fs.readFileSync(path.join(root, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
