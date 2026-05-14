import { ActivityIndicator, Image, ScrollView, StyleSheet, View, Text, Pressable, StatusBar } from 'react-native';

const BALL_IMG = require('../../assets/images/ballon.png');
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Volleyball, Users, History, ChevronRight, Zap } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette } from '../../src/theme/tokens';
import { COMPANY } from '../../src/utils/constants';
import { TacticalBoard } from '../../src/components/tactical/TacticalBoard';
import { TacticalBoardIcon } from '../../src/components/ui/TacticalBoardIcon';
import { createTeam } from '../../src/services/teamService';
import { createMatch } from '../../src/services/matchService';
import { DEFAULT_INDOOR_CONFIG } from '../../src/models/match';

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [showTactical, setShowTactical] = useState(false);
  const [creatingQuickMatch, setCreatingQuickMatch] = useState(false);

  async function handleQuickMatch() {
    if (creatingQuickMatch) return;
    setCreatingQuickMatch(true);
    try {
      const [home, away] = await Promise.all([
        createTeam({ name: 'France', shortName: 'FRA', logoUri: null, color: '#1D4ED8' }),
        createTeam({ name: 'Brésil', shortName: 'BRA', logoUri: null, color: '#F59E0B' }),
      ]);
      const match = await createMatch({
        format: 'indoor_6v6',
        mode: 'leisure',
        teamHomeId: home.id,
        teamAwayId: away.id,
        config: DEFAULT_INDOOR_CONFIG,
      });
      router.replace(`/match/${match.id}/referee`);
    } finally {
      setCreatingQuickMatch(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Image source={BALL_IMG} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{t('home.title')}</Text>
          <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
        </View>

        {/* Quick Match CTA */}
        <Pressable
          style={({ pressed }) => [styles.quickMatchButton, pressed && styles.quickMatchButtonPressed]}
          onPress={handleQuickMatch}
          disabled={creatingQuickMatch}
          accessibilityLabel={t('home.quickMatch')}
          accessibilityRole="button"
        >
          {creatingQuickMatch
            ? <ActivityIndicator color="#fff" size="small" />
            : <Zap size={28} color="#fff" strokeWidth={2} />
          }
          <View style={styles.quickMatchContent}>
            <Text style={styles.quickMatchTitle}>{t('home.quickMatch')}</Text>
            <Text style={styles.quickMatchDesc}>{t('home.quickMatchDesc')}</Text>
          </View>
          {!creatingQuickMatch && <ChevronRight size={20} color="rgba(255,255,255,0.7)" />}
        </Pressable>

        {/* New Match CTA */}
        <Pressable
          style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
          onPress={() => router.push('/match/new')}
          accessibilityLabel={t('home.newMatch')}
          accessibilityRole="button"
        >
          <Volleyball size={28} color="#fff" strokeWidth={1.5} />
          <Text style={styles.ctaText}>{t('home.newMatch')}</Text>
          <ChevronRight size={20} color="rgba(255,255,255,0.7)" />
        </Pressable>

        {/* Tactical Board CTA */}
        <Pressable
          style={({ pressed }) => [styles.tacticalButton, pressed && styles.tacticalButtonPressed]}
          onPress={() => setShowTactical(true)}
          accessibilityLabel={t('tactical.title')}
          accessibilityRole="button"
        >
          <TacticalBoardIcon size={28} />
          <View style={styles.tacticalContent}>
            <Text style={styles.tacticalTitle}>{t('tactical.title')}</Text>
            <Text style={styles.tacticalDesc}>{t('home.tacticalDesc')}</Text>
          </View>
          <ChevronRight size={20} color={palette.textMuted} />
        </Pressable>

        {/* Quick Links */}
        <View style={styles.quickLinks}>
          <QuickLink
            icon={<Users size={20} color={palette.textSecondary} />}
            label={t('home.myTeams')}
            onPress={() => router.push('/(tabs)/teams')}
          />
          <View style={styles.divider} />
          <QuickLink
            icon={<History size={20} color={palette.textSecondary} />}
            label={t('home.history')}
            onPress={() => router.push('/(tabs)/matches')}
          />
        </View>

        {/* Footer */}
        <Text style={styles.footer}>{t('about.developedBy')} {COMPANY}</Text>
      </ScrollView>

      <TacticalBoard
        visible={showTactical}
        onClose={() => setShowTactical(false)}
      />
    </SafeAreaView>
  );
}

function QuickLink({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.quickLink, pressed && styles.quickLinkPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {icon}
      <Text style={styles.quickLinkLabel}>{label}</Text>
      <ChevronRight size={16} color={palette.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 32,
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_900Black',
    color: palette.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: palette.textSecondary,
    marginTop: 6,
  },
  quickMatchButton: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 12,
  },
  quickMatchButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  quickMatchContent: {
    flex: 1,
  },
  quickMatchTitle: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
  quickMatchDesc: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  ctaButton: {
    backgroundColor: palette.accentPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 24,
  },
  ctaButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    flex: 1,
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
  tacticalButton: {
    backgroundColor: palette.backgroundSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A3F2A',
    marginBottom: 16,
  },
  tacticalButtonPressed: {
    opacity: 0.8,
    backgroundColor: palette.backgroundElevated,
  },
  tacticalContent: {
    flex: 1,
  },
  tacticalTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textPrimary,
    marginBottom: 3,
  },
  tacticalDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: palette.textSecondary,
  },
  quickLinks: {
    backgroundColor: palette.backgroundSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    overflow: 'hidden',
  },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  quickLinkPressed: {
    backgroundColor: palette.backgroundElevated,
  },
  quickLinkLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: palette.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: palette.backgroundElevated,
    marginLeft: 16,
  },
  footer: {
    marginTop: 24,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: palette.textMuted,
    textAlign: 'center',
  },
});
