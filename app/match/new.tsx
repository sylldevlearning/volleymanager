import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllTeams } from '../../src/services/teamService';
import { createMatch } from '../../src/services/matchService';
import type { Team } from '../../src/models/team';
import type { MatchFormat, MatchMode, MatchConfig } from '../../src/models/match';
import {
  DEFAULT_INDOOR_CONFIG,
  DEFAULT_BEACH_CONFIG,
  DEFAULT_LEISURE_CONFIG,
} from '../../src/models/match';
import { palette } from '../../src/theme/tokens';

type FormatOption = { id: MatchFormat; label: string };
type ModeOption = { id: MatchMode; label: string };

const FORMATS: FormatOption[] = [
  { id: 'indoor_6v6', label: 'match.indoor6v6' },
  { id: 'beach_2v2', label: 'match.beach2v2' },
];

const MODES: ModeOption[] = [
  { id: 'competition', label: 'match.competition' },
  { id: 'leisure', label: 'match.leisure' },
];

function getDefaultConfig(format: MatchFormat, mode: MatchMode): MatchConfig {
  if (mode === 'leisure') return DEFAULT_LEISURE_CONFIG;
  if (format === 'beach_2v2') return DEFAULT_BEACH_CONFIG;
  return DEFAULT_INDOOR_CONFIG;
}

export default function NewMatchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [format, setFormat] = useState<MatchFormat>('indoor_6v6');
  const [mode, setMode] = useState<MatchMode>('competition');
  const [teamHomeId, setTeamHomeId] = useState<string>('');
  const [teamAwayId, setTeamAwayId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAllTeams().then(setTeams);
  }, []);

  const handleStart = async () => {
    if (!teamHomeId || !teamAwayId) {
      Alert.alert(t('common.error'), t('match.selectTeam'));
      return;
    }
    if (teamHomeId === teamAwayId) {
      Alert.alert(t('common.error'), t('match.differentTeams'));
      return;
    }
    setLoading(true);
    try {
      const config = getDefaultConfig(format, mode);
      const match = await createMatch({ format, mode, teamHomeId, teamAwayId, config });
      router.replace(`/match/${match.id}/referee`);
    } catch (e) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Format */}
        <Section title={t('match.format')}>
          <SegmentControl
            options={FORMATS}
            selected={format}
            onSelect={(v) => setFormat(v as MatchFormat)}
          />
        </Section>

        {/* Mode */}
        <Section title={t('match.mode')}>
          <SegmentControl
            options={MODES}
            selected={mode}
            onSelect={(v) => setMode(v as MatchMode)}
          />
        </Section>

        {/* Teams */}
        <Section title={t('match.teamHome')}>
          <TeamPicker
            teams={teams}
            selected={teamHomeId}
            onSelect={setTeamHomeId}
            placeholder={t('match.selectTeam')}
          />
        </Section>

        <Section title={t('match.teamAway')}>
          <TeamPicker
            teams={teams}
            selected={teamAwayId}
            onSelect={setTeamAwayId}
            placeholder={t('match.selectTeam')}
          />
        </Section>

        {/* Config preview */}
        <ConfigPreview format={format} mode={mode} />

        <Pressable
          style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed, loading && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={loading}
          accessibilityLabel={t('match.start')}
          accessibilityRole="button"
        >
          <Text style={styles.startButtonText}>
            {loading ? t('common.loading') : t('match.start')}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SegmentControl({
  options,
  selected,
  onSelect,
}: {
  options: Array<{ id: string; label: string }>;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.segmentRow}>
      {options.map((opt) => (
        <Pressable
          key={opt.id}
          style={[styles.segment, selected === opt.id && styles.segmentActive]}
          onPress={() => onSelect(opt.id)}
          accessibilityRole="radio"
          accessibilityState={{ selected: selected === opt.id }}
        >
          <Text style={[styles.segmentText, selected === opt.id && styles.segmentTextActive]}>
            {t(opt.label)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function TeamPicker({
  teams,
  selected,
  onSelect,
  placeholder,
}: {
  teams: Team[];
  selected: string;
  onSelect: (id: string) => void;
  placeholder: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.teamPicker}>
      {teams.length === 0 ? (
        <Text style={styles.noTeamText}>{t('match.noTeamsHint')}</Text>
      ) : (
        teams.map((team) => (
          <Pressable
            key={team.id}
            style={[styles.teamOption, selected === team.id && styles.teamOptionActive]}
            onPress={() => onSelect(team.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === team.id }}
            accessibilityLabel={team.name}
          >
            <View style={[styles.teamDot, { backgroundColor: team.color }]} />
            <Text style={[styles.teamOptionText, selected === team.id && styles.teamOptionTextActive]}>
              {team.name}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

function ConfigPreview({ format, mode }: { format: MatchFormat; mode: MatchMode }) {
  const { t } = useTranslation();
  const config = getDefaultConfig(format, mode);
  return (
    <View style={styles.configPreview}>
      <Text style={styles.configTitle}>Configuration</Text>
      <View style={styles.configRows}>
        <ConfigRow label={t('match.config.setsToWin')} value={String(config.setsToWin)} />
        <ConfigRow label={t('match.config.pointsPerSet')} value={String(config.pointsPerSet)} />
        <ConfigRow label={t('match.config.pointsLastSet')} value={String(config.pointsLastSet)} />
        <ConfigRow
          label={t('match.config.timeoutsPerSet')}
          value={config.unlimitedTimeouts ? '∞' : String(config.timeoutsPerSet ?? 0)}
        />
        <ConfigRow
          label={t('match.config.substitutionsPerSet')}
          value={config.unlimitedSubstitutions ? '∞' : String(config.substitutionsPerSet ?? 0)}
        />
      </View>
    </View>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.configRow}>
      <Text style={styles.configLabel}>{label}</Text>
      <Text style={styles.configValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 20, gap: 0, paddingBottom: 40 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: palette.backgroundSurface,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: palette.accentPrimary },
  segmentText: { fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  segmentTextActive: { color: '#fff', fontFamily: 'Inter_700Bold' },
  teamPicker: { gap: 8 },
  teamOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.backgroundSurface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  teamOptionActive: { borderColor: palette.accentPrimary, backgroundColor: palette.accentPrimaryMuted },
  teamDot: { width: 12, height: 12, borderRadius: 6 },
  teamOptionText: { fontSize: 15, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  teamOptionTextActive: { color: palette.textPrimary, fontFamily: 'Inter_600SemiBold' },
  noTeamText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textMuted, padding: 12 },
  configPreview: {
    backgroundColor: palette.backgroundSurface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
  },
  configTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textSecondary,
    marginBottom: 10,
  },
  configRows: { gap: 6 },
  configRow: { flexDirection: 'row', justifyContent: 'space-between' },
  configLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', color: palette.textSecondary },
  configValue: { fontSize: 13, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  startButton: {
    backgroundColor: palette.accentPrimary,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  startButtonPressed: { opacity: 0.85 },
  startButtonDisabled: { opacity: 0.5 },
  startButtonText: { fontSize: 17, fontFamily: 'Inter_700Bold', color: '#fff' },
});
