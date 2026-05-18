import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TacticalTool, ArrowThickness } from '../../models/tactical';
import { palette } from '../../theme/tokens';

interface ToolBarProps {
  selectedTool: TacticalTool;
  arrowThickness: ArrowThickness;
  currentGroup: number;
  currentGroupColor: string;
  hasDrawings: boolean;
  onSelectTool: (tool: TacticalTool) => void;
  onAdvanceGroup: () => void;
  onResetGroup: () => void;
  onUndoDrawing: () => void;
  onClearAll: () => void;
  onSyncFromMatch?: () => void;
}

const TOOLS: { key: TacticalTool; icon: string; labelKey: string }[] = [
  { key: 'move', icon: '✋', labelKey: 'tactical.tools.move' },
  { key: 'arrow_curved', icon: '↝', labelKey: 'tactical.tools.tracedArrow' },
  { key: 'pencil', icon: '✏️', labelKey: 'tactical.tools.pencil' },
];

export function ToolBar({
  selectedTool,
  arrowThickness,
  currentGroup,
  currentGroupColor,
  hasDrawings,
  onSelectTool,
  onAdvanceGroup,
  onResetGroup,
  onUndoDrawing,
  onClearAll,
  onSyncFromMatch,
}: ToolBarProps) {
  const { t } = useTranslation();

  function handleClearAll() {
    Alert.alert(
      t('tactical.clearConfirm'),
      '',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: onClearAll },
      ],
      { cancelable: true }
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolsRow}
      >
        {/* Draw tool chips */}
        {TOOLS.map((tool) => {
          const active = selectedTool === tool.key;
          const label = t(tool.labelKey).split(' ')[0];
          return (
            <Pressable
              key={tool.key}
              style={[styles.toolBtn, active && styles.toolBtnActive]}
              onPress={() => onSelectTool(tool.key)}
              accessibilityLabel={t(tool.labelKey)}
              accessibilityRole="button"
            >
              <Text style={[styles.toolIcon, active && styles.toolIconActive]}>
                {tool.icon}
              </Text>
              <Text style={[styles.toolLabel, active && styles.toolLabelActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}

        {/* Undo last drawing */}
        <Pressable
          style={[styles.undoBtn, !hasDrawings && styles.undoBtnDisabled]}
          onPress={onUndoDrawing}
          disabled={!hasDrawings}
          accessibilityRole="button"
          accessibilityLabel="Undo"
        >
          <Text style={[styles.undoIcon, hasDrawings && styles.undoIconActive]}>↩</Text>
        </Pressable>

        <View style={styles.divider} />

        {/* Group cycling button — tap to advance, long-press to reset to T1 */}
        <Pressable
          style={[styles.groupBtn, { backgroundColor: currentGroupColor }]}
          onPress={onAdvanceGroup}
          onLongPress={onResetGroup}
          delayLongPress={500}
          accessibilityRole="button"
          accessibilityLabel={`T${currentGroup}`}
        >
          <Text style={styles.groupBtnText}>T{currentGroup}</Text>
        </Pressable>

        <View style={styles.divider} />

        {onSyncFromMatch !== undefined && (
          <Pressable
            style={styles.syncBtn}
            onPress={onSyncFromMatch}
            accessibilityLabel={t('tactical.syncFromMatch')}
            accessibilityRole="button"
          >
            <Text style={styles.syncBtnIcon}>🔄</Text>
            <Text style={styles.syncBtnText}>{t('tactical.syncFromMatch')}</Text>
          </Pressable>
        )}

        <Pressable
          style={styles.clearBtn}
          onPress={handleClearAll}
          accessibilityLabel={t('tactical.tools.clearAll')}
          accessibilityRole="button"
        >
          <Text style={styles.clearBtnIcon}>🧺</Text>
          <Text style={styles.clearBtnText}>{t('tactical.tools.clearAll')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.backgroundSurface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: palette.backgroundElevated,
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: palette.backgroundElevated,
    minWidth: 44,
  },
  toolBtnActive: {
    backgroundColor: palette.accentPrimary,
  },
  toolIcon: {
    fontSize: 18,
  },
  toolIconActive: {
    color: '#FFFFFF',
  },
  toolLabel: {
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    color: palette.textMuted,
    marginTop: 2,
  },
  toolLabelActive: {
    color: 'rgba(255,255,255,0.9)',
  },
  undoBtn: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoBtnDisabled: {
    opacity: 0.35,
  },
  undoIcon: {
    fontSize: 18,
    color: '#8B949E',
  },
  undoIconActive: {
    color: '#FFFFFF',
  },
  groupBtn: {
    height: 36,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  divider: {
    width: 8,
  },
  syncBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: palette.accentSecondary + '20',
    borderWidth: 1,
    borderColor: palette.accentSecondary + '50',
  },
  syncBtnIcon: { fontSize: 16 },
  syncBtnText: {
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    color: palette.accentSecondary,
    marginTop: 2,
  },
  clearBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: palette.backgroundElevated,
    borderWidth: 1,
    borderColor: palette.error + '30',
  },
  clearBtnIcon: { fontSize: 16 },
  clearBtnText: {
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    color: palette.error,
    marginTop: 2,
  },
});
