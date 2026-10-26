import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import type { ApplyPlan, BoardCheckResult, TeamLineupPlan } from '../../features/tactical/applyToMatch';
import type { Player } from '../../models/player';
import { palette } from '../../theme/tokens';

type ShownPlan = Exclude<ApplyPlan, { kind: 'none' }>;

interface ApplyToMatchSheetProps {
  plan: ShownPlan | null;
  homeTeamName: string;
  awayTeamName: string;
  homePlayers: Player[];
  awayPlayers: Player[];
  applying: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

/** Recap before the board is written to the match: substitutions (during a set) or starting lineup (between sets). */
export function ApplyToMatchSheet({
  plan, homeTeamName, awayTeamName, homePlayers, awayPlayers, applying, onCancel, onConfirm,
}: ApplyToMatchSheetProps) {
  const { t } = useTranslation();
  const canConfirm = plan?.ok === true && !applying;

  return (
    <Modal visible={plan !== null} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('tactical.apply.title')}</Text>
          <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel={t('common.cancel')}>
            <X size={20} color={palette.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {plan?.kind === 'substitutions' && (
            <>
              <TeamSubstitutions name={homeTeamName} result={plan.home} />
              <TeamSubstitutions name={awayTeamName} result={plan.away} />
            </>
          )}
          {plan?.kind === 'lineup' && (
            <>
              <Text style={styles.sectionTitle}>{t('tactical.apply.lineupTitle')}</Text>
              <TeamLineup name={homeTeamName} plan={plan.home} players={homePlayers} />
              <TeamLineup name={awayTeamName} plan={plan.away} players={awayPlayers} />
            </>
          )}
          {plan && !plan.ok && <Text style={styles.refused}>{t('tactical.apply.refusedHint')}</Text>}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onCancel} accessibilityRole="button">
            <Text style={styles.btnSecondaryText}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnPrimary, !canConfirm && styles.btnDisabled]}
            onPress={onConfirm}
            disabled={!canConfirm}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canConfirm }}
          >
            <Text style={styles.btnPrimaryText}>{t('tactical.apply.confirm')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function TeamSubstitutions({ name, result }: { name: string; result: BoardCheckResult }) {
  const { t } = useTranslation();
  if (result.items.length === 0) return null;
  return (
    <View style={styles.teamBlock}>
      <Text style={styles.teamName}>{name}</Text>
      {result.items.map((item) => (
        <View key={`${item.playerOutId}-${item.playerInId}`} style={styles.row}>
          <Text style={[styles.rowText, item.isLibero && styles.liberoText]}>
            {t('tactical.apply.subLine', { in: item.inNumber, out: item.outNumber })}
            {item.isLibero ? ` (${t('tactical.apply.liberoTag')})` : ''}
          </Text>
          {item.error && <Text style={styles.error}>{item.error}</Text>}
        </View>
      ))}
    </View>
  );
}

function TeamLineup({ name, plan, players }: { name: string; plan: TeamLineupPlan; players: Player[] }) {
  const { t } = useTranslation();
  if (plan.status === 'unchanged') return null;
  return (
    <View style={styles.teamBlock}>
      <Text style={styles.teamName}>{name}</Text>
      {plan.status === 'changed' ? (
        <View style={styles.zones}>
          {[1, 2, 3, 4, 5, 6].map((zone) => (
            <Text key={zone} style={styles.zoneText}>
              {t('tactical.apply.zone', {
                zone: ROMAN[zone],
                number: players.find((p) => p.id === plan.court[zone])?.number ?? '?',
              })}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.error}>
          {t(`tactical.apply.lineupErrors.${plan.error.code}`, 'params' in plan.error ? plan.error.params : {})}
        </Text>
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
  body: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },
  teamBlock: { backgroundColor: palette.backgroundElevated, borderRadius: 14, padding: 14, gap: 6 },
  teamName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },
  row: { gap: 2 },
  rowText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary },
  liberoText: { color: palette.libero },
  error: { fontSize: 13, fontFamily: 'Inter_500Medium', color: palette.error },
  zones: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  zoneText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.textPrimary, minWidth: 64 },
  refused: { fontSize: 13, fontFamily: 'Inter_500Medium', color: palette.textMuted, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  btn: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnSecondary: { backgroundColor: palette.backgroundElevated },
  btnSecondaryText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary },
  btnPrimary: { backgroundColor: palette.accentPrimary },
  btnPrimaryText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#FFFFFF' },
  btnDisabled: { opacity: 0.4 },
});
