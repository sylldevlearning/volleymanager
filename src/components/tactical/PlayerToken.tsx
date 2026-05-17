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
import { palette } from '../../theme/tokens';
import { BallToken } from './BallToken';

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
  const zIdx = useSharedValue(1);

  const basePixelX = player.x * courtWidth;
  const basePixelY = player.y * courtHeight;

  function triggerHaptic() {
    if (hapticsEnabled) Haptics.selectionAsync();
  }
  function notifyTap() {
    onTap?.(player.playerId);
  }

  const tapGesture = Gesture.Tap()
    .enabled(canDrag)
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
      zIdx.value = 9999;
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
      zIdx.value = 1;
    })
    .onFinalize(() => {
      scale.value = withSpring(1);
      zIdx.value = 1;
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
    zIndex: zIdx.value,
  }));

  const isBall = player.isBall === true;
  const BALL_SIZE = 32;
  const defaultColor = player.isLibero ? '#FBBF24' : (player.isHome ? '#1D4ED8' : '#E63946');
  const bgColor = player.customColor ?? defaultColor;
  const diameter = TOKEN_RADIUS * 2;
  const shortName = isBall ? '' : getPlayerShortName(player);
  const insideLabel = showName && !player.isLibero
    ? player.label.slice(0, 3)
    : String(player.number);
  const tokenRadius = isBall ? BALL_SIZE / 2 : TOKEN_RADIUS;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        pointerEvents={canDrag ? 'auto' : 'none'}
        style={[
          styles.wrapper,
          {
            left: basePixelX - WRAPPER_WIDTH / 2,
            top: basePixelY - tokenRadius,
          },
          animStyle,
        ]}
      >
        {isBall ? (
          <BallToken size={BALL_SIZE} />
        ) : (
          <View style={{ position: 'relative' }}>
            <View
              style={[
                styles.circle,
                player.isLibero && styles.liberoCircle,
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
            {player.isLibero && (
              <View style={styles.liberoBadge}>
                <Text style={styles.liberoBadgeText}>L</Text>
              </View>
            )}
          </View>
        )}
        {!isBall && (
          <Text style={styles.nameLabel} numberOfLines={1}>
            {shortName}
          </Text>
        )}
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
  liberoCircle: {
    borderStyle: 'dashed',
    borderColor: '#fff',
    borderWidth: 2,
  },
  liberoBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E63946',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liberoBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
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
