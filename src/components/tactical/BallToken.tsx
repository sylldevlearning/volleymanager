import React from 'react';
import { VolleyballBallSVG } from './VolleyballBallSVG';

// Custom ball image:
// Drop assets/images/volleyball.png (or .svg) in the project to use it automatically.
// When the file is present, replace the export below with:
//
//   import { Image } from 'react-native';
//   let customBall: number | null = null;
//   try { customBall = require('../../../assets/images/volleyball.png'); } catch { }
//   export function BallToken({ size = 32 }: { size?: number }) {
//     if (customBall) return <Image source={customBall} style={{ width: size, height: size }} />;
//     return <VolleyballBallSVG size={size} />;
//   }

export function BallToken({ size = 32 }: { size?: number }) {
  return <VolleyballBallSVG size={size} />;
}
