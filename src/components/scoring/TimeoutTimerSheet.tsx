import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import { palette } from '../../theme/tokens';

const TIMEOUT_DURATION = 30;

interface TimeoutTimerSheetProps {
  visible: boolean;
  teamName: string;
  teamColor: string;
  onEnd: () => void;
  onCancel?: () => void;
}

export function TimeoutTimerSheet({ visible, teamName, teamColor, onEnd, onCancel }: TimeoutTimerSheetProps) {
  const { t } = useTranslation();
  const [seconds, setSeconds] = useState(TIMEOUT_DURATION);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasBuzzed = useRef(false);

  // expo-audio: hook manages lifecycle automatically
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const player = useAudioPlayer(require('../../../assets/sounds/buzzer.wav'));

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!visible) return;

    setSeconds(TIMEOUT_DURATION);
    hasBuzzed.current = false;

    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          if (!hasBuzzed.current) {
            hasBuzzed.current = true;
            playBuzzer();
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible]);

  function playBuzzer() {
    try {
      player.seekTo(0);
      player.play();
    } catch { /* ignore */ }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), 300);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), 600);
  }

  const handleEnd = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    onEnd();
  };

  const handleCancel = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    onCancel?.();
  };

  const progress = seconds / TIMEOUT_DURATION;
  const isUrgent = seconds <= 10;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('timeout.title')}</Text>
          <Text style={[styles.teamName, { color: teamColor }]}>{teamName}</Text>

          <View style={styles.timerContainer}>
            <Text style={[styles.timer, isUrgent && styles.timerUrgent]}>
              {String(seconds).padStart(2, '0')}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress * 100}%` as `${number}%`,
                    backgroundColor: isUrgent ? palette.error : teamColor,
                  },
                ]}
              />
            </View>
          </View>

          {seconds === 0 && (
            <Text style={styles.buzzerText}>{t('timeout.finished')}</Text>
          )}

          <Pressable
            style={({ pressed }) => [styles.endBtn, pressed && styles.endBtnPressed]}
            onPress={handleEnd}
            accessibilityRole="button"
          >
            <Text style={styles.endBtnText}>{t('timeout.endNow')}</Text>
          </Pressable>

          {onCancel && (
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.endBtnPressed]}
              onPress={handleCancel}
              accessibilityRole="button"
            >
              <Text style={styles.cancelBtnText}>{t('timeout.cancel')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: palette.backgroundSurface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    marginHorizontal: 32,
    width: 300,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
  },
  title: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  teamName: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  timerContainer: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  timer: {
    fontSize: 72,
    fontFamily: 'Inter_900Black',
    color: palette.textPrimary,
    lineHeight: 80,
    includeFontPadding: false,
  },
  timerUrgent: {
    color: palette.error,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: palette.backgroundElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  buzzerText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: palette.error,
  },
  endBtn: {
    marginTop: 8,
    backgroundColor: palette.backgroundElevated,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  endBtnPressed: { opacity: 0.7 },
  endBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textPrimary,
  },
  cancelBtn: {
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.error + '50',
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: palette.error,
  },
});
