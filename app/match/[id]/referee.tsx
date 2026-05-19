import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const BALL_IMG = require('../../../assets/images/ballon.png');
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Flag, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { getMatchById, createSet, getSetsForMatch, updateSet, updateMatchStatus } from '../../../src/services/matchService';
import { addEvent, undoLastEvent, addDirectPointCorrection } from '../../../src/services/eventService';
import { getPlayersByTeam } from '../../../src/services/playerService';
import { performSubstitution } from '../../../src/services/substitutionService';
import { useScoringStore } from '../../../src/stores/scoringStore';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { getTeamById } from '../../../src/services/teamService';
import { isSetWon, isMatchWon, isLastSet, getTotalSets, canRequestTimeout } from '../../../src/utils/volleyball-rules';
import { ScoreButton } from '../../../src/components/scoring/ScoreButton';
import { SetTracker } from '../../../src/components/scoring/SetTracker';
import { UndoButton } from '../../../src/components/scoring/UndoButton';
import { SubstitutionSheet } from '../../../src/components/scoring/SubstitutionSheet';
import { TimeoutTimerSheet } from '../../../src/components/scoring/TimeoutTimerSheet';
import { TacticalBoard } from '../../../src/components/tactical/TacticalBoard';
import { TacticalBoardIcon } from '../../../src/components/ui/TacticalBoardIcon';
import { InfoTooltip } from '../../../src/components/ui/InfoTooltip';
import type { Match } from '../../../src/models/match';
import type { Team } from '../../../src/models/team';
import type { Player } from '../../../src/models/player';
import { getPlayerShortName } from '../../../src/features/players/player-helpers';
import { takeLineupDraft } from '../../../src/features/lineup/lineupDraft';
import { palette } from '../../../src/theme/tokens';

type PointAction =
  | 'serve_ace' | 'attack_kill' | 'block_kill'
  | 'serve_fault' | 'attack_fault' | 'block_fault' | 'defense_fault';

interface PendingSetEnd {
  winnerId: string;
  winnerSide: 'home' | 'away';
  newScoreHome: number;
  newScoreAway: number;
  newSetsHome: number;
  newSetsAway: number;
  setNum: number;
  isMatchEnd: boolean;
  matchWinnerName: string;
}

const FAULT_ACTIONS = new Set<PointAction>(['serve_fault', 'attack_fault', 'block_fault', 'defense_fault']);

interface AttributionState {
  scoringTeam: 'home' | 'away';
  playerId: string | null;
  action: PointAction | null;
}

export default function RefereeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  const {
    match, currentSet, scoreHome, scoreAway, setsHome, setsAway,
    setScores, servingTeam, timeoutsHome, timeoutsAway, showChangeEnds,
    onCourtHome, onCourtAway, benchHome, benchAway, liberoHome, liberoAway,
    pairsHome, pairsAway, substitutionsHome, substitutionsAway,
    initMatch, addPointEvent, undoPoint, removePoint, addCorrectionEvent, endCurrentSet, startNewSet,
    requestTimeout, cancelTimeout, initLineup, applySubstitution,
    dismissChangeEnds, reset,
  } = useScoringStore();

  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [homePlayers, setHomePlayers] = useState<Player[]>([]);
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTactical, setShowTactical] = useState(false);
  const [showSubSheet, setShowSubSheet] = useState(false);
  const [subSide, setSubSide] = useState<'home' | 'away'>('home');
  const [attribution, setAttribution] = useState<AttributionState | null>(null);
  const [showTimeoutSheet, setShowTimeoutSheet] = useState(false);
  const [timeoutTeam, setTimeoutTeam] = useState<'home' | 'away'>('home');
  const [timeoutTeamName, setTimeoutTeamName] = useState('');
  const [timeoutTeamColor, setTimeoutTeamColor] = useState<string>(palette.teamHome);
  const attributionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingSetEnd, setPendingSetEnd] = useState<PendingSetEnd | null>(null);
  const pendingSetEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated ball bounce for service indicator
  const ballY = useSharedValue(0);
  useEffect(() => {
    ballY.value = withRepeat(
      withSequence(withTiming(-5, { duration: 350 }), withTiming(0, { duration: 350 })),
      -1,
      false,
    );
  }, [ballY]);
  const ballAnimStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ballY.value }] }));

  // Load match
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

      // Build initial lineups (first 6 non-libero starters on court, libero on bench)
      function buildLineup(players: Player[]) {
        const liberoPlayer = players.find((p) => p.position === 'libero');
        const starters = players.filter((p) => p.position !== 'libero').slice(0, 6);
        const benchPlayers = [
          ...players.filter((p) => p.position !== 'libero').slice(6),
          ...(liberoPlayer ? [liberoPlayer] : []),
        ];
        const courtMap: Record<number, string> = {};
        starters.forEach((p, i) => { courtMap[i + 1] = p.id; });
        const liberoState = liberoPlayer
          ? { liberoId: liberoPlayer.id, isOnCourt: false, replacedPlayerId: null, replacedPosition: null }
          : null;
        return { courtMap, bench: benchPlayers, liberoState };
      }

      const draft = takeLineupDraft();
      const homeLineup = draft?.home ?? buildLineup(homePlrs);
      const awayLineup = draft?.away ?? buildLineup(awayPlrs);

      if (m.status === 'created') {
        await updateMatchStatus(id, 'live');
        const firstSet = await createSet(id, 1);
        initMatch({ ...m, status: 'live' }, firstSet);
      } else {
        // Resume: load existing sets, use the last unfinished one
        const existingSets = await getSetsForMatch(id);
        const activeSet =
          existingSets.find((s) => !s.finishedAt) ??
          existingSets[existingSets.length - 1] ??
          (await createSet(id, 1));
        initMatch(m, activeSet);
      }
      // initLineup AFTER initMatch — initMatch resets court to EMPTY_COURT
      initLineup('home', homeLineup.courtMap, homeLineup.bench, homeLineup.liberoState);
      initLineup('away', awayLineup.courtMap, awayLineup.bench, awayLineup.liberoState);
      setLoading(false);
    }
    load();
    return () => reset();
  }, [id]);

  // Auto-dismiss attribution strip after 8 s of inactivity
  useEffect(() => {
    if (attribution) {
      if (attributionTimerRef.current) clearTimeout(attributionTimerRef.current);
      attributionTimerRef.current = setTimeout(() => setAttribution(null), 8000);
    }
    return () => { if (attributionTimerRef.current) clearTimeout(attributionTimerRef.current); };
  }, [attribution]);

  // Clean up pending-set-end timer on unmount
  useEffect(() => {
    return () => { if (pendingSetEndTimerRef.current) clearTimeout(pendingSetEndTimerRef.current); };
  }, []);

  const handleAttributionSelect = useCallback(
    async (update: Partial<Pick<AttributionState, 'playerId' | 'action'>>) => {
      if (!match || !currentSet || !attribution) return;
      const next = { ...attribution, ...update };
      if (next.playerId && next.action) {
        // Both selected → record stat and dismiss
        const isFault = FAULT_ACTIONS.has(next.action);
        // Faults are attributed to the opposing team (they caused their opponents to score)
        const eventTeamId = isFault
          ? (next.scoringTeam === 'home' ? match.teamAwayId : match.teamHomeId)
          : (next.scoringTeam === 'home' ? match.teamHomeId : match.teamAwayId);
        await addEvent({
          matchId: match.id,
          setId: currentSet.id,
          eventType: next.action,
          playerId: next.playerId,
          teamId: eventTeamId,
          details: {},
        });
        setAttribution(null);
        if (attributionTimerRef.current) clearTimeout(attributionTimerRef.current);
      } else {
        // Clear player selection when switching between point/fault categories
        if (update.action && attribution.action !== null) {
          const wasFailt = FAULT_ACTIONS.has(attribution.action);
          const isNowFault = FAULT_ACTIONS.has(update.action);
          if (wasFailt !== isNowFault) next.playerId = null;
        }
        setAttribution(next);
      }
    },
    [match, currentSet, attribution],
  );

  const finalizePendingSetEnd = useCallback((info: PendingSetEnd) => {
    if (pendingSetEndTimerRef.current) clearTimeout(pendingSetEndTimerRef.current);
    setPendingSetEnd(null);
    setAttribution(null);

    if (info.isMatchEnd) {
      Alert.alert(
        t('match.matchOver'),
        t('referee.winsMatch', { name: info.matchWinnerName }),
        [{ text: t('common.done'), onPress: () => router.replace(`/match/${match?.id}/summary`) }],
      );
    } else {
      Alert.alert(
        t('match.setOver'),
        t('referee.setsScore', { home: info.newSetsHome, away: info.newSetsAway }),
        [{
          text: t('referee.nextSet'),
          onPress: async () => {
            if (!match) return;
            const nextSet = await createSet(match.id, info.setNum + 1);
            startNewSet(nextSet);
          },
        }],
      );
    }
  }, [match, t, router, startNewSet]);

  const handlePoint = useCallback(async (team: 'home' | 'away') => {
    if (!match || !currentSet) return;
    if (currentSet.winnerTeamId) return;

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

    addPointEvent(team, newEvent);

    // Show attribution strip (always, even if no players — fault section still useful)
    if (homePlayers.length > 0 || awayPlayers.length > 0) {
      setAttribution({ scoringTeam: team, playerId: null, action: null });
    }

    const newScoreHome = team === 'home' ? scoreHome + 1 : scoreHome;
    const newScoreAway = team === 'away' ? scoreAway + 1 : scoreAway;
    const setNum = currentSet.setNumber;
    const lastSet = isLastSet(setNum, match.config);

    // Check set win
    const homeWins = isSetWon(newScoreHome, newScoreAway, match.config, lastSet);
    const awayWins = isSetWon(newScoreAway, newScoreHome, match.config, lastSet);

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
        if (hapticsEnabled) setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 300);
      }

      const pendingInfo: PendingSetEnd = {
        winnerId: winnerTeamId,
        winnerSide,
        newScoreHome,
        newScoreAway,
        newSetsHome,
        newSetsAway,
        setNum,
        isMatchEnd,
        matchWinnerName: homeWins ? (homeTeam?.name ?? '') : (awayTeam?.name ?? ''),
      };
      setPendingSetEnd(pendingInfo);
      if (pendingSetEndTimerRef.current) clearTimeout(pendingSetEndTimerRef.current);
      pendingSetEndTimerRef.current = setTimeout(() => finalizePendingSetEnd(pendingInfo), 3000);
    }
  }, [match, currentSet, scoreHome, scoreAway, setsHome, setsAway, homeTeam, awayTeam, homePlayers, awayPlayers, finalizePendingSetEnd]);

  const handleUndo = useCallback(async () => {
    if (!match || !currentSet) return;
    const cancelledId = await undoLastEvent(match.id, currentSet.id);
    if (cancelledId) {
      undoPoint(cancelledId);
      if (hapticsEnabled) Haptics.selectionAsync();
    }
  }, [match, currentSet, hapticsEnabled]);

  const handleRemovePoint = useCallback(async (team: 'home' | 'away') => {
    if (!match || !currentSet) return;
    const newEvent = await addDirectPointCorrection(match.id, currentSet.id, team);
    addCorrectionEvent(team, newEvent);
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [match, currentSet, hapticsEnabled, addCorrectionEvent]);

  const handleSubConfirm = useCallback(async (opts: {
    playerOutId: string;
    playerInId: string;
    position: number;
    isLibero: boolean;
  }) => {
    if (!match || !currentSet) return;
    const side = subSide;
    const teamId = side === 'home' ? match.teamHomeId : match.teamAwayId;
    const { pair } = await performSubstitution({
      matchId: match.id,
      setId: currentSet.id,
      teamId,
      teamSide: side,
      playerOutId: opts.playerOutId,
      playerInId: opts.playerInId,
      position: opts.position,
      isLibero: opts.isLibero,
    });
    applySubstitution(side, opts.playerOutId, opts.playerInId, opts.position, opts.isLibero, pair);
    if (hapticsEnabled) Haptics.selectionAsync();
  }, [match, currentSet, subSide, applySubstitution, hapticsEnabled]);

  const handleTimeout = (team: 'home' | 'away') => {
    if (!match) return;
    const timeoutsUsed = team === 'home' ? timeoutsHome : timeoutsAway;
    if (!canRequestTimeout(timeoutsUsed, match.config)) {
      Alert.alert('', t('referee.noTimeoutsLeft'));
      return;
    }
    requestTimeout(team);
    setTimeoutTeam(team);
    if (hapticsEnabled) Haptics.selectionAsync();
    const name = team === 'home' ? (homeTeam?.name ?? '') : (awayTeam?.name ?? '');
    const color = team === 'home' ? (homeTeam?.color ?? palette.teamHome) : palette.teamAway;
    setTimeoutTeamName(name);
    setTimeoutTeamColor(color);
    setShowTimeoutSheet(true);
  };

  const handleTimeoutCancel = () => {
    cancelTimeout(timeoutTeam);
    setShowTimeoutSheet(false);
  };

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

  if (loading || !match || !homeTeam || !awayTeam) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  const maxSets = getTotalSets(match.config);
  const currentSetNum = currentSet?.setNumber ?? 1;
  const maxTimeouts = match.config.timeoutsPerSet ?? 2;
  const setIsOver = !!currentSet?.winnerTeamId;

  return (
    <SafeAreaView style={styles.container}>
      {/* Sets tracker */}
      <View style={styles.setsRow}>
        <SetTracker
          setScores={setScores}
          currentSetNumber={currentSetNum}
          maxSets={maxSets}
        />
        <InfoTooltip textKey="help.referee" />
      </View>

      {/* Score area */}
      <View style={styles.scoreArea}>
        <ScoreButton
          teamName={homeTeam.name}
          score={scoreHome}
          teamColor={homeTeam.color || palette.teamHome}
          onPress={() => handlePoint('home')}
          onRemove={() => handleRemovePoint('home')}
          disabled={setIsOver || showTimeoutSheet}
        />

        <View style={styles.scoreSeparator}>
          <Text style={styles.setsScore}>{setsHome} - {setsAway}</Text>
          <Text style={styles.setLabel}>SETS</Text>
        </View>

        <ScoreButton
          teamName={awayTeam.name}
          score={scoreAway}
          teamColor={palette.teamAway}
          onPress={() => handlePoint('away')}
          onRemove={() => handleRemovePoint('away')}
          disabled={setIsOver || showTimeoutSheet}
        />
      </View>

      {/* Service indicator */}
      <View style={styles.serviceRow}>
        {servingTeam === 'home' && <Animated.Image source={BALL_IMG} style={[styles.serviceBall, ballAnimStyle]} />}
        <View style={[styles.serviceDot, servingTeam === 'home' && styles.serviceDotActive]} />
        <Text style={styles.serviceText}>
          {t('referee.serveIndicator')} : {servingTeam === 'home' ? homeTeam.name : awayTeam.name}
        </Text>
        <View style={[styles.serviceDot, servingTeam === 'away' && styles.serviceDotActive]} />
        {servingTeam === 'away' && <Animated.Image source={BALL_IMG} style={[styles.serviceBall, ballAnimStyle]} />}
      </View>

      {/* Timeouts */}
      <View style={styles.infoRow}>
        <TimeoutIndicator
          label={homeTeam.shortName ?? homeTeam.name.slice(0, 3).toUpperCase()}
          used={timeoutsHome}
          max={match.config.unlimitedTimeouts ? Infinity : maxTimeouts}
          onPress={() => handleTimeout('home')}
          color={homeTeam.color || palette.teamHome}
        />
        <TimeoutIndicator
          label={awayTeam.shortName ?? awayTeam.name.slice(0, 3).toUpperCase()}
          used={timeoutsAway}
          max={match.config.unlimitedTimeouts ? Infinity : maxTimeouts}
          onPress={() => handleTimeout('away')}
          color={palette.teamAway}
          reversed
        />
      </View>

      {/* Substitution row */}
      {match.format === 'indoor_6v6' && (
        <View style={styles.subRow}>
          <SubIndicator
            label={homeTeam.shortName ?? homeTeam.name.slice(0, 3).toUpperCase()}
            used={substitutionsHome}
            max={match.config.unlimitedSubstitutions ? null : (match.config.substitutionsPerSet ?? 6)}
            color={homeTeam.color || palette.teamHome}
            onPress={() => { setSubSide('home'); setShowSubSheet(true); }}
          />
          <Text style={styles.subSeparator}>{t('match.substitution')}</Text>
          <SubIndicator
            label={awayTeam.shortName ?? awayTeam.name.slice(0, 3).toUpperCase()}
            used={substitutionsAway}
            max={match.config.unlimitedSubstitutions ? null : (match.config.substitutionsPerSet ?? 6)}
            color={palette.teamAway}
            onPress={() => { setSubSide('away'); setShowSubSheet(true); }}
            reversed
          />
        </View>
      )}

      {/* Attribution strip — appears after each point */}
      {attribution && (
        <AttributionStrip
          scoringTeam={attribution.scoringTeam}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
          homeColor={homeTeam?.color ?? palette.teamHome}
          awayColor={palette.teamAway}
          selectedPlayerId={attribution.playerId}
          selectedAction={attribution.action}
          onSelectPlayer={(id) => handleAttributionSelect({ playerId: id })}
          onSelectAction={(action) => handleAttributionSelect({ action })}
          onDismiss={() => setAttribution(null)}
          t={t}
        />
      )}

      {/* Set-end banner — visible for 3 s after the last point */}
      {pendingSetEnd && (
        <View style={styles.setEndBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.setEndBannerTitle}>
              {pendingSetEnd.isMatchEnd ? t('match.matchOver') : t('match.setOver')} !
            </Text>
            <Text style={styles.setEndBannerSubtitle}>{t('stats.setEndStats')}</Text>
          </View>
          <Pressable
            onPress={() => finalizePendingSetEnd(pendingSetEnd)}
            style={styles.setEndBannerBtn}
            accessibilityRole="button"
          >
            <Text style={styles.setEndBannerBtnText}>
              {pendingSetEnd.isMatchEnd ? t('common.done') : t('referee.nextSet')} →
            </Text>
          </Pressable>
        </View>
      )}

      {/* Bottom actions */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.actionsScroll}
        contentContainerStyle={styles.actionsRow}
      >
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={() => {
            Alert.alert(t('home.quitMatch'), '', [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('home.backToMenu'), onPress: () => router.replace('/') },
            ]);
          }}
          accessibilityRole="button"
        >
          <ArrowLeft size={16} color={palette.textSecondary} />
          <Text style={styles.actionText}>{t('home.backToMenu')}</Text>
        </Pressable>
        <UndoButton onPress={handleUndo} disabled={setIsOver} />
        <Pressable
          style={({ pressed }) => [styles.tacticalBtn, pressed && styles.actionBtnPressed]}
          onPress={() => setShowTactical(true)}
          accessibilityLabel={t('tactical.title')}
          accessibilityRole="button"
        >
          <TacticalBoardIcon size={20} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtnEnd, pressed && styles.actionBtnPressed]}
          onPress={handleEndMatch}
          accessibilityLabel={t('match.endMatch')}
          accessibilityRole="button"
        >
          <Flag size={16} color={palette.error} />
          <Text style={[styles.actionText, { color: palette.error }]}>{t('match.endMatch')}</Text>
        </Pressable>
      </ScrollView>

      {/* Timeout countdown sheet */}
      <TimeoutTimerSheet
        visible={showTimeoutSheet}
        teamName={timeoutTeamName}
        teamColor={timeoutTeamColor}
        onEnd={() => setShowTimeoutSheet(false)}
        onCancel={handleTimeoutCancel}
      />

      {/* Substitution sheet */}
      <SubstitutionSheet
        visible={showSubSheet}
        onClose={() => setShowSubSheet(false)}
        side={subSide}
        teamName={subSide === 'home' ? (homeTeam?.name ?? '') : (awayTeam?.name ?? '')}
        teamColor={subSide === 'home' ? (homeTeam?.color ?? palette.teamHome) : palette.teamAway}
        allPlayers={subSide === 'home' ? homePlayers : awayPlayers}
        onCourt={subSide === 'home' ? onCourtHome : onCourtAway}
        bench={subSide === 'home' ? benchHome : benchAway}
        libero={subSide === 'home' ? liberoHome : liberoAway}
        pairs={subSide === 'home' ? pairsHome : pairsAway}
        subsUsed={subSide === 'home' ? substitutionsHome : substitutionsAway}
        config={match.config}
        format={match.format}
        mode={match.mode}
        onConfirm={handleSubConfirm}
      />

      {/* Tactical board */}
      <TacticalBoard
        visible={showTactical}
        onClose={() => setShowTactical(false)}
        format={match.format}
        homeTeamId={match.teamHomeId}
        awayTeamId={match.teamAwayId}
        homeTeamName={homeTeam.name}
        awayTeamName={awayTeam.name}
        matchId={match.id}
        homePlayers={homePlayers}
        awayPlayers={awayPlayers}
      />

      {/* Change ends modal (beach) */}
      <Modal visible={showChangeEnds} transparent animationType="fade">
        <View style={styles.changeEndsOverlay}>
          <View style={styles.changeEndsCard}>
            <Text style={styles.changeEndsTitle}>{t('match.changeEnds')}</Text>
            <Pressable
              style={styles.changeEndsBtn}
              onPress={dismissChangeEnds}
              accessibilityRole="button"
            >
              <Text style={styles.changeEndsBtnText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function AttributionStrip({
  scoringTeam,
  homePlayers,
  awayPlayers,
  homeColor,
  awayColor,
  selectedPlayerId,
  selectedAction,
  onSelectPlayer,
  onSelectAction,
  onDismiss,
  t,
}: {
  scoringTeam: 'home' | 'away';
  homePlayers: Player[];
  awayPlayers: Player[];
  homeColor: string;
  awayColor: string;
  selectedPlayerId: string | null;
  selectedAction: PointAction | null;
  onSelectPlayer: (id: string) => void;
  onSelectAction: (action: PointAction) => void;
  onDismiss: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const isFaultAction = selectedAction ? FAULT_ACTIONS.has(selectedAction) : false;
  // Points → scoring team's players; Faults → opposing team's players (they made the error)
  const players = isFaultAction
    ? (scoringTeam === 'home' ? awayPlayers : homePlayers)
    : (scoringTeam === 'home' ? homePlayers : awayPlayers);
  const teamColor = scoringTeam === 'home' ? homeColor : awayColor;
  const chipColor = isFaultAction ? palette.error : teamColor;

  const POINT_ACTIONS: { key: PointAction; label: string }[] = [
    { key: 'serve_ace', label: t('referee.attribution.ace') },
    { key: 'attack_kill', label: t('referee.attribution.attack') },
    { key: 'block_kill', label: t('referee.attribution.block') },
  ];

  const FAULT_ACTION_LIST: { key: PointAction; label: string }[] = [
    { key: 'serve_fault', label: t('referee.attribution.serveFault') },
    { key: 'attack_fault', label: t('referee.attribution.attackFault') },
    { key: 'block_fault', label: t('referee.attribution.blockFault') },
    { key: 'defense_fault', label: t('referee.attribution.defenseFault') },
  ];

  return (
    <View style={attrStyles.strip}>
      <View style={attrStyles.header}>
        <Text style={attrStyles.title}>{t('referee.attribution.who')}</Text>
        <Pressable onPress={onDismiss} accessibilityRole="button" style={attrStyles.skipBtn}>
          <Text style={attrStyles.skipText}>{t('referee.attribution.skip')}</Text>
        </Pressable>
      </View>

      {/* Player chips — scoring team for points, opposing team for faults */}
      {players.length > 0 && (
        <FlatList
          horizontal
          data={players}
          keyExtractor={(p) => p.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={attrStyles.playerList}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedPlayerId;
            const isLibero = item.position === 'libero';
            const activeChipColor = isLibero ? palette.libero : chipColor;
            return (
              <Pressable
                style={[attrStyles.playerChip, isSelected && { borderColor: activeChipColor, backgroundColor: activeChipColor + '20' }]}
                onPress={() => onSelectPlayer(item.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[attrStyles.playerNum, isSelected && { color: activeChipColor }]}>
                  {isLibero ? '⚡' : ''}#{item.number}
                </Text>
                <Text style={attrStyles.playerName} numberOfLines={1}>{getPlayerShortName(item)}</Text>
              </Pressable>
            );
          }}
        />
      )}

      {/* Points section */}
      <View style={attrStyles.sectionBlock}>
        <Text style={attrStyles.sectionTitle}>{t('referee.attribution.pointsSection')}</Text>
        <View style={attrStyles.actions}>
          {POINT_ACTIONS.map(({ key, label }) => {
            const isSelected = key === selectedAction;
            return (
              <Pressable
                key={key}
                style={[attrStyles.actionBtn, isSelected && { borderColor: teamColor, backgroundColor: teamColor + '20' }]}
                onPress={() => onSelectAction(key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[attrStyles.actionText, isSelected && { color: teamColor }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Faults section */}
      <View style={attrStyles.sectionBlock}>
        <Text style={[attrStyles.sectionTitle, attrStyles.faultSectionTitle]}>{t('referee.attribution.faultsSection')}</Text>
        <View style={attrStyles.actions}>
          {FAULT_ACTION_LIST.map(({ key, label }) => {
            const isSelected = key === selectedAction;
            return (
              <Pressable
                key={key}
                style={[attrStyles.actionBtn, isSelected && { borderColor: palette.error, backgroundColor: palette.error + '20' }]}
                onPress={() => onSelectAction(key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[attrStyles.actionText, isSelected && { color: palette.error }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const attrStyles = StyleSheet.create({
  strip: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: palette.backgroundSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    paddingVertical: 10,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  title: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  skipBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  skipText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: palette.textMuted },
  playerList: { paddingHorizontal: 12, gap: 6 },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: palette.backgroundElevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  playerNum: { fontSize: 12, fontFamily: 'Inter_700Bold', color: palette.textMuted },
  playerName: { fontSize: 12, fontFamily: 'Inter_500Medium', color: palette.textSecondary, maxWidth: 72 },
  sectionBlock: { gap: 6, paddingHorizontal: 12 },
  sectionTitle: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  faultSectionTitle: { color: palette.error + 'AA' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: palette.backgroundElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },
});

function SubIndicator({
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
  const full = max !== null && used >= max;
  return (
    <Pressable
      style={[styles.subGroup, reversed && styles.subGroupReversed, full && styles.subGroupFull]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Remplacement ${label}`}
    >
      <Text style={[styles.subLabel, { color }]}>{label}</Text>
      {dots.length > 0 && (
        <View style={styles.subDots}>
          {dots.map((used, i) => (
            <View key={i} style={[styles.subDot, { backgroundColor: used ? color : color + '30' }]} />
          ))}
        </View>
      )}
      {max === null && <Text style={styles.subInf}>∞</Text>}
    </Pressable>
  );
}

function TimeoutIndicator({
  label,
  used,
  max,
  onPress,
  color,
  reversed,
}: {
  label: string;
  used: number;
  max: number;
  onPress: () => void;
  color: string;
  reversed?: boolean;
}) {
  const dots = max === Infinity ? [] : Array.from({ length: max }, (_, i) => i < used);
  return (
    <Pressable
      style={[styles.timeoutGroup, reversed && styles.timeoutGroupReversed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Temps mort ${label}`}
    >
      <Text style={[styles.timeoutLabel, { color }]}>{label}</Text>
      {dots.length > 0 && (
        <View style={styles.timeoutDots}>
          {dots.map((used, i) => (
            <View key={i} style={[styles.timeoutDot, { backgroundColor: used ? color : color + '30' }]} />
          ))}
        </View>
      )}
      {max === Infinity && <Text style={styles.timeoutInf}>∞</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  loading: { flex: 1, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: palette.textSecondary, fontFamily: 'Inter_400Regular' },
  setsRow: { paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingRight: 12 },
  scoreArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  scoreSeparator: { alignItems: 'center', gap: 4, width: 56 },
  setsScore: { fontSize: 20, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  setLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: palette.textMuted, letterSpacing: 1 },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 10,
    marginHorizontal: 16,
    backgroundColor: palette.backgroundSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    marginBottom: 8,
  },
  serviceBall: { width: 28, height: 28, marginHorizontal: 4 },
  serviceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.backgroundHover },
  serviceDotActive: { backgroundColor: palette.accentPrimary },
  serviceText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 4,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  subSeparator: { fontSize: 10, fontFamily: 'Inter_500Medium', color: palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  subGroup: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  subGroupReversed: { flexDirection: 'row-reverse' },
  subGroupFull: { opacity: 0.4 },
  subLabel: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  subDots: { flexDirection: 'row', gap: 3 },
  subDot: { width: 7, height: 7, borderRadius: 3.5 },
  subInf: { fontSize: 14, color: palette.textMuted, fontFamily: 'Inter_700Bold' },
  timeoutGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeoutGroupReversed: { flexDirection: 'row-reverse' },
  timeoutLabel: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  timeoutDots: { flexDirection: 'row', gap: 4 },
  timeoutDot: { width: 10, height: 10, borderRadius: 5 },
  timeoutInf: { fontSize: 16, color: palette.textMuted, fontFamily: 'Inter_700Bold' },
  actionsScroll: {
    flexShrink: 0,
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
  },
  actionBtnEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1,
    borderColor: palette.error + '40',
  },
  tacticalBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tacticalIcon: { alignItems: 'center', justifyContent: 'center' },
  actionBtnPressed: { opacity: 0.7 },
  actionText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  setEndBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2EA043',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  setEndBannerTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  setEndBannerSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  setEndBannerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  setEndBannerBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  changeEndsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeEndsCard: {
    backgroundColor: palette.backgroundSurface,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 20,
    marginHorizontal: 40,
  },
  changeEndsTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: palette.textPrimary,
    textAlign: 'center',
  },
  changeEndsBtn: {
    backgroundColor: palette.accentPrimary,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 14,
  },
  changeEndsBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
});
