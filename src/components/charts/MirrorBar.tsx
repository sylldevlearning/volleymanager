import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette } from '../../theme/tokens';

interface MirrorBarProps {
  label: string;
  homeValue: number;  // 0-100
  awayValue: number;  // 0-100
  homeColor?: string;
  awayColor?: string;
}

export function MirrorBar({
  label,
  homeValue,
  awayValue,
  homeColor = palette.teamHome,
  awayColor = palette.teamAway,
}: MirrorBarProps) {
  const homeW = `${Math.min(100, homeValue)}%` as `${number}%`;
  const awayW = `${Math.min(100, awayValue)}%` as `${number}%`;

  return (
    <View style={styles.row}>
      {/* Home side */}
      <View style={styles.homeSection}>
        <Text style={[styles.value, { color: homeColor }]}>{homeValue}%</Text>
        <View style={styles.homeTrack}>
          <View style={[styles.homeBar, { width: homeW, backgroundColor: homeColor }]} />
        </View>
      </View>

      {/* Label */}
      <Text style={styles.label} numberOfLines={1}>{label}</Text>

      {/* Away side */}
      <View style={styles.awaySection}>
        <View style={styles.awayTrack}>
          <View style={[styles.awayBar, { width: awayW, backgroundColor: awayColor }]} />
        </View>
        <Text style={[styles.value, { color: awayColor }]}>{awayValue}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    gap: 8,
  },
  homeSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
  },
  awaySection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  homeTrack: {
    flex: 1,
    height: 8,
    backgroundColor: palette.backgroundElevated,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  homeBar: {
    height: '100%',
    borderRadius: 4,
  },
  awayTrack: {
    flex: 1,
    height: 8,
    backgroundColor: palette.backgroundElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  awayBar: {
    height: '100%',
    borderRadius: 4,
  },
  label: {
    width: 72,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    minWidth: 32,
    textAlign: 'center',
  },
});
