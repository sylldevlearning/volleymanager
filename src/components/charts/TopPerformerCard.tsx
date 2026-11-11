import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles, type AppTheme } from '../../theme/useAppTheme';

interface TopPerformerCardProps {
  category: string;
  playerName: string;
  playerNumber: number;
  value: string;
}

export function TopPerformerCard({
  category,
  playerName,
  playerNumber,
  value,
}: TopPerformerCardProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>#{playerNumber}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.category}>{category}</Text>
        <Text style={styles.name} numberOfLines={1}>{playerName}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: a.backgroundElevated,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: a.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: a.textPrimary,
  },
  info: { flex: 1 },
  category: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: a.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  name: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: a.textPrimary,
    marginTop: 1,
  },
  value: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: a.warning,
  },
});
