import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { palette } from '../../theme/tokens';

interface PlaybackControlsProps {
  isPlaying: boolean;
  speed: 0.5 | 1 | 2;
  hasArrows: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSetSpeed: (speed: 0.5 | 1 | 2) => void;
}

const SPEEDS: (0.5 | 1 | 2)[] = [0.5, 1, 2];

export function PlaybackControls({
  isPlaying,
  speed,
  hasArrows,
  onPlay,
  onPause,
  onReset,
  onSetSpeed,
}: PlaybackControlsProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.playBtn, !hasArrows && styles.disabled]}
        onPress={isPlaying ? onPause : onPlay}
        disabled={!hasArrows}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? t('tactical.playback.pause') : t('tactical.playback.play')}
      >
        <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
      </Pressable>

      <Pressable
        style={[styles.resetBtn, !hasArrows && styles.disabled]}
        onPress={onReset}
        disabled={!hasArrows}
        accessibilityRole="button"
        accessibilityLabel={t('tactical.playback.reset')}
      >
        <Text style={styles.resetText}>⏹</Text>
      </Pressable>

      <View style={styles.speedRow}>
        {SPEEDS.map((s) => (
          <Pressable
            key={s}
            style={[styles.speedBtn, s === speed && styles.speedBtnActive]}
            onPress={() => onSetSpeed(s)}
            accessibilityRole="button"
          >
            <Text style={[styles.speedText, s === speed && styles.speedTextActive]}>
              x{s}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: palette.backgroundSurface,
    borderTopWidth: 1,
    borderTopColor: palette.backgroundElevated,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  resetBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: {
    fontSize: 16,
    color: palette.textSecondary,
  },
  speedRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  speedBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: palette.backgroundElevated,
  },
  speedBtnActive: {
    backgroundColor: palette.accentPrimaryMuted,
    borderWidth: 1,
    borderColor: palette.accentPrimary + '60',
  },
  speedText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textMuted,
  },
  speedTextActive: {
    color: palette.accentPrimary,
  },
  disabled: {
    opacity: 0.4,
  },
});
