import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { palette } from '../../theme/tokens';
import type { StandingsTable } from '../../features/tournament/display';

/** A pool / league table: place, team, played, won, lost, points, set and point differences. */
/** `finished`: teams that have finished their tournament, marked "Terminé" */
export function StandingsTableView({ table, finished }: { table: StandingsTable; finished?: Set<string> }) {
  const { t } = useTranslation();
  const diff = (n: number) => (n > 0 ? `+${n}` : String(n));
  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {table.title}
        {!table.complete && <Text style={styles.progress}> · {t('tournament.view.tableInProgress')}</Text>}
      </Text>
      <View style={[styles.row, styles.head]}>
        <Text style={[styles.cell, styles.rank]}>#</Text>
        <Text style={[styles.cell, styles.team, styles.headText]}>{t('tournament.view.colTeam')}</Text>
        <Text style={[styles.cell, styles.num, styles.headText]}>{t('tournament.view.colPlayed')}</Text>
        <Text style={[styles.cell, styles.num, styles.headText]}>{t('tournament.view.colWon')}</Text>
        <Text style={[styles.cell, styles.num, styles.headText]}>{t('tournament.view.colLost')}</Text>
        <Text style={[styles.cell, styles.num, styles.headText]}>{t('tournament.view.colPoints')}</Text>
        <Text style={[styles.cell, styles.wide, styles.headText]}>{t('tournament.view.colSets')}</Text>
        <Text style={[styles.cell, styles.wide, styles.headText]}>{t('tournament.view.colDiff')}</Text>
      </View>
      {table.rows.map((r) => (
        <View key={r.teamId} style={styles.row}>
          <Text style={[styles.cell, styles.rank]}>{r.rank}</Text>
          <View style={[styles.team, styles.teamCell]}>
            <Text style={styles.teamName} numberOfLines={1}>{r.name}</Text>
            {finished?.has(r.teamId) && <Text style={styles.badge}>{t('tournament.finished.badge')}</Text>}
          </View>
          <Text style={[styles.cell, styles.num]}>{r.played}</Text>
          <Text style={[styles.cell, styles.num]}>{r.won}</Text>
          <Text style={[styles.cell, styles.num]}>{r.lost}</Text>
          <Text style={[styles.cell, styles.num, styles.points]}>{r.points}</Text>
          <Text style={[styles.cell, styles.wide]}>{diff(r.setsWon - r.setsLost)}</Text>
          <Text style={[styles.cell, styles.wide]}>{diff(r.pointsWon - r.pointsLost)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.backgroundSurface, borderRadius: 14, borderWidth: 1,
    borderColor: palette.backgroundElevated, padding: 12, gap: 2,
  },
  title: { fontSize: 14, fontFamily: 'Inter_700Bold', color: palette.textPrimary, marginBottom: 6 },
  progress: { fontSize: 13, fontFamily: 'Inter_400Regular', color: palette.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: palette.backgroundElevated },
  head: { borderTopWidth: 0 },
  headText: { color: palette.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  cell: { fontSize: 13, fontFamily: 'Inter_500Medium', color: palette.textPrimary, textAlign: 'center' },
  rank: { width: 22, color: palette.textSecondary },
  team: { flex: 1, textAlign: 'left', paddingHorizontal: 4 },
  teamCell: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamName: { flexShrink: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: palette.textPrimary },
  badge: {
    fontSize: 10, fontFamily: 'Inter_600SemiBold', color: palette.success, overflow: 'hidden',
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, backgroundColor: 'rgba(46, 160, 67, 0.15)',
  },
  num: { width: 26 },
  wide: { width: 40 },
  points: { fontFamily: 'Inter_700Bold' },
});
