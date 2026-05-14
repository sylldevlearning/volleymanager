import React from 'react';
import Svg, { Rect, Line, Circle } from 'react-native-svg';

interface TacticalBoardIconProps {
  size?: number;
  color?: string;
}

export function TacticalBoardIcon({ size = 24, color = 'currentColor' }: TacticalBoardIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="2" y="4" width="20" height="16" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
      <Line x1="12" y1="4" x2="12" y2="20" stroke={color} strokeWidth="1" opacity={0.5} />
      <Circle cx="18" cy="17" r="2.5" fill={color} opacity={0.8} />
    </Svg>
  );
}
