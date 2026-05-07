import React from 'react';
import Svg, { Rect, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';

interface CourtSVGProps {
  width: number;
  height: number;
  format: 'indoor_6v6' | 'beach_2v2';
}

const COURT_GREEN = '#1A3A1A';
const LINE_COLOR = 'rgba(255,255,255,0.6)';
const LINE_MUTED = 'rgba(255,255,255,0.25)';
const NET_COLOR = 'rgba(255,255,255,0.85)';

export function CourtSVG({ width, height, format }: CourtSVGProps) {
  const pad = 8;
  const w = width - pad * 2;
  const h = height - pad * 2;

  // Key y-positions (relative to court area starting at pad)
  const netY = pad + h * 0.5;
  const homeAttackY = pad + h * 0.75;
  const awayAttackY = pad + h * 0.25;

  return (
    <Svg width={width} height={height}>
      {/* Court background */}
      <Rect
        x={pad} y={pad} width={w} height={h}
        fill={COURT_GREEN}
        rx={8}
      />

      {/* Team zones subtle tint */}
      <Rect
        x={pad} y={pad} width={w} height={h * 0.5 - 1}
        fill="rgba(230,57,70,0.06)"
        rx={4}
      />
      <Rect
        x={pad} y={netY + 1} width={w} height={h * 0.5 - 1}
        fill="rgba(29,78,216,0.06)"
        rx={4}
      />

      {/* Outer boundary */}
      <Rect
        x={pad} y={pad} width={w} height={h}
        fill="none"
        stroke={LINE_COLOR}
        strokeWidth={2}
        rx={8}
      />

      {/* Net line */}
      <Line x1={pad} y1={netY} x2={pad + w} y2={netY} stroke={NET_COLOR} strokeWidth={3} />

      {/* Net posts */}
      <Rect x={pad - 4} y={netY - 6} width={8} height={12} fill={NET_COLOR} rx={2} />
      <Rect x={pad + w - 4} y={netY - 6} width={8} height={12} fill={NET_COLOR} rx={2} />

      {/* Attack lines */}
      <Line
        x1={pad} y1={homeAttackY} x2={pad + w} y2={homeAttackY}
        stroke={LINE_MUTED} strokeWidth={1.5} strokeDasharray="6,4"
      />
      <Line
        x1={pad} y1={awayAttackY} x2={pad + w} y2={awayAttackY}
        stroke={LINE_MUTED} strokeWidth={1.5} strokeDasharray="6,4"
      />

      {/* Service zones (beach only: small boxes at back) */}
      {format === 'beach_2v2' && (
        <>
          <Rect
            x={pad + w * 0.3} y={pad + h * 0.91}
            width={w * 0.4} height={h * 0.07}
            fill="none" stroke={LINE_MUTED} strokeWidth={1}
          />
          <Rect
            x={pad + w * 0.3} y={pad + h * 0.02}
            width={w * 0.4} height={h * 0.07}
            fill="none" stroke={LINE_MUTED} strokeWidth={1}
          />
        </>
      )}

      {/* Team labels */}
      <SvgText
        x={pad + w / 2} y={pad + h * 0.12}
        textAnchor="middle" alignmentBaseline="middle"
        fontSize={10} fill="rgba(230,57,70,0.5)"
        fontWeight="700" letterSpacing={2}
      >
        EXTÉRIEUR
      </SvgText>
      <SvgText
        x={pad + w / 2} y={pad + h * 0.88}
        textAnchor="middle" alignmentBaseline="middle"
        fontSize={10} fill="rgba(29,78,216,0.5)"
        fontWeight="700" letterSpacing={2}
      >
        DOMICILE
      </SvgText>
    </Svg>
  );
}
