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
import { ApplyToMatchSheet } from './ApplyToMatchSheet';
import { useTacticalStore } from '../../features/tactical/tacticalStore';
import { seedDefaultPlays } from '../../features/tactical/tacticalService';
import { openMatchBoard, saveMatchBoard } from '../../features/tactical/boardPersistence';
import { matchPhase, planBoardApply, rulesContextFromStore, type ApplyPlan } from '../../features/tactical/applyToMatch';
import { recordSubstitution, type SubstitutionContext } from '../../features/match/recordSubstitution';
import { applyBoardLineup } from '../../features/match/applyLineup';
import { HOME_POSITION_COORDS, AWAY_POSITION_COORDS, findNearestPlayer, clamp, easeInOut } from '../../features/tactical/positionUtils';
import { buildDefaultBench, benchFromPlayers, findTokenAt, MAX_ON_COURT } from '../../features/tactical/benchUtils';
import { useScoringStore } from '../../stores/scoringStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { PlayerPosition, TacticalPlay, StepSnapshot, Arrow, FreehandPath, BenchPlayer } from '../../models/tactical';
import type { Player } from '../../models/player';
import { updatePlayer } from '../../services/playerService';
import type { MatchFormat } from '../../models/match';
import type { CourtMap } from '../../stores/scoringStore';
import type { LiberoState } from '../../models/substitution';
import { getPlayerShortName } from '../../features/players/player-helpers';
import { palette } from '../../theme/tokens';
import { InfoTooltip } from '../ui/InfoTooltip';
import { CoachMarks } from '../ui/CoachMarks';
import * as Haptics from 'expo-haptics';

const BENCH_TOKEN_SIZE = 30;
/** Height of the substitutes strip under the court (label + two rows of tokens) */
const BENCH_H = 96;
/** Max distance (px) between a dropped substitute and a court token to swap them */
const SWAP_RADIUS_PX = 28;
/** Debounce of the match board auto-save */
const SAVE_DELAY_MS = 500;

// ── Bench token — draggable / tappable substitute chip ───────────────────────

interface BenchTokenItemProps {
  player: BenchPlayer;
  enabled: boolean;
  hapticsEnabled: boolean;
  onDragStart: () => void;
  onDrop: (player: BenchPlayer, absX: number, absY: number) => void;
  onTap: (player: BenchPlayer) => void;
}

function BenchTokenItem({ player, enabled, hapticsEnabled, onDragStart, onDrop, onTap }: BenchTokenItemProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);

  function notifyDragStart() {
    if (hapticsEnabled) Haptics.selectionAsync();
    onDragStart();
  }
  function notifyDrop(absX: number, absY: number) {
    onDrop(player, absX, absY);
  }
  function notifyTap() {
    onTap(player);
  }

  const pan = Gesture.Pan()
    .enabled(enabled)
    .minDistance(10)
    .onStart(() => {
      scale.value = withSpring(1.2);
      runOnJS(notifyDragStart)();
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(notifyDrop)(e.absoluteX, e.absoluteY);
    })
    .onFinalize(() => {
      tx.value = withSpring(0);
      ty.value = withSpring(0);
      scale.value = withSpring(1);
    });

  const tap = Gesture.Tap()
    .enabled(enabled)
    .maxDuration(200)
    .maxDistance(10)
    .onEnd((_e, success) => {
      if (success) runOnJS(notifyTap)();
    });

  // Same ordering as PlayerToken: Pan first, Tap handles quick taps.
  const gesture = Gesture.Exclusive(pan, tap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const bgColor = player.isLibero
    ? '#FBBF24'
    : (player.customColor ?? (player.isHome ? palette.teamHome : palette.teamAway));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[benchStyles.token, { backgroundColor: bgColor }, animStyle]}
        accessibilityRole="button"
        accessibilityLabel={getPlayerShortName(player)}
      >
        <Text style={benchStyles.tokenLabel}>{String(player.number)}</Text>
      </Animated.View>
    </GestureDetector>
  );
}

const benchStyles = StyleSheet.create({
  token: {
    width: BENCH_TOKEN_SIZE,
    height: BENCH_TOKEN_SIZE,
    borderRadius: BENCH_TOKEN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
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
  format: MatchFormat,
): PlayerPosition[] {
  const positions: PlayerPosition[] = [];
  // Teams without a lineup (quick match: no roster) get the numbered default tokens
  const fallback = buildDefaultPositions(homeTeamId, awayTeamId, [], [], format);

  function addTeam(
    courtMap: CourtMap,
    libero: LiberoState | null,
    players: Player[],
    teamId: string,
    isHome: boolean,
    coords: typeof HOME_POSITION_COORDS,
  ) {
    if (Object.keys(courtMap).length === 0) {
      positions.push(...fallback.filter((p) => !p.isBall && p.isHome === isHome));
      return;
    }
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
    benchHome,
    benchAway,
    setBench,
    swapWithBench,
    sendToBench,
    enterFromBench,
    updatePlayerInfo,
    addArrow,
    removeArrow,
    clearArrows,
    addFreehandPath,
    undoLastDrawing,
    advanceGroup,
    resetGroup,
    removeGroupDrawings,
    addHistorySnapshot,
    history,
    setTool,
    setArrowThickness,
    loadPlay,
    resetBoard,
    clearBenchMoves,
  } = useTacticalStore();

  const {
    rotationHome, rotationAway,
    scoreHome, scoreAway, setsHome, setsAway,
    benchHome: matchBenchHome, benchAway: matchBenchAway,
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
  /** Match board only: false until this match's save is restored (or found missing) */
  const [boardReady, setBoardReady] = useState(!matchId);

  // ── Bench ─────────────────────────────────────────────────────────────────
  const courtRef = useRef<View>(null);
  const benchRef = useRef<View>(null);
  const toolbarRef = useRef<View>(null);
  // Screen coordinates, re-measured at each drag start (the modal slides in after layout)
  const courtPageRef = useRef({ x: 0, y: 0 });
  const benchPageYRef = useRef(Infinity);
  /** Which layer is being dragged from — raised above the other so the token stays visible */
  const [dragSource, setDragSource] = useState<'court' | 'bench' | null>(null);

  const hasBench = currentFormat === 'indoor_6v6';
  const courtAvailableH = availableH - (hasBench ? BENCH_H : 0);
  const courtW = Math.max(80, Math.min(screenW - PADDING * 2, courtAvailableH / 2));
  const courtH = courtW * 2;

  // ── Playback / history-browse state ──────────────────────────────────────
  const [playbackPositions, setPlaybackPositions] = useState<PlayerPosition[] | null>(null);
  const [stepPhase, setStepPhase] = useState<StepPhase>('idle');
  /** -1 = live (normal); ≥ 0 = browsing history at that index */
  const [historyViewStep, setHistoryViewStep] = useState(-1);
  /** Opacity of ephemeral drawings — animated to 0 during fade-out after advance */
  const [drawingFadeOpacity, setDrawingFadeOpacity] = useState(1);
  /** Non-null while replaying a history step: the group number being replayed */
  const [replayGroupNum, setReplayGroupNum] = useState<number | null>(null);

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

  // total = completed steps + pending groups still on board
  const totalSteps = history.length + sortedGroupNums.length;
  const hasCurrentArrows = arrows.length > 0 || freehandPaths.some((fp) => fp.hasArrow);
  const inHistory = historyViewStep >= 0;

  // Edit mode: live view, not animating
  const isEditMode = !inHistory && stepPhase === 'idle';

  const displayPositions = playbackPositions ?? positions;
  // In history browse show the snapshot's stored drawings, otherwise show live store arrows
  const overlayArrowsDisplay = inHistory ? (history[historyViewStep]?.drawings ?? []) : arrows;
  const overlayFreehandDisplay = inHistory ? (history[historyViewStep]?.freehandDrawings ?? []) : freehandPaths;

  // ArrowOverlay display mode:
  //   edit mode OR history browse (idle) → show all drawings at full opacity
  //   animating live advance OR replaying history → show only active group at drawingFadeOpacity
  const isReplayingHistory = replayGroupNum !== null;
  const arrowEditMode = isEditMode || (inHistory && !isReplayingHistory);
  const activeGroupForOverlay = isReplayingHistory
    ? replayGroupNum
    : (!isEditMode && !inHistory ? currentGroup : null);

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
        // Restore this match's board; without a save, start from the match state
        let cancelled = false;
        openMatchBoard(matchId).then((opened) => {
          if (cancelled) return;
          if (opened.restored) {
            setIsSyncedWithMatch(opened.syncedWithMatch);
            setCurrentFormat(opened.format);
          } else {
            resetBoard();
            setIsSyncedWithMatch(true);
            setCurrentFormat(format);
          }
          setBoardReady(true);
        }).catch(() => {
          if (!cancelled) setBoardReady(true);
        });
        return () => { cancelled = true; };
      } else if (positions.length === 0) {
        setPositions(buildDefaultPositions(homeTeamId, awayTeamId, rotationHome, rotationAway, format));
        setBench(buildDefaultBench(homeTeamId, true), buildDefaultBench(awayTeamId, false));
      }
    } else if (matchId) {
      // Closed: the next open restores the save again before syncing or saving
      setBoardReady(false);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Match sync: auto-follow rotations & substitutions while isSyncedWithMatch is true ──
  useEffect(() => {
    if (!matchId || !visible || !boardReady || !isSyncedWithMatch) return;
    const ball = positions.find((p) => p.isBall);
    const synced = buildSyncedPositions(
      homeTeamId, awayTeamId,
      onCourtHome, onCourtAway,
      liberoHome, liberoAway,
      homePlayers, awayPlayers,
      ball,
      format,
    );
    setPositions(synced);
    clearBenchMoves();
    setBench(
      homePlayers.length > 0 ? benchFromPlayers(matchBenchHome, homeTeamId, true) : buildDefaultBench(homeTeamId, true),
      awayPlayers.length > 0 ? benchFromPlayers(matchBenchAway, awayTeamId, false) : buildDefaultBench(awayTeamId, false),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, visible, boardReady, isSyncedWithMatch, onCourtHome, onCourtAway, liberoHome, liberoAway, matchBenchHome, matchBenchAway]);

  // ── Match board auto-save: every change, debounced, survives an app kill ──
  const saveMetaRef = useRef({ syncedWithMatch: isSyncedWithMatch, format: currentFormat });
  saveMetaRef.current = { syncedWithMatch: isSyncedWithMatch, format: currentFormat };
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveBoardNow = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    if (matchId) saveMatchBoard(matchId, saveMetaRef.current).catch(console.error);
  }, [matchId]);

  useEffect(() => {
    if (!matchId || !visible || !boardReady) return;
    const schedule = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(saveBoardNow, SAVE_DELAY_MS);
    };
    schedule();
    const unsubscribe = useTacticalStore.subscribe(schedule);
    return () => {
      unsubscribe();
      // Leaving (close, unmount, other match): write what is pending right away
      if (saveTimerRef.current) saveBoardNow();
    };
  }, [matchId, visible, boardReady, isSyncedWithMatch, currentFormat, saveBoardNow]);

  useEffect(() => { playbackPositionsRef.current = playbackPositions; }, [playbackPositions]);
  // When drawings change (add/undo/advance) exit history browse mode
  useEffect(() => {
    if (historyViewStep >= 0) {
      setHistoryViewStep(-1);
      setPlaybackPositions(null);
      setReplayGroupNum(null);
      setDrawingFadeOpacity(1);
    }
  }, [drawingOrder]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Animation helpers ─────────────────────────────────────────────────────

  /** Animate each player along its drawn trajectory (freehand = multi-waypoint, arrow = straight). */
  function animateAlongPaths(
    basePositions: PlayerPosition[],
    groupArrows: Arrow[],
    groupFreehand: FreehandPath[],
    durationMs: number,
    onComplete: () => void,
  ) {
    type PlayerWaypoints = { playerId: string; points: { x: number; y: number }[] };
    const playerWaypoints: PlayerWaypoints[] = [];
    const claimed = new Set<string>();

    for (const arrow of groupArrows) {
      let playerId = arrow.linkedPlayerId ?? null;
      if (!playerId || claimed.has(playerId)) {
        const candidates = basePositions.filter((p) => !claimed.has(p.playerId));
        playerId = findNearestPlayer(candidates, arrow.fromX, arrow.fromY)?.playerId ?? null;
      }
      if (playerId && !claimed.has(playerId)) {
        claimed.add(playerId);
        playerWaypoints.push({
          playerId,
          points: [{ x: arrow.fromX, y: arrow.fromY }, { x: arrow.toX, y: arrow.toY }],
        });
      }
    }

    for (const fp of groupFreehand) {
      const points = parseFreehandPoints(fp.d);
      if (points.length < 2) continue;
      let playerId = fp.linkedPlayerId ?? null;
      if (!playerId || claimed.has(playerId)) {
        const candidates = basePositions.filter((p) => !claimed.has(p.playerId));
        playerId = findNearestPlayer(candidates, points[0].x, points[0].y)?.playerId ?? null;
      }
      if (playerId && !claimed.has(playerId)) {
        claimed.add(playerId);
        playerWaypoints.push({ playerId, points });
      }
    }

    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    let start: number | null = null;

    function frame(now: number) {
      if (start === null) start = now;
      const rawProgress = Math.min((now - start) / durationMs, 1);
      const eased = easeInOut(rawProgress);

      const interpolated = basePositions.map((p) => {
        const wp = playerWaypoints.find((w) => w.playerId === p.playerId);
        if (!wp) return p;
        const { points } = wp;
        const totalSegments = points.length - 1;
        const scaledT = eased * totalSegments;
        const seg = Math.min(Math.floor(scaledT), totalSegments - 1);
        const localT = scaledT - seg;
        const from = points[seg];
        const to = points[seg + 1];
        return { ...p, x: from.x + (to.x - from.x) * localT, y: from.y + (to.y - from.y) * localT };
      });

      setPlaybackPositions(interpolated);

      if (rawProgress < 1) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        onComplete();
      }
    }

    animFrameRef.current = requestAnimationFrame(frame);
  }

  /** Animate `drawingFadeOpacity` from 1 → 0 over `durationMs`, then call `onComplete`. */
  function fadeOutDrawings(durationMs: number, onComplete: () => void) {
    let start: number | null = null;

    function frame(now: number) {
      if (start === null) start = now;
      const progress = Math.min((now - start) / durationMs, 1);
      setDrawingFadeOpacity(1 - progress);
      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        setDrawingFadeOpacity(1);
        onComplete();
      }
    }

    animFrameRef.current = requestAnimationFrame(frame);
  }

  // ── Step controls (history-browse mode) ──────────────────────────────────

  /** Replay history[stepIndex] with full path animation + fade, then advance to next step. */
  function handleReplayHistoryStep(stepIndex: number) {
    const step = history[stepIndex];
    if (!step) return;

    setReplayGroupNum(step.group);
    setStepPhase('animating');
    setPlaybackPositions([...step.positionsBefore]);

    animateAlongPaths(step.positionsBefore, step.drawings, step.freehandDrawings, 800, () => {
      setPlaybackPositions([...step.positionsAfter]);
      fadeOutDrawings(300, () => {
        setReplayGroupNum(null);
        setStepPhase('idle');
        if (stepIndex < history.length - 1) {
          setHistoryViewStep(stepIndex + 1);
          setPlaybackPositions([...history[stepIndex + 1].positionsBefore]);
        } else {
          setHistoryViewStep(-1);
          setPlaybackPositions(null);
        }
      });
    });
  }

  function handleStepForward() {
    if (stepPhase !== 'idle') return;

    if (inHistory) {
      // Replay this step with animation along saved trajectory
      handleReplayHistoryStep(historyViewStep);
      return;
    }

    // Live mode: advance current group (same as T1→T2 button)
    if (hasCurrentArrows) handleAdvanceGroup();
  }

  function handleStepBack() {
    if (stepPhase !== 'idle') return;

    if (!inHistory) {
      // Live → go to last history step
      if (history.length === 0) return;
      const step = history.length - 1;
      setHistoryViewStep(step);
      setPlaybackPositions([...history[step].positionsBefore]);
      return;
    }

    if (historyViewStep > 0) {
      const step = historyViewStep - 1;
      setHistoryViewStep(step);
      setPlaybackPositions([...history[step].positionsBefore]);
    }
    // historyViewStep === 0 → already at start, nothing to do
  }

  function handleGoToStart() {
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    setStepPhase('idle');
    setReplayGroupNum(null);
    setDrawingFadeOpacity(1);
    if (history.length > 0) {
      setHistoryViewStep(0);
      setPlaybackPositions([...history[0].positionsBefore]);
    } else {
      setHistoryViewStep(-1);
      setPlaybackPositions(null);
    }
  }

  function handleReset() {
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    if (fadeIntervalRef.current != null) clearInterval(fadeIntervalRef.current);
    setStepPhase('idle');
    setReplayGroupNum(null);
    setDrawingFadeOpacity(1);
    setHistoryViewStep(-1);
    setPlaybackPositions(null);
  }

  // ── Group colors ──────────────────────────────────────────────────────────
  const GROUP_COLORS = ['#E63946', '#1D4ED8', '#2EA043', '#F59E0B', '#8B5CF6', '#EC4899'];
  const groupColor = GROUP_COLORS[(currentGroup - 1) % GROUP_COLORS.length];

  // ── Group advance / reset ─────────────────────────────────────────────────
  function handleAdvanceGroup() {
    if (historyViewStep >= 0) {
      setHistoryViewStep(-1);
      setPlaybackPositions(null);
    }
    const groupNum = currentGroup;
    const basePositions = positions;

    const groupArrows = arrows.filter((a) => a.group === groupNum);
    const groupFreehand = freehandPaths.filter((fp) => fp.hasArrow && fp.group === groupNum);
    const hasGroupDrawings = groupArrows.length > 0 || groupFreehand.length > 0;

    if (!hasGroupDrawings) {
      advanceGroup();
      return;
    }

    const targetPositions = applyGroupMovement(basePositions, groupNum);

    addHistorySnapshot({
      group: groupNum,
      positionsBefore: JSON.parse(JSON.stringify(basePositions)),
      positionsAfter: JSON.parse(JSON.stringify(targetPositions)),
      drawings: JSON.parse(JSON.stringify(groupArrows)),
      freehandDrawings: JSON.parse(JSON.stringify(groupFreehand)),
    });

    setStepPhase('animating');
    animateAlongPaths(basePositions, groupArrows, groupFreehand, 800, () => {
      setPositions(targetPositions);
      setPlaybackPositions(null);
      fadeOutDrawings(300, () => {
        removeGroupDrawings(groupNum);
        advanceGroup();
        setStepPhase('idle');
      });
    });
  }

  function handleResetGroup() {
    if (animFrameRef.current != null) cancelAnimationFrame(animFrameRef.current);
    setHistoryViewStep(-1);
    setPlaybackPositions(null);
    setStepPhase('idle');
    setReplayGroupNum(null);
    setDrawingFadeOpacity(1);
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

  // ── Court & bench drag/drop ───────────────────────────────────────────────
  function measureDropZones() {
    courtRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      courtPageRef.current = { x: pageX, y: pageY };
    });
    benchRef.current?.measure((_x, _y, _w, _h, _pageX, pageY) => {
      benchPageYRef.current = pageY;
    });
  }

  function markBoardEdited() {
    if (isSyncedWithMatch) setIsSyncedWithMatch(false);
  }

  function handleBenchDragStart() {
    measureDropZones();
    setDragSource('bench');
  }

  function handleBenchDrop(benchPlayer: BenchPlayer, absX: number, absY: number) {
    setDragSource(null);
    const px = absX - courtPageRef.current.x;
    const py = absY - courtPageRef.current.y;
    if (px < 0 || px > courtW || py < 0 || py > courtH) return;

    const before = useTacticalStore.getState().positions;
    const target = findTokenAt(positions, px, py, courtW, courtH, SWAP_RADIUS_PX, benchPlayer.isHome);
    if (target) {
      swapWithBench(benchPlayer.playerId, target.playerId);
    } else {
      enterFromBench(
        benchPlayer.playerId,
        clamp(px / courtW, 0.02, 0.98),
        clamp(py / courtH, 0.02, 0.98),
        MAX_ON_COURT[currentFormat],
      );
    }
    if (useTacticalStore.getState().positions !== before) markBoardEdited();
  }

  function handleBenchTap(benchPlayer: BenchPlayer) {
    setEditingPlayer({ ...benchPlayer, x: 0, y: 0 });
  }

  function handleCourtDragStart() {
    measureDropZones();
    setDragSource('court');
  }

  function handleDragEnd(playerId: string, x: number, y: number, _absX: number, absY: number) {
    setDragSource(null);
    if (hasBench && playerId !== 'ball' && absY >= benchPageYRef.current) {
      sendToBench(playerId);
    } else {
      movePlayer(playerId, x, y);
    }
    markBoardEdited();
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
    markBoardEdited();
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
    markBoardEdited();
  }

  function handleNewBoard() {
    handleReset();
    clearArrows();
    clearBenchMoves();
    setPositions(buildDefaultPositions(homeTeamId, awayTeamId, rotationHome, rotationAway, currentFormat));
    setBench(buildDefaultBench(homeTeamId, true), buildDefaultBench(awayTeamId, false));
    markBoardEdited();
    setTool('move');
  }

  function handleToggleFormat() {
    const next: MatchFormat = currentFormat === 'indoor_6v6' ? 'beach_2v2' : 'indoor_6v6';
    setCurrentFormat(next);
    clearArrows();
    handleReset();
    setPositions(buildDefaultPositions(homeTeamId, awayTeamId, rotationHome, rotationAway, next));
    setBench(buildDefaultBench(homeTeamId, true), buildDefaultBench(awayTeamId, false));
    markBoardEdited();
  }

  // ── Apply to match ────────────────────────────────────────────────────────
  // Indoor match boards only (beach has no substitutions or zones I–VI)
  const canApply = !!matchId && format === 'indoor_6v6' && currentFormat === 'indoor_6v6';
  const [applyPlan, setApplyPlan] = useState<Exclude<ApplyPlan, { kind: 'none' }> | null>(null);
  const [applying, setApplying] = useState(false);
  /** The recap was opened from "Appliquer ces changements au match ?" — close the board once applied */
  const closeAfterApplyRef = useRef(false);

  function computeApplyPlan(): ApplyPlan {
    const live = useScoringStore.getState();
    if (!live.match) return { kind: 'none' };
    const board = useTacticalStore.getState();
    return planBoardApply({
      positions: board.positions,
      benchMoves: board.benchMoves,
      phase: matchPhase(live.currentSet, live.events),
      home: rulesContextFromStore(live, 'home', homePlayers),
      away: rulesContextFromStore(live, 'away', awayPlayers),
    });
  }

  function handleApplyPress() {
    const plan = computeApplyPlan();
    if (plan.kind !== 'none') {
      closeAfterApplyRef.current = false;
      setApplyPlan(plan);
      return;
    }
    const live = useScoringStore.getState();
    const phase = matchPhase(live.currentSet, live.events);
    const message = phase === 'set_over'
      ? t('tactical.apply.nothingSetOver')
      : phase === 'before_first_point' ? t('tactical.apply.nothingLineup') : t('tactical.apply.nothingInSet');
    Alert.alert(t('tactical.apply.nothingTitle'), message);
  }

  async function handleConfirmApply() {
    const live = useScoringStore.getState();
    if (!applyPlan || !applyPlan.ok || !live.match || !live.currentSet) return;
    const contextFor = (side: 'home' | 'away'): SubstitutionContext => ({
      matchId: live.match!.id,
      setId: live.currentSet!.id,
      teamId: side === 'home' ? live.match!.teamHomeId : live.match!.teamAwayId,
      side,
      roster: side === 'home' ? homePlayers : awayPlayers,
    });

    setApplying(true);
    try {
      if (applyPlan.kind === 'substitutions') {
        // In order: each one was validated against the match after the previous ones
        for (const item of applyPlan.home.items) await recordSubstitution(contextFor('home'), item);
        for (const item of applyPlan.away.items) await recordSubstitution(contextFor('away'), item);
      } else {
        if (applyPlan.home.status === 'changed') await applyBoardLineup(contextFor('home'), applyPlan.home.court);
        if (applyPlan.away.status === 'changed') await applyBoardLineup(contextFor('away'), applyPlan.away.court);
      }
      clearBenchMoves();
      setApplyPlan(null);
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (closeAfterApplyRef.current) finishClose();
    } catch (e) {
      console.error(e);
      Alert.alert('', t('tactical.apply.failed'));
    } finally {
      setApplying(false);
    }
  }

  function handleCancelApply() {
    // From the close prompt too: the coach stays on the board to fix it
    closeAfterApplyRef.current = false;
    setApplyPlan(null);
  }

  function finishClose() {
    handleReset();
    if (matchId && boardReady) saveBoardNow();
    onClose();
  }

  function handleClose() {
    if (canApply && boardReady) {
      const plan = computeApplyPlan();
      if (plan.kind !== 'none') {
        Alert.alert(t('tactical.apply.askOnClose'), '', [
          // "Plus tard": the match is untouched, the board stays saved as it is
          { text: t('tactical.apply.later'), style: 'cancel', onPress: finishClose },
          {
            text: t('tactical.apply.now'),
            onPress: () => {
              closeAfterApplyRef.current = true;
              setApplyPlan(plan);
            },
          },
        ]);
        return;
      }
    }
    finishClose();
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
          {matchId ? <InfoTooltip textKey="help.tacticalMatch" /> : <InfoTooltip textKey="help.tactical" />}
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
        <View style={[styles.courtContainer, { zIndex: dragSource === 'court' ? 30 : 10 }]}>
          <View ref={courtRef} collapsable={false} style={[styles.court, { width: courtW, height: courtH }]}>
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
                      arrows={overlayArrowsDisplay}
                      freehandPaths={overlayFreehandDisplay}
                      courtWidth={courtW}
                      courtHeight={courtH}
                      eraserMode={false}
                      drawPreview={drawPreview}
                      pencilPreviewD={pencilPreviewD}
                      pencilColor={pencilColor}
                      onRemoveArrow={removeArrow}
                      isEditMode={arrowEditMode}
                      activeGroup={activeGroupForOverlay}
                      arrowOpacity={drawingFadeOpacity}
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
                onDragStart={handleCourtDragStart}
                onDragEnd={handleDragEnd}
                onTap={handleTokenTap}
                hapticsEnabled={hapticsEnabled}
              />
            ))}
          </View>
        </View>

        {/* Substitutes bench */}
        {hasBench && (
          <View
            ref={benchRef}
            collapsable={false}
            style={[styles.benchStrip, { height: BENCH_H, zIndex: dragSource === 'bench' ? 30 : 5 }]}
          >
            {[
              { isHome: true, players: benchHome, title: homeTeamName ?? t('tactical.benchHome') },
              { isHome: false, players: benchAway, title: awayTeamName ?? t('tactical.benchAway') },
            ].map((side, i) => (
              <React.Fragment key={side.isHome ? 'home' : 'away'}>
                {i === 1 && <View style={styles.benchDivider} />}
                <View style={styles.benchHalf}>
                  <Text style={styles.benchTitle} numberOfLines={1}>{side.title}</Text>
                  <View style={styles.benchTokens}>
                    {side.players.map((p) => (
                      <BenchTokenItem
                        key={p.playerId}
                        player={p}
                        enabled={selectedTool === 'move' && isEditMode}
                        hapticsEnabled={hapticsEnabled}
                        onDragStart={handleBenchDragStart}
                        onDrop={handleBenchDrop}
                        onTap={handleBenchTap}
                      />
                    ))}
                    {side.players.length === 0 && <Text style={styles.benchEmptyLabel}>–</Text>}
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        )}

        {/* Playback controls */}
        <PlaybackControls
          historyViewStep={historyViewStep}
          historyTotal={history.length}
          totalSteps={totalSteps}
          stepPhase={stepPhase}
          hasArrows={hasCurrentArrows}
          onStepForward={handleStepForward}
          onStepBack={handleStepBack}
          onGoToStart={handleGoToStart}
        />

        {/* Toolbar */}
        <View ref={toolbarRef} collapsable={false}>
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
            onApplyToMatch={canApply ? handleApplyPress : undefined}
          />
        </View>

        <ApplyToMatchSheet
          plan={applyPlan}
          homeTeamName={homeTeamName ?? t('tactical.benchHome')}
          awayTeamName={awayTeamName ?? t('tactical.benchAway')}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
          applying={applying}
          onCancel={handleCancelApply}
          onConfirm={handleConfirmApply}
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

        <CoachMarks
          tipId="tactical"
          enabled={visible && editingPlayer === null && !showPlaybook && !showMenu && applyPlan === null}
          steps={[
            { id: 'court', target: courtRef },
            ...(hasBench ? [{ id: 'bench', target: benchRef }] : []),
            { id: 'tools', target: toolbarRef },
            { id: 'steps', target: toolbarRef },
          ]}
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    overflow: 'visible',
  },
  benchStrip: {
    flexDirection: 'row',
    marginHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: palette.backgroundElevated,
    overflow: 'visible',
  },
  benchHalf: {
    flex: 1,
    paddingHorizontal: 4,
    overflow: 'visible',
  },
  benchDivider: {
    width: 1,
    backgroundColor: palette.backgroundElevated,
  },
  benchTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textSecondary,
    marginBottom: 4,
  },
  benchTokens: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    overflow: 'visible',
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
