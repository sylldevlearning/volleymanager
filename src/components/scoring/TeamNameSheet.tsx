import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { normalizeTeamName, TEAM_NAME_MAX_LENGTH } from '../../features/match/teamRename';
import { useThemedStyles, useAppTheme, type AppTheme } from '../../theme/useAppTheme';

interface TeamNameSheetProps {
  visible: boolean;
  /** Current name, prefilled */
  name: string;
  teamColor: string;
  onClose: () => void;
  /** Receives the normalized name */
  onSave: (name: string) => void;
}

/** Quick match: rename a team from the scoring screen (tap on its name). */
export function TeamNameSheet({ visible, name, teamColor, onClose, onSave }: TeamNameSheetProps) {
  const colors = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const [value, setValue] = useState(name);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue(name);
      setInvalid(false);
    }
  }, [visible, name]);

  function handleSave() {
    const normalized = normalizeTeamName(value);
    if (normalized === null) {
      setInvalid(true);
      return;
    }
    onSave(normalized);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common.close')} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={[styles.headerDot, { backgroundColor: teamColor }]} />
              <Text style={styles.title}>{t('referee.renameTeamTitle')}</Text>
              <Pressable
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <X size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              value={value}
              onChangeText={(v) => { setValue(v); setInvalid(false); }}
              maxLength={TEAM_NAME_MAX_LENGTH}
              autoFocus
              selectTextOnFocus
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSave}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('referee.renameTeamTitle')}
            />

            {invalid && (
              <Text style={styles.error}>{t('referee.renameTeamInvalid', { max: TEAM_NAME_MAX_LENGTH })}</Text>
            )}

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.button, styles.cancelBtn, pressed && styles.pressed]}
                onPress={onClose}
                accessibilityRole="button"
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.button, styles.saveBtn, pressed && styles.pressed]}
                onPress={handleSave}
                accessibilityRole="button"
              >
                <Text style={styles.saveText}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  kav: { width: '100%' },
  sheet: {
    backgroundColor: a.backgroundSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerDot: { width: 12, height: 12, borderRadius: 6 },
  title: { flex: 1, fontSize: 17, fontFamily: 'Inter_700Bold', color: a.textPrimary },
  closeBtn: { padding: 6 },
  input: {
    backgroundColor: a.backgroundElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: a.backgroundHover,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: a.textPrimary,
  },
  error: { fontSize: 13, fontFamily: 'Inter_500Medium', color: a.error },
  actions: { flexDirection: 'row', gap: 12 },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: { backgroundColor: a.backgroundElevated },
  saveBtn: { backgroundColor: a.fill },
  pressed: { opacity: 0.8 },
  cancelText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: a.textPrimary },
  saveText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: a.onFill },
});
