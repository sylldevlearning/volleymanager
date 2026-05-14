import React from 'react';
import { G, Path, Polygon } from 'react-native-svg';
import type { Arrow } from '../../models/tactical';

interface ArrowPathProps {
  arrow: Arrow;
  courtWidth: number;
  courtHeight: number;
  onPress?: () => void;
  eraserMode?: boolean;
  opacity?: number;
}

function toPixel(rel: number, size: number): number {
  return rel * size;
}

function buildSolidPath(
  fx: number, fy: number,
  tx: number, ty: number,
): string {
  return `M ${fx} ${fy} L ${tx} ${ty}`;
}

function buildCurvedPath(
  fx: number, fy: number,
  tx: number, ty: number,
  cx: number, cy: number,
): string {
  return `M ${fx} ${fy} Q ${cx} ${cy} ${tx} ${ty}`;
}

function arrowHeadPoints(
  fx: number, fy: number,
  tx: number, ty: number,
  cx?: number, cy?: number,
): string {
  // Tangent at endpoint (for curves, tangent from control point)
  const dx = cx !== undefined ? tx - cx : tx - fx;
  const dy = cy !== undefined ? ty - cy : ty - fy;
  const angle = Math.atan2(dy, dx);
  const size = 8;

  const x1 = tx - size * Math.cos(angle - Math.PI / 6);
  const y1 = ty - size * Math.sin(angle - Math.PI / 6);
  const x2 = tx - size * Math.cos(angle + Math.PI / 6);
  const y2 = ty - size * Math.sin(angle + Math.PI / 6);

  return `${tx},${ty} ${x1},${y1} ${x2},${y2}`;
}

export function ArrowPath({ arrow, courtWidth, courtHeight, onPress, eraserMode, opacity: opacityProp = 1 }: ArrowPathProps) {
  const fx = toPixel(arrow.fromX, courtWidth);
  const fy = toPixel(arrow.fromY, courtHeight);
  const tx = toPixel(arrow.toX, courtWidth);
  const ty = toPixel(arrow.toY, courtHeight);
  const cx = arrow.controlX !== undefined ? toPixel(arrow.controlX, courtWidth) : undefined;
  const cy = arrow.controlY !== undefined ? toPixel(arrow.controlY, courtHeight) : undefined;

  const strokeW = arrow.thickness === 'thick' ? 3 : 2;
  const dashArray = arrow.type === 'dashed' ? '8,5' : undefined;

  const d = arrow.type === 'curved' && cx !== undefined && cy !== undefined
    ? buildCurvedPath(fx, fy, tx, ty, cx, cy)
    : buildSolidPath(fx, fy, tx, ty);

  const headPoints = arrowHeadPoints(fx, fy, tx, ty, cx, cy);
  const opacity = eraserMode ? 0.5 : opacityProp;

  return (
    <G opacity={opacity} onPress={onPress}>
      {/* Hit area for eraser (transparent, wider) */}
      {eraserMode && (
        <Path
          d={d}
          stroke="transparent"
          strokeWidth={20}
          fill="none"
          onPress={onPress}
        />
      )}
      {/* Actual arrow line */}
      <Path
        d={d}
        stroke={arrow.color}
        strokeWidth={strokeW}
        fill="none"
        strokeDasharray={dashArray}
        strokeLinecap="round"
      />
      {/* Arrow head */}
      <Polygon
        points={headPoints}
        fill={arrow.color}
      />
    </G>
  );
}
