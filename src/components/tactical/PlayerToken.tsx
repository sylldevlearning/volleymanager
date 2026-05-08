import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import type { PlayerPosition } from '../../models/tactical';
import { clamp } from '../../features/tactical/positionUtils';
import { getPlayerShortName } from '../../features/players/player-helpers';

const TOKEN_RADIUS = 20;
const WRAPPER_WIDTH = 64;

interface PlayerTokenProps {
  player: PlayerPosition;
  courtWidth: number;
  courtHeight: number;
  canDrag: boolean;
  showName: boolean;
  onDragEnd: (playerId: string, x: number, y: number) => void;
  onTap?: (playerId: string) => void;
  hapticsEnabled: boolean;
}

export function PlayerToken({
  player,
  courtWidth,
  courtHeight,
  canDrag,
  showName,
  onDragEnd,
  onTap,
  hapticsEnabled,
}: PlayerTokenProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const basePixelX = player.x * courtWidth;
  const basePixelY = player.y * courtHeight;

  function triggerHaptic() {
    if (hapticsEnabled) Haptics.selectionAsync();
  }
  function notifyTap() {
    onTap?.(player.playerId);
  }

  const tapGesture = Gesture.Tap()
    .maxDuration(200)
    .maxDistance(10)
    .onEnd((_e, success) => {
      if (success) runOnJS(notifyTap)();
    });

  const panGesture = Gesture.Pan()
    .enabled(canDrag)
    .minDistance(10)
    .onBegin(() => {
      scale.value = withSpring(1.2);
      runOnJS(triggerHaptic)();
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const newPixelX = basePixelX + e.translationX;
      const newPixelY = basePixelY + e.translationY;
      const newRelX = clamp(newPixelX / courtWidth, 0.02, 0.98);
      const newRelY = clamp(newPixelY / courtHeight, 0.02, 0.98);
      runOnJS(onDragEnd)(player.playerId, newRelX, newRelY);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
    })
    .onFinalize(() => {
      scale.value = withSpring(1);
    });

  // Pan must be first: it activates on movement (minDistance 10), letting Tap handle quick taps.
  // With Tap first and no maxDistance, Tap would hold the gesture for 200ms while Pan waits,
  // then RNGH's late-activation of Pan causes a native crash on Expo Go.
  const gesture = Gesture.Exclusive(panGesture, tapGesture);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const bgColor = player.isHome ? '#1D4ED8' : '#E63946';
  const diameter = TOKEN_RADIUS * 2;
  const shortName = getPlayerShortName(player);
  const insideLabel = showName ? player.label.slice(0, 3) : String(player.number);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.wrapper,
          {
            left: basePixelX - WRAPPER_WIDTH / 2,
            top: basePixelY - TOKEN_RADIUS,
          },
          animStyle,
        ]}
      >
        <View
          style={[
            styles.circle,
            {
              width: diameter,
              height: diameter,
              borderRadius: TOKEN_RADIUS,
              backgroundColor: bgColor,
            },
          ]}
        >
          <Text style={styles.label}>{insideLabel}</Text>
        </View>
        <Text style={styles.nameLabel} numberOfLines={1}>
          {shortName}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    width: WRAPPER_WIDTH,
    alignItems: 'center',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  nameLabel: {
    color: '#8B949E',
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    width: WRAPPER_WIDTH,
    marginTop: 2,
  },
});
