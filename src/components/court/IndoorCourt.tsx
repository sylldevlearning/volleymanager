import { StyleSheet, Text, View, Pressable } from 'react-native';
import Svg, { Line, Rect, Circle, Text as SvgText, G } from 'react-native-svg';
import { palette } from '../../theme/tokens';

export interface PlayerInPosition {
  position: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  number: number;
  isLibero?: boolean;
  /** The player currently marked as captain on court (registered or acting stand-in). */
  isCaptain?: boolean;
}

interface IndoorCourtProps {
  players?: PlayerInPosition[];
  servingPosition?: number;
  onPositionPress?: (position: 1 | 2 | 3 | 4 | 5 | 6) => void;
  highlightServe?: boolean;
  width?: number;
  /** Shows the shaded "ADVERSAIRE" half below the net — off when displaying two real teams side by side. */
  showOpponentHalf?: boolean;
  /** Shows the dashed 3m attack lines — off for a clean, minimal half-court (e.g. lineup entry). */
  showAttackLines?: boolean;
}

// Volleyball court positions layout (from team's perspective, facing net)
// Back row: P1(right), P6(center), P5(left)
// Front row: P2(right), P3(center), P4(left)
const POSITION_COORDS: Record<number, { x: number; y: number }> = {
  1: { x: 0.83, y: 0.75 }, // Back right
  2: { x: 0.83, y: 0.25 }, // Front right
  3: { x: 0.5, y: 0.25 },  // Front center (setter zone)
  4: { x: 0.17, y: 0.25 }, // Front left
  5: { x: 0.17, y: 0.75 }, // Back left
  6: { x: 0.5, y: 0.75 },  // Back center
};

const CIRCLE_RADIUS = 22;

export function IndoorCourt({
  players = [],
  servingPosition,
  onPositionPress,
  highlightServe = true,
  width = 300,
  showOpponentHalf = true,
  showAttackLines = true,
}: IndoorCourtProps) {
  const height = width * 0.6;
  const pad = 16;
  const courtW = width - pad * 2;
  const courtH = height - pad * 2;

  const playerMap = new Map(players.map((p) => [p.position, p]));

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        {/* Court background */}
        <Rect x={pad} y={pad} width={courtW} height={courtH} fill={palette.backgroundElevated} rx={8} />

        {/* Court lines */}
        {/* Net */}
        <Line
          x1={pad}
          y1={pad + courtH / 2}
          x2={pad + courtW}
          y2={pad + courtH / 2}
          stroke={palette.textSecondary}
          strokeWidth={2}
        />
        {/* Attack lines (3m line) */}
        {showAttackLines && (
          <>
            <Line
              x1={pad}
              y1={pad + courtH * 0.25}
              x2={pad + courtW}
              y2={pad + courtH * 0.25}
              stroke={palette.textMuted}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <Line
              x1={pad}
              y1={pad + courtH * 0.75}
              x2={pad + courtW}
              y2={pad + courtH * 0.75}
              stroke={palette.textMuted}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
          </>
        )}

        {/* Position slots (visuals only — touch handled by the Pressable overlay below) */}
        {([1, 2, 3, 4, 5, 6] as const).map((pos) => {
          const coord = POSITION_COORDS[pos];
          const cx = pad + coord.x * courtW;
          const cy = pad + coord.y * courtH;
          const player = playerMap.get(pos);
          const isServing = servingPosition === pos && highlightServe;
          const r = CIRCLE_RADIUS;

          return (
            <G key={pos}>
              <Circle
                cx={cx}
                cy={cy}
                r={r}
                fill={player
                  ? player.isLibero
                    ? palette.libero + '40'
                    : palette.accentSecondary + '30'
                  : palette.backgroundHover}
                stroke={isServing
                  ? palette.accentPrimary
                  : player
                    ? player.isLibero
                      ? palette.libero
                      : palette.accentSecondary
                    : palette.backgroundHover}
                strokeWidth={isServing ? 2.5 : 1.5}
                strokeDasharray={player?.isLibero ? '4 2' : undefined}
              />
              {player ? (
                <SvgText
                  x={cx}
                  y={cy + 1}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  fontSize={13}
                  fontWeight="700"
                  fill={palette.textPrimary}
                >
                  {player.number}
                </SvgText>
              ) : (
                <SvgText
                  x={cx}
                  y={cy + 1}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  fontSize={12}
                  fill={palette.textMuted}
                >
                  P{pos}
                </SvgText>
              )}
              {isServing && (
                <Circle cx={cx + r - 4} cy={cy - r + 4} r={5} fill={palette.accentPrimary} />
              )}
              {player?.isLibero && (
                <G>
                  <Circle cx={cx + r - 5} cy={cy - r + 5} r={7} fill="#E63946" />
                  <SvgText x={cx + r - 5} y={cy - r + 6} textAnchor="middle" alignmentBaseline="middle" fontSize={8} fontWeight="700" fill="#fff">L</SvgText>
                </G>
              )}
              {player?.isCaptain && (
                <G>
                  <Circle cx={cx - r + 5} cy={cy - r + 5} r={7} fill={palette.warning} />
                  <SvgText x={cx - r + 5} y={cy - r + 6} textAnchor="middle" alignmentBaseline="middle" fontSize={8} fontWeight="700" fill="#0D1117">C</SvgText>
                </G>
              )}
            </G>
          );
        })}

        {/* Opponent side (simplified) */}
        {showOpponentHalf && (
          <>
            <Rect
              x={pad}
              y={pad}
              width={courtW}
              height={courtH / 2 - 2}
              fill={palette.backgroundSurface}
              rx={8}
              opacity={0.5}
            />
            <SvgText
              x={pad + courtW / 2}
              y={pad + courtH / 4}
              textAnchor="middle"
              alignmentBaseline="middle"
              fontSize={12}
              fill={palette.textMuted}
            >
              ADVERSAIRE
            </SvgText>
          </>
        )}
      </Svg>

      {/* Touch overlay — plain RN Pressables for reliable single-tap hit-testing
          (SVG shape onPress can require a second tap on some devices). */}
      {onPositionPress && ([1, 2, 3, 4, 5, 6] as const).map((pos) => {
        const coord = POSITION_COORDS[pos];
        const cx = pad + coord.x * courtW;
        const cy = pad + coord.y * courtH;
        return (
          <Pressable
            key={pos}
            onPress={() => onPositionPress(pos)}
            style={[
              styles.touchTarget,
              { left: cx - CIRCLE_RADIUS, top: cy - CIRCLE_RADIUS, width: CIRCLE_RADIUS * 2, height: CIRCLE_RADIUS * 2 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`P${pos}`}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  touchTarget: {
    position: 'absolute',
    borderRadius: 999,
  },
});
