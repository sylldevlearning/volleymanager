import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMatchById } from '../../../src/services/matchService';
import { getPlayersByTeam } from '../../../src/services/playerService';
import { getTeamById } from '../../../src/services/teamService';
import { setLineupDraft } from '../../../src/features/lineup/lineupDraft';
import type { Player } from '../../../src/models/player';
import type { Team } from '../../../src/models/team';
import type { Match } from '../../../src/models/match';
import type { LiberoState } from '../../../src/models/substitution';
import type { CourtMap } from '../../../src/stores/scoringStore';
import { palette } from '../../../src/theme/tokens';

interface PlayerSlot {
  player: Player;
  isPresent: boolean;
  isStarter: boolean;
}

function buildInitialSlots(players: Player[], maxStarters: number): PlayerSlot[] {
  const nonLiberos = players.filter((p) => p.position !== 'libero');
  return players.map((p) => {
    const isLibero = p.position === 'libero';
    const nonLiberoIdx = nonLiberos.indexOf(p);
    return {
      player: p,
      isPresent: true,
      isStarter: !isLibero && nonLiberoIdx < maxStarters,
    };
  });
}

function buildSideLineup(slots: PlayerSlot[]): { courtMap: CourtMap; bench: Player[]; liberoState: LiberoState | null } {
  const starters = slots.filter((s) => s.isStarter);
  const courtMap: CourtMap = {};
  starters.forEach((s, i) => { courtMap[i + 1] = s.player.id; });

  const liberoSlot = slots.find((s) => s.player.position === 'libero' && s.isPresent);
  const liberoState: LiberoState | null = liberoSlot
    ? { liberoId: liberoSlot.player.id, isOnCourt: false, replacedPlayerId: null, replacedPosition: null }
    : null;

  const bench = slots.filter((s) => s.isPresent && !s.isStarter).map((s) => s.player);
  return { courtMap, bench, liberoState };
}

export default function LineupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const [match, setMatch] = useState<Match | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [homeSlots, setHomeSlots] = useState<PlayerSlot[]>([]);
  const [awaySlots, setAwaySlots] = useState<PlayerSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const maxStarters = match?.format === 'beach_2v2' ? 2 : 6;

  useEffect(() => {
    async function load() {
      if (!id) return;
      const m = await getMatchById(id);
      if (!m) return;
      setMatch(m);
      const max = m.format === 'beach_2v2' ? 2 : 6;

      const [home, away, homePlrs, awayPlrs] = await Promise.all([
        getTeamById(m.teamHomeId),
        getTeamById(m.teamAwayId),
        getPlayersByTeam(m.teamHomeId),
        getPlayersByTeam(m.teamAwayId),
      ]);
      setHomeTeam(home);
      setAwayTeam(away);
      setHomeSlots(buildInitialSlots(homePlrs, max));
      setAwaySlots(buildInitialSlots(awayPlrs, max));
      setLoading(false);
    }
    load();
  }, [id]);

  function togglePresent(side: 'home' | 'away', playerId: string) {
    const setter = side === 'home' ? setHomeSlots : setAwaySlots;
    setter((prev) =>
      prev.map((s) => {
        if (s.player.id !== playerId) return s;
        const nowPresent = !s.isPresent;
        return { ...s, isPresent: nowPresent, isStarter: nowPresent ? s.isStarter : false };
      })
    );
  }

  function toggleStarter(side: 'home' | 'away', playerId: string) {
    const slots = side === 'home' ? homeSlots : awaySlots;
    const setter = side === 'home' ? setHomeSlots : setAwaySlots;
    const slot = slots.find((s) => s.player.id === playerId);
    if (!slot?.isPresent || slot.player.position === 'libero') return;

    const currentStarters = slots.filter((s) => s.isStarter && s.player.id !== playerId).length;
    if (!slot.isStarter && currentStarters >= maxStarters) {
      Alert.alert(t('common.error'), t('lineup.tooMany', { count: maxStarters }));
      return;
    }
    setter((prev) =>
      prev.map((s) => (s.player.id === playerId ? { ...s, isStarter: !s.isStarter } : s))
    );
  }

  function validate() {
    const homeStarters = homeSlots.filter((s) => s.isStarter).length;
    const awayStarters = awaySlots.filter((s) => s.isStarter).length;
    if (homeStarters < maxStarters || awayStarters < maxStarters) {
      Alert.alert(t('common.error'), t('lineup.notEnough', { count: maxStarters }));
      return;
    }
    setLineupDraft({
      home: buildSideLineup(homeSlots),
      away: buildSideLineup(awaySlots),
    });
    router.replace(`/match/${id}/referee`);
  }

  if (loading || !match) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('lineup.title')}</Text>
        <Text style={styles.headerHint}>{t('lineup.selectStarters')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <TeamSection
          team={homeTeam}
          slots={homeSlots}
          maxStarters={maxStarters}
          side="home"
          onTogglePresent={(id) => togglePresent('home', id)}
          onToggleStarter={(id) => toggleStarter('home', id)}
          t={t}
        />
        <TeamSection
          team={awayTeam}
          slots={awaySlots}
          maxStarters={maxStarters}
          side="away"
          onTogglePresent={(id) => togglePresent('away', id)}
          onToggleStarter={(id) => toggleStarter('away', id)}
          t={t}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.validateBtn, pressed && styles.validateBtnPressed]}
          onPress={validate}
          accessibilityRole="button"
        >
          <Text style={styles.validateBtnText}>{t('lineup.validate')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function TeamSection({
  team,
  slots,
  maxStarters,
  side,
  onTogglePresent,
  onToggleStarter,
  t,
}: {
  team: Team | null;
  slots: PlayerSlot[];
  maxStarters: number;
  side: 'home' | 'away';
  onTogglePresent: (id: string) => void;
  onToggleStarter: (id: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const starterCount = slots.filter((s) => s.isStarter).length;
  const teamColor = team?.color ?? (side === 'home' ? palette.teamHome : palette.teamAway);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.teamDot, { backgroundColor: teamColor }]} />
        <Text style={styles.sectionTeamName}>{team?.name ?? '—'}</Text>
        <Text style={[styles.startersCount, starterCount === maxStarters && styles.startersCountFull]}>
          {t('lineup.startersCount', { count: starterCount, max: maxStarters })}
        </Text>
      </View>

      {slots.map((slot) => (
        <PlayerRow
          key={slot.player.id}
          slot={slot}
          onTogglePresent={() => onTogglePresent(slot.player.id)}
          onToggleStarter={() => onToggleStarter(slot.player.id)}
          t={t}
        />
      ))}

      {slots.length === 0 && (
        <Text style={styles.emptyText}>{t('team.noPlayers')}</Text>
      )}
    </View>
  );
}

function PlayerRow({
  slot,
  onTogglePresent,
  onToggleStarter,
  t,
}: {
  slot: PlayerSlot;
  onTogglePresent: () => void;
  onToggleStarter: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { player, isPresent, isStarter } = slot;
  const isLibero = player.position === 'libero';
  const displayName = [player.lastName, player.firstName].filter(Boolean).join(' ') || `#${player.number}`;

  let badgeLabel: string;
  let badgeStyle: object;
  if (!isPresent) {
    badgeLabel = t('lineup.absent');
    badgeStyle = styles.badgeAbsent;
  } else if (isLibero) {
    badgeLabel = t('lineup.libero');
    badgeStyle = styles.badgeLibero;
  } else if (isStarter) {
    badgeLabel = t('lineup.starter');
    badgeStyle = styles.badgeStarter;
  } else {
    badgeLabel = t('lineup.bench');
    badgeStyle = styles.badgeBench;
  }

  return (
    <View style={[styles.playerRow, !isPresent && styles.playerRowAbsent]}>
      <Pressable
        onPress={onTogglePresent}
        style={[styles.checkbox, isPresent && styles.checkboxActive]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isPresent }}
      >
        {isPresent && <Text style={styles.checkMark}>✓</Text>}
      </Pressable>

      <View style={styles.jerseyBadge}>
        <Text style={styles.jerseyText}>{player.number}</Text>
      </View>

      <Text style={[styles.playerName, !isPresent && styles.playerNameDimmed]} numberOfLines={1}>
        {displayName}
      </Text>

      <Pressable
        onPress={onToggleStarter}
        disabled={!isPresent || isLibero}
        accessibilityRole="button"
      >
        <View style={[styles.badge, badgeStyle]}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  loadingText: { color: palette.textMuted, textAlign: 'center', marginTop: 40 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: palette.textPrimary,
    marginBottom: 4,
  },
  headerHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: palette.textMuted,
  },

  scroll: { paddingBottom: 24 },

  section: {
    marginTop: 20,
    marginHorizontal: 16,
    backgroundColor: palette.backgroundSurface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: palette.backgroundElevated,
  },
  teamDot: { width: 10, height: 10, borderRadius: 5 },
  sectionTeamName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: palette.textPrimary,
  },
  startersCount: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textMuted,
  },
  startersCountFull: { color: palette.success },

  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: palette.backgroundElevated,
  },
  playerRowAbsent: { opacity: 0.45 },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: palette.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: palette.accentPrimary,
    borderColor: palette.accentPrimary,
  },
  checkMark: { fontSize: 12, color: '#fff', fontFamily: 'Inter_700Bold' },

  jerseyBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.textPrimary },

  playerName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: palette.textPrimary,
  },
  playerNameDimmed: { color: palette.textMuted },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 58,
    alignItems: 'center',
  },
  badgeText: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  badgeStarter: { backgroundColor: 'rgba(230,57,70,0.15)', borderWidth: 1, borderColor: palette.accentPrimary },
  badgeBench: { backgroundColor: palette.backgroundElevated },
  badgeAbsent: { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.backgroundElevated },
  badgeLibero: { backgroundColor: 'rgba(29,78,216,0.15)', borderWidth: 1, borderColor: '#1D4ED8' },

  emptyText: { fontSize: 13, color: palette.textMuted, padding: 14, textAlign: 'center' },

  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: palette.backgroundElevated,
  },
  validateBtn: {
    backgroundColor: palette.accentPrimary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  validateBtnPressed: { opacity: 0.85 },
  validateBtnText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
});
