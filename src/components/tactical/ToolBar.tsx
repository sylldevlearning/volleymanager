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
              <Text style={[styles.toolLabel, active && styles.toolLabelActive]}>
                {t(`tactical.tools.${camelKey(tool.key)}`).split(' ')[0]}
              </Text>
            </Pressable>
          );
        })}

        <View style={styles.divider} />

        <Pressable
          style={styles.clearBtn}
          onPress={handleClearAll}
          accessibilityLabel={t('tactical.tools.clearAll')}
          accessibilityRole="button"
        >
          <Text style={styles.clearBtnIcon}>🧺</Text>
          <Text style={styles.clearBtnText}>{t('tactical.tools.clearAll')}</Text>
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: palette.backgroundElevated,
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  divider: {
    flex: 1,
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
