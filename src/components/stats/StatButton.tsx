import { StyleSheet, Pressable } from 'react-native';
import { Text } from '../ui/Text';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAppTheme } from '../../theme/useAppTheme';

type StatVariant = 'success' | 'error' | 'warning' | 'neutral';

interface StatButtonProps {
  label: string;
  emoji: string;
  variant?: StatVariant;
  count?: number;
  onPress: () => void;
}

const variantKey = { success: 'success', error: 'error', warning: 'warning', neutral: 'info' } as const;

export function StatButton({ label, emoji, variant = 'neutral', count = 0, onPress }: StatButtonProps) {
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const color = useAppTheme()[variantKey[variant]];
  // Tint and border from the same colour (error a bit stronger)
  const bg = color + (variant === 'error' ? '28' : '18');
  const border = color + (variant === 'error' ? '80' : '50');

  const handlePress = () => {
    if (hapticsEnabled) Haptics.selectionAsync();
    onPress();
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        { borderColor: border, backgroundColor: bg },
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
    minWidth: 80,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 2,
  },
  buttonPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  emoji: { fontSize: 18 },
  label: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textAlign: 'center', letterSpacing: 0.2 },
  count: { fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 2 },
});
