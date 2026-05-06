import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../../theme/tokens';

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
  const slots = Array.from({ length: maxSets }, (_, i) => i + 1);

  return (
    <View style={styles.container}>
      {slots.map((setNum) => {
        const isFinished = setNum < currentSetNumber;
        const isCurrent = setNum === currentSetNumber;
        const score = setScores[setNum - 1];

        return (
          <View
            key={setNum}
            style={[
              styles.setSlot,
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  setSlot: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    minWidth: 52,
  },
  setSlotActive: {
    borderColor: palette.accentPrimary,
    backgroundColor: palette.accentPrimaryMuted,
  },
  setSlotFinished: {
    borderColor: palette.backgroundHover,
  },
  setLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  setScore: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textSecondary,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.accentPrimary,
    marginTop: 2,
  },
  dash: {
    fontSize: 12,
    color: palette.textMuted,
  },
});
