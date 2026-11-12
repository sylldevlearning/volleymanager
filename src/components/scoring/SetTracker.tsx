import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles, type AppTheme } from '../../theme/useAppTheme';
import { useResponsive } from '../../hooks/useResponsive';

interface SetScore {
  home: number;
  away: number;
}

interface SetTrackerProps {
  setScores: SetScore[];
  currentSetNumber: number;
  maxSets: number;
}

export function SetTracker({ setScores, currentSetNumber, maxSets }: SetTrackerProps) {
  const styles = useThemedStyles(makeStyles);
  // Under 370 dp (Galaxy S7…) five tabs plus the help button no longer fit at full width
  const { isSmall } = useResponsive();
  const slots = Array.from({ length: maxSets }, (_, i) => i + 1);

  return (
    <View style={[styles.container, isSmall && styles.containerCompact]}>
      {slots.map((setNum) => {
        const isFinished = setNum < currentSetNumber;
        const isCurrent = setNum === currentSetNumber;
        const score = setScores[setNum - 1];

        return (
          <View
            key={setNum}
            style={[
              styles.setSlot,
              isSmall && styles.setSlotCompact,
              isCurrent && styles.setSlotActive,
              isFinished && styles.setSlotFinished,
            ]}
          >
            <Text style={styles.setLabel}>S{setNum}</Text>
            {isFinished && score ? (
              <Text style={styles.setScore}>{score.home}-{score.away}</Text>
            ) : isCurrent ? (
              <View style={styles.dot} />
            ) : (
              <Text style={styles.dash}>—</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  containerCompact: { gap: 4, paddingHorizontal: 8 },
  setSlotCompact: { minWidth: 44, paddingHorizontal: 6 },
  setSlot: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: a.backgroundSurface,
    borderWidth: 1,
    borderColor: a.backgroundElevated,
    minWidth: 52,
  },
  setSlotActive: {
    borderColor: a.color,
    backgroundColor: a.muted,
  },
  setSlotFinished: {
    borderColor: a.backgroundHover,
  },
  setLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: a.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  setScore: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: a.textSecondary,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: a.fill,
    marginTop: 2,
  },
  dash: {
    fontSize: 12,
    color: a.textMuted,
  },
});
