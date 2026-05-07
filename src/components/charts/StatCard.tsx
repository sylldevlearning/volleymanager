import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette } from '../../theme/tokens';

interface StatCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: string;
}

export function StatCard({ label, value, suffix = '', accent = palette.textPrimary }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, { color: accent }]}>
        {value}{suffix}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: palette.backgroundElevated,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
  },
  value: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
  },
  label: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: palette.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
