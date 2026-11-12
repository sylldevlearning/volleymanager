/**
 * Small screens (Galaxy S7, 5.1", 360 × 640 dp) — quick match scoring screen.
 *
 * Tester reports on 1.0.1: the service bar hid the "+1" buttons, after the
 * first point the set tabs overlapped the scores, the "+" and "−" signs were
 * hidden, and the bottom-right button was cut off.
 */
import fs from 'fs';
import path from 'path';
import {
  SCORE_BUTTON_MAX,
  SCORE_BUTTON_MIN,
  fitScoreButton,
  scoreButtonOverhead,
} from '../src/features/match/scoreLayout';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

/** Space left to one team's column on a Galaxy S7 once the point attribution panel is open */
const S7_COLUMN = { width: 128, height: 156 };

describe('fitScoreButton — the score square fits its column', () => {
  it('keeps the full size on a roomy screen', () => {
    const fit = fitScoreButton({ width: 180, height: 420 });
    expect(fit.size).toBe(SCORE_BUTTON_MAX);
    expect(fit.compact).toBe(false);
  });

  it('Galaxy S7 with the attribution panel open: square, +1 and −1 all inside the column', () => {
    const fit = fitScoreButton(S7_COLUMN);
    expect(fit.size).toBeLessThanOrEqual(S7_COLUMN.width);
    expect(fit.size + scoreButtonOverhead(fit.compact)).toBeLessThanOrEqual(S7_COLUMN.height);
    expect(fit.size).toBeGreaterThanOrEqual(SCORE_BUTTON_MIN);
  });

  it('never wider than the column (two columns + separator on 360 dp)', () => {
    expect(fitScoreButton({ width: 120, height: 600 }).size).toBeLessThanOrEqual(120);
  });

  it.each([
    [140, 160], [128, 200], [150, 240], [128, 130], [100, 150],
  ])('column %i × %i: everything fits whenever it can', (width, height) => {
    const fit = fitScoreButton({ width, height });
    const needed = fit.size + scoreButtonOverhead(fit.compact);
    if (height >= SCORE_BUTTON_MIN + scoreButtonOverhead(true)) {
      expect(needed).toBeLessThanOrEqual(height);
    }
    expect(fit.size).toBeLessThanOrEqual(Math.max(SCORE_BUTTON_MIN, width));
  });

  it('never smaller than the minimum touch size', () => {
    expect(fitScoreButton({ width: 40, height: 40 }).size).toBe(SCORE_BUTTON_MIN);
  });

  it('the score digits stay inside the square', () => {
    for (const h of [130, 156, 220, 420]) {
      const fit = fitScoreButton({ width: 140, height: h });
      expect(fit.fontSize).toBeLessThanOrEqual(Math.round(fit.size * 0.6));
    }
  });

  it('is unchanged until the column is measured', () => {
    expect(fitScoreButton(null)).toEqual({ size: SCORE_BUTTON_MAX, fontSize: null, compact: false });
  });
});

describe('ScoreButton — sizes itself from its column', () => {
  const src = read('src/components/scoring/ScoreButton.tsx');

  it('measures its column and uses fitScoreButton', () => {
    expect(src).toMatch(/onLayout=/);
    expect(src).toMatch(/fitScoreButton\(/);
  });

  it('the +1 and −1 badges stay in the same column as the square', () => {
    expect(src).toMatch(/accessibilityLabel="\+1"/);
    expect(src).toMatch(/accessibilityLabel="-1"/);
  });
});

describe('Quick match scoring screen (referee.tsx)', () => {
  const src = read('app/match/[id]/referee.tsx');

  it('the score area gives each column its whole height and never spills over its neighbours', () => {
    const block = src.match(/scoreArea: \{[^}]*\}/)?.[0] ?? '';
    expect(block).toMatch(/alignItems: 'stretch'/);
    expect(block).toMatch(/overflow: 'hidden'/);
  });

  it('both score buttons fit their column', () => {
    expect(src.match(/<ScoreButton\s+fitColumn\s/g)).toHaveLength(2);
  });

  it('bottom actions are a fixed bar, not a horizontal scroll that pushes "End match" off-screen', () => {
    expect(src).not.toMatch(/<ScrollView\s+horizontal[\s\S]{0,200}actionsRow/);
    expect(src).toMatch(/label=\{t\('arbitrage\.actionEnd'\)\}/);
    expect(src).toMatch(/label=\{t\('referee\.actionTactical'\)\}/);
  });
});

describe('Set tabs on narrow screens', () => {
  it('SetTracker has a compact style for screens under 370 dp', () => {
    const src = read('src/components/scoring/SetTracker.tsx');
    expect(src).toMatch(/useResponsive\(\)/);
    expect(src).toMatch(/setSlotCompact/);
  });
});
