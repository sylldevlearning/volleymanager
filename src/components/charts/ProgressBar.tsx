import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette } from '../../theme/tokens';

interface ProgressBarProps {
  value: number;   // 0-100
  total?: number;
  count?: number;
  label?: string;
  showLabel?: boolean;
}

function barColor(value: number): string {
  if (value <= 30) return palette.error;
  if (value <= 60) return palette.warning;
  return palette.success;
}

export function ProgressBar({ value, total, count, label, showLabel = true }: ProgressBarProps) {
  const color = barColor(value);
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

const styles = StyleSheet.create({
  container: { marginVertical: 4 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pct: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  track: {
    height: 8,
    backgroundColor: palette.backgroundElevated,
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
    color: palette.textMuted,
    marginTop: 3,
  },
});
