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
import { getAllPlays, savePlay, updatePlay, deletePlay } from '../../features/tactical/tacticalService';
import type { TacticalPlay, PlayerPosition, Arrow, TacticalCategory } from '../../models/tactical';
import type { MatchFormat } from '../../models/match';
import { palette } from '../../theme/tokens';

interface PlaybookSheetProps {
  visible: boolean;
  mode: 'load' | 'save';
  format: MatchFormat;
  currentPositions: PlayerPosition[];
  currentArrows: Arrow[];
  currentPlayId: string | null;
  currentPlayName: string | null;
  onLoad: (play: TacticalPlay) => void;
  onClose: () => void;
  onPlayDeleted?: (id: string) => void;
}

const CATEGORIES: { key: TacticalCategory; emoji: string }[] = [
  { key: 'reception', emoji: '🫳' },
  { key: 'attack', emoji: '💥' },
  { key: 'defense', emoji: '🛡' },
  { key: 'coverage', emoji: '⭕' },
  { key: 'serve', emoji: '🏐' },
  { key: 'custom', emoji: '✏️' },
];

export function PlaybookSheet({
  visible,
  mode,
  format,
  currentPositions,
  currentArrows,
  currentPlayId,
  currentPlayName,
  onLoad,
  onClose,
  onPlayDeleted,
}: PlaybookSheetProps) {
  const { t } = useTranslation();
  const [plays, setPlays] = useState<TacticalPlay[]>([]);
  const [saveName, setSaveName] = useState('');
  const [saveCategory, setSaveCategory] = useState<TacticalCategory>('custom');
  const [saving, setSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<'new' | 'update'>('new');

  useEffect(() => {
    if (visible) {
      getAllPlays(format)
        .then((loadedPlays) => {
          setPlays(loadedPlays);
          // Restore category after async load resolves
          if (mode === 'save' && currentPlayId) {
            const existing = loadedPlays.find((p) => p.id === currentPlayId);
            if (existing) setSaveCategory(existing.category);
          }
        })
        .catch(console.error);

      if (mode === 'save' && currentPlayId && currentPlayName) {
        setSaveName(currentPlayName);
        setSaveMode('update');
      } else {
        setSaveName('');
        setSaveMode('new');
      }
    }
  }, [visible, format, mode, currentPlayId, currentPlayName]);

  async function handleSave() {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      if (saveMode === 'update' && currentPlayId) {
        await updatePlay(currentPlayId, currentPositions, currentArrows, saveName.trim());
      } else {
        await savePlay(saveName.trim(), format, saveCategory, currentPositions, currentArrows);
      }
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert(t('common.error'), String(e));
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
          onPlayDeleted?.(play.id);
        },
      },
    ]);
  }

  function handleEdit(play: TacticalPlay) {
    // Load the play for editing
    onLoad(play);
    // Switch to save mode will happen after load
    onClose();
  }

  const defaultPlays = plays.filter((p) => p.isDefault);
  const customPlays = plays.filter((p) => !p.isDefault);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.sheetHeader}>
          <Text style={styles.title}>
            {mode === 'save'
              ? (saveMode === 'update' ? t('tactical.playbook.update') : t('tactical.playbook.save'))
              : t('tactical.playbook.load')}
          </Text>
          {mode === 'save' && currentPlayId && (
            <Pressable
              style={styles.modeToggle}
              onPress={() => setSaveMode((m) => m === 'update' ? 'new' : 'update')}
            >
              <Text style={styles.modeToggleText}>
                {saveMode === 'update' ? t('tactical.playbook.saveAsNew') : t('tactical.playbook.updateCurrent')}
              </Text>
            </Pressable>
          )}
        </View>

        {mode === 'save' ? (
          <View style={styles.saveForm}>
            <TextInput
              style={styles.input}
              value={saveName}
              onChangeText={setSaveName}
              placeholder={t('tactical.playbook.name')}
              placeholderTextColor={palette.textMuted}
              maxLength={40}
              autoFocus
            />
            {saveMode === 'new' && (
              <View style={styles.categoryRow}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.key}
                    style={[styles.catChip, saveCategory === cat.key && styles.catChipActive]}
                    onPress={() => setSaveCategory(cat.key)}
                  >
                    <Text style={styles.catEmoji}>{cat.emoji}</Text>
                    <Text style={[styles.catText, saveCategory === cat.key && styles.catTextActive]}>
                      {t(`tactical.categories.${cat.key}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable
              style={[styles.saveBtn, (!saveName.trim() || saving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!saveName.trim() || saving}
            >
              <Text style={styles.saveBtnText}>
                {saving
                  ? t('common.loading')
                  : saveMode === 'update'
                    ? '✅ ' + t('tactical.playbook.update')
                    : '💾 ' + t('common.save')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={[]}
            keyExtractor={(item) => item}
            style={styles.list}
            ListHeaderComponent={
              <>
                {customPlays.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>✏️ {t('tactical.playbook.custom')}</Text>
                    {customPlays.map((play) => (
                      <PlayRow
                        key={play.id}
                        play={play}
                        onLoad={() => { onLoad(play); onClose(); }}
                        onEdit={() => handleEdit(play)}
                        onDelete={() => handleDelete(play)}
                        t={t}
                      />
                    ))}
                    <View style={styles.sectionDivider} />
                  </>
                )}
                <Text style={styles.sectionTitle}>📚 {t('tactical.playbook.defaults')}</Text>
                {defaultPlays.map((play) => (
                  <PlayRow
                    key={play.id}
                    play={play}
                    onLoad={() => { onLoad(play); onClose(); }}
                    t={t}
                  />
                ))}
                {plays.length === 0 && (
                  <Text style={styles.emptyText}>{t('tactical.playbook.noPlays')}</Text>
                )}
              </>
            }
            renderItem={() => null}
          />
        )}
      </View>
    </Modal>
  );
}

function PlayRow({
  play,
  onLoad,
  onEdit,
  onDelete,
  t,
}: {
  play: TacticalPlay;
  onLoad: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  t: (key: string) => string;
}) {
  const catEmoji = CATEGORIES.find((c) => c.key === play.category)?.emoji ?? '📋';
  return (
    <View style={rowStyles.row}>
      <Pressable style={rowStyles.main} onPress={onLoad}>
        <Text style={rowStyles.emoji}>{catEmoji}</Text>
        <View style={rowStyles.info}>
          <Text style={rowStyles.name}>{play.name}</Text>
          <Text style={rowStyles.meta}>
            {t(`tactical.categories.${play.category}`)}
            {' · '}
            {play.arrows.length} {play.arrows.length === 1 ? t('tactical.arrows_one') : t('tactical.arrows_other')}
          </Text>
        </View>
        <Text style={rowStyles.chevron}>›</Text>
      </Pressable>
      {!play.isDefault && (
        <View style={rowStyles.actions}>
          {onEdit && (
            <Pressable style={rowStyles.actionBtn} onPress={onEdit}>
              <Text style={rowStyles.editText}>✏️</Text>
            </Pressable>
          )}
          {onDelete && (
            <Pressable style={rowStyles.actionBtn} onPress={onDelete}>
              <Text style={rowStyles.deleteText}>🗑</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 4,
    gap: 10,
  },
  emoji: { fontSize: 20, width: 28, textAlign: 'center' },
  info: { flex: 1 },
  name: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textPrimary,
  },
  meta: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: palette.textMuted,
    marginTop: 2,
  },
  chevron: { fontSize: 20, color: palette.textMuted, marginRight: 4 },
  actions: { flexDirection: 'row' },
  actionBtn: { padding: 10 },
  editText: { fontSize: 16 },
  deleteText: { fontSize: 16 },
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: palette.backgroundSurface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: '75%',
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
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: palette.textPrimary,
  },
  modeToggle: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: palette.backgroundElevated,
  },
  modeToggleText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: palette.textSecondary,
  },
  list: { maxHeight: 460 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: palette.textMuted,
    letterSpacing: 0.5,
    paddingVertical: 8,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: palette.backgroundElevated,
    marginVertical: 8,
  },
  emptyText: {
    color: palette.textMuted,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingVertical: 24,
  },
  saveForm: { gap: 12 },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: palette.backgroundElevated,
  },
  catChipActive: {
    backgroundColor: palette.accentPrimaryMuted,
    borderWidth: 1,
    borderColor: palette.accentPrimary + '50',
  },
  catEmoji: { fontSize: 13 },
  catText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: palette.textMuted,
  },
  catTextActive: { color: palette.accentPrimary },
  saveBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: palette.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
});
