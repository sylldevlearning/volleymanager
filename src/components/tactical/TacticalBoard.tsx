import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { useSharedValue, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';

import { CourtSVG } from './CourtSVG';
import { ArrowOverlay } from './ArrowOverlay';
import { PlayerToken } from './PlayerToken';
import { ToolBar } from './ToolBar';
import { PlaybackControls } from './PlaybackControls';
import { PlaybookSheet } from './PlaybookSheet';
import { useTacticalStore } from '../../features/tactical/tacticalStore';
import { seedDefaultPlays } from '../../features/tactical/tacticalService';
import { HOME_POSITION_COORDS, AWAY_POSITION_COORDS, findNearestPlayer, clamp, easeInOut } from '../../features/tactical/positionUtils';
import { useScoringStore } from '../../stores/scoringStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { PlayerPosition, TacticalPlay } from '../../models/tactical';
import type { MatchFormat } from '../../models/match';
import { palette } from '../../theme/tokens';

interface TacticalBoardProps {
  visible: boolean;
  format: MatchFormat;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  onClose: () => void;
}

function buildDefaultPositions(
  homeTeamId: string,
  awayTeamId: string,
  rotationHome: number[],
  rotationAway: number[],
  format: MatchFormat,
): PlayerPosition[] {
  const positions: PlayerPosition[] = [];

  if (format === 'indoor_6v6') {
    for (let i = 0; i < 6; i++) {
      const pos = ((rotationHome[i] ?? i + 1) as 1 | 2 | 3 | 4 | 5 | 6);
      const coord = HOME_POSITION_COORDS[pos] ?? HOME_POSITION_COORDS[1];
      positions.push({
        playerId: `home_${i}`,
        x: coord.x, y: coord.y,
        teamId: homeTeamId,
        number: i + 1,
        label: String(i + 1),
        isHome: true,
      });
    }
    for (let i = 0; i < 6; i++) {
      const pos = ((rotationAway[i] ?? i + 1) as 1 | 2 | 3 | 4 | 5 | 6);
      const coord = AWAY_POSITION_COORDS[pos] ?? AWAY_POSITION_COORDS[1];
      positions.push({
        playerId: `away_${i}`,
        x: coord.x, y: coord.y,
        teamId: awayTeamId,
        number: i + 1,
        label: String(i + 1),
        isHome: false,
      });
    }
  } else {
    positions.push(
      { playerId: 'home_0', x: 0.65, y: 0.78, teamId: homeTeamId, number: 1, label: '1', isHome: true },
      { playerId: 'home_1', x: 0.35, y: 0.62, teamId: homeTeamId, number: 2, label: '2', isHome: true },
      { playerId: 'away_0', x: 0.35, y: 0.22, teamId: awayTeamId, number: 1, label: '1', isHome: false },
      { playerId: 'away_1', x: 0.65, y: 0.38, teamId: awayTeamId, number: 2, label: '2', isHome: false },
    );
  }

  return positions;
}

interface DrawPreviewState {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  type: 'solid' | 'dashed' | 'curved';
}

export function TacticalBoard({
  visible,
  format,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  onClose,
}: TacticalBoardProps) {
  const { t } = useTranslation();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  const {
    positions,
    arrows,
    selectedTool,
    arrowThickness,
    isPlaying,
    playbackSpeed,
    setPositions,
    movePlayer,
    addArrow,
    removeArrow,
    clearArrows,
    setTool,
    setPlaying,
    setPlaybackSpeed,
    loadPlay,
    resetBoard,
  } = useTacticalStore();

  const { rotationHome, rotationAway } = useScoringStore();

  // Court dimensions: portrait, height = 2 * width
  const HEADER_H = 48;
  const PLAYBACK_H = 60;
  const TOOLBAR_H = 106;
  const PADDING = 16;
  const availableH = screenH - HEADER_H - PLAYBACK_H - TOOLBAR_H - PADDING * 2;
  const courtW = Math.min(screenW - PADDING * 2, availableH / 2);
  const courtH = courtW * 2;

  const [drawPreview, setDrawPreview] = useState<DrawPreviewState | null>(null);
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [playbookMode, setPlaybookMode] = useState<'load' | 'save'>('load');
  const [playbackPositions, setPlaybackPositions] = useState<PlayerPosition[] | null>(null);
  const [showNames, setShowNames] = useState(false);

  const drawStartX = useSharedValue(0);
  const drawStartY = useSharedValue(0);
  const isPlayingRef = useRef(false);
  const animFrameRef = useRef<number | null>(null);
  const positionsRef = useRef(positions);

  // Keep ref in sync
  useEffect(() => { positionsRef.current = positions; }, [positions]);

  // Initialize on open
  useEffect(() => {
    if (visible) {
      seedDefaultPlays().catch(console.error);
      if (positions.length === 0) {
        setPositions(buildDefaultPositions(homeTeamId, awayTeamId, rotationHome, rotationAway, format));
      }
    }
  }, [visible]);

  // Playback control
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (isPlaying) {
      startAnimation();
    }
    return () => {
      if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  function startAnimation() {
    const sorted = [...arrows].sort((a, b) => a.order - b.order);
    let animPositions = [...positionsRef.current];
    setPlaybackPositions([...animPositions]);

    let arrowIdx = 0;
    let animStart: number | null = null;
    let nearestId: string | null = null;
    let startX = 0;
    let startY = 0;

    function step(now: number) {
      if (!isPlayingRef.current) {
        setPlaybackPositions(null);
        return;
      }
      if (arrowIdx >= sorted.length) {
        setPlaying(false);
        return;
      }

      const arrow = sorted[arrowIdx];

      if (animStart === null) {
        const nearest = findNearestPlayer(animPositions, arrow.fromX, arrow.fromY);
        if (!nearest) { arrowIdx++; animFrameRef.current = requestAnimationFrame(step); return; }
        nearestId = nearest.playerId;
        startX = nearest.x;
        startY = nearest.y;
        animStart = now;
      }

      const duration = 800 / playbackSpeed;
      const elapsed = now - animStart;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOut(progress);

      animPositions = animPositions.map((p) =>
        p.playerId === nearestId
          ? { ...p, x: startX + (arrow.toX - startX) * eased, y: startY + (arrow.toY - startY) * eased }
          : p
      );
      setPlaybackPositions([...animPositions]);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        arrowIdx++;
        animStart = null;
        animFrameRef.current = requestAnimationFrame(step);
      }
    }

    animFrameRef.current = requestAnimationFrame(step);
  }

  function handleReset() {
    isPlayingRef.current = false;
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    setPlaying(false);
    setPlaybackPositions(null);
  }

  // Drawing gesture
  const isDrawMode = selectedTool === 'arrow_solid' || selectedTool === 'arrow_dashed' || selectedTool === 'arrow_curved';
  const drawColor = selectedTool === 'arrow_dashed' ? '#FBBF24' : '#1D4ED8';

  function getDrawType(): 'solid' | 'dashed' | 'curved' {
    if (selectedTool === 'arrow_dashed') return 'dashed';
    if (selectedTool === 'arrow_curved') return 'curved';
    return 'solid';
  }

  const drawGesture = Gesture.Pan()
    .enabled(isDrawMode)
    .minDistance(8)
    .onBegin((e) => {
      drawStartX.value = e.x;
      drawStartY.value = e.y;
      runOnJS(setDrawPreview)({
        fromX: e.x, fromY: e.y,
        toX: e.x, toY: e.y,
        color: drawColor,
        type: getDrawType(),
      });
    })
    .onUpdate((e) => {
      runOnJS(setDrawPreview)({
        fromX: drawStartX.value,
        fromY: drawStartY.value,
        toX: drawStartX.value + e.translationX,
        toY: drawStartY.value + e.translationY,
        color: drawColor,
        type: getDrawType(),
      });
    })
    .onEnd((e) => {
      const dist = Math.hypot(e.translationX, e.translationY);
      if (dist > 20) {
        const fromXR = clamp(drawStartX.value / courtW, 0, 1);
        const fromYR = clamp(drawStartY.value / courtH, 0, 1);
        const toXR = clamp((drawStartX.value + e.translationX) / courtW, 0, 1);
        const toYR = clamp((drawStartY.value + e.translationY) / courtH, 0, 1);
        const type = getDrawType();
        runOnJS(addArrow)({
          type,
          fromX: fromXR, fromY: fromYR,
          toX: toXR, toY: toYR,
          controlX: type === 'curved' ? (fromXR + toXR) / 2 - 0.05 : undefined,
          controlY: type === 'curved' ? (fromYR + toYR) / 2 : undefined,
          color: drawColor,
          thickness: arrowThickness,
        });
      }
      runOnJS(setDrawPreview)(null);
    });

  const displayPositions = playbackPositions ?? positions;

  function handleDragEnd(playerId: string, x: number, y: number) {
    movePlayer(playerId, x, y);
  }

  function handleLoadPlay(play: TacticalPlay) {
    loadPlay(play);
    setPlaybackPositions(null);
  }

  function handleClose() {
    handleReset();
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.closeBtn} accessibilityRole="button">
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
          <Text style={styles.title}>{t('tactical.title')}</Text>
          <Pressable
            onPress={() => setShowNames((v) => !v)}
            style={styles.nameToggle}
            accessibilityRole="button"
          >
            <Text style={[styles.nameToggleText, showNames && styles.nameToggleActive]}>
              {showNames ? 'ABC' : '123'}
            </Text>
          </Pressable>
        </View>

        {/* Court container */}
        <View style={styles.courtContainer}>
          <View style={[styles.court, { width: courtW, height: courtH }]}>
            {/* Base court SVG */}
            <CourtSVG width={courtW} height={courtH} format={format} />

            {/* Arrow layer */}
            <ArrowOverlay
              arrows={arrows}
              courtWidth={courtW}
              courtHeight={courtH}
              eraserMode={selectedTool === 'eraser'}
              drawPreview={drawPreview}
              onRemoveArrow={removeArrow}
            />

            {/* Player tokens */}
            {displayPositions.map((player) => (
              <PlayerToken
                key={player.playerId}
                player={player}
                courtWidth={courtW}
                courtHeight={courtH}
                canDrag={selectedTool === 'move' && !isPlaying}
                showName={showNames}
                onDragEnd={handleDragEnd}
                hapticsEnabled={hapticsEnabled}
              />
            ))}

            {/* Drawing gesture overlay (on top of everything in draw mode) */}
            {isDrawMode && (
              <GestureDetector gesture={drawGesture}>
                <Animated.View style={StyleSheet.absoluteFill} />
              </GestureDetector>
            )}
          </View>
        </View>

        {/* Playback controls */}
        <PlaybackControls
          isPlaying={isPlaying}
          speed={playbackSpeed}
          hasArrows={arrows.length > 0}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            isPlayingRef.current = false;
            setPlaying(false);
          }}
          onReset={handleReset}
          onSetSpeed={setPlaybackSpeed}
        />

        {/* Toolbar */}
        <ToolBar
          selectedTool={selectedTool}
          arrowThickness={arrowThickness}
          onSelectTool={setTool}
          onClearAll={clearArrows}
          onSave={() => { setPlaybookMode('save'); setShowPlaybook(true); }}
          onLoad={() => { setPlaybookMode('load'); setShowPlaybook(true); }}
        />

        {/* Playbook sheet */}
        <PlaybookSheet
          visible={showPlaybook}
          mode={playbookMode}
          format={format}
          currentPositions={positions}
          currentArrows={arrows}
          onLoad={handleLoadPlay}
          onClose={() => setShowPlaybook(false)}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: palette.textSecondary,
    fontFamily: 'Inter_700Bold',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: palette.textPrimary,
  },
  nameToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameToggleText: {
    fontSize: 10,
    color: palette.textMuted,
    fontFamily: 'Inter_700Bold',
  },
  nameToggleActive: {
    color: palette.accentPrimary,
  },
  courtContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  court: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
});
