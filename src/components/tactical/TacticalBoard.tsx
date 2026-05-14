import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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

  // Ball token at center of court
  positions.push({
    playerId: 'ball',
    x: 0.5, y: 0.5,
    teamId: '',
    number: 0,
    label: '🏐',
    isHome: false,
    isBall: true,
  });

  return positions;
}

// FIVB position fault check:
// y=0 top (away back line) → y=1 bottom (home back line); net at y=0.5
// For each team, split players into front row (closer to net) and back row,
// then verify depth and left-right column order.
function computePositionFaults(positions: PlayerPosition[]): Set<string> {
  const faults = new Set<string>();

  function checkTeam(players: PlayerPosition[], isHome: boolean) {
    const onCourt = players.filter((p) => !p.isBall);
    if (onCourt.length < 6) return;

    // Front row = 3 players closest to net; for home: smaller y; for away: larger y
    const byDepth = [...onCourt].sort((a, b) => isHome ? a.y - b.y : b.y - a.y);
    const front = byDepth.slice(0, 3).sort((a, b) => a.x - b.x);
    const back = byDepth.slice(3).sort((a, b) => a.x - b.x);

    // Rule 1 — depth: each front player must be closer to the net than column-matched back player
    for (let i = 0; i < 3; i++) {
      const ok = isHome ? front[i].y < back[i].y : front[i].y > back[i].y;
      if (!ok) { faults.add(front[i].playerId); faults.add(back[i].playerId); }
    }

    // Rule 2 — column crossing: front player must not cross adjacent back player's x
    for (let i = 0; i < 3; i++) {
      if (i < 2 && front[i].x > back[i + 1].x) {
        faults.add(front[i].playerId); faults.add(back[i + 1].playerId);
      }
      if (i > 0 && front[i].x < back[i - 1].x) {
        faults.add(front[i].playerId); faults.add(back[i - 1].playerId);
      }
    }

    // Rule 3 — same for back row relative to front row
    for (let i = 0; i < 3; i++) {
      if (i < 2 && back[i].x > front[i + 1].x) {
        faults.add(back[i].playerId); faults.add(front[i + 1].playerId);
      }
      if (i > 0 && back[i].x < front[i - 1].x) {
        faults.add(back[i].playerId); faults.add(front[i - 1].playerId);
      }
    }
  }

  checkTeam(positions.filter((p) => p.isHome), true);
  checkTeam(positions.filter((p) => !p.isHome && !p.isBall), false);
  return faults;
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

  const { rotationHome, rotationAway, scoreHome, scoreAway, setsHome, setsAway } = useScoringStore();

  // Court dimensions: portrait, height = 2 * width
  const HEADER_H = 48;
  const PLAYBACK_H = 60;
  const TOOLBAR_H = 106;
  const PADDING = 16;
  const safeH = screenH - insets.top - insets.bottom;
  const availableH = safeH - HEADER_H - PLAYBACK_H - TOOLBAR_H - PADDING * 2;
  const courtW = Math.max(80, Math.min(screenW - PADDING * 2, availableH / 2));
  const courtH = courtW * 2;

  const [drawPreview, setDrawPreview] = useState<DrawPreviewState | null>(null);
  const [pencilPreviewD, setPencilPreviewD] = useState<string | null>(null);
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerPosition | null>(null);
  const [playbookMode, setPlaybookMode] = useState<'load' | 'save'>('load');
  const [playbackPositions, setPlaybackPositions] = useState<PlayerPosition[] | null>(null);
  const [currentFormat, setCurrentFormat] = useState<MatchFormat>(format);
  const [faultPlayerIds, setFaultPlayerIds] = useState<Set<string>>(new Set());

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

  function parseFreehandPoints(d: string): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    const re = /[ML]\s*([\d.]+)\s+([\d.]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(d)) !== null) {
      pts.push({ x: parseFloat(m[1]) / courtW, y: parseFloat(m[2]) / courtH });
    }
    return pts;
  }

  type AnimSegment =
    | { kind: 'arrow'; fromX: number; fromY: number; toX: number; toY: number }
    | { kind: 'path'; points: { x: number; y: number }[] };

  function startAnimation() {
    // Merge arrows and freehand paths (hasArrow=true) into unified group map
    const groupMap = new Map<number, Array<{ nearestId: string; segment: AnimSegment; startX: number; startY: number }>>();

    const sortedArrows = [...arrows].sort((a, b) => a.order - b.order);
    for (const arrow of sortedArrows) {
      const g = arrow.group ?? arrow.order;
      if (!groupMap.has(g)) groupMap.set(g, []);
      groupMap.get(g)!.push({
        nearestId: '',
        segment: { kind: 'arrow', fromX: arrow.fromX, fromY: arrow.fromY, toX: arrow.toX, toY: arrow.toY },
        startX: 0, startY: 0,
      });
    }

    for (const fp of freehandPaths) {
      if (!fp.hasArrow) continue;
      const points = parseFreehandPoints(fp.d);
      if (points.length < 2) continue;
      const g = fp.group ?? 1;
      if (!groupMap.has(g)) groupMap.set(g, []);
      groupMap.get(g)!.push({
        nearestId: '',
        segment: { kind: 'path', points },
        startX: 0, startY: 0,
      });
    }

    if (groupMap.size === 0) { setPlaying(false); return; }

    const groups = [...groupMap.entries()].sort(([a], [b]) => a - b).map(([, v]) => v);

    let animPositions = [...positionsRef.current];
    setPlaybackPositions([...animPositions]);

    let groupIdx = 0;
    let animStart: number | null = null;
    let groupItems: typeof groups[number] = [];

    function step(now: number) {
      if (!isPlayingRef.current) { setPlaybackPositions(null); return; }
      if (groupIdx >= groups.length) { setPlaying(false); return; }

      if (animStart === null) {
        groupItems = groups[groupIdx].map((item) => {
          const startPt = item.segment.kind === 'arrow'
            ? { x: item.segment.fromX, y: item.segment.fromY }
            : item.segment.points[0];
          const nearest = findNearestPlayer(animPositions, startPt.x, startPt.y);
          return nearest
            ? { ...item, nearestId: nearest.playerId, startX: nearest.x, startY: nearest.y }
            : { ...item, nearestId: '', startX: 0, startY: 0 };
        });
        animStart = now;
      }

      const duration = 800 / playbackSpeed;
      const elapsed = now - animStart;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOut(progress);

      animPositions = animPositions.map((p) => {
        for (const item of groupItems) {
          if (!item.nearestId || p.playerId !== item.nearestId) continue;
          const seg = item.segment;
          if (seg.kind === 'arrow') {
            return { ...p, x: item.startX + (seg.toX - item.startX) * eased, y: item.startY + (seg.toY - item.startY) * eased };
          } else {
            // Interpolate along multi-point path
            const pts = seg.points;
            const totalSegments = pts.length - 1;
            const rawIdx = eased * totalSegments;
            const segIdx = Math.min(Math.floor(rawIdx), totalSegments - 1);
            const localT = rawIdx - segIdx;
            const a = pts[segIdx], b = pts[segIdx + 1];
            return { ...p, x: a.x + (b.x - a.x) * localT, y: a.y + (b.y - a.y) * localT };
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

  // Group colors — each group gets a distinct color that cycles
  const GROUP_COLORS = ['#E63946', '#1D4ED8', '#2EA043', '#F59E0B', '#8B5CF6', '#EC4899'];
  const groupColor = GROUP_COLORS[(currentGroup - 1) % GROUP_COLORS.length];

  // Drawing gesture
  const isDrawMode = selectedTool === 'arrow_solid' || selectedTool === 'arrow_dashed';
  const isCurvedMode = selectedTool === 'arrow_curved';
  // Curved arrows use group color; pencil uses red annotation color
  const drawColor = groupColor;
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
      addFreehandPath(buildPathD(pts), drawColor, true, currentGroup);
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
    if (faultPlayerIds.size > 0) setFaultPlayerIds(new Set());
  }

  function handleTokenTap(playerId: string) {
    if (playerId === 'ball') return;
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

  function handleCheckPositions() {
    if (currentFormat !== 'indoor_6v6') return;
    const faults = computePositionFaults(positions);
    setFaultPlayerIds(faults);
    if (faults.size === 0) {
      Alert.alert(t('tactical.positionCheckTitle'), t('tactical.positionOk'));
    } else {
      Alert.alert(
        t('tactical.positionCheckTitle'),
        t('tactical.positionFaults', { count: faults.size }),
        [{ text: 'OK' }],
      );
    }
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

          {/* Live score pill — shown when a match is active */}
          {(scoreHome > 0 || scoreAway > 0 || setsHome > 0 || setsAway > 0) && (
            <View style={styles.scorePill}>
              <Text style={styles.scorePillText}>
                {setsHome}–{setsAway} ({scoreHome}–{scoreAway})
              </Text>
            </View>
          )}

          {currentFormat === 'indoor_6v6' && (
            <Pressable
              onPress={handleCheckPositions}
              style={[styles.headerBtn, faultPlayerIds.size > 0 && styles.headerBtnFault]}
              accessibilityRole="button"
              accessibilityLabel={t('tactical.positionCheckTitle')}
            >
              <Text style={styles.headerBtnText}>⚠️</Text>
            </Pressable>
          )}

          <Pressable onPress={handleNewBoard} style={styles.headerBtn} accessibilityRole="button"
            accessibilityLabel="Nouveau schéma">
            <Text style={styles.headerBtnText}>🗒</Text>
          </Pressable>

          <Pressable
            onPress={() => setShowMenu((v) => !v)}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={t('tactical.menu')}
          >
            <Text style={styles.headerBtnText}>⋮</Text>
          </Pressable>
        </View>

        {/* Hamburger menu overlay */}
        {showMenu && (
          <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)}>
            <View style={styles.menuCard}>
              <Pressable
                style={styles.menuItem}
                onPress={() => { setShowMenu(false); setPlaybookMode('load'); setShowPlaybook(true); }}
              >
                <Text style={styles.menuItemIcon}>📂</Text>
                <Text style={styles.menuItemText}>{t('tactical.loadPlay')}</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable
                style={styles.menuItem}
                onPress={() => { setShowMenu(false); setPlaybookMode('save'); setShowPlaybook(true); }}
              >
                <Text style={styles.menuItemIcon}>💾</Text>
                <Text style={styles.menuItemText}>{t('tactical.savePlay')}</Text>
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable
                style={styles.menuItem}
                onPress={() => { setShowMenu(false); clearArrows(); }}
              >
                <Text style={styles.menuItemIcon}>🧺</Text>
                <Text style={[styles.menuItemText, { color: palette.error }]}>{t('tactical.tools.clearAll')}</Text>
              </Pressable>
            </View>
          </Pressable>
        )}

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
                isFaulty={faultPlayerIds.has(player.playerId)}
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
          hasArrows={arrows.length > 0 || freehandPaths.some((fp) => fp.hasArrow)}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            isPlayingRef.current = false;
            setPlaying(false);
          }}
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
  headerBtnFault: {
    backgroundColor: palette.error + '30',
    borderWidth: 1,
    borderColor: palette.error,
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
  scorePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: palette.backgroundElevated,
    borderWidth: 1,
    borderColor: palette.accentPrimary + '40',
  },
  scorePillText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: palette.textPrimary,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  menuCard: {
    position: 'absolute',
    top: 52,
    right: 8,
    minWidth: 200,
    backgroundColor: palette.backgroundSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 12,
    zIndex: 101,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemIcon: { fontSize: 16 },
  menuItemText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textPrimary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: palette.backgroundElevated,
    marginHorizontal: 12,
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
