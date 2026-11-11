import React from 'react';
import Svg, { Polyline, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { useAppTheme } from '../../theme/useAppTheme';

interface LineChartPoint {
  label: string;
  value: number; // 0-100
}

interface LineChartProps {
  data: LineChartPoint[];
  color?: string;
  height?: number;
  width?: number;
}

export function LineChart({
  data,
  color = '#1D4ED8',
  height = 100,
  width = 280,
}: LineChartProps) {
  const colors = useAppTheme();
  if (data.length < 2) {
    return null;
  }

  const padL = 24;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const xStep = chartW / (data.length - 1);
  const points = data.map((d, i) => ({
    x: padL + i * xStep,
    y: padT + chartH - (Math.min(100, Math.max(0, d.value)) / 100) * chartH,
    label: d.label,
    value: d.value,
  }));

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Horizontal guide lines at 25/50/75%
  const guides = [25, 50, 75];

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {guides.map((g) => {
        const gy = padT + chartH - (g / 100) * chartH;
        return (
          <G key={g}>
            <Line
              x1={padL} y1={gy} x2={padL + chartW} y2={gy}
              stroke={colors.textPrimary + '10'}
              strokeWidth={1}
            />
            <SvgText x={padL - 2} y={gy + 3} textAnchor="end" fontSize={8} fill={colors.textMuted}>
              {g}
            </SvgText>
          </G>
        );
      })}

      <Polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {points.map((p, i) => (
        <G key={i}>
          <Circle cx={p.x} cy={p.y} r={3.5} fill={color} />
          <SvgText
            x={p.x}
            y={p.y - 7}
            textAnchor="middle"
            fontSize={9}
            fill={color}
            fontWeight="700"
          >
            {p.value}%
          </SvgText>
          <SvgText
            x={p.x}
            y={padT + chartH + 14}
            textAnchor="middle"
            fontSize={9}
            fill={colors.textSecondary}
          >
            {p.label}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}
