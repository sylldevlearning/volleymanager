import React from 'react';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';

interface CourtSVGProps {
  width: number;
  height: number;
  format: 'indoor_6v6' | 'beach_2v2';
}

// Free zone outside the court boundary lines (darker)
const FREE_ZONE = '#0D1F0D';
// Actual playing surface
const COURT_GREEN = '#1B3E1B';
const LINE_COLOR = 'rgba(255,255,255,0.65)';
const LINE_MUTED = 'rgba(255,255,255,0.28)';
const NET_COLOR = 'rgba(255,255,255,0.9)';

export function CourtSVG({ width, height, format }: CourtSVGProps) {
  // Free-zone margins: ~1m on each side of a 9×18m court → 1/11 ≈ 9% width, 1/20 = 5% height
  const padX = width * 0.09;
  const padY = height * 0.05;
  const cw = width - padX * 2;  // court width in pixels
  const ch = height - padY * 2; // court height in pixels

  // Net at vertical centre of the full SVG (always y = height/2)
  const netY = height * 0.5;

  // 3m attack lines: 3/9 = 1/3 of each half measured from net
  const homeAttackY = netY + ch / 6;  // home half goes down from net
  const awayAttackY = netY - ch / 6;  // away half goes up from net

  const cx = padX + cw / 2; // horizontal centre

  return (
    <Svg width={width} height={height}>
      {/* Free zone — full SVG background */}
      <Rect x={0} y={0} width={width} height={height} fill={FREE_ZONE} />

      {/* Playing surface */}
      <Rect x={padX} y={padY} width={cw} height={ch} fill={COURT_GREEN} />

      {/* Team zone tints */}
      <Rect x={padX} y={padY} width={cw} height={ch * 0.5 - 1} fill="rgba(230,57,70,0.06)" />
      <Rect x={padX} y={netY + 1} width={cw} height={ch * 0.5 - 1} fill="rgba(29,78,216,0.06)" />

      {/* Court boundary lines */}
      <Rect
        x={padX} y={padY} width={cw} height={ch}
        fill="none" stroke={LINE_COLOR} strokeWidth={2}
      />

      {/* Net line */}
      <Line x1={padX} y1={netY} x2={padX + cw} y2={netY} stroke={NET_COLOR} strokeWidth={3} />

      {/* Net posts */}
      <Rect x={padX - 4} y={netY - 6} width={8} height={12} fill={NET_COLOR} rx={2} />
      <Rect x={padX + cw - 4} y={netY - 6} width={8} height={12} fill={NET_COLOR} rx={2} />

      {/* 3m attack lines */}
      <Line
        x1={padX} y1={homeAttackY} x2={padX + cw} y2={homeAttackY}
        stroke={LINE_MUTED} strokeWidth={1.5} strokeDasharray="6,4"
      />
      <Line
        x1={padX} y1={awayAttackY} x2={padX + cw} y2={awayAttackY}
        stroke={LINE_MUTED} strokeWidth={1.5} strokeDasharray="6,4"
      />

      {/* Beach service zones */}
      {format === 'beach_2v2' && (
        <>
          <Rect
            x={padX + cw * 0.3} y={padY + ch * 0.91}
            width={cw * 0.4} height={ch * 0.07}
            fill="none" stroke={LINE_MUTED} strokeWidth={1}
          />
          <Rect
            x={padX + cw * 0.3} y={padY + ch * 0.02}
            width={cw * 0.4} height={ch * 0.07}
            fill="none" stroke={LINE_MUTED} strokeWidth={1}
          />
        </>
      )}

      {/* Team labels — inside court area */}
      <SvgText
        x={cx} y={padY + ch * 0.10}
        textAnchor="middle" alignmentBaseline="middle"
        fontSize={10} fill="rgba(230,57,70,0.45)"
        fontWeight="700" letterSpacing={2}
      >
        EXTÉRIEUR
      </SvgText>
      <SvgText
        x={cx} y={padY + ch * 0.90}
        textAnchor="middle" alignmentBaseline="middle"
        fontSize={10} fill="rgba(29,78,216,0.45)"
        fontWeight="700" letterSpacing={2}
      >
        DOMICILE
      </SvgText>
    </Svg>
  );
}
