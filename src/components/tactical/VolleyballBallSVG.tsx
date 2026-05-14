import React from 'react';
import Svg, { Circle, Path, ClipPath, Defs, G } from 'react-native-svg';

interface VolleyballBallSVGProps {
  size: number;
}

/** Stylised Mikasa-style volleyball: white sphere with 3 blue/yellow curved bands */
export function VolleyballBallSVG({ size }: VolleyballBallSVGProps) {
  const r = size / 2;
  const cx = r;
  const cy = r;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <ClipPath id="ballClip">
          <Circle cx={cx} cy={cy} r={r - 1} />
        </ClipPath>
      </Defs>

      {/* White base ball */}
      <Circle cx={cx} cy={cy} r={r - 1} fill="#FFFFFF" />

      {/* Blue band — horizontal arc */}
      <G clipPath="url(#ballClip)">
        <Path
          d={`M ${cx - r} ${cy - r * 0.05} Q ${cx} ${cy - r * 0.55} ${cx + r} ${cy - r * 0.05}`}
          fill="none"
          stroke="#1D4ED8"
          strokeWidth={r * 0.28}
          strokeLinecap="round"
        />
        {/* Yellow band — left diagonal */}
        <Path
          d={`M ${cx - r * 0.1} ${cy + r} Q ${cx - r * 0.6} ${cy} ${cx - r * 0.1} ${cy - r}`}
          fill="none"
          stroke="#F59E0B"
          strokeWidth={r * 0.22}
          strokeLinecap="round"
        />
        {/* Blue band — right diagonal */}
        <Path
          d={`M ${cx + r * 0.1} ${cy - r} Q ${cx + r * 0.6} ${cy} ${cx + r * 0.1} ${cy + r}`}
          fill="none"
          stroke="#1D4ED8"
          strokeWidth={r * 0.18}
          strokeLinecap="round"
        />
      </G>

      {/* Outer border */}
      <Circle cx={cx} cy={cy} r={r - 1} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />
    </Svg>
  );
}
