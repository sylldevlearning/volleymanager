import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import { getPairsForMatch } from '../../services/substitutionService';
import type { SubstitutionPair } from '../../models/substitution';
import type { Player } from '../../models/player';
import type { Team } from '../../models/team';
import type { MatchSet } from '../../models/match';
import { palette } from '../../theme/tokens';

interface SubstitutionRecapSheetProps {
  visible: boolean;
  onClose: () => void;
  matchId: string;
  sets: MatchSet[];
  homeTeam: Team;
  awayTeam: Team;
  homePlayers: Player[];
  awayPlayers: Player[];
}

function numberOf(playerId: string, roster: Player[]): number | string {
  return roster.find((p) => p.id === playerId)?.number ?? '?';
}

export function SubstitutionRecapSheet({
  visible, onClose, matchId, sets, homeTeam, awayTeam, homePlayers, awayPlayers,
}: SubstitutionRecapSheetProps) {
  const { t } = useTranslation();
  const [homePairs, setHomePairs] = useState<SubstitutionPair[]>([]);
  const [awayPairs, setAwayPairs] = useState<SubstitutionPair[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getPairsForMatch(matchId, homeTeam.id),
      getPairsForMatch(matchId, awayTeam.id),
    ]).then(([home, away]) => {
      if (cancelled) return;
      setHomePairs(home.filter((p) => !p.isCancelled));
      setAwayPairs(away.filter((p) => !p.isCancelled));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [visible, matchId, homeTeam.id, awayTeam.id]);

  const sortedSets = [...sets].sort((a, b) => a.setNumber - b.setNumber);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('arbitrage.recapTitle')}</Text>
          <Pressable onPress={onClose} accessibilityRole="button">
            <X size={20} color={palette.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {loading && <Text style={styles.emptyText}>{t('common.loading')}</Text>}
          {!loading && sortedSets.length === 0 && (
            <Text style={styles.emptyText}>{t('arbitrage.recapEmpty')}</Text>
          )}
          {!loading && sortedSets.map((set) => (
            <SetRecap
              key={set.id}
              set={set}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              homePairs={homePairs.filter((p) => p.setId === set.id)}
              awayPairs={awayPairs.filter((p) => p.setId === set.id)}
              homePlayers={homePlayers}
              awayPlayers={awayPlayers}
              t={t}
            />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function SetRecap({
  set, homeTeam, awayTeam, homePairs, awayPairs, homePlayers, awayPlayers, t,
}: {
  set: MatchSet;
  homeTeam: Team;
  awayTeam: Team;
  homePairs: SubstitutionPair[];
  awayPairs: SubstitutionPair[];
  homePlayers: Player[];
  awayPlayers: Player[];
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (homePairs.length === 0 && awayPairs.length === 0) return null;
  return (
    <View style={styles.setBlock}>
      <Text style={styles.setTitle}>{t('match.set')} {set.setNumber}</Text>
      <TeamRecap team={homeTeam} pairs={homePairs} roster={homePlayers} t={t} />
      <TeamRecap team={awayTeam} pairs={awayPairs} roster={awayPlayers} t={t} />
    </View>
  );
}

function TeamRecap({
  team, pairs, roster, t,
}: {
  team: Team;
  pairs: SubstitutionPair[];
  roster: Player[];
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (pairs.length === 0) return null;
  const regular = pairs.filter((p) => !p.isLibero);
  const libero = pairs.filter((p) => p.isLibero);

  return (
    <View style={styles.teamBlock}>
      <View style={styles.teamHeader}>
        <View style={[styles.teamDot, { backgroundColor: team.color }]} />
        <Text style={styles.teamName}>{team.name}</Text>
      </View>

      {regular.map((pair) => (
        <View key={pair.id} style={styles.row}>
          <Text style={styles.rowText}>
            {pair.isExceptional ? `⚠ ` : ''}
            N°{numberOf(pair.playerOutId, roster)} → N°{numberOf(pair.playerInId, roster)}
          </Text>
        </View>
      ))}

      {libero.length > 0 && (
        <View style={styles.liberoBlock}>
          <Text style={styles.liberoLabel}>{t('arbitrageSetup.libero')}</Text>
          {libero.map((pair) => {
            const outPlayer = roster.find((p) => p.id === pair.playerOutId);
            const isEntry = outPlayer?.position !== 'libero';
            return (
              <View key={pair.id} style={styles.row}>
                <Text style={[styles.rowText, { color: palette.libero }]}>
                  {isEntry
                    ? `N°${numberOf(pair.playerInId, roster)} ${t('arbitrage.recapLiberoIn')} (N°${numberOf(pair.playerOutId, roster)})`
                    : `N°${numberOf(pair.playerOutId, roster)} ${t('arbitrage.recapLiberoOut')} (N°${numberOf(pair.playerInId, roster)})`}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: palette.backgroundSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: palette.backgroundElevated,
  },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  body: { padding: 16, gap: 16 },
  emptyText: { fontSize: 14, color: palette.textMuted, textAlign: 'center', paddingVertical: 24 },
  setBlock: {
    backgroundColor: palette.backgroundElevated,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  setTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },
  teamBlock: { gap: 4 },
  teamHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  teamDot: { width: 8, height: 8, borderRadius: 4 },
  teamName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },
  row: { paddingVertical: 2, paddingLeft: 14 },
  rowText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: palette.textPrimary },
  liberoBlock: { marginTop: 2 },
  liberoLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: palette.libero, paddingLeft: 14, textTransform: 'uppercase', letterSpacing: 0.3 },
});
