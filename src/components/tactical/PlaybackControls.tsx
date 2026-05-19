import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { palette } from '../../theme/tokens';

type StepPhase = 'idle' | 'showing' | 'animating' | 'done';

interface PlaybackControlsProps {
  historyViewStep: number; // -1 = live, ≥0 = browsing history at that index
  historyTotal: number;    // number of completed steps saved in history
  totalSteps: number;      // historyTotal + pending groups still on board
  stepPhase: StepPhase;
  hasArrows: boolean;      // current live drawings exist
  onStepForward: () => void;
  onStepBack: () => void;
  onGoToStart: () => void;
}

export function PlaybackControls({
  historyViewStep,
  historyTotal,
  totalSteps,
  stepPhase,
  hasArrows,
  onStepForward,
  onStepBack,
  onGoToStart,
}: PlaybackControlsProps) {
  const { t } = useTranslation();
  const isAnimating = stepPhase !== 'idle';
  const inHistory = historyViewStep >= 0;

  const canGoToStart = !isAnimating && historyTotal > 0;
  const canBack = !isAnimating && (inHistory ? historyViewStep > 0 : historyTotal > 0);
  const canForward = !isAnimating && (hasArrows || inHistory);

  let stepLabel: string;
  if (inHistory) {
    stepLabel = t('tactical.playback.stepOf', { current: historyViewStep + 1, total: totalSteps });
  } else if (hasArrows && totalSteps > 0) {
    stepLabel = t('tactical.playback.stepOf', { current: historyTotal + 1, total: totalSteps });
  } else if (historyTotal > 0) {
    stepLabel = t('tactical.playback.historyCount', { count: historyTotal });
  } else {
    stepLabel = '—';
  }

  const labelActive = inHistory || (hasArrows && totalSteps > 0);

  return (
    <View style={styles.container}>
      {/* ⏮ Go to start */}
      <Pressable
        style={[styles.btn, !canGoToStart && styles.btnDisabled]}
        onPress={onGoToStart}
        disabled={!canGoToStart}
        accessibilityRole="button"
        accessibilityLabel={t('tactical.playback.start')}
      >
        <Text style={[styles.btnIcon, !canGoToStart && styles.btnIconDisabled]}>⏮</Text>
      </Pressable>

      {/* ◀ Step back */}
      <Pressable
        style={[styles.btn, !canBack && styles.btnDisabled]}
        onPress={onStepBack}
        disabled={!canBack}
        accessibilityRole="button"
        accessibilityLabel={t('tactical.playback.back')}
      >
        <Text style={[styles.btnIcon, !canBack && styles.btnIconDisabled]}>◀</Text>
      </Pressable>

      {/* Step indicator */}
      <View style={styles.indicator}>
        <Text style={labelActive ? styles.indicatorText : styles.indicatorTextMuted}>
          {stepLabel}
        </Text>
      </View>

      {/* ▶ Step forward / advance */}
      <Pressable
        style={[styles.btn, styles.btnPrimary, !canForward && styles.btnDisabled]}
        onPress={onStepForward}
        disabled={!canForward}
        accessibilityRole="button"
        accessibilityLabel={t('tactical.playback.forward')}
      >
        <Text style={[styles.btnIcon, !canForward && styles.btnIconDisabled]}>▶</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: palette.backgroundSurface,
    borderTopWidth: 1,
    borderTopColor: palette.backgroundElevated,
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: palette.accentPrimary,
  },
  btnDisabled: {
    opacity: 0.35,
  },
  btnIcon: {
    fontSize: 16,
    color: palette.textPrimary,
  },
  btnIconDisabled: {
    color: palette.textMuted,
  },
  indicator: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textPrimary,
    textAlign: 'center',
  },
  indicatorTextMuted: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: palette.textMuted,
    textAlign: 'center',
  },
});
