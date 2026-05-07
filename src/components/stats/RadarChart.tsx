import React from 'react';
import Svg, { Polygon, Circle, Line, Text as SvgText } from 'react-native-svg';

interface RadarMetric {
  label: string;
  value: number; // 0-100
}

interface RadarChartProps {
  metrics: RadarMetric[];
  size?: number;
  color?: string;
}

export function RadarChart({ metrics, size = 160, color = '#1D4ED8' }: RadarChartProps) {
  const n = metrics.length;
  if (n < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 28;

  function getAngle(i: number) {
    return (2 * Math.PI * i) / n - Math.PI / 2;
  }

  function getPoint(i: number, ratio: number) {
    const a = getAngle(i);
    return { x: cx + ratio * r * Math.cos(a), y: cy + ratio * r * Math.sin(a) };
  }

  function polygonPoints(ratio: number) {
    return Array.from({ length: n }, (_, i) => {
      const p = getPoint(i, ratio);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }).join(' ');
  }

  const dataPoints = metrics
    .map((m, i) => {
      const ratio = Math.max(0, Math.min(100, m.value)) / 100;
      const p = getPoint(i, ratio);
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <Svg width={size} height={size}>
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <Polygon
          key={level}
          points={polygonPoints(level)}
          fill="none"
          stroke={level === 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}
          strokeWidth={level === 1 ? 1.5 : 1}
        />
      ))}

      {Array.from({ length: n }, (_, i) => {
        const p = getPoint(i, 1);
        return (
          <Line
            key={i}
            x1={cx} y1={cy}
            x2={p.x} y2={p.y}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
        );
      })}

      <Polygon points={dataPoints} fill={color + '28'} stroke={color} strokeWidth={2} />

      {metrics.map((m, i) => {
        const ratio = Math.max(0, Math.min(100, m.value)) / 100;
        const p = getPoint(i, ratio);
        return <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />;
      })}

      {metrics.map((m, i) => {
        const p = getPoint(i, 1.42);
        const a = getAngle(i);
        const anchor =
          Math.abs(Math.cos(a)) < 0.1 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
        return (
          <SvgText
            key={i}
            x={p.x}
            y={p.y}
            textAnchor={anchor}
            fontSize={9}
            fill="rgba(139,148,158,0.9)"
          >
            {m.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}
