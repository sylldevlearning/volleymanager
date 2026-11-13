import React from 'react';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { useAppTheme } from '../../theme/useAppTheme';

export interface BarGroup {
  /** Skill name, written once under the group */
  label: string;
  /** One bar per team, side by side */
  bars: { value: number; color: string }[];
}

/**
 * Bars grouped by skill (one per team): a single label per group, so long
 * names in any language never overlap.
 */
export function GroupedBarChart({ groups, height = 130 }: { groups: BarGroup[]; height?: number }) {
  const colors = useAppTheme();
  const svgW = 300;
  const padTop = 16;
  const padBot = 22;
  const chartH = height - padTop - padBot;
  const max = Math.max(1, ...groups.flatMap((g) => g.bars.map((b) => b.value)));
  const slot = svgW / Math.max(1, groups.length);
  const barW = Math.min(30, (slot * 0.7) / Math.max(1, groups[0]?.bars.length ?? 1));

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${svgW} ${height}`} preserveAspectRatio="xMidYMid meet">
      {groups.map((group, gi) => {
        const groupW = barW * group.bars.length + 4 * (group.bars.length - 1);
        const x0 = gi * slot + (slot - groupW) / 2;
        return (
          <G key={`${group.label}-${gi}`}>
            {group.bars.map((bar, bi) => {
              const x = x0 + bi * (barW + 4);
              const barH = (bar.value / max) * chartH;
              const y = padTop + chartH - barH;
              return (
                <G key={bi}>
                  <Rect
                    x={x}
                    y={bar.value > 0 ? y : padTop + chartH - 2}
                    width={barW}
                    height={bar.value > 0 ? barH : 2}
                    fill={bar.color}
                    rx={3}
                    opacity={bar.value > 0 ? 0.85 : 0.25}
                  />
                  {bar.value > 0 && (
                    <SvgText x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={10} fill={bar.color} fontWeight="700">
                      {bar.value}
                    </SvgText>
                  )}
                </G>
              );
            })}
            <SvgText
              x={gi * slot + slot / 2}
              y={padTop + chartH + 15}
              textAnchor="middle"
              fontSize={10}
              fill={colors.textSecondary}
            >
              {group.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
