/**
 * Layout audit (1.2.2): every screen adapts to small phones, large system
 * fonts and the navigation bar.
 */
import fs from 'fs';
import path from 'path';
import { MAX_FONT_SCALE } from '../src/components/ui/Text';
import { timeoutSheetLayout } from '../src/components/scoring/timeoutSheetLayout';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

describe('system font size is capped globally', () => {
  it('cap is 1.3', () => {
    expect(MAX_FONT_SCALE).toBe(1.3);
  });

  it('the app Text and TextInput apply the cap by default', () => {
    const src = read('src/components/ui/Text.tsx');
    expect(src).toMatch(/maxFontSizeMultiplier=\{maxFontSizeMultiplier \?\? MAX_FONT_SCALE\}/g);
    expect(src.match(/maxFontSizeMultiplier \?\? MAX_FONT_SCALE/g)).toHaveLength(2);
  });

  it("no screen imports Text or TextInput straight from 'react-native'", () => {
    const offenders = [...sourceFiles('app'), ...sourceFiles('src')]
      .filter((f) => !f.endsWith(path.join('components', 'ui', 'Text.tsx')))
      .filter((f) => {
        const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
        return [...s.matchAll(/import\s*\{([^}]*)\}\s*from\s*'react-native'/g)]
          .some((m) => /(^|[\s,])(Text|TextInput)(\s*[,}]|\s*$)/.test(m[1].replace(/type\s+\w+/g, '')));
      });
    expect(offenders).toEqual([]);
  });
});

describe('bottom sheets keep clear of the navigation bar', () => {
  const SHEETS = [
    'src/components/scoring/SubstitutionSheet.tsx',
    'src/components/scoring/TeamNameSheet.tsx',
    'src/components/scoring/TimeoutTimerSheet.tsx',
    'src/components/arbitrage/SanctionSheet.tsx',
    'src/components/arbitrage/SubstitutionRecapSheet.tsx',
    'src/components/tactical/ApplyToMatchSheet.tsx',
    'src/components/tactical/PlaybookSheet.tsx',
    'src/components/tactical/PlayerEditSheet.tsx',
    'src/components/ui/CoachMarks.tsx',
    'src/components/ui/InfoTooltip.tsx',
  ];
  it.each(SHEETS)('%s uses the bottom safe-area inset', (f) => {
    const src = read(f);
    expect(src).toMatch(/useSafeAreaInsets\(\)/);
    expect(src).toMatch(/insets\.bottom/);
  });
});

describe('TimeoutTimerSheet adapts to the screen', () => {
  it('360 dp phone: the card fits with margins', () => {
    const l = timeoutSheetLayout({ width: 360, height: 640 });
    expect(l.cardWidth).toBeLessThanOrEqual(360 - 32);
    expect(l.timerFontSize).toBeLessThanOrEqual(72);
  });

  it('very narrow (320 dp): smaller card and countdown', () => {
    const l = timeoutSheetLayout({ width: 320, height: 568 });
    expect(l.cardWidth).toBeLessThanOrEqual(288);
    expect(l.timerFontSize).toBeLessThan(72);
    expect(l.timerLineHeight).toBeGreaterThan(l.timerFontSize);
  });

  it('roomy screens keep the original 300 dp card and 72 countdown', () => {
    expect(timeoutSheetLayout({ width: 412, height: 915 })).toEqual({ cardWidth: 300, timerFontSize: 72, timerLineHeight: 80 });
  });

  it('the sheet uses it', () => {
    const src = read('src/components/scoring/TimeoutTimerSheet.tsx');
    expect(src).toMatch(/timeoutSheetLayout\(/);
    expect(src).not.toMatch(/width: 300,/);
  });
});
