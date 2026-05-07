import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
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

const TOKEN_RADIUS = 20;

interface PlayerTokenProps {
  player: PlayerPosition;
  courtWidth: number;
  courtHeight: number;
  canDrag: boolean;
  showName: boolean;
  onDragEnd: (playerId: string, x: number, y: number) => void;
  hapticsEnabled: boolean;
}

export function PlayerToken({
  player,
  courtWidth,
  courtHeight,
  canDrag,
  showName,
  onDragEnd,
  hapticsEnabled,
}: PlayerTokenProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  // When player position updates from store (after drop or playback), reset delta
  const basePixelX = player.x * courtWidth;
  const basePixelY = player.y * courtHeight;

  function triggerHaptic() {
    if (hapticsEnabled) {
      Haptics.selectionAsync();
    }
  }

  const gesture = Gesture.Pan()
    .enabled(canDrag)
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

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const bgColor = player.isHome ? '#1D4ED8' : '#E63946';
  const diameter = TOKEN_RADIUS * 2;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.token,
          {
            width: diameter,
            height: diameter,
            borderRadius: TOKEN_RADIUS,
            backgroundColor: bgColor,
            left: basePixelX - TOKEN_RADIUS,
            top: basePixelY - TOKEN_RADIUS,
          },
          animStyle,
        ]}
      >
        <Text style={styles.label}>
          {showName ? player.label.slice(0, 3) : String(player.number)}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  token: {
    position: 'absolute',
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
});
