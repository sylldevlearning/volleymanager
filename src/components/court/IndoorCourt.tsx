import { StyleSheet, Text, View, Pressable } from 'react-native';
import Svg, { Line, Rect, Circle, Text as SvgText } from 'react-native-svg';
import { palette } from '../../theme/tokens';

interface PlayerInPosition {
  position: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  number: number;
  isLibero?: boolean;
}

interface IndoorCourtProps {
  players?: PlayerInPosition[];
  servingPosition?: number;
  onPositionPress?: (position: 1 | 2 | 3 | 4 | 5 | 6) => void;
  highlightServe?: boolean;
  width?: number;
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

export function IndoorCourt({
  players = [],
  servingPosition,
  onPositionPress,
  highlightServe = true,
  width = 300,
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

        {/* Position slots */}
        {([1, 2, 3, 4, 5, 6] as const).map((pos) => {
          const coord = POSITION_COORDS[pos];
          const cx = pad + coord.x * courtW;
          const cy = pad + coord.y * courtH;
          const player = playerMap.get(pos);
          const isServing = servingPosition === pos && highlightServe;
          const r = 22;

          return (
            <React.Fragment key={pos}>
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
                onPress={() => onPositionPress?.(pos)}
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
            </React.Fragment>
          );
        })}

        {/* Opponent side (simplified) */}
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
      </Svg>
    </View>
  );
}

// Import React for Fragment
import React from 'react';

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
});
