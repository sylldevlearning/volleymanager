import fs from 'fs';
import path from 'path';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';
import { arrowStart, nextSelection, SELECT_RADIUS_PX, tokenAt } from '../src/features/tactical/arrowSelection';
import type { PlayerPosition } from '../src/models/tactical';

const W = 300;
const H = 600;
const token = (playerId: string, x: number, y: number, isBall = false): PlayerPosition => ({
  playerId, x, y, teamId: 't', number: 1, label: playerId, isHome: true, isBall,
});
// A and B close together, the ball next to A
const positions = [token('A', 0.5, 0.5), token('B', 0.55, 0.5), token('ball', 0.45, 0.5, true), token('C', 0.2, 0.2)];

describe('selecting a player or the ball (step 1)', () => {
  it('a tap selects the closest token under the finger, ball included', () => {
    expect(tokenAt(positions, 0.5 * W, 0.5 * H, W, H)).toBe('A');
    expect(tokenAt(positions, 0.45 * W - 2, 0.5 * H, W, H)).toBe('ball');
    expect(tokenAt(positions, 0.2 * W + SELECT_RADIUS_PX - 1, 0.2 * H, W, H)).toBe('C');
  });

  it('a tap on an empty area deselects', () => {
    expect(tokenAt(positions, 0.9 * W, 0.9 * H, W, H)).toBeNull();
    expect(nextSelection('A', null)).toBeNull();
    expect(nextSelection(null, 'B')).toBe('B');
    expect(nextSelection('A', 'C')).toBe('C');
  });
});

describe('drawing the arrow (step 2)', () => {
  it('starts on the selected token, wherever the finger starts — even next to another player', () => {
    // Finger right on B, but A is selected
    expect(arrowStart(positions, 'A', 0.55 * W, 0.5 * H, W, H)).toEqual({ x: 0.5 * W, y: 0.5 * H, linkedId: 'A' });
    // The ball can be selected and moved
    expect(arrowStart(positions, 'ball', 0.9 * W, 0.9 * H, W, H)).toEqual({ x: 0.45 * W, y: 0.5 * H, linkedId: 'ball' });
  });

  it('without a selection: nothing is drawn (the board says to tap a token first)', () => {
    expect(arrowStart(positions, null, 0.2 * W, 0.2 * H, W, H)).toBeNull();
  });

  it('a selection that left the court is ignored', () => {
    expect(arrowStart(positions, 'gone', 0.2 * W, 0.2 * H, W, H)).toBeNull();
  });
});

describe('board wiring', () => {
  const board = fs.readFileSync(path.join(__dirname, '../src/components/tactical/TacticalBoard.tsx'), 'utf8');

  it('a tap selects, a drag draws from the selection, the halo shows it', () => {
    expect(board).toContain('Gesture.Tap()');
    expect(board).toContain('nextSelection(selectedTokenId, tokenAt(');
    expect(board).toContain('arrowStart(displayPositions, selectedTokenId,');
    expect(board).toContain('styles.selectionHalo');
  });

  it('the "?" and the bubble explain the two steps', () => {
    for (const dict of [fr, en]) {
      const d = dict as unknown as { help: Record<string, string>; tips: { tactical: Record<string, string> } };
      expect(d.help.tactical).toMatch(/1\..*2\./s);
      expect(d.tips.tactical.tools).toMatch(/1\..*2\./s);
    }
    expect(fr.help.tactical).toMatch(/halo/);
    expect(fr.tips.tactical.tools).toMatch(/zone vide/);
  });
});
