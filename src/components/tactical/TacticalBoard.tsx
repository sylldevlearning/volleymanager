import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
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
import type { Player } from '../../models/player';
import { updatePlayer } from '../../services/playerService';
import type { MatchFormat } from '../../models/match';
import type { CourtMap } from '../../stores/scoringStore';
import type { LiberoState } from '../../models/substitution';
import { getPlayerShortName } from '../../features/players/player-helpers';
import { palette } from '../../theme/tokens';
import { InfoTooltip } from '../ui/InfoTooltip';

const BENCH_W = 52;
const BENCH_TOKEN_SIZE = 32;

// ── Bench token — draggable bench player chip ─────────────────────────────────

interface BenchTokenItemProps {
  player: Player;
  isHome: boolean;
  onDrop: (player: Player, isHome: boolean, absX: number, absY: number) => void;
}

function BenchTokenItem({ player, isHome, onDrop }: BenchTokenItemProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  function notifyDrop(absX: number, absY: number) {
    onDrop(player, isHome, absX, absY);
  }

  const pan = Gesture.Pan()
    .onBegin(() => {
      scale.value = withSpring(1.15);
      opacity.value = withTiming(0.95, { duration: 120 });
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(notifyDrop)(e.absoluteX, e.absoluteY);
      tx.value = withSpring(0);
      ty.value = withSpring(0);
      scale.value = withSpring(1);
      opacity.value = withTiming(0.6, { duration: 200 });
    })
    .onFinalize(() => {
      tx.value = withSpring(0);
      ty.value = withSpring(0);
      scale.value = withSpring(1);
      opacity.value = withTiming(0.6, { duration: 200 });
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const bgColor = isHome ? '#1D4ED8' : '#E63946';

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          benchStyles.token,
          { width: BENCH_TOKEN_SIZE, height: BENCH_TOKEN_SIZE, borderRadius: BENCH_TOKEN_SIZE / 2, backgroundColor: bgColor },
          animStyle,
        ]}
      >
        <Text style={benchStyles.tokenLabel}>{String(player.number)}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const benchStyles = StyleSheet.create({
  token: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 8,
  },
  tokenLabel: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
});

// ─────────────────────────────────────────────────────────────────────────────

interface TacticalBoardProps {
  visible: boolean;
  onClose: () => void;
  format?: MatchFormat;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  matchId?: string;
  homePlayers?: Player[];
  awayPlayers?: Player[];
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

function buildSyncedPositions(
  homeTeamId: string,
  awayTeamId: string,
  onCourtHome: CourtMap,
  onCourtAway: CourtMap,
  liberoHome: LiberoState | null,
  liberoAway: LiberoState | null,
  homePlayers: Player[],
  awayPlayers: Player[],
  existingBall: PlayerPosition | undefined,
): PlayerPosition[] {
  const positions: PlayerPosition[] = [];

  function addTeam(
    courtMap: CourtMap,
    libero: LiberoState | null,
    players: Player[],
    teamId: string,
    isHome: boolean,
    coords: typeof HOME_POSITION_COORDS,
  ) {
    for (const posStr of Object.keys(courtMap)) {
      const pos = Number(posStr) as 1 | 2 | 3 | 4 | 5 | 6;
      const ownerId = courtMap[pos];
      if (!ownerId) continue;
      const isLiberoSlot = libero?.isOnCourt && libero.replacedPosition === pos;
      const actualId = isLiberoSlot ? libero!.liberoId : ownerId;
      const p = players.find((pl) => pl.id === actualId);
      const coord = coords[pos] ?? coords[1];
      positions.push({
        playerId: actualId,
        x: coord.x,
        y: coord.y,
        teamId,
        number: p?.number ?? pos,
        label: p ? getPlayerShortName(p) : String(pos),
        isHome,
        isLibero: actualId === libero?.liberoId,
      });
    }
  }

  addTeam(onCourtHome, liberoHome, homePlayers, homeTeamId, true, HOME_POSITION_COORDS);
  addTeam(onCourtAway, liberoAway, awayPlayers, awayTeamId, false, AWAY_POSITION_COORDS);

  positions.push({
    playerId: 'ball',
    x: existingBall?.x ?? 0.5,
    y: existingBall?.y ?? 0.5,
    teamId: '',
    number: 0,
    label: '🏐',
    isHome: false,
    isBall: true,
  });

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

type StepPhase = 'idle' | 'showing' | 'animating' | 'done';

export function TacticalBoard({
  visible,
  onClose,
  format = 'indoor_6v6',
  homeTeamId = 'home',
  awayTeamId = 'away',
  homeTeamName,
  awayTeamName,
  matchId,
  homePlayers = [],
  awayPlayers = [],
}: TacticalBoardProps) {
  const { t } = useTranslation();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  const {
    positions,
    arrows,
    freehandPaths,
    drawingOrder,
    selectedTool,
    arrowThickness,
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
    undoLastDrawing,
    advanceGroup,
    resetGroup,
    removeGroupDrawings,
    setTool,
    setArrowThickness,
    loadPlay,
    resetBoard,
  } = useTacticalStore();

  const {
    rotationHome, rotationAway,
    scoreHome, scoreAway, setsHome, setsAway,
    benchHome, benchAway,
    onCourtHome, onCourtAway,
    liberoHome, liberoAway,
  } = useScoringStore();

  const HEADER_H = 48;
  const PLAYBACK_H = 60;
  const TOOLBAR_H = 106;
  const PADDING = 16;
  const safeH = screenH - insets.top - insets.bottom;
  const availableH = safeH - HEADER_H - PLAYBACK_H - TOOLBAR_H - PADDING * 2;

  // ── UI state ──────────────────────────────────────────────────────────────
  const [drawPreview, setDrawPreview] = useState<DrawPreviewState | null>(null);
  const [pencilPreviewD, setPencilPreviewD] = useState<string | null>(null);
  const [showPlaybook, setShowPlaybook] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerPosition | null>(null);
  const [playbookMode, setPlaybookMode] = useState<'load' | 'save'>('load');
  const [currentFormat, setCurrentFormat] = useState<MatchFormat>(format);
  const [isSyncedWithMatch, setIsSyncedWithMatch] = useState(true);

  // ── Bench ─────────────────────────────────────────────────────────────────
  const courtRef = useRef<View>(null);
  const [courtPageX, setCourtPageX] = useState(0);
  const [courtPageY, setCourtPageY] = useState(0);
  const [localBenchHome, setLocalBenchHome] = useState<Player[]>([]);
  const [localBenchAway, setLocalBenchAway] = useState<Player[]>([]);

  const hasBench = currentFormat === 'indoor_6v6' && (benchHome.length > 0 || benchAway.length > 0);
  const benchOffset = hasBench ? BENCH_W * 2 : 0;
  const courtW = Math.max(80, Math.min(screenW - PADDING * 2 - benchOffset, availableH / 2));
  const courtH = courtW * 2;

  // ── Step-based playback state ─────────────────────────────────────────────
  const [playbackPositions, setPlaybackPositions] = useState<PlayerPosition[] | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepPhase, setStepPhase] = useState<StepPhase>('idle');
  const [stepSnapshots, setStepSnapshots] = useState<PlayerPosition[][] | null>(null);
  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  const [arrowOpacity, setArrowOpacity] = useState(1);
  const [playbackSpeed] = useState<0.5 | 1 | 2>(1);

  const animFrameRef = useRef<number | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackPositionsRef = useRef<PlayerPosition[] | null>(null);

  // Sorted unique groups from all ephemeral drawings
  const sortedGroupNums = useMemo(() => {
    const groups = new Set<number>();
    arrows.forEach((a) => groups.add(a.group));
    freehandPaths.filter((fp) => fp.hasArrow).forEach((fp) => {
      if (fp.group != null) groups.add(fp.group);
    });
    return [...groups].sort((a, b) => a - b);
  }, [arrows, freehandPaths]);

  const totalSteps = sortedGroupNums.length;
  const hasArrows = arrows.length > 0 || freehandPaths.some((fp) => fp.hasArrow);

  // Edit mode = no playback started yet (all arrows visible)
  const isEditMode = stepSnapshots === null;

  const displayPositions = playbackPositions ?? positions;

  // ── Gesture refs ──────────────────────────────────────────────────────────
  const drawStartX = useSharedValue(0);
  const drawStartY = useSharedValue(0);
  const pencilPointsRef = useRef<{ x: number; y: number }[]>([]);
  /** The playerId touched at the start of the current drawing gesture */
  const linkedPlayerIdRef = useRef<string | null>(null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      seedDefaultPlays().catch(console.error);
      if (matchId) {
        // Always re-sync from live match state on every open, regardless of
        // whether the user had dragged players before closing.
        setIsSyncedWithMatch(true);
      } else if (positions.length === 0) {
        setPositions(buildDefaultPositions(homeTeamId, awayTeamId, rotationHome, rotationAway, format));
      }
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setLocalBenchHome(benchHome); }, [benchHome]);
  useEffect(() => { setLocalBenchAway(benchAway); }, [benchAway]);

  // ── Match sync: auto-follow rotations & substitutions while isSyncedWithMatch is true ──
  useEffect(() => {
    if (!matchId || !visible || !isSyncedWithMatch) return;
    const hasCourtData = Object.keys(onCourtHome).length > 0;
    if (!hasCourtData) return;
    const ball = positions.find((p) => p.isBall);
    const synced = buildSyncedPositions(
      homeTeamId, awayTeamId,
      onCourtHome, onCourtAway,
      liberoHome, liberoAway,
      homePlayers, awayPlayers,
      ball,
    );
    setPositions(synced);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, visible, isSyncedWithMatch, onCourtHome, onCourtAway, liberoHome, liberoAway]);

  // When drawings change while in playback mode, invalidate stale snapshots.
  // Without this, stepSnapshots[stepIdx+1] can be undefined if more groups
  // were added after snapshots were computed, causing a crash in animateFromTo.
  const stepSnapshotsRef = useRef(stepSnapshots);
  useEffect(() => { stepSnapshotsRef.current = stepSnapshots; }, [stepSnapshots]);
  useEffect(() => { playbackPositionsRef.current = playbackPositions; }, [playbackPositions]);
  useEffect(() => {
    if (stepSnapshotsRef.current !== null) {
      // Commit the animated positions to the store before exiting playback so
      // that clearing playbackPositions does not snap players back to their
      // original (pre-animation) positions.
      if (playbackPositionsRef.current !== null) {
        setPositions(playbackPositionsRef.current);
      }
      setStepSnapshots(null);
      setCurrentStep(0);
      setStepPhase('idle');
      setActiveGroup(null);
      setArrowOpacity(1);
      setPlaybackPositions(null);
    }
  // drawingOrder changes on every add/remove — it does NOT change when only
  // currentGroup changes, so this effect never fires just because the user
  // tapped the group-advance button.
  }, [drawingOrder]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
      if (fadeIntervalRef.current != null) clearInterval(fadeIntervalRef.current);
    };
  }, []);

  // ── Freehand path helpers ─────────────────────────────────────────────────
  function parseFreehandPoints(d: string): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    const re = /[ML]\s*([\d.]+)\s+([\d.]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(d)) !== null) {
      pts.push({ x: parseFloat(m[1]) / courtW, y: parseFloat(m[2]) / courtH });
    }
    return pts;
  }

  // ── Snapshot computation ──────────────────────────────────────────────────
  function applyGroupMovement(currentPositions: PlayerPosition[], groupNum: number): PlayerPosition[] {
    const groupArrows = arrows.filter((a) => a.group === groupNum);
    const groupPaths = freehandPaths.filter((fp) => fp.hasArrow && fp.group === groupNum);

    const claimed = new Set<string>();
    const movements: { playerId: string; toX: number; toY: number }[] = [];

    for (const arrow of groupArrows) {
      // Use linkedPlayerId if recorded, otherwise fall back to nearest-player heuristic
      let playerId = arrow.linkedPlayerId ?? null;
      if (!playerId || claimed.has(playerId)) {
        const candidates = currentPositions.filter((p) => !claimed.has(p.playerId));
        playerId = findNearestPlayer(candidates, arrow.fromX, arrow.fromY)?.playerId ?? null;
      }
      if (playerId && !claimed.has(playerId)) {
        claimed.add(playerId);
        movements.push({ playerId, toX: arrow.toX, toY: arrow.toY });
      }
    }

    for (const fp of groupPaths) {
      const points = parseFreehandPoints(fp.d);
      if (points.length < 2) continue;
      const startPt = points[0];
      const endPt = points[points.length - 1];
      let playerId = fp.linkedPlayerId ?? null;
      if (!playerId || claimed.has(playerId)) {
        const candidates = currentPositions.filter((p) => !claimed.has(p.playerId));
        playerId = findNearestPlayer(candidates, startPt.x, startPt.y)?.playerId ?? null;
      }
      if (playerId && !claimed.has(playerId)) {
        claimed.add(playerId);
        movements.push({ playerId, toX: endPt.x, toY: endPt.y });
      }
    }

    return currentPositions.map((p) => {
      const m = movements.find((mv) => mv.playerId === p.playerId);
      return m ? { ...p, x: m.toX, y: m.toY } : p;
    });
  }

  function computeSnapshots(initialPositions: PlayerPosition[]): PlayerPosition[][] {
    const snaps: PlayerPosition[][] = [[...initialPositions]];
    let current = initialPositions;
    for (const groupNum of sortedGroupNums) {
      current = applyGroupMovement(current, groupNum);
      snaps.push([...current]);
    }
    return snaps;
  }

  // ── Animation helpers ─────────────────────────────────────────────────────
  function animateFromTo(
    fromPositions: PlayerPosition[],
    toPositions: PlayerPosition[],
    durationMs: number,
    onComplete: () => void,
  ) {
    // Defensive: snapshots can be stale if drawings changed mid-playback
    if (!fromPositions || !toPositions) { onComplete(); return; }
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    let start: number | null = null;

    function frame(now: number) {
      if (start === null) start = now;
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = easeInOut(progress);

      const interpolated = fromPositions.map((p) => {
        const target = toPositions.find((t) => t.playerId === p.playerId);
        if (!target) return p;
        return {
          ...p,
          x: p.x + (target.x - p.x) * eased,
          y: p.y + (target.y - p.y) * eased,
        };
      });
      setPlaybackPositions(interpolated);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        onComplete();
      }
    }

    animFrameRef.current = requestAnimationFrame(frame);
  }

  function fadeOutArrows(onComplete: () => void) {
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    const startTime = Date.now();
    const duration = 300;
    fadeIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setArrowOpacity(1 - progress);
      if (progress >= 1) {
        clearInterval(fadeIntervalRef.current!);
        fadeIntervalRef.current = null;
        onComplete();
      }
    }, 16);
  }

  // ── Playback controls ─────────────────────────────────────────────────────
  function handleStepForward() {
    if (stepPhase !== 'idle' || currentStep >= totalSteps) return;

    let snaps = stepSnapshots;
    if (snaps === null) {
      snaps = computeSnapshots(positions);
      setStepSnapshots(snaps);
    }

    const stepIdx = currentStep;
    const groupNum = sortedGroupNums[stepIdx];
    setActiveGroup(groupNum);
    setArrowOpacity(1);
    setStepPhase('animating');

    const fromPos = snaps[stepIdx];
    const toPos = snaps[stepIdx + 1];
    // Guard: stale snapshot (drawings changed between compute and press)
    if (!fromPos || !toPos) {
      setStepSnapshots(null);
      setStepPhase('idle');
      setActiveGroup(null);
      return;
    }
    const duration = 800 / playbackSpeed;

    animateFromTo(fromPos, toPos, duration, () => {
      setStepPhase('done');
      fadeOutArrows(() => {
        setArrowOpacity(1);
        setCurrentStep(stepIdx + 1);
        setStepPhase('idle');
        setActiveGroup(null);
      });
    });
  }

  function handleStepBack() {
    if (stepPhase !== 'idle' || currentStep <= 0) return;

    let snaps = stepSnapshots;
    if (snaps === null) {
      snaps = computeSnapshots(positions);
      setStepSnapshots(snaps);
    }

    const prevStep = currentStep - 1;
    const groupNum = sortedGroupNums[prevStep];

    // Snap back instantly
    setPlaybackPositions([...snaps[prevStep]]);
    setCurrentStep(prevStep);

    // Briefly show the arrows for the step we reversed
    setActiveGroup(groupNum);
    setArrowOpacity(0.65);
    setStepPhase('showing');

    const t = setTimeout(() => {
      fadeOutArrows(() => {
        setArrowOpacity(1);
        setStepPhase('idle');
        setActiveGroup(null);
      });
    }, 450);

    // Cleanup timeout on unmount (best-effort — the component is long-lived)
    return () => clearTimeout(t);
  }

  function handleGoToStart() {
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    if (fadeIntervalRef.current != null) clearInterval(fadeIntervalRef.current);
    // Reset to edit mode: all arrows visible, original positions
    setCurrentStep(0);
    setStepPhase('idle');
    setActiveGroup(null);
    setArrowOpacity(1);
    setStepSnapshots(null);
    setPlaybackPositions(null);
  }

  function handleGoToEnd() {
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    if (fadeIntervalRef.current != null) clearInterval(fadeIntervalRef.current);

    let snaps = stepSnapshots;
    if (snaps === null) {
      snaps = computeSnapshots(positions);
      setStepSnapshots(snaps);
    }

    setPlaybackPositions([...snaps[totalSteps]]);
    setCurrentStep(totalSteps);
    setStepPhase('idle');
    setActiveGroup(null);
    setArrowOpacity(1);
  }

  function handleReset() {
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    if (fadeIntervalRef.current != null) clearInterval(fadeIntervalRef.current);
    setCurrentStep(0);
    setStepPhase('idle');
    setActiveGroup(null);
    setArrowOpacity(1);
    setStepSnapshots(null);
    setPlaybackPositions(null);
  }

  // ── Group colors ──────────────────────────────────────────────────────────
  const GROUP_COLORS = ['#E63946', '#1D4ED8', '#2EA043', '#F59E0B', '#8B5CF6', '#EC4899'];
  const groupColor = GROUP_COLORS[(currentGroup - 1) % GROUP_COLORS.length];

  // ── Group advance / reset — exit playback first, keep current positions ───
  function exitPlaybackWithCommit() {
    if (stepSnapshots === null) return;
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    if (fadeIntervalRef.current != null) clearInterval(fadeIntervalRef.current);
    if (playbackPositions !== null) setPositions(playbackPositions);
    setStepSnapshots(null);
    setCurrentStep(0);
    setStepPhase('idle');
    setActiveGroup(null);
    setArrowOpacity(1);
    setPlaybackPositions(null);
  }

  function handleAdvanceGroup() {
    const groupNum = currentGroup;
    const basePositions = playbackPositions ?? positions;

    exitPlaybackWithCommit();

    const hasGroupDrawings =
      arrows.some((a) => a.group === groupNum) ||
      freehandPaths.some((fp) => fp.hasArrow && fp.group === groupNum);

    if (!hasGroupDrawings) {
      advanceGroup();
      return;
    }

    const targetPositions = applyGroupMovement(basePositions, groupNum);
    setStepPhase('animating');

    animateFromTo(basePositions, targetPositions, 400, () => {
      setPositions(targetPositions);
      setPlaybackPositions(null);
      removeGroupDrawings(groupNum);
      advanceGroup();
      setStepPhase('idle');
    });
  }

  function handleResetGroup() {
    exitPlaybackWithCommit();
    resetGroup();
  }

  // ── Drawing gestures ──────────────────────────────────────────────────────
  const isDrawMode = selectedTool === 'arrow_solid' || selectedTool === 'arrow_dashed';
  const isCurvedMode = selectedTool === 'arrow_curved';
  const drawColor = groupColor;
  const drawType: 'solid' | 'dashed' = selectedTool === 'arrow_dashed' ? 'dashed' : 'solid';

  function captureLinkedPlayer(touchX: number, touchY: number) {
    const TOUCH_RADIUS_PX = 30;
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const p of displayPositions) {
      if (p.isBall) continue;
      const px = p.x * courtW;
      const py = p.y * courtH;
      const dist = Math.hypot(touchX - px, touchY - py);
      if (dist < TOUCH_RADIUS_PX && dist < bestDist) {
        bestDist = dist;
        bestId = p.playerId;
      }
    }
    linkedPlayerIdRef.current = bestId;
  }

  function commitArrow(fromXR: number, fromYR: number, toXR: number, toYR: number) {
    addArrow({
      type: drawType,
      fromX: fromXR, fromY: fromYR,
      toX: toXR, toY: toYR,
      color: drawColor,
      thickness: arrowThickness,
      linkedPlayerId: linkedPlayerIdRef.current,
    });
    linkedPlayerIdRef.current = null;
  }

  const drawGesture = Gesture.Pan()
    .enabled(isDrawMode)
    .minDistance(8)
    .onBegin((e) => {
      drawStartX.value = e.x;
      drawStartY.value = e.y;
      runOnJS(captureLinkedPlayer)(e.x, e.y);
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
        runOnJS(commitArrow)(fromXR, fromYR, toXR, toYR);
      } else {
        linkedPlayerIdRef.current = null;
      }
      runOnJS(setDrawPreview)(null);
    });

  const isPencilMode = selectedTool === 'pencil';
  const pencilColor = isCurvedMode ? drawColor : '#E63946';

  function buildPathD(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }

  function onPencilBegin(x: number, y: number, captureLinked = false) {
    if (captureLinked) captureLinkedPlayer(x, y);
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
      addFreehandPath(buildPathD(pts), drawColor, true, currentGroup, linkedPlayerIdRef.current);
    }
    pencilPointsRef.current = [];
    setPencilPreviewD(null);
    linkedPlayerIdRef.current = null;
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
    .onBegin((e) => { runOnJS(onPencilBegin)(e.x, e.y, true); })
    .onUpdate((e) => { runOnJS(onPencilUpdate)(e.x, e.y); })
    .onEnd(() => { runOnJS(onCurvedEnd)(); })
    .onFinalize(() => { runOnJS(onCurvedEnd)(); });

  const allDrawGesture = Gesture.Exclusive(drawGesture, curvedGesture, pencilGesture);

  // ── Court layout ──────────────────────────────────────────────────────────
  function handleCourtLayout() {
    courtRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      setCourtPageX(pageX);
      setCourtPageY(pageY);
    });
  }

  function handleBenchSwap(benchPlayer: Player, isHome: boolean, absX: number, absY: number) {
    const relX = (absX - courtPageX) / courtW;
    const relY = (absY - courtPageY) / courtH;
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return;

    const teamPlayers = positions.filter((p) => !p.isBall && p.isHome === isHome);
    const nearest = findNearestPlayer(teamPlayers, relX, relY);
    if (!nearest) return;

    setPositions(
      positions.map((p) => {
        if (p.playerId !== nearest.playerId) return p;
        return {
          ...p,
          number: benchPlayer.number,
          label: String(benchPlayer.number),
          firstName: benchPlayer.firstName,
          lastName: benchPlayer.lastName,
        };
      }),
    );

    const outgoing: Player = {
      id: nearest.playerId,
      teamId: nearest.teamId,
      firstName: nearest.firstName ?? null,
      lastName: nearest.lastName ?? null,
      number: nearest.number,
      position: null,
      photoUri: null,
      isActive: true,
      createdAt: '',
    };

    if (isHome) {
      setLocalBenchHome((prev) => [...prev.filter((p) => p.id !== benchPlayer.id), outgoing]);
    } else {
      setLocalBenchAway((prev) => [...prev.filter((p) => p.id !== benchPlayer.id), outgoing]);
    }
  }

  function handleDragEnd(playerId: string, x: number, y: number) {
    movePlayer(playerId, x, y);
    if (isSyncedWithMatch) setIsSyncedWithMatch(false);
  }

  function handleSyncFromMatch() {
    setIsSyncedWithMatch(true);
    // isSyncedWithMatch entering deps array triggers the sync useEffect automatically
  }

  function handleTokenTap(playerId: string) {
    if (playerId === 'ball') return;
    const found = positions.find((p) => p.playerId === playerId);
    if (found) setEditingPlayer(found);
  }

  async function handleEditSave(
    playerId: string,
    updates: { number: number; firstName: string; lastName: string; customColor?: string },
  ) {
    const newLabel = String(updates.number);
    updatePlayerInfo(playerId, {
      number: updates.number,
      firstName: updates.firstName || null,
      lastName: updates.lastName || null,
      label: newLabel,
      customColor: updates.customColor,
    });
    const isSynthetic = playerId.startsWith('home_') || playerId.startsWith('away_');
    if (!isSynthetic) {
      try {
        await updatePlayer(playerId, {
          firstName: updates.firstName || null,
          lastName: updates.lastName || null,
          number: updates.number,
        });
      } catch {
        // Best-effort
      }
    }
  }

  function handleLoadPlay(play: TacticalPlay) {
    loadPlay(play);
    setCurrentFormat(play.format);
    handleReset();
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
    handleReset();
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
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.headerBtn} accessibilityRole="button">
            <Text style={styles.headerBtnText}>✕</Text>
          </Pressable>

          {!homeTeamName && (
            <Pressable onPress={handleToggleFormat} style={styles.formatChip} accessibilityRole="button">
              <Text style={styles.formatChipText}>
                {currentFormat === 'indoor_6v6' ? '6×6' : '2×2'}
              </Text>
            </Pressable>
          )}

          <Text style={styles.title}>{t('tactical.title')}</Text>

          {(scoreHome > 0 || scoreAway > 0 || setsHome > 0 || setsAway > 0) && (
            <View style={styles.scorePill}>
              <Text style={styles.scorePillText}>
                {setsHome}–{setsAway} ({scoreHome}–{scoreAway})
              </Text>
            </View>
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
          <InfoTooltip textKey="help.tactical" />
        </View>

        {/* Hamburger menu */}
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
                onPress={() => { setShowMenu(false); clearArrows(); handleReset(); }}
              >
                <Text style={styles.menuItemIcon}>🧺</Text>
                <Text style={[styles.menuItemText, { color: palette.error }]}>{t('tactical.tools.clearAll')}</Text>
              </Pressable>
            </View>
          </Pressable>
        )}

        {/* Court container */}
        <View style={styles.courtContainer}>
          {hasBench && (
            <View style={[styles.benchColumn, { width: BENCH_W }]}>
              {localBenchHome.map((p) => (
                <BenchTokenItem key={p.id} player={p} isHome={true} onDrop={handleBenchSwap} />
              ))}
              {localBenchHome.length === 0 && (
                <Text style={styles.benchEmptyLabel}>–</Text>
              )}
            </View>
          )}

          <View ref={courtRef} onLayout={handleCourtLayout} style={[styles.court, { width: courtW, height: courtH }]}>
            <CourtSVG width={courtW} height={courtH} format={currentFormat} />

            <View style={styles.drawLayer}>
              {selectedTool === 'eraser' ? (
                <ArrowOverlay
                  arrows={arrows}
                  freehandPaths={freehandPaths}
                  courtWidth={courtW}
                  courtHeight={courtH}
                  eraserMode={true}
                  drawPreview={null}
                  pencilPreviewD={null}
                  pencilColor={pencilColor}
                  onRemoveArrow={removeArrow}
                  isEditMode={true}
                  activeGroup={null}
                  arrowOpacity={1}
                />
              ) : (
                <GestureDetector gesture={allDrawGesture}>
                  <Animated.View style={{ flex: 1 }}>
                    <ArrowOverlay
                      arrows={arrows}
                      freehandPaths={freehandPaths}
                      courtWidth={courtW}
                      courtHeight={courtH}
                      eraserMode={false}
                      drawPreview={drawPreview}
                      pencilPreviewD={pencilPreviewD}
                      pencilColor={pencilColor}
                      onRemoveArrow={removeArrow}
                      isEditMode={isEditMode}
                      activeGroup={activeGroup}
                      arrowOpacity={arrowOpacity}
                    />
                  </Animated.View>
                </GestureDetector>
              )}
            </View>

            {displayPositions.map((player) => (
              <PlayerToken
                key={player.playerId}
                player={player}
                courtWidth={courtW}
                courtHeight={courtH}
                canDrag={selectedTool === 'move' && isEditMode}
                showName={false}
                onDragEnd={handleDragEnd}
                onTap={handleTokenTap}
                hapticsEnabled={hapticsEnabled}
              />
            ))}
          </View>

          {hasBench && (
            <View style={[styles.benchColumn, { width: BENCH_W }]}>
              {localBenchAway.map((p) => (
                <BenchTokenItem key={p.id} player={p} isHome={false} onDrop={handleBenchSwap} />
              ))}
              {localBenchAway.length === 0 && (
                <Text style={styles.benchEmptyLabel}>–</Text>
              )}
            </View>
          )}
        </View>

        {/* Playback controls */}
        <PlaybackControls
          currentStep={currentStep}
          totalSteps={totalSteps}
          stepPhase={stepPhase}
          hasArrows={hasArrows}
          onStepForward={handleStepForward}
          onStepBack={handleStepBack}
          onGoToStart={handleGoToStart}
          onGoToEnd={handleGoToEnd}
        />

        {/* Toolbar */}
        <ToolBar
          selectedTool={selectedTool}
          arrowThickness={arrowThickness}
          currentGroup={currentGroup}
          currentGroupColor={groupColor}
          hasDrawings={drawingOrder.length > 0}
          onSelectTool={setTool}
          onAdvanceGroup={handleAdvanceGroup}
          onResetGroup={handleResetGroup}
          onUndoDrawing={undoLastDrawing}
          onClearAll={() => { clearArrows(); handleReset(); }}
          onSyncFromMatch={matchId ? handleSyncFromMatch : undefined}
        />

        <PlayerEditSheet
          visible={editingPlayer !== null}
          player={editingPlayer}
          onClose={() => setEditingPlayer(null)}
          onSave={handleEditSave}
        />

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
    overflow: 'visible',
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
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    overflow: 'visible',
  },
  benchColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 10,
    elevation: 10,
  },
  benchEmptyLabel: {
    fontSize: 16,
    color: palette.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  court: {
    position: 'relative',
    overflow: 'visible',
  },
  drawLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
});
