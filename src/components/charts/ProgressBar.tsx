import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { useThemedStyles, useAppTheme, type AppTheme } from '../../theme/useAppTheme';

interface ProgressBarProps {
  value: number;   // 0-100
  total?: number;
  count?: number;
  label?: string;
  showLabel?: boolean;
}

function barColor(value: number, colors: AppTheme): string {
  if (value <= 30) return colors.error;
  if (value <= 60) return colors.warning;
  return colors.success;
}

export function ProgressBar({ value, total, count, label, showLabel = true }: ProgressBarProps) {
  const styles = useThemedStyles(makeStyles);
  const color = barColor(value, useAppTheme());
  const pct = `${Math.min(100, Math.max(0, value))}%` as `${number}%`;

  return (
    <View style={styles.container}>
      {showLabel && label && (
        <View style={styles.header}>
          <Text style={styles.label}>{label}</Text>
          <Text style={[styles.pct, { color }]}>{value}%</Text>
        </View>
      )}
      <View style={styles.track}>
        <View style={[styles.bar, { width: pct, backgroundColor: color }]} />
      </View>
      {(count !== undefined || total !== undefined) && (
        <Text style={styles.sub}>
          {count !== undefined && total !== undefined
            ? `${count} / ${total}`
            : count !== undefined
            ? `${count}`
            : `/ ${total}`}
        </Text>
      )}
    </View>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  container: { marginVertical: 4 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: a.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pct: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  track: {
    height: 8,
    backgroundColor: a.backgroundElevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  sub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: a.textMuted,
    marginTop: 3,
  },
});
