import { StyleSheet, Text, Pressable } from 'react-native';
import { RotateCcw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { palette } from '../../theme/tokens';

interface UndoButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export function UndoButton({ onPress, disabled }: UndoButtonProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={t('match.undo')}
      accessibilityRole="button"
    >
      <RotateCcw size={18} color={disabled ? palette.textMuted : palette.textSecondary} />
      <Text style={[styles.text, disabled && styles.textDisabled]}>{t('match.undo')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
  },
  buttonPressed: { opacity: 0.7 },
  buttonDisabled: { opacity: 0.4 },
  text: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: palette.textSecondary,
  },
  textDisabled: { color: palette.textMuted },
});
