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
}: PlaybackControlsProps) {
  const { t } = useTranslation();
  const isAnimating = stepPhase !== 'idle';
  const atStart = currentStep <= 0;
  const atEnd = currentStep >= totalSteps;

  const canBack = hasArrows && !isAnimating && !atStart;
  const canForward = hasArrows && !isAnimating && !atEnd;

  return (
    <View style={styles.container}>
      {/* ⏮ */}
      <Pressable
        style={[styles.btn, !canBack && styles.btnDisabled]}
        onPress={onGoToStart}
        disabled={!canBack}
        accessibilityRole="button"
        accessibilityLabel={t('tactical.playback.start')}
      >
        <Text style={[styles.btnIcon, !canBack && styles.btnIconDisabled]}>⏮</Text>
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

      {/* Step indicator */}
      <View style={styles.indicator}>
        {hasArrows && totalSteps > 0 ? (
          <Text style={styles.indicatorText}>
            {t('tactical.playback.stepOf', { current: currentStep, total: totalSteps })}
          </Text>
        ) : (
          <Text style={styles.indicatorTextMuted}>—</Text>
        )}
      </View>

      {/* ▶ */}
      <Pressable
        style={[styles.btn, styles.btnPrimary, !canForward && styles.btnDisabled]}
        onPress={onStepForward}
        disabled={!canForward}
        accessibilityRole="button"
        accessibilityLabel={t('tactical.playback.forward')}
      >
        <Text style={[styles.btnIcon, !canForward && styles.btnIconDisabled]}>▶</Text>
      </Pressable>

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
