import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Text } from './Text';
import { AlertTriangle } from 'lucide-react-native';
import { useThemedStyles, useAppTheme, type AppTheme } from '../../theme/useAppTheme';

const VISIBLE_MS = 3500;

interface WarningBannerProps {
  /** Text to show; a new `id` shows it again even with the same text */
  message: { id: number; text: string } | null;
  onHidden: () => void;
}

/** Short warning at the top of the screen — never blocks the touches underneath. */
export function WarningBanner({ message, onHidden }: WarningBannerProps) {
  const colors = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => onHidden());
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!message) return null;
  return (
    <Animated.View
      style={[styles.banner, { opacity }]}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <AlertTriangle size={16} color={colors.warning} />
      <Text style={styles.text}>{message.text}</Text>
    </Animated.View>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    zIndex: 50,
    elevation: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: a.backgroundElevated,
    borderWidth: 1,
    borderColor: a.warning + '60',
  },
  text: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', color: a.textPrimary },
});
