import React from 'react';
import { Pressable, StyleSheet, Text, View, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TacticalTool, ArrowThickness } from '../../models/tactical';
import { palette } from '../../theme/tokens';

interface ToolBarProps {
  selectedTool: TacticalTool;
  arrowThickness: ArrowThickness;
  onSelectTool: (tool: TacticalTool) => void;
  onClearAll: () => void;
  onSave: () => void;
  onLoad: () => void;
}

const TOOLS: { key: TacticalTool; icon: string }[] = [
  { key: 'move', icon: '✋' },
  { key: 'arrow_solid', icon: '→' },
  { key: 'arrow_dashed', icon: '⇢' },
  { key: 'arrow_curved', icon: '↝' },
  { key: 'eraser', icon: '🧹' },
];

export function ToolBar({
  selectedTool,
  arrowThickness,
  onSelectTool,
  onClearAll,
  onSave,
  onLoad,
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
      {/* Tool buttons row */}
      <View style={styles.toolsRow}>
        {TOOLS.map((tool) => {
          const active = selectedTool === tool.key;
          return (
            <Pressable
              key={tool.key}
              style={[styles.toolBtn, active && styles.toolBtnActive]}
              onPress={() => onSelectTool(tool.key)}
              accessibilityLabel={t(`tactical.tools.${camelKey(tool.key)}`)}
              accessibilityRole="button"
            >
              <Text style={[styles.toolIcon, active && styles.toolIconActive]}>
                {tool.icon}
              </Text>
            </Pressable>
          );
        })}

        <View style={styles.divider} />

        <Pressable
          style={styles.actionBtn}
          onPress={handleClearAll}
          accessibilityLabel={t('tactical.tools.clearAll')}
          accessibilityRole="button"
        >
          <Text style={styles.actionBtnText}>✕</Text>
        </Pressable>
      </View>

      {/* Playbook actions */}
      <View style={styles.playbookRow}>
        <Pressable style={styles.playbookBtn} onPress={onLoad} accessibilityRole="button">
          <Text style={styles.playbookBtnText}>📂 {t('tactical.playbook.load')}</Text>
        </Pressable>
        <Pressable style={[styles.playbookBtn, styles.playbookBtnSave]} onPress={onSave} accessibilityRole="button">
          <Text style={[styles.playbookBtnText, styles.playbookSaveText]}>💾 {t('tactical.playbook.save')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function camelKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.backgroundSurface,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: palette.backgroundElevated,
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnActive: {
    backgroundColor: palette.accentPrimary,
  },
  toolIcon: {
    fontSize: 18,
    color: palette.textSecondary,
  },
  toolIconActive: {
    color: '#FFFFFF',
  },
  divider: {
    flex: 1,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 16,
    color: palette.error,
  },
  playbookRow: {
    flexDirection: 'row',
    gap: 8,
  },
  playbookBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    backgroundColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playbookBtnSave: {
    backgroundColor: palette.accentPrimaryMuted,
    borderWidth: 1,
    borderColor: palette.accentPrimary + '40',
  },
  playbookBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: palette.textSecondary,
  },
  playbookSaveText: {
    color: palette.accentPrimary,
  },
});
