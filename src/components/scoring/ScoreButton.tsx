import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Pencil } from 'lucide-react-native';
import { useSettingsStore } from '../../stores/settingsStore';
import { useResponsive } from '../../hooks/useResponsive';
import { ANIMATION_DURATION_SHORT } from '../../utils/constants';
import { fitScoreButton } from '../../features/match/scoreLayout';
import { useAppTheme, useThemedStyles, type AppTheme } from '../../theme/useAppTheme';

interface ScoreButtonProps {
  teamName: string;
  score: number;
  teamColor: string;
  onPress: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  /** Quick match: the team name is a button that opens the renaming sheet */
  onNamePress?: () => void;
  /** Accessibility hint of the name button */
  nameHint?: string;
  /**
   * The parent stretches this column to its full height (alignItems: 'stretch'):
   * the square then shrinks to fit it. Not for content-sized parents, where the
   * measure would depend on the square itself.
   */
  fitColumn?: boolean;
}

const DEBOUNCE_MS = 400;

export function ScoreButton({ teamName, score, teamColor, onPress, onRemove, disabled, onNamePress, nameHint, fitColumn }: ScoreButtonProps) {
  const styles = useThemedStyles(makeStyles);
  const colors = useAppTheme();
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const { scoreFontSize, scoreButtonSize } = useResponsive();
  const scale = useSharedValue(1);
  const lastPressTime = useSharedValue(0);
  const shouldFire = useSharedValue(false);
  // Column given by the screen: the square shrinks so that name, square and badges always fit
  const [column, setColumn] = useState<{ width: number; height: number } | null>(null);
  const fit = fitScoreButton(column);
  const fontSize = fit.fontSize === null ? scoreFontSize : Math.min(scoreFontSize, fit.fontSize);

  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setColumn((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function triggerHaptic() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  const gesture = Gesture.Tap()
    .enabled(!disabled)
    .onStart(() => {
      const now = Date.now();
      if (now - lastPressTime.value < DEBOUNCE_MS) {
        shouldFire.value = false;
        return;
      }
      shouldFire.value = true;
      lastPressTime.value = now;
      scale.value = withTiming(0.93, { duration: ANIMATION_DURATION_SHORT });
      if (hapticsEnabled) {
        runOnJS(triggerHaptic)();
      }
    })
    .onEnd(() => {
      if (!shouldFire.value) return;
      scale.value = withSpring(1, { damping: 12, stiffness: 180 });
      runOnJS(onPress)();
    });

  return (
    <View style={[styles.container, fit.compact && styles.containerCompact]} onLayout={fitColumn ? handleLayout : undefined}>
      {onNamePress ? (
        <Pressable
          style={styles.nameButton}
          onPress={onNamePress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityHint={nameHint}
        >
          <Text style={styles.teamName} numberOfLines={1}>
            {teamName}
          </Text>
          <Pencil size={12} color={colors.textSecondary} />
        </Pressable>
      ) : (
        <Text style={styles.teamName} numberOfLines={1}>
          {teamName}
        </Text>
      )}
      {/* GestureDetector covers only the score circle — keeps badges separate */}
      <GestureDetector gesture={gesture}>
        <Animated.View style={animatedStyle}>
          <View
            style={[
              styles.button,
              { backgroundColor: teamColor + '20', borderColor: teamColor },
              column
                ? { width: fit.size, height: fit.size }
                : { minHeight: scoreButtonSize },
            ]}
          >
            <Text
              style={[styles.score, { color: teamColor, fontSize, lineHeight: fontSize }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {score}
            </Text>
          </View>
        </Animated.View>
      </GestureDetector>
      <View style={styles.badgeRow}>
        {onRemove && (
          <Pressable
            style={[styles.minusBadge, { borderColor: teamColor }]}
            onPress={onRemove}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="-1"
          >
            <Text style={[styles.minusText, { color: teamColor }]}>-1</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.addBadge, { backgroundColor: disabled ? teamColor + '40' : teamColor }]}
          onPress={disabled ? undefined : onPress}
          accessibilityRole="button"
          accessibilityLabel="+1"
        >
          <Text style={styles.addText}>+1</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  containerCompact: { gap: 6 },
  nameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '90%',
  },
  teamName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: a.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    maxWidth: '90%',
  },
  button: {
    width: 140,
    aspectRatio: 1,
    maxWidth: 160,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontFamily: 'Inter_900Black',
    includeFontPadding: false,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  minusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: a.backgroundSurface,
  },
  minusText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
});
