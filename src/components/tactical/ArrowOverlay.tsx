import React from 'react';
import Svg, { Path, Polygon } from 'react-native-svg';
import { ArrowPath } from './ArrowPath';
import type { Arrow } from '../../models/tactical';

interface DrawPreview {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  type: 'solid' | 'dashed' | 'curved';
}

interface ArrowOverlayProps {
  arrows: Arrow[];
  courtWidth: number;
  courtHeight: number;
  eraserMode: boolean;
  drawPreview: DrawPreview | null;
  onRemoveArrow: (id: string) => void;
}

export function ArrowOverlay({
  arrows,
  courtWidth,
  courtHeight,
  eraserMode,
  drawPreview,
  onRemoveArrow,
}: ArrowOverlayProps) {
  return (
    <Svg
      width={courtWidth}
      height={courtHeight}
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents={eraserMode ? 'auto' : 'none'}
    >
      {arrows.map((arrow) => (
        <ArrowPath
          key={arrow.id}
          arrow={arrow}
          courtWidth={courtWidth}
          courtHeight={courtHeight}
          eraserMode={eraserMode}
          onPress={eraserMode ? () => onRemoveArrow(arrow.id) : undefined}
        />
      ))}

      {/* Live draw preview */}
      {drawPreview && (
        <>
          <Path
            d={`M ${drawPreview.fromX} ${drawPreview.fromY} L ${drawPreview.toX} ${drawPreview.toY}`}
            stroke={drawPreview.color}
            strokeWidth={2}
            fill="none"
            opacity={0.6}
            strokeDasharray={drawPreview.type === 'dashed' ? '8,5' : undefined}
            strokeLinecap="round"
          />
          <Polygon
            points={(() => {
              const dx = drawPreview.toX - drawPreview.fromX;
              const dy = drawPreview.toY - drawPreview.fromY;
              const angle = Math.atan2(dy, dx);
              const s = 8;
              const x1 = drawPreview.toX - s * Math.cos(angle - Math.PI / 6);
              const y1 = drawPreview.toY - s * Math.sin(angle - Math.PI / 6);
              const x2 = drawPreview.toX - s * Math.cos(angle + Math.PI / 6);
              const y2 = drawPreview.toY - s * Math.sin(angle + Math.PI / 6);
              return `${drawPreview.toX},${drawPreview.toY} ${x1},${y1} ${x2},${y2}`;
            })()}
            fill={drawPreview.color}
            opacity={0.6}
          />
        </>
      )}
    </Svg>
  );
}
