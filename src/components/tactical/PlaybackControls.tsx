import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { palette } from '../../theme/tokens';

type StepPhase = 'idle' | 'showing' | 'animating' | 'done';

interface PlaybackControlsProps {
  currentStep: number;
  totalSteps: number;
  stepPhase: StepPhase;
  hasArrows: boolean;
  onStepForward: () => void;
  onStepBack: () => void;
  onGoToStart: () => void;
  onGoToEnd: () => void;
  hasHistory: boolean;
  isPlayingAll: boolean;
  historyStep: number;
  historyTotal: number;
  onPlayAll: () => void;
  onStopPlayAll: () => void;
}

export function PlaybackControls({
  currentStep,
  totalSteps,
  stepPhase,
  hasArrows,
  onStepForward,
  onStepBack,
  onGoToStart,
  onGoToEnd,
  hasHistory,
  isPlayingAll,
  historyStep,
  historyTotal,
  onPlayAll,
  onStopPlayAll,
}: PlaybackControlsProps) {
  const { t } = useTranslation();
  const isAnimating = stepPhase !== 'idle';
  const atStart = currentStep <= 0;
  const atEnd = currentStep >= totalSteps;

  // History-only mode: current drawings are gone, history exists
  const historyMode = !hasArrows && hasHistory;

  const canBack = hasArrows && !isAnimating && !isPlayingAll && !atStart;
  const canForward = hasArrows && !isAnimating && !isPlayingAll && !atEnd;
  const canGoToStart = (hasArrows && !atStart) || (historyMode && !isPlayingAll);
  const canPlayAll = historyMode && !isPlayingAll && !isAnimating;

  return (
    <View style={styles.container}>
      {/* ⏮ */}
      <Pressable
        style={[styles.btn, !canGoToStart && styles.btnDisabled]}
        onPress={onGoToStart}
        disabled={!canGoToStart}
        accessibilityRole="button"
        accessibilityLabel={t('tactical.playback.start')}
      >
        <Text style={[styles.btnIcon, !canGoToStart && styles.btnIconDisabled]}>⏮</Text>
      </Pressable>

      {/* ◀ */}
      <Pressable
        style={[styles.btn, !canBack && styles.btnDisabled]}
        onPress={onStepBack}
        disabled={!canBack}
        accessibilityRole="button"
        accessibilityLabel={t('tactical.playback.back')}
      >
        <Text style={[styles.btnIcon, !canBack && styles.btnIconDisabled]}>◀</Text>
      </Pressable>

      {/* Step / history indicator */}
      <View style={styles.indicator}>
        {isPlayingAll ? (
          <Text style={styles.indicatorText}>
            {t('tactical.playback.stepOf', { current: historyStep, total: historyTotal })}
          </Text>
        ) : hasArrows && totalSteps > 0 ? (
          <Text style={styles.indicatorText}>
            {t('tactical.playback.stepOf', { current: currentStep, total: totalSteps })}
          </Text>
        ) : historyMode ? (
          <Text style={styles.indicatorTextMuted}>
            {t('tactical.playback.historyCount', { count: historyTotal })}
          </Text>
        ) : (
          <Text style={styles.indicatorTextMuted}>—</Text>
        )}
      </View>

      {/* ▶ / ⏹ */}
      {isPlayingAll ? (
        <Pressable
          style={[styles.btn, styles.btnStop]}
          onPress={onStopPlayAll}
          accessibilityRole="button"
          accessibilityLabel={t('tactical.playback.stop')}
        >
          <Text style={styles.btnIcon}>⏹</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.btn, styles.btnPrimary, !canForward && !canPlayAll && styles.btnDisabled]}
          onPress={historyMode ? onPlayAll : onStepForward}
          disabled={!canForward && !canPlayAll}
          accessibilityRole="button"
          accessibilityLabel={historyMode ? t('tactical.playback.playAll') : t('tactical.playback.forward')}
        >
          <Text style={[styles.btnIcon, !canForward && !canPlayAll && styles.btnIconDisabled]}>▶</Text>
        </Pressable>
      )}

      {/* ⏭ */}
      <Pressable
        style={[styles.btn, !canForward && styles.btnDisabled]}
        onPress={onGoToEnd}
        disabled={!canForward}
        accessibilityRole="button"
        accessibilityLabel={t('tactical.playback.end')}
      >
        <Text style={[styles.btnIcon, !canForward && styles.btnIconDisabled]}>⏭</Text>
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
  btnStop: {
    backgroundColor: palette.accentSecondary,
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
