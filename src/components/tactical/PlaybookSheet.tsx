import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getAllPlays, savePlay, deletePlay } from '../../features/tactical/tacticalService';
import type { TacticalPlay, PlayerPosition, Arrow, TacticalCategory } from '../../models/tactical';
import type { MatchFormat } from '../../models/match';
import { palette } from '../../theme/tokens';

interface PlaybookSheetProps {
  visible: boolean;
  mode: 'load' | 'save';
  format: MatchFormat;
  currentPositions: PlayerPosition[];
  currentArrows: Arrow[];
  onLoad: (play: TacticalPlay) => void;
  onClose: () => void;
}

const CATEGORIES: { key: TacticalCategory; label: string }[] = [
  { key: 'reception', label: 'reception' },
  { key: 'attack', label: 'attack' },
  { key: 'defense', label: 'defense' },
  { key: 'coverage', label: 'coverage' },
  { key: 'serve', label: 'serve' },
  { key: 'custom', label: 'custom' },
];

export function PlaybookSheet({
  visible,
  mode,
  format,
  currentPositions,
  currentArrows,
  onLoad,
  onClose,
}: PlaybookSheetProps) {
  const { t } = useTranslation();
  const [plays, setPlays] = useState<TacticalPlay[]>([]);
  const [saveName, setSaveName] = useState('');
  const [saveCategory, setSaveCategory] = useState<TacticalCategory>('custom');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      getAllPlays(format).then(setPlays).catch(console.error);
    }
  }, [visible, format]);

  async function handleSave() {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      const play = await savePlay(saveName.trim(), format, saveCategory, currentPositions, currentArrows);
      setSaveName('');
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(play: TacticalPlay) {
    if (play.isDefault) return;
    Alert.alert(t('tactical.playbook.deleteConfirm'), play.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deletePlay(play.id);
          setPlays((prev) => prev.filter((p) => p.id !== play.id));
        },
      },
    ]);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        <Text style={styles.title}>
          {mode === 'save' ? t('tactical.playbook.save') : t('tactical.playbook.load')}
        </Text>

        {mode === 'save' ? (
          <View style={styles.saveForm}>
            <TextInput
              style={styles.input}
              value={saveName}
              onChangeText={setSaveName}
              placeholder={t('tactical.playbook.name')}
              placeholderTextColor={palette.textMuted}
              maxLength={40}
            />
            <View style={styles.categoryRow}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.key}
                  style={[styles.catChip, saveCategory === cat.key && styles.catChipActive]}
                  onPress={() => setSaveCategory(cat.key)}
                >
                  <Text style={[styles.catText, saveCategory === cat.key && styles.catTextActive]}>
                    {t(`tactical.categories.${cat.label}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[styles.saveBtn, (!saveName.trim() || saving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!saveName.trim() || saving}
            >
              <Text style={styles.saveBtnText}>
                {saving ? t('common.loading') : t('common.save')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={plays}
            keyExtractor={(item) => item.id}
            style={styles.list}
            ListEmptyComponent={
              <Text style={styles.emptyText}>{t('tactical.playbook.noPlays')}</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.playItem}>
                <Pressable style={styles.playItemContent} onPress={() => { onLoad(item); onClose(); }}>
                  <View>
                    <Text style={styles.playName}>{item.name}</Text>
                    <Text style={styles.playCat}>
                      {t(`tactical.categories.${item.category}`)}
                      {item.isDefault ? ` · ${t('tactical.playbook.defaults')}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.playArrow}>›</Text>
                </Pressable>
                {!item.isDefault && (
                  <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </Pressable>
                )}
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: palette.backgroundSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: palette.backgroundHover,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: palette.textPrimary,
    marginBottom: 16,
  },
  list: {
    maxHeight: 400,
  },
  emptyText: {
    color: palette.textMuted,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingVertical: 24,
  },
  playItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  playItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingRight: 8,
  },
  playName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textPrimary,
  },
  playCat: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: palette.textMuted,
    marginTop: 2,
  },
  playArrow: {
    fontSize: 20,
    color: palette.textMuted,
  },
  deleteBtn: {
    padding: 10,
  },
  deleteBtnText: {
    fontSize: 16,
  },
  saveForm: {
    gap: 12,
  },
  input: {
    backgroundColor: palette.backgroundElevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    borderWidth: 1,
    borderColor: palette.backgroundHover,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: palette.backgroundElevated,
  },
  catChipActive: {
    backgroundColor: palette.accentPrimaryMuted,
    borderWidth: 1,
    borderColor: palette.accentPrimary + '50',
  },
  catText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: palette.textMuted,
  },
  catTextActive: {
    color: palette.accentPrimary,
  },
  saveBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: palette.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
});
