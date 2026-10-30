import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarClock, ChevronRight, Ellipsis, Pencil, ScanQrCode, Shuffle, Trash2 } from 'lucide-react-native';
import { palette } from '../../../src/theme/tokens';
import { InfoTooltip } from '../../../src/components/ui/InfoTooltip';
import { CoachMarks } from '../../../src/components/ui/CoachMarks';
import { MatchRow } from '../../../src/components/tournament/MatchRow';
import { StandingsTableView } from '../../../src/components/tournament/StandingsTableView';
import { Chip } from '../../../src/components/tournament/WizardSteps';
import { deleteTournament, getTournamentBundle, type TournamentBundle } from '../../../src/services/tournamentService';
import { fillRandomResults } from '../../../src/features/tournament/devRandomScores';
import {
  bracketRounds,
  matchGroups,
  rankingRows,
  slotGroups,
  standingsTables,
} from '../../../src/features/tournament/display';
import { finishedTeamIds, phaseStatuses, type PhaseInfo, type PhaseStatus } from '../../../src/features/tournament/phases';

type Tab = 'planning' | 'matches' | 'standings';
type StatusFilter = 'all' | 'toPlay' | 'done';

/** The "?" explains the tab on screen */
const TAB_HELP: Record<Tab, string> = {
  planning: 'help.tournamentPlanning',
  matches: 'help.tournamentMatches',
  standings: 'help.tournamentStandings',
};

export default function TournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const [bundle, setBundle] = useState<TournamentBundle | null>(null);
  const [tab, setTab] = useState<Tab>('planning');
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [phase, setPhase] = useState<string | null>(null);
  const [team, setTeam] = useState<string | null>(null);
  // First-use bubbles
  const tabsRef = useRef<View>(null);
  const phasesRef = useRef<View>(null);
  const contentRef = useRef<View>(null);
  const menuRef = useRef<View>(null);

  // Reloads after a score, a renaming or a new planning
  useFocusEffect(useCallback(() => {
    let active = true;
    getTournamentBundle(id).then((b) => { if (active) setBundle(b); });
    return () => { active = false; };
  }, [id]));

  const groups = useMemo(() => (bundle ? matchGroups(bundle, t) : []), [bundle, t]);
  const phases = useMemo(() => (bundle ? phaseStatuses(bundle, t) : []), [bundle, t]);
  const filtered = useMemo(() => {
    if (!bundle) return [];
    const inPhase = phase ? new Set(groups.find((g) => g.key === phase)?.matchIds ?? []) : null;
    return [...bundle.matches]
      .filter((m) => !inPhase || inPhase.has(m.id))
      .filter((m) => !team || m.homeId === team || m.awayId === team)
      .filter((m) => status === 'all' || (status === 'done') === (m.status === 'validated'))
      .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0) || (a.court ?? 0) - (b.court ?? 0));
  }, [bundle, groups, phase, team, status]);

  if (!bundle) return <SafeAreaView style={styles.container} edges={['bottom']} />;

  const done = bundle.matches.filter((m) => m.status === 'validated').length;
  const openMatch = (matchId: string) => router.push(`/tournament/${id}/match/${matchId}`);

  function confirmDelete() {
    setMenuOpen(false);
    Alert.alert(t('tournament.view.deleteTitle', { name: bundle!.tournament.name }), t('tournament.view.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteTournament(id);
          router.back();
        },
      },
    ]);
  }

  const sections = slotGroups(bundle.matches).map((g) => ({ title: g.time, data: g.matches }));
  const statusText = (status: PhaseStatus) => t(STATUS_KEYS[status]);
  // A filter chip and its phase: pools share the status of the pool phase
  const phaseOfGroup = (key: string) => phases.find((ph) => ph.key === (key.startsWith('pool:') ? 'pools' : key));
  function openPhase(phase: PhaseInfo) {
    if (phase.screen?.kind === 'round') router.push(`/tournament/${id}/round/${phase.screen.round}`);
    else if (phase.screen?.kind === 'levels') router.push(`/tournament/${id}/levels`);
    else {
      setTab('matches');
      setPhase(groups.some((g) => g.key === phase.key) ? phase.key : null);
    }
  }
  const ranking = rankingRows(bundle);
  // Nothing left to play: marked "Terminé" (follows the corrections)
  const finished = finishedTeamIds(bundle);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: bundle?.tournament.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              <InfoTooltip textKey={TAB_HELP[tab]} />
              <Pressable ref={menuRef} onPress={() => setMenuOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('tournament.view.menu')}>
                <Ellipsis size={22} color={palette.textPrimary} />
              </Pressable>
            </View>
          ),
        }}
      />

      <Text style={styles.progress}>
        {bundle.tournament.status === 'finished' ? t('tournament.view.finished') : t('tournament.view.progress', { done, total: bundle.matches.length })}
      </Text>

      {phases.length > 1 && (
        <View ref={phasesRef} collapsable={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.phaseStrip} contentContainerStyle={styles.phaseStripContent}>
          {phases.map((ph) => (
            <Pressable key={ph.key} style={[styles.phaseChip, ph.status === 'live' && styles.phaseChipLive]} onPress={() => openPhase(ph)}
              accessibilityRole="button" accessibilityLabel={`${ph.label} · ${statusText(ph.status)}`}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[ph.status] }]} />
              <View>
                <Text style={styles.phaseLabel}>{ph.label}</Text>
                <Text style={[styles.phaseStatus, { color: STATUS_COLORS[ph.status] }]}>{statusText(ph.status)}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
        </View>
      )}

      <View ref={tabsRef} style={styles.tabBar}>
        {(['planning', 'matches', 'standings'] as Tab[]).map((key) => (
          <Pressable key={key} style={[styles.tab, tab === key && styles.tabActive]} onPress={() => setTab(key)}
            accessibilityRole="tab" accessibilityState={{ selected: tab === key }}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {key === 'planning' ? t('tournament.view.tabPlanning') : key === 'matches' ? t('tournament.view.tabMatches') : t('tournament.view.tabStandings')}
            </Text>
          </Pressable>
        ))}
      </View>

      <View ref={contentRef} style={styles.content} collapsable={false}>
      {tab === 'planning' && (
        <SectionList
          sections={sections}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <MatchRow match={item} bundle={bundle} showTime={false} onPress={() => openMatch(item.id)} />
            </View>
          )}
        />
      )}

      {tab === 'matches' && (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={(
            <View style={styles.filters}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Chip label={t('tournament.view.filterAll')} active={status === 'all'} onPress={() => setStatus('all')} />
                <Chip label={t('tournament.view.filterToPlay')} active={status === 'toPlay'} onPress={() => setStatus('toPlay')} />
                <Chip label={t('tournament.view.filterDone')} active={status === 'done'} onPress={() => setStatus('done')} />
              </ScrollView>
              {groups.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <Chip label={t('tournament.view.allPhases')} active={phase === null} onPress={() => setPhase(null)} />
                  {groups.map((g) => {
                    const ph = phaseOfGroup(g.key);
                    return <Chip key={g.key} label={ph ? `${g.label} · ${statusText(ph.status)}` : g.label} active={phase === g.key} onPress={() => setPhase(g.key)} />;
                  })}
                </ScrollView>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Chip label={t('tournament.view.allTeams')} active={team === null} onPress={() => setTeam(null)} />
                {bundle.teams.map((x) => <Chip key={x.id} label={x.name} active={team === x.id} onPress={() => setTeam(x.id)} />)}
              </ScrollView>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>{t('tournament.view.noMatch')}</Text>}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <MatchRow match={item} bundle={bundle} onPress={() => openMatch(item.id)} />
            </View>
          )}
        />
      )}

      {tab === 'standings' && (
        <ScrollView contentContainerStyle={[styles.list, styles.standings]}>
          {phases.length > 1 && (
            <View style={styles.phaseCard}>
              <Text style={styles.rankingTitle}>{t('tournament.view.phases')}</Text>
              {phases.map((ph) => (
                <Pressable key={ph.key} style={styles.phaseRow} onPress={() => openPhase(ph)} accessibilityRole="button">
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[ph.status] }]} />
                  <Text style={styles.phaseRowLabel}>
                    {ph.screen?.kind === 'round' && ph.status === 'done' ? t('tournament.round.titleDone', { n: ph.screen.round }) : ph.label}
                  </Text>
                  <Text style={[styles.phaseStatus, { color: STATUS_COLORS[ph.status] }]}>
                    {statusText(ph.status)} · {ph.done}/{ph.total}
                  </Text>
                  {ph.screen && <ChevronRight size={16} color={palette.textMuted} />}
                </Pressable>
              ))}
              {phases.some((ph) => ph.screen?.kind === 'levels') && (
                <Pressable style={styles.phaseRow} onPress={() => router.push(`/tournament/${id}/levels`)} accessibilityRole="button">
                  <View style={[styles.statusDot, { backgroundColor: '#D4AF37' }]} />
                  <Text style={styles.phaseRowLabel}>{t('tournament.levels.title')}</Text>
                  <ChevronRight size={16} color={palette.textMuted} />
                </Pressable>
              )}
            </View>
          )}
          {ranking.length > 0 && (
            <View style={styles.rankingCard}>
              <Text style={styles.rankingTitle}>{t('tournament.view.finalRanking')}</Text>
              {ranking.map((r) => (
                <View key={r.teamId} style={styles.rankingRow}>
                  <Text style={styles.rankingRank}>{r.rank}</Text>
                  <Text style={styles.rankingName} numberOfLines={1}>{r.name}</Text>
                  {finished.has(r.teamId) && <Text style={styles.finishedBadge}>{t('tournament.finished.badge')}</Text>}
                </View>
              ))}
            </View>
          )}
          {standingsTables(bundle, t).map((table) => <StandingsTableView key={table.title} table={table} finished={finished} />)}
          {bracketRounds(bundle, t).map((round) => (
            <View key={round.title} style={styles.bracketRound}>
              <Text style={styles.sectionTitle}>{round.title}</Text>
              {round.matches.map((m) => (
                <View key={m.id} style={styles.item}>
                  <MatchRow match={m} bundle={bundle} onPress={() => openMatch(m.id)} />
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('tournament.view.menu')}</Text>
            <MenuItem icon={<ScanQrCode size={20} color={palette.textPrimary} />} label={t('tournament.view.menuScanResult')}
              onPress={() => { setMenuOpen(false); router.push(`/tournament/${id}/scan-result`); }} />
            <MenuItem icon={<Pencil size={20} color={palette.textPrimary} />} label={t('tournament.view.menuTeams')}
              onPress={() => { setMenuOpen(false); router.push(`/tournament/${id}/teams`); }} />
            <MenuItem icon={<CalendarClock size={20} color={palette.textPrimary} />} label={t('tournament.view.menuSchedule')}
              onPress={() => { setMenuOpen(false); router.push(`/tournament/${id}/schedule`); }} />
            {__DEV__ && (
              <MenuItem
                icon={<Shuffle size={20} color={palette.warning} />}
                label={t('tournament.view.menuDevFill')}
                onPress={async () => {
                  setMenuOpen(false);
                  const filled = await fillRandomResults(id);
                  setBundle(await getTournamentBundle(id));
                  Alert.alert(t('tournament.view.devFilled', { count: filled }));
                }}
              />
            )}
            <MenuItem icon={<Trash2 size={20} color={palette.error} />} label={t('tournament.view.menuDelete')} danger onPress={confirmDelete} />
          </View>
        </Pressable>
      </Modal>

      <CoachMarks
        tipId="tournament"
        enabled={!menuOpen}
        steps={[
          { id: 'tabs', target: tabsRef },
          { id: 'phases', target: phasesRef },
          { id: 'matches', target: contentRef },
          { id: 'menu', target: menuRef },
        ]}
      />
    </SafeAreaView>
  );
}

const STATUS_KEYS: Record<PhaseStatus, string> = {
  done: 'tournament.view.statusDone',
  live: 'tournament.view.statusLive',
  upcoming: 'tournament.view.statusUpcoming',
};
const STATUS_COLORS: Record<PhaseStatus, string> = { done: palette.success, live: palette.info, upcoming: palette.textMuted };

function MenuItem({ icon, label, onPress, danger }: { icon: ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={onPress} accessibilityRole="button">
      {icon}
      <Text style={[styles.menuText, danger && styles.menuDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  content: { flex: 1 },
  finishedBadge: {
    fontSize: 11, fontFamily: 'Inter_600SemiBold', color: palette.success, overflow: 'hidden',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(46, 160, 67, 0.15)',
  },
  progress: { fontSize: 13, fontFamily: 'Inter_500Medium', color: palette.textSecondary, paddingHorizontal: 16, paddingBottom: 8 },
  phaseStrip: { flexGrow: 0, marginBottom: 8 },
  phaseStripContent: { paddingHorizontal: 16, gap: 8 },
  phaseChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  phaseChipLive: { borderColor: palette.info },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  phaseLabel: { fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  phaseStatus: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  phaseCard: {
    backgroundColor: palette.backgroundSurface, borderRadius: 14, borderWidth: 1,
    borderColor: palette.backgroundElevated, padding: 12, gap: 2,
  },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: palette.backgroundElevated },
  phaseRowLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: palette.textPrimary },
  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, padding: 4, gap: 4,
    backgroundColor: palette.backgroundSurface, borderRadius: 12,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: palette.backgroundElevated },
  tabText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  tabTextActive: { fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: palette.textPrimary, marginTop: 14, marginBottom: 6 },
  item: { marginBottom: 8 },
  filters: { gap: 8, marginBottom: 10 },
  chipRow: { gap: 8 },
  empty: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textSecondary, textAlign: 'center', paddingVertical: 32 },
  standings: { gap: 12 },
  rankingCard: {
    backgroundColor: palette.backgroundSurface, borderRadius: 14, borderWidth: 1,
    borderColor: palette.warning, padding: 12, gap: 4,
  },
  rankingTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: palette.warning, marginBottom: 4 },
  rankingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  rankingRank: { width: 26, fontSize: 15, fontFamily: 'Inter_700Bold', color: palette.textPrimary, textAlign: 'center' },
  rankingName: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium', color: palette.textPrimary },
  bracketRound: {},
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.backgroundSurface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, paddingBottom: 32, gap: 4,
  },
  sheetTitle: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary, marginBottom: 8, textTransform: 'uppercase' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 10 },
  menuItemPressed: { backgroundColor: palette.backgroundElevated },
  menuText: { fontSize: 16, fontFamily: 'Inter_500Medium', color: palette.textPrimary },
  menuDanger: { color: palette.error },
});
