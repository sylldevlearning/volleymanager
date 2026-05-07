import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Pause, Play, Flag } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { getMatchById, createSet, updateSet, updateMatchStatus } from '../../../src/services/matchService';
import { addEvent, undoLastEvent } from '../../../src/services/eventService';
import { useScoringStore } from '../../../src/stores/scoringStore';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { getTeamById } from '../../../src/services/teamService';
import { isSetWon, isMatchWon, isLastSet, getTotalSets, canRequestTimeout } from '../../../src/utils/volleyball-rules';
import { ScoreButton } from '../../../src/components/scoring/ScoreButton';
import { SetTracker } from '../../../src/components/scoring/SetTracker';
import { UndoButton } from '../../../src/components/scoring/UndoButton';
import { TacticalBoard } from '../../../src/components/tactical/TacticalBoard';
import type { Match } from '../../../src/models/match';
import type { Team } from '../../../src/models/team';
import { palette } from '../../../src/theme/tokens';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function RefereeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  const {
    match, currentSet, sets, scoreHome, scoreAway, setsHome, setsAway,
    setScores, servingTeam, timeoutsHome, timeoutsAway, matchTimer,
    isTimerRunning, showChangeEnds,
    initMatch, addPointEvent, undoPoint, endCurrentSet, startNewSet,
    requestTimeout, tickTimer, setTimerRunning, dismissChangeEnds, reset,
  } = useScoringStore();

  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [showTactical, setShowTactical] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load match
  useEffect(() => {
    async function load() {
      if (!id) return;
      const m = await getMatchById(id);
      if (!m) return;

      const [home, away] = await Promise.all([getTeamById(m.teamHomeId), getTeamById(m.teamAwayId)]);
      setHomeTeam(home);
      setAwayTeam(away);

      if (m.status === 'created') {
        await updateMatchStatus(id, 'live');
        const firstSet = await createSet(id, 1);
        initMatch({ ...m, status: 'live' }, firstSet);
      } else {
        // Resume in-progress match (simplified: restart state)
        const firstSet = await createSet(id, 1);
        initMatch(m, firstSet);
      }
      setLoading(false);
    }
    load();
    return () => reset();
  }, [id]);

  // Timer
  useEffect(() => {
    if (isTimerRunning && !isPaused) {
      timerRef.current = setInterval(tickTimer, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerRunning, isPaused]);

  const handlePoint = useCallback(async (team: 'home' | 'away') => {
    if (!match || !currentSet || isPaused) return;

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

      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      await updateSet(currentSet.id, newScoreHome, newScoreAway, winnerTeamId);
      const updatedSet = { ...currentSet, scoreHome: newScoreHome, scoreAway: newScoreAway, winnerTeamId };
      endCurrentSet(winnerSide, updatedSet);

      const newSetsHome = setsHome + (homeWins ? 1 : 0);
      const newSetsAway = setsAway + (awayWins ? 1 : 0);

      if (isMatchWon(newSetsHome, match.config) || isMatchWon(newSetsAway, match.config)) {
        // Match over
        const matchWinnerId = isMatchWon(newSetsHome, match.config) ? match.teamHomeId : match.teamAwayId;
        await updateMatchStatus(match.id, 'finished', matchWinnerId);
        setTimerRunning(false);
        if (hapticsEnabled) {
          setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 300);
        }
        Alert.alert(
          t('match.matchOver'),
          `${isMatchWon(newSetsHome, match.config) ? homeTeam?.name : awayTeam?.name} remporte le match !`,
          [{ text: t('common.done'), onPress: () => router.replace(`/match/${match.id}/summary`) }]
        );
      } else {
        // Next set
        Alert.alert(
          t('match.setOver'),
          `Score des sets : ${newSetsHome} - ${newSetsAway}`,
          [{
            text: 'Set suivant',
            onPress: async () => {
              const nextSet = await createSet(match.id, setNum + 1);
              startNewSet(nextSet);
            },
          }]
        );
      }
    }
  }, [match, currentSet, isPaused, scoreHome, scoreAway, setsHome, setsAway, homeTeam, awayTeam]);

  const handleUndo = useCallback(async () => {
    if (!match || !currentSet) return;
    const cancelledId = await undoLastEvent(match.id, currentSet.id);
    if (cancelledId) {
      undoPoint(cancelledId);
      if (hapticsEnabled) Haptics.selectionAsync();
    }
  }, [match, currentSet, hapticsEnabled]);

  const handleTimeout = (team: 'home' | 'away') => {
    if (!match) return;
    const timeoutsUsed = team === 'home' ? timeoutsHome : timeoutsAway;
    if (!canRequestTimeout(timeoutsUsed, match.config)) {
      Alert.alert('', 'Plus de temps morts disponibles.');
      return;
    }
    requestTimeout(team);
    if (hapticsEnabled) Haptics.selectionAsync();
    Alert.alert(t('match.timeout'), `Temps mort — ${team === 'home' ? homeTeam?.name : awayTeam?.name}`);
  };

  const handlePause = () => {
    setIsPaused((p) => !p);
    if (hapticsEnabled) Haptics.selectionAsync();
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Sets tracker */}
      <View style={styles.setsRow}>
        <SetTracker
          setScores={setScores}
          currentSetNumber={currentSetNum}
          maxSets={maxSets}
        />
      </View>

      {/* Score area */}
      <View style={styles.scoreArea}>
        <ScoreButton
          teamName={homeTeam.name}
          score={scoreHome}
          teamColor={homeTeam.color || palette.teamHome}
          onPress={() => handlePoint('home')}
          disabled={isPaused}
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
          disabled={isPaused}
        />
      </View>

      {/* Service indicator */}
      <View style={styles.serviceRow}>
        <View style={[styles.serviceDot, servingTeam === 'home' && styles.serviceDotActive]} />
        <Text style={styles.serviceText}>
          {t('referee.serveIndicator')} : {servingTeam === 'home' ? homeTeam.name : awayTeam.name}
        </Text>
        <View style={[styles.serviceDot, servingTeam === 'away' && styles.serviceDotActive]} />
      </View>

      {/* Timeouts + Timer */}
      <View style={styles.infoRow}>
        <TimeoutIndicator
          label={homeTeam.shortName ?? homeTeam.name.slice(0, 3).toUpperCase()}
          used={timeoutsHome}
          max={match.config.unlimitedTimeouts ? Infinity : maxTimeouts}
          onPress={() => handleTimeout('home')}
          color={homeTeam.color || palette.teamHome}
        />
        <Text style={styles.timer}>{formatTime(matchTimer)}</Text>
        <TimeoutIndicator
          label={awayTeam.shortName ?? awayTeam.name.slice(0, 3).toUpperCase()}
          used={timeoutsAway}
          max={match.config.unlimitedTimeouts ? Infinity : maxTimeouts}
          onPress={() => handleTimeout('away')}
          color={palette.teamAway}
          reversed
        />
      </View>

      {/* Bottom actions */}
      <View style={styles.actionsRow}>
        <UndoButton
          onPress={handleUndo}
          disabled={isPaused}
        />
        <Pressable
          style={({ pressed }) => [styles.tacticalBtn, pressed && styles.actionBtnPressed]}
          onPress={() => setShowTactical(true)}
          accessibilityLabel={t('tactical.title')}
          accessibilityRole="button"
        >
          <Text style={styles.tacticalIcon}>📋</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={handlePause}
          accessibilityLabel={isPaused ? t('match.resume') : t('match.pause')}
          accessibilityRole="button"
        >
          {isPaused ? <Play size={18} color={palette.success} /> : <Pause size={18} color={palette.textSecondary} />}
          <Text style={styles.actionText}>{isPaused ? t('match.resume') : t('match.pause')}</Text>
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
      </View>

      {/* Tactical board */}
      <TacticalBoard
        visible={showTactical}
        onClose={() => setShowTactical(false)}
        format={match.format}
        homeTeamId={match.teamHomeId}
        awayTeamId={match.teamAwayId}
        homeTeamName={homeTeam.name}
        awayTeamName={awayTeam.name}
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
  setsRow: { paddingTop: 12, paddingBottom: 8 },
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
  timer: { fontSize: 20, fontFamily: 'Inter_700Bold', color: palette.textSecondary },
  timeoutGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeoutGroupReversed: { flexDirection: 'row-reverse' },
  timeoutLabel: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  timeoutDots: { flexDirection: 'row', gap: 4 },
  timeoutDot: { width: 10, height: 10, borderRadius: 5 },
  timeoutInf: { fontSize: 16, color: palette.textMuted, fontFamily: 'Inter_700Bold' },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    alignItems: 'center',
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
  tacticalIcon: { fontSize: 20 },
  actionBtnPressed: { opacity: 0.7 },
  actionText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
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
