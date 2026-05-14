import React from 'react';
import { Image } from 'react-native';

const BALL = require('../../../assets/images/ballon.png');

export function BallToken({ size = 32 }: { size?: number }) {
  return <Image source={BALL} style={{ width: size, height: size }} resizeMode="contain" />;
}
