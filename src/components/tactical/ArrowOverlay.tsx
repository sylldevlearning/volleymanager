import React from 'react';
import Svg, { Path, Polygon } from 'react-native-svg';
import { ArrowPath } from './ArrowPath';
import type { Arrow, FreehandPath } from '../../models/tactical';

function computeArrowhead(d: string, color: string): React.ReactElement | null {
  const tokens = d.trim().split(/\s+/);
  const coords: number[] = [];
  for (const t of tokens) {
    const n = parseFloat(t);
    if (!isNaN(n)) coords.push(n);
  }
  if (coords.length < 4) return null;
  const tx = coords[coords.length - 2];
  const ty = coords[coords.length - 1];
  const px = coords[coords.length - 4];
  const py = coords[coords.length - 3];
  const angle = Math.atan2(ty - py, tx - px);
  const s = 10;
  const x1 = tx - s * Math.cos(angle - Math.PI / 6);
  const y1 = ty - s * Math.sin(angle - Math.PI / 6);
  const x2 = tx - s * Math.cos(angle + Math.PI / 6);
  const y2 = ty - s * Math.sin(angle + Math.PI / 6);
  return <Polygon key="ah" points={`${tx},${ty} ${x1},${y1} ${x2},${y2}`} fill={color} />;
}

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
  freehandPaths: FreehandPath[];
  courtWidth: number;
  courtHeight: number;
  eraserMode: boolean;
  drawPreview: DrawPreview | null;
  pencilPreviewD: string | null;
  pencilColor: string;
  onRemoveArrow: (id: string) => void;
}

export function ArrowOverlay({
  arrows,
  freehandPaths,
  courtWidth,
  courtHeight,
  eraserMode,
  drawPreview,
  pencilPreviewD,
  pencilColor,
  onRemoveArrow,
}: ArrowOverlayProps) {
  return (
    <Svg
      width={courtWidth}
      height={courtHeight}
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents={eraserMode ? 'auto' : 'none'}
    >
      {/* Committed freehand paths */}
      {freehandPaths.map((fp) => {
        const arrowhead = fp.hasArrow ? computeArrowhead(fp.d, fp.color) : null;
        return (
          <React.Fragment key={fp.id}>
            <Path
              d={fp.d}
              stroke={fp.color}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {arrowhead}
          </React.Fragment>
        );
      })}

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

      {/* Live pencil preview */}
      {pencilPreviewD && (
        <Path
          d={pencilPreviewD}
          stroke={pencilColor}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />
      )}

      {/* Live arrow draw preview */}
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
