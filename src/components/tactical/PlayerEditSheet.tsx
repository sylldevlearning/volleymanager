import React, { useEffect, useState } from 'react';
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
import { palette } from '../../theme/tokens';
import type { PlayerPosition } from '../../models/tactical';

interface PlayerEditSheetProps {
  visible: boolean;
  player: PlayerPosition | null;
  onClose: () => void;
  onSave: (playerId: string, updates: { number: number; firstName: string; lastName: string }) => void;
}

export function PlayerEditSheet({ visible, player, onClose, onSave }: PlayerEditSheetProps) {
  const { t } = useTranslation();
  const [numberStr, setNumberStr] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (player && visible) {
      setNumberStr(String(player.number));
      setLastName((player.lastName ?? '').trim());
      setError('');
    }
  }, [player?.playerId, visible]);

  function handleSave() {
    const num = parseInt(numberStr, 10);
    if (isNaN(num) || num < 0 || num > 99) {
      setError(t('player.numberRequired'));
      return;
    }
    if (!player) return;
    onSave(player.playerId, {
      number: num,
      firstName: (player.firstName ?? '').trim(),
      lastName: lastName.trim(),
    });
    onClose();
  }

  if (!player) return null;

  const bgColor = player.isHome ? palette.teamHome : palette.teamAway;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={[styles.headerDot, { backgroundColor: bgColor }]} />
              <Text style={styles.title}>{t('player.quickEdit')}</Text>
              <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
                <X size={18} color={palette.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.fields}>
              <View style={styles.fieldNumber}>
                <Text style={styles.fieldLabel}>{t('player.numberOnly')}</Text>
                <TextInput
                  style={[styles.input, styles.inputNumber]}
                  value={numberStr}
                  onChangeText={(v) => { setNumberStr(v); setError(''); }}
                  keyboardType="number-pad"
                  maxLength={2}
                  autoFocus
                  selectTextOnFocus
                  placeholderTextColor={palette.textMuted}
                  accessibilityLabel={t('player.numberOnly')}
                />
              </View>
              <View style={styles.fieldName}>
                <Text style={styles.fieldLabel}>{t('player.namePlaceholder')}</Text>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder={t('player.namePlaceholder')}
                  placeholderTextColor={palette.textMuted}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                  accessibilityLabel="Nom"
                />
              </View>
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
              onPress={handleSave}
              accessibilityRole="button"
            >
              <Text style={styles.saveBtnText}>{t('common.save')}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  kav: { width: '100%' },
  sheet: {
    backgroundColor: palette.backgroundSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
    borderTopWidth: 1,
    borderColor: palette.backgroundElevated,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.backgroundHover,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  headerDot: { width: 10, height: 10, borderRadius: 5 },
  title: { flex: 1, fontSize: 16, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  closeBtn: { padding: 4 },
  fields: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  fieldNumber: { width: 72 },
  fieldName: { flex: 1 },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: palette.backgroundElevated,
    borderWidth: 1,
    borderColor: palette.backgroundHover,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: palette.textPrimary,
  },
  inputNumber: {
    textAlign: 'center',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  error: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: palette.error,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  saveBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: palette.accentPrimary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnPressed: { opacity: 0.85 },
  saveBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
});
