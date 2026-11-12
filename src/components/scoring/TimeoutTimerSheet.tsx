import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../ui/Text';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import { useThemedStyles, useAppTheme, type AppTheme } from '../../theme/useAppTheme';
import { timeoutSheetLayout } from './timeoutSheetLayout';

const TIMEOUT_DURATION = 30;

interface TimeoutTimerSheetProps {
  visible: boolean;
  teamName: string;
  teamColor: string;
  onEnd: () => void;
  onCancel?: () => void;
}

export function TimeoutTimerSheet({ visible, teamName, teamColor, onEnd, onCancel }: TimeoutTimerSheetProps) {
  const colors = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const layout = timeoutSheetLayout(useWindowDimensions());
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
      <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={[styles.card, { width: layout.cardWidth }]}>
          <Text style={styles.title}>{t('timeout.title')}</Text>
          <Text style={[styles.teamName, { color: teamColor }]}>{teamName}</Text>

          <View style={styles.timerContainer}>
            <Text
              style={[
                styles.timer,
                { fontSize: layout.timerFontSize, lineHeight: layout.timerLineHeight },
                isUrgent && styles.timerUrgent,
              ]}
            >
              {String(seconds).padStart(2, '0')}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress * 100}%` as `${number}%`,
                    backgroundColor: isUrgent ? colors.error : teamColor,
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

const makeStyles = (a: AppTheme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: a.backgroundSurface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: a.backgroundElevated,
  },
  title: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: a.textMuted,
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
    fontFamily: 'Inter_900Black',
    color: a.textPrimary,
    includeFontPadding: false,
  },
  timerUrgent: {
    color: a.error,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: a.backgroundElevated,
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
    color: a.error,
  },
  endBtn: {
    marginTop: 8,
    backgroundColor: a.backgroundElevated,
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
    color: a.textPrimary,
  },
  cancelBtn: {
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: a.error + '50',
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: a.error,
  },
});
