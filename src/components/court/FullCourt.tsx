import { StyleSheet, View, Pressable } from 'react-native';
import Svg, { Line, Rect, Circle, Text as SvgText, G } from 'react-native-svg';
import { palette } from '../../theme/tokens';
import type { PlayerInPosition } from './IndoorCourt';

export interface FullCourtSide {
  players: PlayerInPosition[];
  isServing: boolean;
  onPositionPress: (position: 1 | 2 | 3 | 4 | 5 | 6) => void;
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

const CIRCLE_RADIUS = 20;

export function FullCourt({ left, right, leftColor, rightColor, width, height }: FullCourtProps) {
  const pad = 10;
  const courtW = width - pad * 2;
  const courtH = height - pad * 2;
  const halfW = courtW / 2;

  function coords(position: 1 | 2 | 3 | 4 | 5 | 6, isLeft: boolean) {
    const { row, col } = getPositionSlot(position, isLeft);
    const y = pad + ROWS[row] * courtH;
    const colFraction = COL_FRACTION[col];
    // For the left half, the fraction grows toward the net (right edge of the half).
    // For the right half it's mirrored, growing toward the net (left edge of the half).
    const x = isLeft
      ? pad + colFraction * halfW
      : pad + halfW + (1 - colFraction) * halfW;
    return { x, y };
  }

  function renderSide(side: FullCourtSide, isLeft: boolean, color: string) {
    const playerMap = new Map(side.players.map((p) => [p.position, p]));
    return ([1, 2, 3, 4, 5, 6] as const).map((pos) => {
      const { x: cx, y: cy } = coords(pos, isLeft);
      const player = playerMap.get(pos);
      const isServing = side.isServing && pos === 1;
      const r = CIRCLE_RADIUS;
      return (
        <G key={`${isLeft ? 'l' : 'r'}-${pos}`}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            fill={player ? (player.isLibero ? palette.libero + '40' : color + '30') : palette.backgroundHover}
            stroke={isServing ? palette.accentPrimary : player ? (player.isLibero ? palette.libero : color) : palette.backgroundHover}
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
      {([1, 2, 3, 4, 5, 6] as const).map((pos) => {
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
      {([1, 2, 3, 4, 5, 6] as const).map((pos) => {
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
