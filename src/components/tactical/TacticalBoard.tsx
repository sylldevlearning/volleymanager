import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';

import { CourtSVG } from './CourtSVG';
import { ArrowOverlay } from './ArrowOverlay';
import { PlayerToken } from './PlayerToken';
import { ToolBar } from './ToolBar';
import { PlaybackControls } from './PlaybackControls';
import { PlaybookSheet } from './PlaybookSheet';
import { PlayerEditSheet } from './PlayerEditSheet';
import { useTacticalStore } from '../../features/tactical/tacticalStore';
import { seedDefaultPlays } from '../../features/tactical/tacticalService';
import { HOME_POSITION_COORDS, AWAY_POSITION_COORDS, findNearestPlayer, clamp, easeInOut } from '../../features/tactical/positionUtils';
import { useScoringStore } from '../../stores/scoringStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { PlayerPosition, TacticalPlay } from '../../models/tactical';
import { updatePlayer } from '../../services/playerService';
import type { MatchFormat } from '../../models/match';
import { palette } from '../../theme/tokens';

interface TacticalBoardProps {
  visible: boolean;
  onClose: () => void;
  format?: MatchFormat;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeamName?: string;
  awayTeamName?: string;
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
  onClose,
  format = 'indoor_6v6',
  homeTeamId = 'home',
  awayTeamId = 'away',
  homeTeamName,
  awayTeamName,
}: TacticalBoardProps) {
  const { t } = useTranslation();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  const {
    positions,
    arrows,
    freehandPaths,
    selectedTool,
    arrowThickness,
    isPlaying,
    playbackSpeed,
    groupMode,
    currentGroup,
    currentPlayId,
    currentPlayName,
    setPositions,
    movePlayer,
    updatePlayerInfo,
    addArrow,
    removeArrow,
    clearArrows,
    addFreehandPath,
    toggleGroupMode,
    setTool,
    setPlaying,
    setPlaybackSpeed,
    loadPlay,
    resetBoard,
  } = useTacticalStore();

  const { rotationHome, rotationAway } = useScoringStore();

  // Court dimensions: portrait, height = 2 * width
  const HEADER_H = 48;
  const SAVEBAR_H = 44;
  const PLAYBACK_H = 60;
  const TOOLBAR_H = 106;
  const PADDING = 16;
  const safeH = screenH - insets.top - insets.bottom;
  const availableH = safeH - HEADER_H - SAVEBAR_H - PLAYBACK_H - TOOLBAR_H - PADDING * 2;
  const courtW = Math.max(80, Math.min(screenW - PADDING * 2, availableH / 2));
  const courtH = courtW * 2;

  const [drawPreview, setDrawPreview] = useState<DrawPreviewState | null>(null);
  const [pencilPreviewD, setPencilPreviewD] = useState<string | null>(null);
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerPosition | null>(null);
  const [playbookMode, setPlaybookMode] = useState<'load' | 'save'>('load');
  const [playbackPositions, setPlaybackPositions] = useState<PlayerPosition[] | null>(null);
  const [currentFormat, setCurrentFormat] = useState<MatchFormat>(format);

  const drawStartX = useSharedValue(0);
  const drawStartY = useSharedValue(0);
  const pencilPointsRef = useRef<{ x: number; y: number }[]>([]);
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
    // Build ordered list of groups: each group is an array of arrows to animate simultaneously
    const sorted = [...arrows].sort((a, b) => a.order - b.order);
    const groupMap = new Map<number, typeof arrows>();
    for (const arrow of sorted) {
      const g = arrow.group ?? arrow.order;
      if (!groupMap.has(g)) groupMap.set(g, []);
      groupMap.get(g)!.push(arrow);
    }
    const groups = [...groupMap.values()];

    let animPositions = [...positionsRef.current];
    setPlaybackPositions([...animPositions]);

    let groupIdx = 0;
    let animStart: number | null = null;
    // Per arrow in current group: nearest player + start coords
    let groupMeta: Array<{ nearestId: string; startX: number; startY: number }> = [];

    function step(now: number) {
      if (!isPlayingRef.current) { setPlaybackPositions(null); return; }
      if (groupIdx >= groups.length) { setPlaying(false); return; }

      const group = groups[groupIdx];

      if (animStart === null) {
        groupMeta = group.map((arrow) => {
          const nearest = findNearestPlayer(animPositions, arrow.fromX, arrow.fromY);
          return nearest
            ? { nearestId: nearest.playerId, startX: nearest.x, startY: nearest.y }
            : { nearestId: '', startX: 0, startY: 0 };
        });
        animStart = now;
      }

      const duration = 800 / playbackSpeed;
      const elapsed = now - animStart;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOut(progress);

      // Animate all arrows in the group simultaneously
      animPositions = animPositions.map((p) => {
        for (let i = 0; i < group.length; i++) {
          const meta = groupMeta[i];
          if (meta.nearestId && p.playerId === meta.nearestId) {
            const arrow = group[i];
            return { ...p, x: meta.startX + (arrow.toX - meta.startX) * eased, y: meta.startY + (arrow.toY - meta.startY) * eased };
          }
        }
        return p;
      });
      setPlaybackPositions([...animPositions]);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        groupIdx++;
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
  const isDrawMode = selectedTool === 'arrow_solid' || selectedTool === 'arrow_dashed';
  const isCurvedMode = selectedTool === 'arrow_curved';
  const drawColor = selectedTool === 'arrow_dashed' ? '#FBBF24' : '#1D4ED8';
  // Precompute as primitive string so the worklet can capture it safely
  const drawType: 'solid' | 'dashed' =
    selectedTool === 'arrow_dashed' ? 'dashed' : 'solid';

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
        type: drawType,
      });
    })
    .onUpdate((e) => {
      runOnJS(setDrawPreview)({
        fromX: drawStartX.value,
        fromY: drawStartY.value,
        toX: drawStartX.value + e.translationX,
        toY: drawStartY.value + e.translationY,
        color: drawColor,
        type: drawType,
      });
    })
    .onEnd((e) => {
      const dist = Math.hypot(e.translationX, e.translationY);
      if (dist > 20) {
        const fromXR = clamp(drawStartX.value / courtW, 0, 1);
        const fromYR = clamp(drawStartY.value / courtH, 0, 1);
        const toXR = clamp((drawStartX.value + e.translationX) / courtW, 0, 1);
        const toYR = clamp((drawStartY.value + e.translationY) / courtH, 0, 1);
        runOnJS(addArrow)({
          type: drawType,
          fromX: fromXR, fromY: fromYR,
          toX: toXR, toY: toYR,
          color: drawColor,
          thickness: arrowThickness,
        });
      }
      runOnJS(setDrawPreview)(null);
    });

  // Pencil/Curved freehand gestures
  const isPencilMode = selectedTool === 'pencil';
  const pencilColor = isCurvedMode ? drawColor : '#E63946';

  function buildPathD(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }

  function onPencilBegin(x: number, y: number) {
    pencilPointsRef.current = [{ x, y }];
    setPencilPreviewD(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  function onPencilUpdate(x: number, y: number) {
    pencilPointsRef.current.push({ x, y });
    setPencilPreviewD(buildPathD(pencilPointsRef.current));
  }

  function onPencilEnd() {
    const pts = pencilPointsRef.current;
    if (pts.length > 3) {
      addFreehandPath(buildPathD(pts), pencilColor);
    }
    pencilPointsRef.current = [];
    setPencilPreviewD(null);
  }

  function onCurvedEnd() {
    const pts = pencilPointsRef.current;
    if (pts.length > 3) {
      addFreehandPath(buildPathD(pts), drawColor, true);
    }
    pencilPointsRef.current = [];
    setPencilPreviewD(null);
  }

  const pencilGesture = Gesture.Pan()
    .enabled(isPencilMode)
    .minDistance(0)
    .onBegin((e) => { runOnJS(onPencilBegin)(e.x, e.y); })
    .onUpdate((e) => { runOnJS(onPencilUpdate)(e.x, e.y); })
    .onEnd(() => { runOnJS(onPencilEnd)(); })
    .onFinalize(() => { runOnJS(onPencilEnd)(); });

  const curvedGesture = Gesture.Pan()
    .enabled(isCurvedMode)
    .minDistance(0)
    .onBegin((e) => { runOnJS(onPencilBegin)(e.x, e.y); })
    .onUpdate((e) => { runOnJS(onPencilUpdate)(e.x, e.y); })
    .onEnd(() => { runOnJS(onCurvedEnd)(); })
    .onFinalize(() => { runOnJS(onCurvedEnd)(); });

  const displayPositions = playbackPositions ?? positions;

  function handleDragEnd(playerId: string, x: number, y: number) {
    movePlayer(playerId, x, y);
  }

  function handleTokenTap(playerId: string) {
    const found = positions.find((p) => p.playerId === playerId);
    if (found) setEditingPlayer(found);
  }

  async function handleEditSave(
    playerId: string,
    updates: { number: number; firstName: string; lastName: string },
  ) {
    const newLabel = String(updates.number);
    updatePlayerInfo(playerId, {
      number: updates.number,
      firstName: updates.firstName || null,
      lastName: updates.lastName || null,
      label: newLabel,
    });
    // Only persist to DB for real (non-synthetic) player IDs
    const isSynthetic = playerId.startsWith('home_') || playerId.startsWith('away_');
    if (!isSynthetic) {
      try {
        await updatePlayer(playerId, {
          firstName: updates.firstName || null,
          lastName: updates.lastName || null,
          number: updates.number,
        });
      } catch {
        // Best-effort — store already updated, DB update non-blocking
      }
    }
  }

  function handleLoadPlay(play: TacticalPlay) {
    loadPlay(play);
    setCurrentFormat(play.format);
    setPlaybackPositions(null);
  }

  function handleNewBoard() {
    handleReset();
    clearArrows();
    setPositions(buildDefaultPositions(homeTeamId, awayTeamId, rotationHome, rotationAway, currentFormat));
    setTool('move');
  }

  function handleToggleFormat() {
    const next: MatchFormat = currentFormat === 'indoor_6v6' ? 'beach_2v2' : 'indoor_6v6';
    setCurrentFormat(next);
    clearArrows();
    setPositions(buildDefaultPositions(homeTeamId, awayTeamId, rotationHome, rotationAway, next));
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
      {/* GestureHandlerRootView inside Modal fixes drag on Android */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.headerBtn} accessibilityRole="button">
            <Text style={styles.headerBtnText}>✕</Text>
          </Pressable>

          {/* Format toggle (only in standalone mode) */}
          {!homeTeamName && (
            <Pressable onPress={handleToggleFormat} style={styles.formatChip} accessibilityRole="button">
              <Text style={styles.formatChipText}>
                {currentFormat === 'indoor_6v6' ? '6×6' : '2×2'}
              </Text>
            </Pressable>
          )}

          <Text style={styles.title}>{t('tactical.title')}</Text>

          <Pressable onPress={handleNewBoard} style={styles.headerBtn} accessibilityRole="button"
            accessibilityLabel="Nouveau schéma">
            <Text style={styles.headerBtnText}>🗒</Text>
          </Pressable>
        </View>

        {/* Save / Load bar */}
        <View style={styles.saveBar}>
          <Pressable
            style={styles.saveBarBtn}
            onPress={() => { setPlaybookMode('load'); setShowPlaybook(true); }}
            accessibilityRole="button"
          >
            <Text style={styles.saveBarIcon}>📂</Text>
            <Text style={styles.saveBarText}>{t('tactical.playbook.load')}</Text>
          </Pressable>
          <View style={styles.saveBarDivider} />
          <Pressable
            style={[styles.saveBarBtn, styles.saveBarBtnPrimary]}
            onPress={() => { setPlaybookMode('save'); setShowPlaybook(true); }}
            accessibilityRole="button"
          >
            <Text style={styles.saveBarIcon}>💾</Text>
            <Text style={[styles.saveBarText, styles.saveBarTextPrimary]}>
              {t('tactical.playbook.save')}
            </Text>
          </Pressable>
        </View>

        {/* Court container */}
        <View style={styles.courtContainer}>
          <View style={[styles.court, { width: courtW, height: courtH }]}>
            {/* Base court SVG */}
            <CourtSVG width={courtW} height={courtH} format={currentFormat} />

            {/* Arrow + freehand layer */}
            <ArrowOverlay
              arrows={arrows}
              freehandPaths={freehandPaths}
              courtWidth={courtW}
              courtHeight={courtH}
              eraserMode={selectedTool === 'eraser'}
              drawPreview={drawPreview}
              pencilPreviewD={pencilPreviewD}
              pencilColor={pencilColor}
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
                showName={false}
                onDragEnd={handleDragEnd}
                onTap={handleTokenTap}
                hapticsEnabled={hapticsEnabled}
              />
            ))}

            {/* Drawing gesture overlay (on top of everything in draw mode) */}
            {isDrawMode && (
              <GestureDetector gesture={drawGesture}>
                <Animated.View style={StyleSheet.absoluteFill} />
              </GestureDetector>
            )}
            {/* Pencil gesture overlay */}
            {isPencilMode && (
              <GestureDetector gesture={pencilGesture}>
                <Animated.View style={StyleSheet.absoluteFill} />
              </GestureDetector>
            )}
            {/* Curved (freehand with arrowhead) gesture overlay */}
            {isCurvedMode && (
              <GestureDetector gesture={curvedGesture}>
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
          groupMode={groupMode}
          currentGroup={currentGroup}
          onSelectTool={setTool}
          onToggleGroupMode={toggleGroupMode}
          onClearAll={clearArrows}
        />

        {/* Player quick-edit sheet */}
        <PlayerEditSheet
          visible={editingPlayer !== null}
          player={editingPlayer}
          onClose={() => setEditingPlayer(null)}
          onSave={handleEditSave}
        />

        {/* Playbook sheet */}
        <PlaybookSheet
          visible={showPlaybook}
          mode={playbookMode}
          format={currentFormat}
          currentPositions={positions}
          currentArrows={arrows}
          currentPlayId={currentPlayId}
          currentPlayName={currentPlayName}
          onLoad={handleLoadPlay}
          onClose={() => setShowPlaybook(false)}
          onPlayDeleted={(id) => {
            if (currentPlayId === id) resetBoard();
          }}
        />
      </SafeAreaView>
      </GestureHandlerRootView>
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
    paddingHorizontal: 8,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: {
    fontSize: 14,
    color: palette.textSecondary,
    fontFamily: 'Inter_700Bold',
  },
  headerBtnActive: {
    color: palette.accentPrimary,
  },
  formatChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: palette.accentSecondary + '25',
    borderWidth: 1,
    borderColor: palette.accentSecondary + '50',
  },
  formatChipText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: palette.accentSecondary,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: palette.textPrimary,
  },
  saveBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    backgroundColor: palette.backgroundSurface,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  saveBarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: palette.backgroundElevated,
  },
  saveBarBtnPrimary: {
    backgroundColor: palette.accentPrimaryMuted,
    borderWidth: 1,
    borderColor: palette.accentPrimary + '50',
  },
  saveBarDivider: {
    width: 1,
    backgroundColor: palette.backgroundElevated,
  },
  saveBarIcon: { fontSize: 15 },
  saveBarText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textSecondary,
  },
  saveBarTextPrimary: {
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
