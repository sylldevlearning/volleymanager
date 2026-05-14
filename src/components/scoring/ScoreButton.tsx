import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/settingsStore';
import { useResponsive } from '../../hooks/useResponsive';
import { ANIMATION_DURATION_SHORT } from '../../utils/constants';
import { palette } from '../../theme/tokens';

interface ScoreButtonProps {
  teamName: string;
  score: number;
  teamColor: string;
  onPress: () => void;
  onRemove?: () => void;
  disabled?: boolean;
}

const DEBOUNCE_MS = 400;

export function ScoreButton({ teamName, score, teamColor, onPress, onRemove, disabled }: ScoreButtonProps) {
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const { scoreFontSize, scoreButtonSize } = useResponsive();
  const scale = useSharedValue(1);
  const lastPressTime = useSharedValue(0);

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
      if (now - lastPressTime.value < DEBOUNCE_MS) return;
      lastPressTime.value = now;

      scale.value = withTiming(0.93, { duration: ANIMATION_DURATION_SHORT });
      if (hapticsEnabled) {
        runOnJS(triggerHaptic)();
      }
    })
    .onEnd(() => {
      scale.value = withSpring(1, { damping: 12, stiffness: 180 });
      runOnJS(onPress)();
    });

  return (
    <View style={styles.container}>
      <Text style={styles.teamName} numberOfLines={1}>
        {teamName}
      </Text>
      {/* GestureDetector covers only the score circle — keeps -1 Pressable separate */}
      <GestureDetector gesture={gesture}>
        <Animated.View style={animatedStyle}>
          <View style={[styles.button, { backgroundColor: teamColor + '20', borderColor: teamColor, minHeight: scoreButtonSize }]}>
            <Text style={[styles.score, { color: teamColor, fontSize: scoreFontSize, lineHeight: scoreFontSize }]}>{score}</Text>
          </View>
        </Animated.View>
      </GestureDetector>
      <View style={styles.badgeRow}>
        {onRemove && (
          <Pressable
            style={[styles.minusBadge, { borderColor: teamColor }]}
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel="-1"
          >
            <Text style={[styles.minusText, { color: teamColor }]}>-1</Text>
          </Pressable>
        )}
        <View style={[styles.addBadge, { backgroundColor: teamColor }]}>
          <Text style={styles.addText}>+1</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  teamName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#8B949E',
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
    backgroundColor: palette.backgroundSurface,
  },
  minusText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
});
