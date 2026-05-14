import React from 'react';
import { Image } from 'react-native';

const ICON = require('../../../assets/images/tactical-icon.png');

interface TacticalBoardIconProps {
  size?: number;
}

export function TacticalBoardIcon({ size = 24 }: TacticalBoardIconProps) {
  return <Image source={ICON} style={{ width: size, height: size }} resizeMode="contain" />;
}
