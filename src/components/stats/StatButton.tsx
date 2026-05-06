import { StyleSheet, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/settingsStore';
import { palette } from '../../theme/tokens';

type StatVariant = 'success' | 'error' | 'warning' | 'neutral';

interface StatButtonProps {
  label: string;
  emoji: string;
  variant?: StatVariant;
  count?: number;
  onPress: () => void;
}

const VARIANT_COLORS: Record<StatVariant, string> = {
  success: palette.success,
  error: palette.error,
  warning: palette.warning,
  neutral: palette.info,
};

export function StatButton({ label, emoji, variant = 'neutral', count = 0, onPress }: StatButtonProps) {
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const color = VARIANT_COLORS[variant];

  const handlePress = () => {
    if (hapticsEnabled) Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { borderColor: color + '40', backgroundColor: color + '10' },
        pressed && styles.buttonPressed,
      ]}
      onPress={handlePress}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.label, { color }]}>{label}</Text>
      {count > 0 && (
        <Text style={[styles.count, { color }]}>{count}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minWidth: 72,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  buttonPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  emoji: { fontSize: 18 },
  label: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textAlign: 'center', letterSpacing: 0.2 },
  count: { fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 2 },
});
