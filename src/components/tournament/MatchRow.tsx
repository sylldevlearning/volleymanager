import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatClock } from '../../i18n/format';
import { ChevronRight } from 'lucide-react-native';
import { palette } from '../../theme/tokens';
import { matchTitle, sideName } from '../../features/tournament/display';
import type { TournamentBundle } from '../../features/tournament/bundle';
import type { TournamentMatch } from '../../models/tournament';

interface Props {
  match: TournamentMatch;
  bundle: TournamentBundle;
  onPress: () => void;
  /** Planning rows already sit under their time */
  showTime?: boolean;
}

/** One tournament match: court, phase, teams, score or status. */
export function MatchRow({ match, bundle, onPress, showTime = true }: Props) {
  const { t, i18n } = useTranslation();
  const home = sideName(match, 'home', bundle, t, i18n.language);
  const away = sideName(match, 'away', bundle, t, i18n.language);
  const known = match.homeId !== null && match.awayId !== null;
  const done = match.status === 'validated';
  const setsHome = match.sets?.filter(([h, a]) => h > a).length ?? 0;
  const setsAway = (match.sets?.length ?? 0) - setsHome;

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button">
      <View style={styles.when}>
        {showTime && <Text style={styles.time}>{formatClock(match.scheduledAt?.slice(11, 16) ?? '', i18n.language)}</Text>}
        {match.court !== null && <Text style={styles.court}>{t('tournament.view.court', { n: match.court })}</Text>}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{matchTitle(match, bundle, t)}</Text>
        <Text style={[styles.team, done && match.winnerId === match.homeId && styles.winner, !match.homeId && styles.unknown]} numberOfLines={1}>{home}</Text>
        <Text style={[styles.team, done && match.winnerId === match.awayId && styles.winner, !match.awayId && styles.unknown]} numberOfLines={1}>{away}</Text>
      </View>
      {done ? (
        <View style={styles.score}>
          <Text style={[styles.scoreText, match.winnerId === match.homeId && styles.winner]}>{setsHome}</Text>
          <Text style={[styles.scoreText, match.winnerId === match.awayId && styles.winner]}>{setsAway}</Text>
        </View>
      ) : (
        <Text style={[styles.status, match.status === 'live' && styles.statusLive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {match.status === 'live' ? t('tournament.view.statusLive') : known ? t('tournament.view.statusScheduled') : t('tournament.view.waiting')}
        </Text>
      )}
      <ChevronRight size={16} color={palette.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: palette.backgroundSurface, borderRadius: 12, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  pressed: { opacity: 0.8 },
  when: { width: 44, alignItems: 'center', gap: 2 },
  time: { fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  court: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 12, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  team: { fontSize: 15, fontFamily: 'Inter_500Medium', color: palette.textPrimary },
  unknown: { color: palette.textSecondary, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  winner: { fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  score: { alignItems: 'center', gap: 2, minWidth: 20 },
  scoreText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  status: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },
  statusLive: { color: palette.success },
});
