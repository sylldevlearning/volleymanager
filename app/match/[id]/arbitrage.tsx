import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View, Pressable, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Flag, ArrowLeftRight, X, ListChecks, AlertTriangle, RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

const BALL_IMG = require('../../../assets/images/ballon.png');
const SERVE_BALL_OFFSET = 34;

import { getMatchById, createSet, updateSet, updateMatchStatus, setMatchRefereeState, setFirstServeTeam } from '../../../src/services/matchService';
import { addEvent, undoLastEvent } from '../../../src/services/eventService';
import { getPlayersByTeam } from '../../../src/services/playerService';
import { performSubstitution } from '../../../src/services/substitutionService';
import { saveLineup, type LineupEntry } from '../../../src/services/lineupService';
import { reconstructLiveState } from '../../../src/services/matchStateReconstruction';
import { addSanction, getSanctionsForMatch } from '../../../src/services/sanctionService';
import { getDelaySanctionOutcome, type SanctionType } from '../../../src/utils/sanctionRules';
import { useScoringStore, resolveInitialServing, type CourtMap } from '../../../src/stores/scoringStore';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { getTeamById } from '../../../src/services/teamService';
import { isSetWon, isMatchWon, isLastSet, getTotalSets, shouldChangeEndsIndoor } from '../../../src/utils/volleyball-rules';
import { validateTimeoutRequest } from '../../../src/utils/rulesValidator';
import { getDisplayedCaptainId, needsNewActingCaptain } from '../../../src/utils/captainTracking';
import { ScoreButton } from '../../../src/components/scoring/ScoreButton';
import { SetTracker } from '../../../src/components/scoring/SetTracker';
import { SubstitutionSheet } from '../../../src/components/scoring/SubstitutionSheet';
import { TimeoutTimerSheet } from '../../../src/components/scoring/TimeoutTimerSheet';
import { SubstitutionRecapSheet } from '../../../src/components/arbitrage/SubstitutionRecapSheet';
import { SanctionSheet } from '../../../src/components/arbitrage/SanctionSheet';
import { FullCourt } from '../../../src/components/court/FullCourt';
import type { PlayerInPosition } from '../../../src/components/court/IndoorCourt';
import type { Match } from '../../../src/models/match';
import type { Team } from '../../../src/models/team';
import type { Player } from '../../../src/models/player';
import type { LiberoState } from '../../../src/models/substitution';
import type { MatchEvent } from '../../../src/models/event';
import { getPlayerShortName } from '../../../src/features/players/player-helpers';
import { palette } from '../../../src/theme/tokens';
import { CoachMarks } from '../../../src/components/ui/CoachMarks';
import { InfoTooltip } from '../../../src/components/ui/InfoTooltip';

type SetupPhase = 'serveChoice' | null;

function buildAutoLineup(players: Player[]) {
  const liberoPlayers = players.filter((p) => p.position === 'libero');
  const nonLiberos = players.filter((p) => p.position !== 'libero');
  const starters = nonLiberos.slice(0, 6);
  const bench = [...nonLiberos.slice(6), ...liberoPlayers];
  const courtMap: CourtMap = {};
  starters.forEach((p, i) => { courtMap[i + 1] = p.id; });
  const liberoState: LiberoState | null = liberoPlayers[0]
    ? { liberoId: liberoPlayers[0].id, isOnCourt: false, replacedPlayerId: null, replacedPosition: null }
    : null;
  return { courtMap, bench, liberoState };
}

function toLineupEntries(courtMap: CourtMap): LineupEntry[] {
  return Object.entries(courtMap).map(([pos, playerId]) => ({
    playerId, position: Number(pos) as LineupEntry['position'], isStarter: true, isLibero: false,
  }));
}

/** Fresh bench + libero state for a team's chosen starting six — same construction used whether this is the very first set or a lineup re-entered before a later one. */
function buildLineupState(players: Player[], courtMap: CourtMap): { bench: Player[]; liberoState: LiberoState | null } {
  const liberoPlayer = players.find((p) => p.position === 'libero') ?? null;
  const assigned = new Set(Object.values(courtMap));
  const bench = players.filter((p) => !assigned.has(p.id));
  const liberoState: LiberoState | null = liberoPlayer
    ? { liberoId: liberoPlayer.id, isOnCourt: false, replacedPlayerId: null, replacedPosition: null }
    : null;
  return { bench, liberoState };
}

function courtPlayers(
  onCourt: CourtMap,
  roster: Player[],
  libero: LiberoState | null,
  displayedCaptainId: string | null = null,
): PlayerInPosition[] {
  const result: PlayerInPosition[] = [];
  for (const [posStr, playerId] of Object.entries(onCourt)) {
    const player = roster.find((p) => p.id === playerId);
    if (!player) continue;
    result.push({
      position: Number(posStr) as 1 | 2 | 3 | 4 | 5 | 6,
      name: getPlayerShortName(player),
      number: player.number,
      isLibero: !!(libero?.isOnCourt && libero.liberoId === playerId),
      isCaptain: displayedCaptainId !== null && playerId === displayedCaptainId,
    });
  }
  return result;
}

export default function ArbitrageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  const {
    match, currentSet, sets, scoreHome, scoreAway, setsHome, setsAway, setScores, events,
    servingTeam, timeoutsHome, timeoutsAway,
    onCourtHome, onCourtAway, benchHome, benchAway, liberoHome, liberoAway,
    pairsHome, pairsAway, substitutionsHome, substitutionsAway,
    initMatch, addPointEvent, endCurrentSet, startNewSet,
    requestTimeout, cancelTimeout, initLineup, applySubstitution, applyLiberoExit,
    restoreLiberoToBench, reset, hydrate, recordEvent,
  } = useScoringStore();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupPhase, setSetupPhase] = useState<SetupPhase>(null);
  const [pendingMatch, setPendingMatch] = useState<Match | null>(null);
  const [servingSideChoice, setServingSideChoice] = useState<'home' | 'away'>('home');
  /** Which flow the serve-choice screen serves: the very first set, or the manual re-choice before set 5. */
  const [serveChoiceContext, setServeChoiceContext] = useState<'firstSet' | 'set5'>('firstSet');

  // Lineup set directly on this screen's court (no separate pre-match screen).
  const [lineupSetupMode, setLineupSetupMode] = useState(false);
  const [draftHomeCourt, setDraftHomeCourt] = useState<CourtMap>({});
  const [draftAwayCourt, setDraftAwayCourt] = useState<CourtMap>({});
  const [lineupPickerTarget, setLineupPickerTarget] = useState<{ side: 'home' | 'away'; position: 1 | 2 | 3 | 4 | 5 | 6 } | null>(null);

  const [showSubSheet, setShowSubSheet] = useState(false);
  const [subSide, setSubSide] = useState<'home' | 'away'>('home');
  const [showTimeoutSheet, setShowTimeoutSheet] = useState(false);
  const [timeoutTeam, setTimeoutTeam] = useState<'home' | 'away'>('home');
  const [timeoutTeamName, setTimeoutTeamName] = useState('');
  const [timeoutTeamColor, setTimeoutTeamColor] = useState<string>(palette.teamHome);
  const [preselectedOut, setPreselectedOut] = useState<{ id: string; position: number } | null>(null);
  const [showRecap, setShowRecap] = useState(false);
  const [showSanctionSheet, setShowSanctionSheet] = useState(false);
  const [sanctionSide, setSanctionSide] = useState<'home' | 'away'>('home');
  /** All non-cancelled sanction events for the match — loaded on mount, kept in sync on add/undo, fed to rulesValidator. */
  const [sanctionEvents, setSanctionEvents] = useState<MatchEvent[]>([]);
  /** Which visual side (left/right) each team is drawn on — toggled manually by the referee, never automatically. */
  const [sidesSwapped, setSidesSwapped] = useState(false);

  // First-use help bubbles anchors
  const scoreAreaRef = useRef<View>(null);
  const swapBtnRef = useRef<View>(null);
  const actionsRef = useRef<View>(null);
  const undoRef = useRef<View>(null);

  // Serve indicator ball — follows the serving team, and the visual side it's
  // drawn on when the referee swaps sides with the ⇄ arrows (computed from
  // primitive state only, so this can run before any early-return below).
  const isServingLeft = !lineupSetupMode && servingTeam === (sidesSwapped ? 'away' : 'home');
  const serveBallX = useSharedValue(isServingLeft ? -SERVE_BALL_OFFSET : SERVE_BALL_OFFSET);
  useEffect(() => {
    serveBallX.value = withTiming(isServingLeft ? -SERVE_BALL_OFFSET : SERVE_BALL_OFFSET, { duration: 280 });
  }, [isServingLeft, serveBallX]);
  const serveBallStyle = useAnimatedStyle(() => ({ transform: [{ translateX: serveBallX.value }] }));

  // In-game captain: the registered captain resumes automatically whenever
  // they're back on court; while they're off court, a manually-designated
  // stand-in (acting captain) is marked instead.
  const [actingCaptainHomeId, setActingCaptainHomeId] = useState<string | null>(null);
  const [actingCaptainAwayId, setActingCaptainAwayId] = useState<string | null>(null);
  const [captainPickerSide, setCaptainPickerSide] = useState<'home' | 'away' | null>(null);

  useEffect(() => {
    if (!match || lineupSetupMode) return;
    const onCourtIds = Object.values(onCourtHome);
    if (needsNewActingCaptain({ registeredCaptainId: match.captainHomeId, actingCaptainId: actingCaptainHomeId, onCourtPlayerIds: onCourtIds })) {
      setCaptainPickerSide('home');
    } else if (match.captainHomeId && onCourtIds.includes(match.captainHomeId) && actingCaptainHomeId !== null) {
      setActingCaptainHomeId(null);
    }
  }, [match, lineupSetupMode, onCourtHome, actingCaptainHomeId]);

  useEffect(() => {
    if (!match || lineupSetupMode) return;
    const onCourtIds = Object.values(onCourtAway);
    if (needsNewActingCaptain({ registeredCaptainId: match.captainAwayId, actingCaptainId: actingCaptainAwayId, onCourtPlayerIds: onCourtIds })) {
      setCaptainPickerSide('away');
    } else if (match.captainAwayId && onCourtIds.includes(match.captainAwayId) && actingCaptainAwayId !== null) {
      setActingCaptainAwayId(null);
    }
  }, [match, lineupSetupMode, onCourtAway, actingCaptainAwayId]);

  const handleAssignActingCaptain = useCallback((playerId: string) => {
    if (captainPickerSide === 'home') setActingCaptainHomeId(playerId);
    else if (captainPickerSide === 'away') setActingCaptainAwayId(playerId);
    setCaptainPickerSide(null);
  }, [captainPickerSide]);

  // Persist referee-only screen state (side swap, acting captains) so a
  // resumed match redraws identically — these aren't derivable from match_events.
  useEffect(() => {
    if (!match || lineupSetupMode) return;
    setMatchRefereeState(match.id, { sidesSwapped, actingCaptainHomeId, actingCaptainAwayId });
  }, [match, lineupSetupMode, sidesSwapped, actingCaptainHomeId, actingCaptainAwayId]);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const m = await getMatchById(id);
      if (!m) return;

      const [home, away, homePlrs, awayPlrs] = await Promise.all([
        getTeamById(m.teamHomeId),
        getTeamById(m.teamAwayId),
        getPlayersByTeam(m.teamHomeId),
        getPlayersByTeam(m.teamAwayId),
      ]);
      setHomeTeam(home);
      setAwayTeam(away);
      setHomePlayers(homePlrs);
      setAwayPlayers(awayPlrs);
      setSanctionEvents(await getSanctionsForMatch(m.id));

      if (m.status === 'created') {
        // Brand-new match: manual serve choice, then the I-VI lineup is set
        // directly on this screen's court (see handleValidateLineup).
        setPendingMatch(m);
        setSetupPhase('serveChoice');
        setLoading(false);
        return;
      }

      // Resuming an already-live match: rebuild score, rotation, lineups,
      // libero/captain state, timeouts, substitutions and the referee's own
      // side-swap choice purely from what's persisted — the referee can close
      // the app mid-match and resume exactly where they left off.
      const reconstructed = await reconstructLiveState(id);
      if (reconstructed) {
        hydrate(reconstructed);
        setSidesSwapped(reconstructed.sidesSwapped);
        setActingCaptainHomeId(reconstructed.actingCaptainHomeId);
        setActingCaptainAwayId(reconstructed.actingCaptainAwayId);
        setLoading(false);
        return;
      }

      // Defensive fallback (no sets persisted yet for a non-'created' match —
      // shouldn't normally happen): start set 1 with a default lineup.
      const activeSet = await createSet(id, 1, m.firstServeTeamId ?? m.teamHomeId);
      initMatch(m, activeSet);
      const homeLineup = buildAutoLineup(homePlrs);
      const awayLineup = buildAutoLineup(awayPlrs);
      initLineup('home', homeLineup.courtMap, homeLineup.bench, homeLineup.liberoState);
      initLineup('away', awayLineup.courtMap, awayLineup.bench, awayLineup.liberoState);
      await saveLineup(m.id, activeSet.id, m.teamHomeId, toLineupEntries(homeLineup.courtMap));
      await saveLineup(m.id, activeSet.id, m.teamAwayId, toLineupEntries(awayLineup.courtMap));
      setLoading(false);
    }
    load();
    return () => reset();
  }, [id]);

  // Creates the next set, switches the store to it (carrying the previous
  // on-court lineup over as a starting point), then opens the same in-screen
  // lineup editor used for set 1 — pre-filled and still editable — before
  // play can resume. Shared by the automatic (sets 2-4) and set-5 (after a
  // fresh manual serve choice) transitions.
  const createAndEnterSetLineup = useCallback(async (setNumber: number, servingTeamId: string) => {
    if (!match) return;
    const nextSet = await createSet(match.id, setNumber, servingTeamId);
    startNewSet(nextSet);
    const carriedOver = useScoringStore.getState();
    setDraftHomeCourt(carriedOver.onCourtHome);
    setDraftAwayCourt(carriedOver.onCourtAway);
    setLineupSetupMode(true);
  }, [match, startNewSet]);

  const handleServeChosen = useCallback(async (side: 'home' | 'away') => {
    if (serveChoiceContext === 'set5') {
      if (!match) return;
      const servingTeamId = side === 'home' ? match.teamHomeId : match.teamAwayId;
      await createAndEnterSetLineup(5, servingTeamId);
      setSetupPhase(null);
      return;
    }
    setServingSideChoice(side);
    setSetupPhase(null);
    setDraftHomeCourt({});
    setDraftAwayCourt({});
    setLineupSetupMode(true);
  }, [serveChoiceContext, match, createAndEnterSetLineup]);

  const handleLineupPositionTap = useCallback((side: 'home' | 'away', pos: 1 | 2 | 3 | 4 | 5 | 6) => {
    const draft = side === 'home' ? draftHomeCourt : draftAwayCourt;
    const setDraft = side === 'home' ? setDraftHomeCourt : setDraftAwayCourt;
    if (draft[pos]) {
      setDraft((prev) => {
        const next = { ...prev };
        delete next[pos];
        return next;
      });
      return;
    }
    setLineupPickerTarget({ side, position: pos });
  }, [draftHomeCourt, draftAwayCourt]);

  const handleLineupAssign = useCallback((playerId: string) => {
    if (!lineupPickerTarget) return;
    const { side, position } = lineupPickerTarget;
    const setDraft = side === 'home' ? setDraftHomeCourt : setDraftAwayCourt;
    setDraft((prev) => ({ ...prev, [position]: playerId }));
    setLineupPickerTarget(null);
  }, [lineupPickerTarget]);

  const isHomeLineupComplete = Object.keys(draftHomeCourt).length === 6;
  const isAwayLineupComplete = Object.keys(draftAwayCourt).length === 6;

  const handleValidateLineup = useCallback(async () => {
    if (!id || !isHomeLineupComplete || !isAwayLineupComplete) return;

    if (pendingMatch) {
      // Very first set: the match doesn't go 'live' (and set 1 doesn't exist)
      // until this lineup is actually confirmed.
      const m = pendingMatch;
      const servingTeamId = servingSideChoice === 'home' ? m.teamHomeId : m.teamAwayId;

      await updateMatchStatus(id, 'live');
      await setFirstServeTeam(id, servingTeamId);
      const firstSet = await createSet(id, 1, servingTeamId);
      initMatch({ ...m, status: 'live', firstServeTeamId: servingTeamId }, firstSet);

      const homeState = buildLineupState(homePlayers, draftHomeCourt);
      const awayState = buildLineupState(awayPlayers, draftAwayCourt);
      initLineup('home', draftHomeCourt, homeState.bench, homeState.liberoState);
      initLineup('away', draftAwayCourt, awayState.bench, awayState.liberoState);

      await saveLineup(m.id, firstSet.id, m.teamHomeId, toLineupEntries(draftHomeCourt));
      await saveLineup(m.id, firstSet.id, m.teamAwayId, toLineupEntries(draftAwayCourt));

      setPendingMatch(null);
      setLineupSetupMode(false);
      return;
    }

    // Re-entered lineup before a later set (2-5): the set was already created
    // and switched to (createAndEnterSetLineup), so just confirm the I-VI
    // assignment — pre-filled with the previous set's, but editable.
    if (!match || !currentSet) return;
    const homeState = buildLineupState(homePlayers, draftHomeCourt);
    const awayState = buildLineupState(awayPlayers, draftAwayCourt);
    initLineup('home', draftHomeCourt, homeState.bench, homeState.liberoState);
    initLineup('away', draftAwayCourt, awayState.bench, awayState.liberoState);

    await saveLineup(match.id, currentSet.id, match.teamHomeId, toLineupEntries(draftHomeCourt));
    await saveLineup(match.id, currentSet.id, match.teamAwayId, toLineupEntries(draftAwayCourt));

    setLineupSetupMode(false);
    Alert.alert(t('match.changeEnds'), t('arbitrage.changeEndsHint'));
  }, [id, isHomeLineupComplete, isAwayLineupComplete, pendingMatch, servingSideChoice, draftHomeCourt, draftAwayCourt, homePlayers, awayPlayers, match, currentSet, initMatch, initLineup, t]);

  // Creates the next set, switches the store to it (carrying the previous
  // on-court lineup over as a starting point), then opens the same in-screen
  // lineup editor used for set 1 — pre-filled and still editable — before
  // play can resume. Shared by the automatic (sets 2-4) and set-5 (after a
  // fresh manual serve choice) transitions.
  // Everything that happens once a point is on the board, regardless of
  // whether it came from a direct tap or a sanction's awarded point: court
  // rotation/libero bookkeeping, set/match end detection, and the transition
  // into the next set (or match end).
  const applyScoredPointEffects = useCallback(async (team: 'home' | 'away', pointEvent: MatchEvent) => {
    if (!match || !currentSet) return;

    // Client state (score/rotation/libero) updates synchronously here. If the
    // rotation just forced the active libero off the court, record that as an
    // event too — the court/libero state change itself already happened above.
    const liberoAutoExit = addPointEvent(team, pointEvent);
    if (liberoAutoExit) {
      const side = liberoAutoExit.side;
      const teamId = side === 'home' ? match.teamHomeId : match.teamAwayId;
      const { event: autoExitEvent } = await performSubstitution({
        matchId: match.id,
        setId: currentSet.id,
        teamId,
        teamSide: side,
        playerOutId: liberoAutoExit.liberoId,
        playerInId: liberoAutoExit.replacedPlayerId,
        position: liberoAutoExit.position,
        isLibero: true,
        isAutomatic: true,
      });
      recordEvent(autoExitEvent);
      // The libero is available again — back on the bench, selectable for a future entry.
      const liberoRoster = side === 'home' ? homePlayers : awayPlayers;
      const liberoPlayer = liberoRoster.find((p) => p.id === liberoAutoExit.liberoId);
      if (liberoPlayer) restoreLiberoToBench(side, liberoPlayer);
    }

    const newScoreHome = team === 'home' ? scoreHome + 1 : scoreHome;
    const newScoreAway = team === 'away' ? scoreAway + 1 : scoreAway;
    const setNum = currentSet.setNumber;
    const lastSet = isLastSet(setNum, match.config);
    const homeWins = isSetWon(newScoreHome, newScoreAway, match.config, lastSet);
    const awayWins = isSetWon(newScoreAway, newScoreHome, match.config, lastSet);

    if (match.format === 'indoor_6v6' && shouldChangeEndsIndoor(newScoreHome, newScoreAway, setNum, match.config)) {
      Alert.alert(t('match.changeEnds'), t('arbitrage.changeEndsHint'));
    }

    if (homeWins || awayWins) {
      const winnerTeamId = homeWins ? match.teamHomeId : match.teamAwayId;
      const winnerSide = homeWins ? 'home' : 'away';
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      await updateSet(currentSet.id, newScoreHome, newScoreAway, winnerTeamId);
      const updatedSet = { ...currentSet, scoreHome: newScoreHome, scoreAway: newScoreAway, winnerTeamId };
      endCurrentSet(winnerSide, updatedSet);

      const newSetsHome = setsHome + (homeWins ? 1 : 0);
      const newSetsAway = setsAway + (awayWins ? 1 : 0);
      const isMatchEnd = isMatchWon(newSetsHome, match.config) || isMatchWon(newSetsAway, match.config);

      if (isMatchEnd) {
        const matchWinnerId = isMatchWon(newSetsHome, match.config) ? match.teamHomeId : match.teamAwayId;
        await updateMatchStatus(match.id, 'finished', matchWinnerId);
        useSettingsStore.getState().recordMatchFinished(match.id);
        Alert.alert(t('match.matchOver'), '', [
          // justFinished → the summary may show the store review dialog
          { text: t('common.done'), onPress: () => router.replace(`/match/${match.id}/summary?justFinished=1`) },
        ]);
      } else {
        Alert.alert(
          t('match.setOver'),
          t('referee.setsScore', { home: newSetsHome, away: newSetsAway }),
          [{
            text: t('referee.nextSet'),
            onPress: async () => {
              const nextSetNumber = setNum + 1;
              if (nextSetNumber === 5) {
                // Deciding set — same manual serve choice as set 1, then the
                // lineup editor (handleServeChosen / handleValidateLineup).
                setServeChoiceContext('set5');
                setSetupPhase('serveChoice');
                return;
              }
              const autoSide = resolveInitialServing(match, nextSetNumber);
              const servingTeamId = autoSide === 'home' ? match.teamHomeId : match.teamAwayId;
              await createAndEnterSetLineup(nextSetNumber, servingTeamId);
            },
          }],
        );
      }
    }
  }, [match, currentSet, scoreHome, scoreAway, setsHome, setsAway, hapticsEnabled, addPointEvent, endCurrentSet, router, t, homePlayers, awayPlayers, restoreLiberoToBench, createAndEnterSetLineup]);

  const handlePoint = useCallback(async (team: 'home' | 'away') => {
    if (!match || !currentSet || currentSet.winnerTeamId) return;
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const eventType = team === 'home' ? 'point_home' : 'point_away';
    const newEvent = await addEvent({
      matchId: match.id,
      setId: currentSet.id,
      eventType,
      playerId: null,
      teamId: team === 'home' ? match.teamHomeId : match.teamAwayId,
      details: {},
    });
    await applyScoredPointEffects(team, newEvent);
  }, [match, currentSet, hapticsEnabled, applyScoredPointEffects]);

  const handleUndo = useCallback(async () => {
    if (!match || !currentSet) return;
    const result = await undoLastEvent(match.id, currentSet.id);
    if (!result) return;
    // Rebuild the entire live state from the DB (score, rotation, court,
    // libero, bench, pairs, timeouts, substitutions count) instead of
    // patching the store field-by-field — undoPoint only ever reverted
    // score/serving, so undoing a substitution, timeout or libero move (or
    // the rotation a point caused) silently left the court state wrong.
    // reconstructLiveState is the same replay already used to resume a
    // closed match, so this is guaranteed consistent with it.
    const reconstructed = await reconstructLiveState(match.id);
    if (reconstructed) hydrate(reconstructed);
    // The undone event might have been a sanction (or a penalty's linked point) —
    // refetch rather than guess, so rulesValidator always sees the true state.
    setSanctionEvents(await getSanctionsForMatch(match.id));
    if (hapticsEnabled) Haptics.selectionAsync();
  }, [match, currentSet, hapticsEnabled, hydrate]);

  const handleSubConfirm = useCallback(async (opts: {
    playerOutId: string;
    playerInId: string;
    position: number;
    isLibero: boolean;
    isExceptional?: boolean;
  }) => {
    if (!match || !currentSet) return;
    const side = subSide;
    const teamId = side === 'home' ? match.teamHomeId : match.teamAwayId;
    const { pair, event } = await performSubstitution({
      matchId: match.id,
      setId: currentSet.id,
      teamId,
      teamSide: side,
      playerOutId: opts.playerOutId,
      playerInId: opts.playerInId,
      position: opts.position,
      isLibero: opts.isLibero,
      isExceptional: opts.isExceptional ?? false,
    });
    applySubstitution(side, opts.playerOutId, opts.playerInId, opts.position, opts.isLibero, pair, {
      playerOut: (side === 'home' ? homePlayers : awayPlayers).find((p) => p.id === opts.playerOutId),
      isExceptional: opts.isExceptional,
    });
    recordEvent(event);
    setPreselectedOut(null);
    if (hapticsEnabled) Haptics.selectionAsync();
  }, [match, currentSet, subSide, homePlayers, awayPlayers, applySubstitution, recordEvent, hapticsEnabled]);

  const handleSanctionConfirm = useCallback(async (opts: { sanctionType: SanctionType; playerId: string | null }) => {
    if (!match || !currentSet) return;
    const side = sanctionSide;
    const teamId = side === 'home' ? match.teamHomeId : match.teamAwayId;
    const opponentTeamId = side === 'home' ? match.teamAwayId : match.teamHomeId;

    let awardsPoint: boolean;
    if (opts.sanctionType === 'penalty') {
      awardsPoint = true;
    } else if (opts.sanctionType === 'delay') {
      const priorDelays = sanctionEvents.filter((e) => e.details.sanctionType === 'delay').length;
      awardsPoint = getDelaySanctionOutcome(priorDelays).awardsPoint;
    } else {
      awardsPoint = false;
    }

    const { sanctionEvent, pointEvent } = await addSanction({
      matchId: match.id,
      setId: currentSet.id,
      teamId,
      teamSide: side,
      opponentTeamId,
      sanctionType: opts.sanctionType,
      playerId: opts.playerId,
      awardsPoint,
    });

    setSanctionEvents((prev) => [...prev, sanctionEvent]);
    recordEvent(sanctionEvent);

    if (pointEvent) {
      const scoringTeam: 'home' | 'away' = side === 'home' ? 'away' : 'home';
      await applyScoredPointEffects(scoringTeam, pointEvent);
    }
    if (hapticsEnabled) Haptics.selectionAsync();
  }, [match, currentSet, sanctionSide, sanctionEvents, applyScoredPointEffects, recordEvent, hapticsEnabled]);

  const handleTimeout = async (team: 'home' | 'away') => {
    if (!match || !currentSet) return;
    const teamName = team === 'home' ? (homeTeam?.name ?? '') : (awayTeam?.name ?? '');
    const used = team === 'home' ? timeoutsHome : timeoutsAway;
    const result = validateTimeoutRequest(used, match.config, teamName);
    if (!result.ok) {
      Alert.alert(t('arbitrage.ruleViolation'), result.message);
      return;
    }
    const timeoutEvent = await addEvent({
      matchId: match.id,
      setId: currentSet.id,
      eventType: team === 'home' ? 'timeout_home' : 'timeout_away',
      playerId: null,
      teamId: team === 'home' ? match.teamHomeId : match.teamAwayId,
      details: {},
    });
    recordEvent(timeoutEvent);
    requestTimeout(team);
    setTimeoutTeam(team);
    setTimeoutTeamName(teamName);
    setTimeoutTeamColor(team === 'home' ? (homeTeam?.color ?? palette.teamHome) : palette.teamAway);
    setShowTimeoutSheet(true);
    if (hapticsEnabled) Haptics.selectionAsync();
  };

  const handleTimeoutCancel = async () => {
    if (match && currentSet) await undoLastEvent(match.id, currentSet.id);
    cancelTimeout(timeoutTeam);
    setShowTimeoutSheet(false);
  };

  const handleLiberoExitTap = useCallback((side: 'home' | 'away') => {
    const libero = side === 'home' ? liberoHome : liberoAway;
    if (!libero?.isOnCourt || !libero.replacedPlayerId || libero.replacedPosition === null) return;
    const roster = side === 'home' ? homePlayers : awayPlayers;
    const replacedNumber = roster.find((p) => p.id === libero.replacedPlayerId)?.number ?? '';

    Alert.alert(t('arbitrage.exitLibero'), t('arbitrage.exitLiberoConfirm', { number: replacedNumber }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('arbitrage.exitLibero'),
        onPress: async () => {
          if (!match || !currentSet) return;
          const teamId = side === 'home' ? match.teamHomeId : match.teamAwayId;
          const { event } = await performSubstitution({
            matchId: match.id,
            setId: currentSet.id,
            teamId,
            teamSide: side,
            playerOutId: libero.liberoId,
            playerInId: libero.replacedPlayerId!,
            position: libero.replacedPosition!,
            isLibero: true,
            isAutomatic: false,
          });
          applyLiberoExit(side);
          recordEvent(event);
          const liberoPlayer = roster.find((p) => p.id === libero.liberoId);
          if (liberoPlayer) restoreLiberoToBench(side, liberoPlayer);
          if (hapticsEnabled) Haptics.selectionAsync();
        },
      },
    ]);
  }, [liberoHome, liberoAway, homePlayers, awayPlayers, match, currentSet, applyLiberoExit, restoreLiberoToBench, recordEvent, hapticsEnabled, t]);

  const handleEndMatch = () => {
    Alert.alert(t('referee.confirmEndMatch'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('match.endMatch'),
        style: 'destructive',
        onPress: async () => {
          if (match) {
            await updateMatchStatus(match.id, 'finished');
            router.replace(`/match/${match.id}/summary`);
          }
        },
      },
    ]);
  };

  if (loading || !homeTeam || !awayTeam) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (setupPhase === 'serveChoice') {
    return (
      <SafeAreaView style={styles.container}>
        <ServeChoiceView homeTeam={homeTeam} awayTeam={awayTeam} onChoose={handleServeChosen} t={t} context={serveChoiceContext} />
      </SafeAreaView>
    );
  }

  if (!match && !lineupSetupMode) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  const maxSets = match ? getTotalSets(match.config) : 5;
  const currentSetNum = currentSet?.setNumber ?? 1;
  const setIsOver = !!currentSet?.winnerTeamId;
  const maxTimeouts = match?.config.timeoutsPerSet ?? 2;

  // Which team is drawn on which visual side — only changes when the referee
  // taps the swap arrows (never automatically).
  const leftSide: 'home' | 'away' = sidesSwapped ? 'away' : 'home';
  const rightSide: 'home' | 'away' = sidesSwapped ? 'home' : 'away';

  function sideData(side: 'home' | 'away') {
    const team = side === 'home' ? homeTeam! : awayTeam!;
    return {
      side,
      team,
      color: side === 'home' ? (team.color || palette.teamHome) : palette.teamAway,
      score: side === 'home' ? scoreHome : scoreAway,
      onCourt: lineupSetupMode ? (side === 'home' ? draftHomeCourt : draftAwayCourt) : (side === 'home' ? onCourtHome : onCourtAway),
      roster: side === 'home' ? homePlayers.filter((p) => p.position !== 'libero') : awayPlayers.filter((p) => p.position !== 'libero'),
      fullRoster: side === 'home' ? homePlayers : awayPlayers,
      libero: side === 'home' ? liberoHome : liberoAway,
      isServing: !lineupSetupMode && servingTeam === side,
      timeoutsUsed: side === 'home' ? timeoutsHome : timeoutsAway,
      setsWon: side === 'home' ? setsHome : setsAway,
      displayedCaptainId: lineupSetupMode ? null : getDisplayedCaptainId({
        registeredCaptainId: side === 'home' ? (match?.captainHomeId ?? null) : (match?.captainAwayId ?? null),
        actingCaptainId: side === 'home' ? actingCaptainHomeId : actingCaptainAwayId,
        onCourtPlayerIds: Object.values(side === 'home' ? onCourtHome : onCourtAway),
      }),
    };
  }
  const leftData = sideData(leftSide);
  const rightData = sideData(rightSide);

  function handlePositionTap(side: 'home' | 'away', pos: 1 | 2 | 3 | 4 | 5 | 6) {
    if (lineupSetupMode) {
      handleLineupPositionTap(side, pos);
      return;
    }
    const data = sideData(side);
    const playerId = data.onCourt[pos];
    if (!playerId) return;
    if (data.libero?.isOnCourt && data.libero.liberoId === playerId) {
      handleLiberoExitTap(side);
      return;
    }
    setSubSide(side);
    setPreselectedOut({ id: playerId, position: pos });
    setShowSubSheet(true);
  }

  const courtWidth = Math.min(windowWidth - 24, 520);
  const courtHeight = Math.min(courtWidth * 0.62, windowHeight * 0.34);

  const liberoPickerAvailable = lineupPickerTarget
    ? (lineupPickerTarget.side === 'home' ? homePlayers : awayPlayers)
        .filter((p) => p.position !== 'libero')
        .filter((p) => !Object.values(lineupPickerTarget.side === 'home' ? draftHomeCourt : draftAwayCourt).includes(p.id))
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.setsRow}>
        <SetTracker setScores={setScores} currentSetNumber={currentSetNum} maxSets={maxSets} />
        <View style={styles.helpBtn}>
          <InfoTooltip textKey="help.arbitrage" />
        </View>
      </View>

      <View ref={scoreAreaRef} collapsable={false} style={styles.scoreArea}>
        <ScoreButton
          teamName={leftData.team.name}
          score={leftData.score}
          teamColor={leftData.color}
          onPress={() => handlePoint(leftData.side)}
          disabled={lineupSetupMode || setIsOver || showTimeoutSheet}
        />
        <View style={styles.scoreSeparator}>
          <Text style={styles.setsScore}>{leftData.setsWon} - {rightData.setsWon}</Text>
          <Text style={styles.setLabel}>SETS</Text>
          {!lineupSetupMode && (
            <Animated.Image
              source={BALL_IMG}
              style={[styles.serveBall, serveBallStyle]}
              accessibilityLabel={t('referee.serveIndicator')}
            />
          )}
        </View>
        <ScoreButton
          teamName={rightData.team.name}
          score={rightData.score}
          teamColor={rightData.color}
          onPress={() => handlePoint(rightData.side)}
          disabled={lineupSetupMode || setIsOver || showTimeoutSheet}
        />
      </View>

      <View style={styles.courtLabelsRow}>
        <View style={styles.courtLabel}>
          <View style={[styles.teamDot, { backgroundColor: leftData.color }]} />
          <Text style={styles.courtLabelText} numberOfLines={1}>{leftData.team.name}</Text>
        </View>
        <Pressable
          ref={swapBtnRef}
          style={({ pressed }) => [styles.swapBtn, pressed && styles.swapBtnPressed]}
          onPress={() => setSidesSwapped((s) => !s)}
          accessibilityRole="button"
          accessibilityLabel={t('match.changeEnds')}
        >
          <ArrowLeftRight size={18} color={palette.textSecondary} />
        </Pressable>
        <View style={[styles.courtLabel, styles.courtLabelRight]}>
          <Text style={[styles.courtLabelText, styles.courtLabelTextRight]} numberOfLines={1}>{rightData.team.name}</Text>
          <View style={[styles.teamDot, { backgroundColor: rightData.color }]} />
        </View>
      </View>

      {lineupSetupMode && (
        <Text style={styles.lineupHint}>
          {t('arbitrage.tapPosition')} · {leftData.team.shortName ?? leftData.team.name}: {Object.keys(leftData.onCourt).length}/6 · {rightData.team.shortName ?? rightData.team.name}: {Object.keys(rightData.onCourt).length}/6
        </Text>
      )}

      <View style={styles.courtWrap}>
        <FullCourt
          width={courtWidth}
          height={courtHeight}
          leftColor={leftData.color}
          rightColor={rightData.color}
          left={{
            players: courtPlayers(leftData.onCourt, leftData.fullRoster, lineupSetupMode ? null : leftData.libero, leftData.displayedCaptainId),
            isServing: leftData.isServing,
            onPositionPress: (pos) => handlePositionTap(leftData.side, pos),
          }}
          right={{
            players: courtPlayers(rightData.onCourt, rightData.fullRoster, lineupSetupMode ? null : rightData.libero, rightData.displayedCaptainId),
            isServing: rightData.isServing,
            onPositionPress: (pos) => handlePositionTap(rightData.side, pos),
          }}
        />
      </View>

      {lineupSetupMode ? (
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.validateLineupBtn,
              (!isHomeLineupComplete || !isAwayLineupComplete) && styles.validateLineupBtnDisabled,
              pressed && styles.validateLineupBtnPressed,
            ]}
            onPress={handleValidateLineup}
            disabled={!isHomeLineupComplete || !isAwayLineupComplete}
            accessibilityRole="button"
          >
            <Text style={styles.validateLineupBtnText}>{t('arbitrage.validateLineup')}</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View ref={actionsRef} collapsable={false}>
            <View style={styles.infoRow}>
              <CounterPill
                label={leftData.team.shortName ?? leftData.team.name.slice(0, 3).toUpperCase()}
                used={leftData.timeoutsUsed}
                max={match!.config.unlimitedTimeouts ? null : maxTimeouts}
                color={leftData.color}
                onPress={() => handleTimeout(leftData.side)}
              />
              <Pressable
                style={styles.subBtn}
                onPress={() => { setSubSide(leftData.side); setPreselectedOut(null); setShowSubSheet(true); }}
                accessibilityRole="button"
              >
                <Text style={styles.subBtnText}>{t('match.substitution')}</Text>
              </Pressable>
              <Pressable
                style={styles.subBtn}
                onPress={() => { setSubSide(rightData.side); setPreselectedOut(null); setShowSubSheet(true); }}
                accessibilityRole="button"
              >
                <Text style={styles.subBtnText}>{t('match.substitution')}</Text>
              </Pressable>
              <CounterPill
                label={rightData.team.shortName ?? rightData.team.name.slice(0, 3).toUpperCase()}
                used={rightData.timeoutsUsed}
                max={match!.config.unlimitedTimeouts ? null : maxTimeouts}
                color={rightData.color}
                onPress={() => handleTimeout(rightData.side)}
                reversed
              />
            </View>

            <View style={styles.sanctionRow}>
              <Pressable
                style={styles.sanctionBtn}
                onPress={() => { setSanctionSide(leftData.side); setShowSanctionSheet(true); }}
                accessibilityRole="button"
              >
                <AlertTriangle size={14} color={palette.warning} />
                <Text style={styles.sanctionBtnText}>{t('sanction.button')}</Text>
              </Pressable>
              <Pressable
                style={styles.sanctionBtn}
                onPress={() => { setSanctionSide(rightData.side); setShowSanctionSheet(true); }}
                accessibilityRole="button"
              >
                <AlertTriangle size={14} color={palette.warning} />
                <Text style={styles.sanctionBtnText}>{t('sanction.button')}</Text>
              </Pressable>
            </View>
          </View>

          {/* Fixed 4-column bar — the former horizontal scroll pushed "End match" off-screen */}
          <View style={styles.actionsRow}>
            <ActionButton
              icon={<ArrowLeft size={18} color={palette.textSecondary} />}
              label={t('arbitrage.actionMenu')}
              accessibilityLabel={t('home.backToMenu')}
              onPress={() => {
                Alert.alert(t('home.quitMatch'), '', [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('home.backToMenu'), onPress: () => router.replace('/') },
                ]);
              }}
            />
            <ActionButton
              ref={undoRef}
              icon={<RotateCcw size={18} color={setIsOver ? palette.textMuted : palette.textSecondary} />}
              label={t('match.undo')}
              onPress={handleUndo}
              disabled={setIsOver}
            />
            <ActionButton
              icon={<ListChecks size={18} color={palette.textSecondary} />}
              label={t('arbitrage.actionRecap')}
              accessibilityLabel={t('arbitrage.recapButton')}
              onPress={() => setShowRecap(true)}
            />
            <ActionButton
              icon={<Flag size={18} color={palette.error} />}
              label={t('arbitrage.actionEnd')}
              accessibilityLabel={t('match.endMatch')}
              onPress={handleEndMatch}
              danger
            />
          </View>
        </>
      )}

      <TimeoutTimerSheet
        visible={showTimeoutSheet}
        teamName={timeoutTeamName}
        teamColor={timeoutTeamColor}
        onEnd={() => setShowTimeoutSheet(false)}
        onCancel={handleTimeoutCancel}
      />

      {match && (
        <SubstitutionSheet
          visible={showSubSheet}
          onClose={() => { setShowSubSheet(false); setPreselectedOut(null); }}
          side={subSide}
          teamName={subSide === 'home' ? homeTeam.name : awayTeam.name}
          teamColor={subSide === 'home' ? (homeTeam.color || palette.teamHome) : palette.teamAway}
          allPlayers={subSide === 'home' ? homePlayers : awayPlayers}
          onCourt={subSide === 'home' ? onCourtHome : onCourtAway}
          bench={subSide === 'home' ? benchHome : benchAway}
          libero={subSide === 'home' ? liberoHome : liberoAway}
          pairs={subSide === 'home' ? pairsHome : pairsAway}
          subsUsed={subSide === 'home' ? substitutionsHome : substitutionsAway}
          config={match.config}
          format={match.format}
          mode={match.mode}
          isTeamServing={servingTeam === subSide}
          strict
          setEvents={events}
          sanctionEventsForSet={currentSet ? sanctionEvents.filter((e) => e.setId === currentSet.id) : []}
          sanctionEventsForMatch={sanctionEvents}
          initialOutId={preselectedOut?.id ?? null}
          initialOutPosition={preselectedOut?.position ?? null}
          onConfirm={handleSubConfirm}
        />
      )}

      {match && (
        <SanctionSheet
          visible={showSanctionSheet}
          onClose={() => setShowSanctionSheet(false)}
          teamName={sanctionSide === 'home' ? homeTeam.name : awayTeam.name}
          teamColor={sanctionSide === 'home' ? (homeTeam.color || palette.teamHome) : palette.teamAway}
          players={sanctionSide === 'home' ? homePlayers : awayPlayers}
          onConfirm={handleSanctionConfirm}
        />
      )}

      {match && (
        <SubstitutionRecapSheet
          visible={showRecap}
          onClose={() => setShowRecap(false)}
          matchId={match.id}
          sets={sets}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
        />
      )}

      {/* Lineup setup — player picker for the tapped empty position */}
      <Modal visible={lineupPickerTarget !== null} transparent animationType="fade" onRequestClose={() => setLineupPickerTarget(null)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setLineupPickerTarget(null)} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{t('arbitrage.choosePlayer')}</Text>
            <Pressable onPress={() => setLineupPickerTarget(null)} accessibilityRole="button">
              <X size={20} color={palette.textSecondary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.pickerList}>
            {liberoPickerAvailable.length === 0 ? (
              <Text style={styles.emptyHint}>—</Text>
            ) : (
              liberoPickerAvailable.map((p) => (
                <Pressable key={p.id} style={styles.pickerRow} onPress={() => handleLineupAssign(p.id)} accessibilityRole="button">
                  <View style={[styles.pickerNumBadge, { borderColor: lineupPickerTarget?.side === 'home' ? leftData.color : rightData.color }]}>
                    <Text style={styles.pickerNumText}>{p.number}</Text>
                  </View>
                  <Text style={styles.pickerName}>{getPlayerShortName(p)}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Acting captain picker — mandatory once the registered captain leaves the court */}
      <Modal visible={captainPickerSide !== null} transparent animationType="fade">
        <View style={styles.pickerBackdrop} />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{t('arbitrage.captainPickerTitle')}</Text>
          </View>
          <ScrollView contentContainerStyle={styles.pickerList}>
            {(() => {
              const side = captainPickerSide;
              if (!side) return null;
              const data = sideData(side);
              const onCourtRoster = data.fullRoster.filter(
                (p) => p.position !== 'libero' && Object.values(data.onCourt).includes(p.id),
              );
              return onCourtRoster.map((p) => (
                <Pressable key={p.id} style={styles.pickerRow} onPress={() => handleAssignActingCaptain(p.id)} accessibilityRole="button">
                  <View style={[styles.pickerNumBadge, { borderColor: data.color }]}>
                    <Text style={styles.pickerNumText}>{p.number}</Text>
                  </View>
                  <Text style={styles.pickerName}>{getPlayerShortName(p)}</Text>
                </Pressable>
              ));
            })()}
          </ScrollView>
        </View>
      </Modal>

      <CoachMarks
        tipId="arbitrage"
        enabled={
          !!match && !lineupSetupMode && !showSubSheet && !showTimeoutSheet && !showSanctionSheet
          && !showRecap && captainPickerSide === null
        }
        steps={[
          { id: 'score', target: scoreAreaRef },
          { id: 'sides', target: swapBtnRef },
          { id: 'actions', target: actionsRef },
          { id: 'undo', target: undoRef },
        ]}
      />
    </SafeAreaView>
  );
}

function ServeChoiceView({
  homeTeam, awayTeam, onChoose, t, context = 'firstSet',
}: {
  homeTeam: Team;
  awayTeam: Team;
  onChoose: (side: 'home' | 'away') => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
  context?: 'firstSet' | 'set5';
}) {
  return (
    <View style={styles.serveChoiceContainer}>
      {context === 'set5' && <Text style={styles.serveChoiceSubtitle}>{t('arbitrage.set5Title')}</Text>}
      <Text style={styles.serveChoiceTitle}>{t('arbitrage.serveChoiceTitle')}</Text>
      <Pressable
        style={[styles.serveChoiceBtn, { borderColor: homeTeam.color || palette.teamHome }]}
        onPress={() => onChoose('home')}
        accessibilityRole="button"
      >
        <View style={[styles.teamDot, { backgroundColor: homeTeam.color || palette.teamHome }]} />
        <Text style={styles.serveChoiceBtnText}>{homeTeam.name}</Text>
      </Pressable>
      <Pressable
        style={[styles.serveChoiceBtn, { borderColor: palette.teamAway }]}
        onPress={() => onChoose('away')}
        accessibilityRole="button"
      >
        <View style={[styles.teamDot, { backgroundColor: palette.teamAway }]} />
        <Text style={styles.serveChoiceBtnText}>{awayTeam.name}</Text>
      </Pressable>
    </View>
  );
}

function CounterPill({
  label, used, max, color, onPress, reversed,
}: {
  label: string;
  used: number;
  max: number | null;
  color: string;
  onPress: () => void;
  reversed?: boolean;
}) {
  const dots = max !== null ? Array.from({ length: max }, (_, i) => i < used) : [];
  return (
    <Pressable
      style={[styles.pill, reversed && styles.pillReversed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${used}/${max ?? '∞'}`}
    >
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
      {dots.length > 0 ? (
        <View style={styles.pillDots}>
          {dots.map((on, i) => (
            <View key={i} style={[styles.pillDot, { backgroundColor: on ? color : color + '30' }]} />
          ))}
        </View>
      ) : (
        <Text style={styles.pillInf}>∞</Text>
      )}
    </Pressable>
  );
}

function ActionButton({
  ref, icon, label, accessibilityLabel, onPress, disabled, danger,
}: {
  ref?: Ref<View>;
  icon: ReactNode;
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      ref={ref}
      style={({ pressed }) => [
        styles.actionBtn,
        danger && styles.actionBtnDanger,
        disabled && styles.actionBtnDisabled,
        pressed && styles.actionBtnPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
    >
      {icon}
      <Text
        style={[styles.actionText, danger && { color: palette.error }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  loading: { flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: palette.textSecondary, fontFamily: 'Inter_400Regular' },
  setsRow: { paddingTop: 12, paddingBottom: 8, alignItems: 'center' },
  helpBtn: { position: 'absolute', top: 12, right: 12 },
  scoreArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 4,
  },
  scoreSeparator: { alignItems: 'center', gap: 4, width: 56, position: 'relative', overflow: 'visible' },
  setsScore: { fontSize: 20, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  setLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: palette.textMuted, letterSpacing: 1 },
  serveBall: { position: 'absolute', top: '50%', marginTop: -11, left: '50%', marginLeft: -11, width: 22, height: 22 },

  courtLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  courtLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  courtLabelRight: { flexDirection: 'row-reverse' },
  teamDot: { width: 10, height: 10, borderRadius: 5 },
  courtLabelText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  courtLabelTextRight: { textAlign: 'right' },
  swapBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1, borderColor: palette.backgroundElevated,
    marginHorizontal: 8,
  },
  swapBtnPressed: { opacity: 0.7 },
  courtWrap: { alignItems: 'center', marginBottom: 4 },
  lineupHint: {
    fontSize: 12, fontFamily: 'Inter_500Medium', color: palette.textSecondary,
    textAlign: 'center', marginBottom: 6, paddingHorizontal: 16,
  },

  footer: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 },
  validateLineupBtn: {
    backgroundColor: palette.accentPrimary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  validateLineupBtnPressed: { opacity: 0.85 },
  validateLineupBtnDisabled: { opacity: 0.4 },
  validateLineupBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  subBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    alignItems: 'center',
  },
  subBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },

  sanctionRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 4,
  },
  sanctionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1,
    borderColor: palette.warning + '40',
  },
  sanctionBtnText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: palette.warning },

  pill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pillReversed: { flexDirection: 'row-reverse' },
  pillLabel: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  pillDots: { flexDirection: 'row', gap: 3 },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillInf: { fontSize: 14, color: palette.textMuted, fontFamily: 'Inter_700Bold' },

  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  actionBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
  },
  actionBtnDanger: { borderColor: palette.error + '40' },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnPressed: { opacity: 0.7 },
  actionText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: palette.textSecondary },

  serveChoiceContainer: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  serveChoiceSubtitle: {
    fontSize: 14, fontFamily: 'Inter_600SemiBold', color: palette.accentPrimary,
    textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  serveChoiceTitle: {
    fontSize: 20, fontFamily: 'Inter_700Bold', color: palette.textPrimary,
    textAlign: 'center', marginBottom: 12,
  },
  serveChoiceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 20, borderRadius: 16, borderWidth: 2,
    backgroundColor: palette.backgroundSurface,
  },
  serveChoiceBtnText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: palette.textPrimary },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  pickerSheet: {
    backgroundColor: palette.backgroundSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: palette.backgroundElevated,
  },
  pickerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  pickerList: { padding: 16, gap: 8 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: palette.backgroundElevated, borderRadius: 12,
  },
  pickerNumBadge: { width: 34, height: 34, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  pickerNumText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  pickerName: { fontSize: 15, fontFamily: 'Inter_500Medium', color: palette.textPrimary },
  emptyHint: { fontSize: 13, color: palette.textMuted, textAlign: 'center', paddingVertical: 16 },
});
