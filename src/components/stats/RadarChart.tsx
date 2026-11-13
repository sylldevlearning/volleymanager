import React from 'react';
import Svg, { Polygon, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useAppTheme } from '../../theme/useAppTheme';
import { angleOf, radarLayout } from './radarLayout';

interface RadarMetric {
  label: string;
  value: number; // 0-100
}

export interface RadarSeries {
  values: number[]; // 0-100, one per label
  color: string;
}

interface RadarChartProps {
  metrics: RadarMetric[];
  /** Width of the drawing; the height is the same unless given */
  size?: number;
  height?: number;
  color?: string;
  /** Several shapes on the same axes (e.g. the two teams); replaces the metrics' values */
  series?: RadarSeries[];
  fontSize?: number;
}

export function RadarChart({ metrics, size = 160, height, color = '#1D4ED8', series, fontSize = 11 }: RadarChartProps) {
  const colors = useAppTheme();
  const n = metrics.length;
  if (n < 3) return null;

  const h = height ?? size;
  const { cx, cy, r, labels } = radarLayout(metrics.map((m) => m.label), size, h, fontSize);

  function getPoint(i: number, ratio: number) {
    const a = angleOf(i, n);
    return { x: cx + ratio * r * Math.cos(a), y: cy + ratio * r * Math.sin(a) };
  }

  function polygonPoints(ratios: number[]) {
    return ratios.map((ratio, i) => {
      const p = getPoint(i, ratio);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }).join(' ');
  }

  const shapes: RadarSeries[] = series ?? [{ values: metrics.map((m) => m.value), color }];
  const ratiosOf = (values: number[]) => values.map((v) => Math.max(0, Math.min(100, v)) / 100);

  return (
    <Svg width={size} height={h}>
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <Polygon
          key={level}
          points={polygonPoints(Array(n).fill(level))}
          fill="none"
          stroke={level === 1 ? colors.textPrimary + '26' : colors.textPrimary + '10'}
          strokeWidth={level === 1 ? 1.5 : 1}
        />
      ))}

      {Array.from({ length: n }, (_, i) => {
        const p = getPoint(i, 1);
        return (
          <Line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={colors.textPrimary + '14'} strokeWidth={1} />
        );
      })}

      {shapes.map((shape, si) => (
        <React.Fragment key={si}>
          <Polygon points={polygonPoints(ratiosOf(shape.values))} fill={shape.color + '28'} stroke={shape.color} strokeWidth={2} />
          {ratiosOf(shape.values).map((ratio, i) => {
            const p = getPoint(i, ratio);
            return <Circle key={i} cx={p.x} cy={p.y} r={3} fill={shape.color} />;
          })}
        </React.Fragment>
      ))}

      {metrics.map((m, i) => (
        <SvgText
          key={i}
          x={labels[i].x}
          y={labels[i].y}
          textAnchor={labels[i].anchor}
          fontSize={fontSize}
          fill={colors.textSecondary}
        >
          {m.label}
        </SvgText>
      ))}
    </Svg>
  );
}
