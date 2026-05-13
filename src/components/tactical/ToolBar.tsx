import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TacticalTool, ArrowThickness } from '../../models/tactical';
import { palette } from '../../theme/tokens';

interface ToolBarProps {
  selectedTool: TacticalTool;
  arrowThickness: ArrowThickness;
  groupMode: boolean;
  currentGroup: number;
  onSelectTool: (tool: TacticalTool) => void;
  onToggleGroupMode: () => void;
  onClearAll: () => void;
}

// Only 3 tools exposed: move, traced arrow (arrow_curved), pencil
const TOOLS: { key: TacticalTool; icon: string; labelKey: string }[] = [
  { key: 'move', icon: '✋', labelKey: 'tactical.tools.move' },
  { key: 'arrow_curved', icon: '↝', labelKey: 'tactical.tools.tracedArrow' },
  { key: 'pencil', icon: '✏️', labelKey: 'tactical.tools.pencil' },
];

export function ToolBar({
  selectedTool,
  arrowThickness,
  groupMode,
  currentGroup,
  onSelectTool,
  onToggleGroupMode,
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

  const linkLabel = groupMode
    ? t('tactical.tools.linkActive', { number: currentGroup })
    : t('tactical.tools.link');

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toolsRow}
      >
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

        <Pressable
          style={[styles.toolBtn, groupMode && styles.toolBtnGroupActive]}
          onPress={onToggleGroupMode}
          accessibilityLabel={linkLabel}
          accessibilityRole="button"
        >
          <Text style={[styles.toolLabel, styles.linkLabel, groupMode && styles.toolLabelActive]}>
            {linkLabel}
          </Text>
        </Pressable>

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
  toolBtnGroupActive: {
    backgroundColor: '#1D4ED8',
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
  linkLabel: {
    fontSize: 10,
    marginTop: 0,
  },
  toolLabelActive: {
    color: 'rgba(255,255,255,0.9)',
  },
  divider: {
    width: 8,
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
