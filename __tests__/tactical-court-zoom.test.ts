import fs from 'fs';
import path from 'path';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';
import {
  MAX_ZOOM,
  clampPan,
  clampZoom,
  fitCourt,
  normalizePathD,
  pathPoints,
  pathToPixels,
  viewportToCourt,
} from '../src/features/tactical/courtGeometry';
import type { FreehandPath } from '../src/models/tactical';

describe('court size: all the room between the top bar and the tools, same proportions', () => {
  it('limited by the height or by the width, always twice as tall as wide', () => {
    expect(fitCourt(400, 600)).toEqual({ w: 300, h: 600 });
    expect(fitCourt(300, 900)).toEqual({ w: 300, h: 600 });
    const { w, h } = fitCourt(375, 517);
    expect(h).toBeCloseTo(w * 2);
    expect(w).toBeLessThanOrEqual(375);
    expect(h).toBeLessThanOrEqual(517);
  });

  it('never below a usable size', () => {
    expect(fitCourt(10, 10).w).toBeGreaterThanOrEqual(80);
  });
});

describe('zoom and two-finger move', () => {
  it('zoom between 1× and 4×', () => {
    expect(clampZoom(0.5)).toBe(1);
    expect(clampZoom(2.5)).toBe(2.5);
    expect(clampZoom(9)).toBe(MAX_ZOOM);
    expect(MAX_ZOOM).toBe(4);
  });

  it('the court never leaves the screen: no move at 1×, up to the zoomed edge otherwise', () => {
    expect(clampPan(50, -50, 1, 300, 600)).toEqual({ tx: 0, ty: 0 });
    expect(clampPan(500, -900, 2, 300, 600)).toEqual({ tx: 150, ty: -300 });
    expect(clampPan(40, 20, 2, 300, 600)).toEqual({ tx: 40, ty: 20 });
  });

  it('a touch on the zoomed court lands on the right spot of the court', () => {
    const view = { scale: 1, tx: 0, ty: 0 };
    expect(viewportToCourt(120, 300, view, 300, 600)).toEqual({ x: 120, y: 300 });
    // 2× on the centre: the centre stays, the rest gets closer to it
    const zoomed = { scale: 2, tx: 0, ty: 0 };
    expect(viewportToCourt(150, 300, zoomed, 300, 600)).toEqual({ x: 150, y: 300 });
    expect(viewportToCourt(250, 300, zoomed, 300, 600)).toEqual({ x: 200, y: 300 });
    // Moved by 100 px to the right: what was at x=100 is now under the finger at 150
    expect(viewportToCourt(150, 300, { scale: 2, tx: 100, ty: 0 }, 300, 600)).toEqual({ x: 100, y: 300 });
  });
});

describe('drawings follow the court, saved diagrams do not change', () => {
  const legacy = { w: 150, h: 300 };

  it('new drawings are kept relative to the court (0..1)', () => {
    expect(normalizePathD('M 30 60 L 150 300', 300, 600)).toBe('M 0.1000 0.1000 L 0.5000 0.5000');
  });

  it('a new drawing is drawn at the same place of the court whatever its size', () => {
    const fp: FreehandPath = { id: 'a', d: 'M 0.1000 0.1000 L 0.5000 0.5000', color: '#fff', unit: 'court' };
    expect(pathToPixels(fp, 300, 600, legacy)).toBe('M 30.0 60.0 L 150.0 300.0');
    expect(pathToPixels(fp, 600, 1200, legacy)).toBe('M 60.0 120.0 L 300.0 600.0');
    expect(pathPoints(fp, legacy)).toEqual([{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }]);
  });

  it('an older drawing (court pixels) is scaled from the court it was drawn on', () => {
    const old: FreehandPath = { id: 'b', d: 'M 15 30 L 75 150', color: '#fff' };
    expect(pathPoints(old, legacy)).toEqual([{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }]);
    expect(pathToPixels(old, 300, 600, legacy)).toBe('M 30.0 60.0 L 150.0 300.0');
  });
});

describe('board wiring', () => {
  const board = fs.readFileSync(path.join(__dirname, '../src/components/tactical/TacticalBoard.tsx'), 'utf8');
  const token = fs.readFileSync(path.join(__dirname, '../src/components/tactical/PlayerToken.tsx'), 'utf8');

  it('the court is measured and fitted, not estimated', () => {
    expect(board).toContain('fitCourt(courtArea.w, courtArea.h)');
    expect(board).toContain('onLayout={(e) => setCourtArea(');
  });

  it('pinch to zoom, two fingers to move, double tap back to normal', () => {
    expect(board).toContain('Gesture.Pinch()');
    expect(board).toContain('.minPointers(2)');
    expect(board).toContain('.numberOfTaps(2)');
    // One-finger gestures leave two-finger touches to the zoom
    expect(board.match(/\.maxPointers\(1\)/g)!.length).toBeGreaterThanOrEqual(3);
    expect(token).toContain('.maxPointers(1)');
  });

  it('a substitute dropped from the bench lands on the right spot of the zoomed court', () => {
    // Gestures inside the court get court coordinates from the gesture handler;
    // the bench is outside the zoom, so its drop is converted
    expect(board).toContain('viewportToCourt(');
  });

  it('drawings are stored relative to the court and drawn at its size', () => {
    expect(board).toContain("normalizePathD(buildPathD(pts), courtW, courtH)");
    expect(board).toContain('pathToPixels(');
  });

  it('drawing without a selection does nothing but say so', () => {
    expect(board).toContain("t('tactical.selectFirst')");
    expect(fr.tactical.selectFirst).toBe('Touchez d\'abord un joueur ou le ballon');
    expect(en.tactical.selectFirst).toBeTruthy();
  });

  it('the "?" mentions the zoom', () => {
    expect(fr.help.tactical).toMatch(/pincez/i);
    expect(fr.help.tactical).toMatch(/double tap/i);
    expect(en.help.tactical).toMatch(/pinch/i);
  });
});
