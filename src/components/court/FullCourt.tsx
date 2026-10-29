import { StyleSheet, View, Pressable } from 'react-native';
import Svg, { Line, Rect, Circle, Text as SvgText, G } from 'react-native-svg';
import { palette } from '../../theme/tokens';
import type { PlayerInPosition } from './IndoorCourt';
import type { MatchFormat } from '../../models/match';
import { courtSize } from '../../features/match/formatProfile';

export interface FullCourtSide {
  players: PlayerInPosition[];
  isServing: boolean;
  onPositionPress: (position: number) => void;
  /** The team's libero jersey colour (match setup) */
  liberoColor?: string;
}

interface FullCourtProps {
  /** Team shown on the left of the net. */
  left: FullCourtSide;
  /** Team shown on the right of the net. */
  right: FullCourtSide;
  leftColor: string;
  rightColor: string;
  width: number;
  height: number;
  /** 6×6 by default */
  format?: MatchFormat;
}

// Net vertical, home/away face to face left/right. Row fractions (top/mid/bottom)
// are shared by both halves; which position occupies which row is NOT shared —
// the right half is the 180° (central) rotation of the left half, not a plain
// horizontal mirror, per the FIVB diagonal-server convention:
//   Left  — front top→bottom: IV, III, II ; back top→bottom: V, VI, I
//   Right — front top→bottom: II, III, IV ; back top→bottom: I, VI, V
export type CourtRow = 'top' | 'mid' | 'bottom';
export type CourtCol = 'front' | 'back';

const ROWS: Record<CourtRow, number> = { top: 0.17, mid: 0.5, bottom: 0.83 };
const COL_FRACTION: Record<CourtCol, number> = { back: 0.25, front: 0.75 };

const LEFT_POSITION_SLOT: Record<number, { row: CourtRow; col: CourtCol }> = {
  4: { row: 'top', col: 'front' },
  3: { row: 'mid', col: 'front' },
  2: { row: 'bottom', col: 'front' },
  5: { row: 'top', col: 'back' },
  6: { row: 'mid', col: 'back' },
  1: { row: 'bottom', col: 'back' },
};

const RIGHT_POSITION_SLOT: Record<number, { row: CourtRow; col: CourtCol }> = {
  2: { row: 'top', col: 'front' },
  3: { row: 'mid', col: 'front' },
  4: { row: 'bottom', col: 'front' },
  1: { row: 'top', col: 'back' },
  6: { row: 'mid', col: 'back' },
  5: { row: 'bottom', col: 'back' },
};

/**
 * Pure mapping from an I-VI position number to its visual (row, col) slot.
 * Depends ONLY on the position number and which side it's drawn on — never
 * on which team (home/away) occupies it, so swapping sides with the ⇄ button
 * never changes how a given position is laid out, only which team's data
 * flows into the left/right slot.
 */
export function getPositionSlot(position: 1 | 2 | 3 | 4 | 5 | 6, isLeft: boolean): { row: CourtRow; col: CourtCol } {
  return (isLeft ? LEFT_POSITION_SLOT : RIGHT_POSITION_SLOT)[position];
}

/**
 * Small courts, left half (net on the right): y from top, x from the back line
 * (0) to the net (1). The right half is the 180° rotation, as for 6×6.
 *   4×4 (FFVolley M13): front IV, III, II top→bottom, I alone at the back
 *   3×3: III and II at the front, I at the back (service order)
 *   2×2: the two players side by side, I below (service order)
 */
const SMALL_SLOTS: Record<number, Record<number, { y: number; x: number }>> = {
  4: { 4: { y: 0.17, x: 0.75 }, 3: { y: 0.5, x: 0.75 }, 2: { y: 0.83, x: 0.75 }, 1: { y: 0.5, x: 0.25 } },
  3: { 3: { y: 0.25, x: 0.72 }, 2: { y: 0.75, x: 0.72 }, 1: { y: 0.5, x: 0.28 } },
  2: { 2: { y: 0.3, x: 0.5 }, 1: { y: 0.7, x: 0.5 } },
};

/** Where a place of a small court sits: { y, x } fractions, x growing toward the net. */
export function smallCourtSlot(size: number, position: number, isLeft: boolean): { y: number; x: number } {
  const slot = SMALL_SLOTS[size][position];
  return isLeft ? slot : { y: 1 - slot.y, x: slot.x };
}

const CIRCLE_RADIUS = 20;

export function FullCourt({ left, right, leftColor, rightColor, width, height, format = 'indoor_6v6' }: FullCourtProps) {
  const pad = 10;
  const courtW = width - pad * 2;
  const courtH = height - pad * 2;
  const halfW = courtW / 2;
  const size = courtSize(format);
  const positions = Array.from({ length: size }, (_, i) => i + 1);

  function coords(position: number, isLeft: boolean) {
    let yFraction: number;
    let colFraction: number;
    if (size === 6) {
      const { row, col } = getPositionSlot(position as 1 | 2 | 3 | 4 | 5 | 6, isLeft);
      yFraction = ROWS[row];
      colFraction = COL_FRACTION[col];
    } else {
      ({ y: yFraction, x: colFraction } = smallCourtSlot(size, position, isLeft));
    }
    const y = pad + yFraction * courtH;
    // For the left half, the fraction grows toward the net (right edge of the half).
    // For the right half it's mirrored, growing toward the net (left edge of the half).
    const x = isLeft
      ? pad + colFraction * halfW
      : pad + halfW + (1 - colFraction) * halfW;
    return { x, y };
  }

  function renderSide(side: FullCourtSide, isLeft: boolean, color: string) {
    const liberoColor = side.liberoColor ?? palette.libero;
    const playerMap = new Map(side.players.map((p) => [p.position, p]));
    return positions.map((pos) => {
      const { x: cx, y: cy } = coords(pos, isLeft);
      const player = playerMap.get(pos as PlayerInPosition['position']);
      const isServing = side.isServing && pos === 1;
      const r = CIRCLE_RADIUS;
      return (
        <G key={`${isLeft ? 'l' : 'r'}-${pos}`}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            fill={player ? (player.isLibero ? liberoColor + '40' : color + '30') : palette.backgroundHover}
            stroke={isServing ? palette.accentPrimary : player ? (player.isLibero ? liberoColor : color) : palette.backgroundHover}
            strokeWidth={isServing ? 2.5 : 1.5}
            strokeDasharray={player?.isLibero ? '4 2' : undefined}
          />
          <SvgText
            x={cx} y={cy + 1} textAnchor="middle" alignmentBaseline="middle"
            fontSize={12} fontWeight="700" fill={player ? palette.textPrimary : palette.textMuted}
          >
            {player ? player.number : `P${pos}`}
          </SvgText>
          {isServing && <Circle cx={cx} cy={cy - r - 7} r={4} fill={palette.accentPrimary} />}
          {player?.isLibero && (
            <G>
              <Circle cx={cx + r - 4} cy={cy - r + 4} r={6} fill="#E63946" />
              <SvgText x={cx + r - 4} y={cy - r + 5} textAnchor="middle" alignmentBaseline="middle" fontSize={7} fontWeight="700" fill="#fff">L</SvgText>
            </G>
          )}
          {player?.isCaptain && (
            <G>
              <Circle cx={cx - r + 4} cy={cy - r + 4} r={6} fill={palette.warning} />
              <SvgText x={cx - r + 4} y={cy - r + 5} textAnchor="middle" alignmentBaseline="middle" fontSize={7} fontWeight="700" fill="#0D1117">C</SvgText>
            </G>
          )}
        </G>
      );
    });
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Rect x={pad} y={pad} width={courtW} height={courtH} fill={palette.backgroundElevated} rx={8} />
        {/* Net — vertical line down the middle */}
        <Line x1={pad + halfW} y1={pad} x2={pad + halfW} y2={pad + courtH} stroke={palette.textSecondary} strokeWidth={2} />
        {renderSide(left, true, leftColor)}
        {renderSide(right, false, rightColor)}
      </Svg>

      {/* Touch overlay — plain RN Pressables for reliable single-tap hit-testing. */}
      {positions.map((pos) => {
        const { x, y } = coords(pos, true);
        return (
          <Pressable
            key={`l-${pos}`}
            onPress={() => left.onPositionPress(pos)}
            style={[styles.touchTarget, { left: x - CIRCLE_RADIUS, top: y - CIRCLE_RADIUS, width: CIRCLE_RADIUS * 2, height: CIRCLE_RADIUS * 2 }]}
            accessibilityRole="button"
          />
        );
      })}
      {positions.map((pos) => {
        const { x, y } = coords(pos, false);
        return (
          <Pressable
            key={`r-${pos}`}
            onPress={() => right.onPositionPress(pos)}
            style={[styles.touchTarget, { left: x - CIRCLE_RADIUS, top: y - CIRCLE_RADIUS, width: CIRCLE_RADIUS * 2, height: CIRCLE_RADIUS * 2 }]}
            accessibilityRole="button"
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 12, overflow: 'hidden', position: 'relative' },
  touchTarget: { position: 'absolute', borderRadius: 999 },
});
