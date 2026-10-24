import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type HelpTipId } from '../../stores/settingsStore';
import { useSettingsHydrated } from '../../hooks/useSettingsHydrated';
import { placeBubble, tipTextKey, type Rect } from '../../features/onboarding/helpTips';
import { palette } from '../../theme/tokens';

export interface CoachMarkStep {
  id: string;
  /** Element the bubble points at — the bubble is centred if it can't be measured */
  target: React.RefObject<View | null>;
}

interface CoachMarksProps {
  tipId: HelpTipId;
  steps: CoachMarkStep[];
  /** False while the screen isn't ready (loading, setup mode…) */
  enabled: boolean;
}

const SPOT_PADDING = 6;
const DIM = 'rgba(0,0,0,0.65)';
/** Wait for screen / modal entry animations before the first measure */
const FIRST_MEASURE_DELAY_MS = 450;

/** First-use help bubbles, shown once per screen (flag in settingsStore.seenTips). */
export function CoachMarks({ tipId, steps, enabled }: CoachMarksProps) {
  const { t } = useTranslation();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const hydrated = useSettingsHydrated();
  const seen = useSettingsStore((s) => s.seenTips[tipId] === true);
  const markTipSeen = useSettingsStore((s) => s.markTipSeen);

  const visible = enabled && hydrated && !seen && steps.length > 0;
  const [index, setIndex] = useState(0);
  const [measuredIndex, setMeasuredIndex] = useState(-1);
  const [rect, setRect] = useState<Rect | null>(null);
  const [bubbleH, setBubbleH] = useState(120);

  useEffect(() => {
    if (visible) {
      setIndex(0);
      setMeasuredIndex(-1);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || index >= steps.length) return;
    const timer = setTimeout(() => {
      const node = steps[index].target.current;
      if (!node) {
        setRect(null);
        setMeasuredIndex(index);
        return;
      }
      node.measureInWindow((x, y, width, height) => {
        setRect(width > 0 && height > 0 ? { x, y, width, height } : null);
        setMeasuredIndex(index);
      });
    }, measuredIndex === -1 ? FIRST_MEASURE_DELAY_MS : 0);
    return () => clearTimeout(timer);
  }, [visible, index]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || measuredIndex !== index) return null;

  const isLast = index === steps.length - 1;
  function handleNext() {
    if (isLast) markTipSeen(tipId);
    else setIndex(index + 1);
  }

  const spot = rect && {
    x: rect.x - SPOT_PADDING,
    y: rect.y - SPOT_PADDING,
    width: rect.width + SPOT_PADDING * 2,
    height: rect.height + SPOT_PADDING * 2,
  };
  const bubble = placeBubble(spot, { width: screenW, height: screenH }, bubbleH);

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={handleNext}>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleNext} accessibilityRole="button">
        {spot ? (
          <>
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: Math.max(spot.y, 0) }]} />
            <View style={[styles.dim, { top: spot.y + spot.height, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.dim, { top: spot.y, left: 0, width: Math.max(spot.x, 0), height: spot.height }]} />
            <View style={[styles.dim, { top: spot.y, left: spot.x + spot.width, right: 0, height: spot.height }]} />
            <View style={[styles.spotBorder, { top: spot.y, left: spot.x, width: spot.width, height: spot.height }]} />
          </>
        ) : (
          <View style={[styles.dim, StyleSheet.absoluteFill]} />
        )}

        <View
          style={[styles.bubble, { top: bubble.top, left: bubble.left, width: bubble.width }]}
          onLayout={(e) => setBubbleH(e.nativeEvent.layout.height)}
        >
          <Text style={styles.text}>{t(tipTextKey(tipId, steps[index].id))}</Text>
          <View style={styles.footer}>
            <Text style={styles.counter}>{index + 1} / {steps.length}</Text>
            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={styles.btnText}>{isLast ? t('tips.done') : t('tips.next')}</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
    backgroundColor: DIM,
  },
  spotBorder: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.accentPrimary,
  },
  bubble: {
    position: 'absolute',
    backgroundColor: palette.backgroundSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    padding: 16,
    gap: 12,
  },
  text: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: palette.textPrimary,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: palette.textSecondary,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: palette.accentPrimary,
  },
  btnPressed: { opacity: 0.85 },
  btnText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
});
