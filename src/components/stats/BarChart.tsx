import React from 'react';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';

interface BarItem {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarItem[];
  height?: number;
  defaultColor?: string;
  maxValue?: number;
}

export function BarChart({ data, height = 110, defaultColor = '#1D4ED8', maxValue }: BarChartProps) {
  const svgW = 280;
  const svgH = height;
  const padH = 4;
  const padBot = 28;
  const padTop = 16;
  const chartW = svgW - padH * 2;
  const chartH = svgH - padBot - padTop;

  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  const slot = chartW / data.length;
  const barW = Math.min(36, slot * 0.55);

  return (
    <Svg
      width="100%"
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {data.map((item, i) => {
        const x = padH + i * slot + (slot - barW) / 2;
        const barH = max > 0 ? (item.value / max) * chartH : 0;
        const y = padTop + chartH - barH;
        const color = item.color ?? defaultColor;

        return (
          <G key={`${item.label}-${i}`}>
            {barH > 0 ? (
              <Rect x={x} y={y} width={barW} height={barH} fill={color} rx={3} opacity={0.85} />
            ) : (
              <Rect
                x={x}
                y={padTop + chartH - 2}
                width={barW}
                height={2}
                fill={color}
                rx={1}
                opacity={0.2}
              />
            )}
            {item.value > 0 && (
              <SvgText
                x={x + barW / 2}
                y={y - 3}
                textAnchor="middle"
                fontSize={10}
                fill={color}
                fontWeight="700"
              >
                {item.value}
              </SvgText>
            )}
            <SvgText
              x={x + barW / 2}
              y={padTop + chartH + 14}
              textAnchor="middle"
              fontSize={9}
              fill="rgba(139,148,158,0.8)"
            >
              {item.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
