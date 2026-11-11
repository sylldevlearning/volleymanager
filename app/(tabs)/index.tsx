import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, View, Text, Pressable, StatusBar } from 'react-native';

const BALL_IMG = require('../../assets/images/ballon.png');
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Volleyball, Users, History, ChevronRight, Zap, Whistle, Trophy } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COMPANY, ADMOB_IDS } from '../../src/utils/constants';
import { TacticalBoard } from '../../src/components/tactical/TacticalBoard';
import { TacticalBoardIcon } from '../../src/components/ui/TacticalBoardIcon';
import { InfoTooltip } from '../../src/components/ui/InfoTooltip';
import { AdBanner } from '../../src/components/ads/AdBanner';
import { getInProgressAdHocMatch, updateMatchStatus } from '../../src/services/matchService';
import { createQuickMatch } from '../../src/services/quickMatchService';
import { useThemedStyles, useAppTheme, type AppTheme } from '../../src/theme/useAppTheme';

export default function HomeScreen() {
  const colors = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { t } = useTranslation();
  const [showTactical, setShowTactical] = useState(false);
  const [creatingQuickMatch, setCreatingQuickMatch] = useState(false);

  async function handleArbitragePress() {
    const inProgress = await getInProgressAdHocMatch();
    if (!inProgress) {
      router.push('/arbitrage/new');
      return;
    }
    Alert.alert(t('home.arbitrageResumeTitle'), t('home.arbitrageResumeMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('home.arbitrageResume'), onPress: () => router.push(`/match/${inProgress.id}/arbitrage`) },
      {
        text: t('home.arbitrageNewMatch'),
        style: 'destructive',
        onPress: () => {
          Alert.alert(t('home.arbitrageAbandonConfirmTitle'), t('home.arbitrageAbandonConfirmMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('home.arbitrageAbandonConfirm'),
              style: 'destructive',
              onPress: async () => {
                await updateMatchStatus(inProgress.id, 'finished');
                router.push('/arbitrage/new');
              },
            },
          ]);
        },
      },
    ]);
  }

  async function handleQuickMatch() {
    if (creatingQuickMatch) return;
    setCreatingQuickMatch(true);
    try {
      const match = await createQuickMatch();
      router.replace(`/match/${match.id}/referee`);
    } finally {
      setCreatingQuickMatch(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Image source={BALL_IMG} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{t('home.title')}</Text>
          <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
          <View style={styles.headerTooltip}>
            <InfoTooltip textKey="help.home" />
          </View>
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
            ? <ActivityIndicator color={colors.success} size="small" />
            : <Zap size={26} color={colors.success} strokeWidth={1.5} />
          }
          <View style={styles.quickMatchContent}>
            <Text style={styles.quickMatchTitle}>{t('home.quickMatch')}</Text>
            <Text style={styles.quickMatchDesc}>{t('home.quickMatchDesc')}</Text>
          </View>
          {!creatingQuickMatch && <ChevronRight size={20} color={colors.textMuted} />}
        </Pressable>

        {/* New Match CTA */}
        <Pressable
          style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
          onPress={() => router.push('/match/new')}
          accessibilityLabel={t('home.newMatch')}
          accessibilityRole="button"
        >
          <Volleyball size={26} color={colors.color} strokeWidth={1.5} />
          <View style={styles.ctaContent}>
            <Text style={styles.ctaText}>{t('home.newMatch')}</Text>
          </View>
          <ChevronRight size={20} color={colors.textMuted} />
        </Pressable>

        {/* Arbitrage CTA — standalone match, teams entered freely */}
        <Pressable
          style={({ pressed }) => [styles.arbitrageButton, pressed && styles.arbitrageButtonPressed]}
          onPress={handleArbitragePress}
          accessibilityLabel={t('home.arbitrage')}
          accessibilityRole="button"
        >
          <Whistle size={26} color={colors.accentSecondary} strokeWidth={1.5} />
          <View style={styles.arbitrageContent}>
            <Text style={styles.arbitrageTitle}>{t('home.arbitrage')}</Text>
            <Text style={styles.arbitrageDesc}>{t('home.arbitrageDesc')}</Text>
          </View>
          <ChevronRight size={20} color={colors.textMuted} />
        </Pressable>

        {/* Tournament CTA */}
        <Pressable
          style={({ pressed }) => [styles.arbitrageButton, pressed && styles.arbitrageButtonPressed]}
          onPress={() => router.push('/tournament')}
          accessibilityLabel={t('home.tournament')}
          accessibilityRole="button"
        >
          <Trophy size={26} color={colors.warning} strokeWidth={1.5} />
          <View style={styles.arbitrageContent}>
            <Text style={styles.arbitrageTitle}>{t('home.tournament')}</Text>
            <Text style={styles.arbitrageDesc}>{t('home.tournamentDesc')}</Text>
          </View>
          <ChevronRight size={20} color={colors.textMuted} />
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
          <ChevronRight size={20} color={colors.textMuted} />
        </Pressable>

        {/* Quick Links */}
        <View style={styles.quickLinks}>
          <QuickLink
            icon={<Users size={20} color={colors.textSecondary} />}
            label={t('home.myTeams')}
            onPress={() => router.push('/(tabs)/teams')}
          />
          <View style={styles.divider} />
          <QuickLink
            icon={<History size={20} color={colors.textSecondary} />}
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
      <AdBanner unitId={ADMOB_IDS.BANNER_HOME} />
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
  const colors = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={({ pressed }) => [styles.quickLink, pressed && styles.quickLinkPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {icon}
      <Text style={styles.quickLinkLabel}>{label}</Text>
      <ChevronRight size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: a.background,
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
  headerTooltip: {
    position: 'absolute',
    top: 32,
    right: 0,
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_900Black',
    color: a.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: a.textSecondary,
    marginTop: 6,
  },
  quickMatchButton: {
    backgroundColor: a.backgroundSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: a.backgroundElevated,
    marginBottom: 12,
  },
  quickMatchButtonPressed: {
    opacity: 0.8,
    backgroundColor: a.backgroundElevated,
  },
  quickMatchContent: {
    flex: 1,
  },
  quickMatchTitle: {
    color: a.textPrimary,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 3,
  },
  quickMatchDesc: {
    color: a.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  ctaButton: {
    backgroundColor: a.backgroundSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: a.backgroundElevated,
    marginBottom: 16,
  },
  ctaButtonPressed: {
    opacity: 0.8,
    backgroundColor: a.backgroundElevated,
  },
  ctaContent: {
    flex: 1,
  },
  ctaText: {
    color: a.textPrimary,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  arbitrageButton: {
    backgroundColor: a.backgroundSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: a.backgroundElevated,
    marginBottom: 16,
  },
  arbitrageButtonPressed: {
    opacity: 0.8,
    backgroundColor: a.backgroundElevated,
  },
  arbitrageContent: {
    flex: 1,
  },
  arbitrageTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: a.textPrimary,
    marginBottom: 3,
  },
  arbitrageDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: a.textSecondary,
  },
  tacticalButton: {
    backgroundColor: a.backgroundSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: a.success + '40',
    marginBottom: 16,
  },
  tacticalButtonPressed: {
    opacity: 0.8,
    backgroundColor: a.backgroundElevated,
  },
  tacticalContent: {
    flex: 1,
  },
  tacticalTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: a.textPrimary,
    marginBottom: 3,
  },
  tacticalDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: a.textSecondary,
  },
  quickLinks: {
    backgroundColor: a.backgroundSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: a.backgroundElevated,
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
    backgroundColor: a.backgroundElevated,
  },
  quickLinkLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: a.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: a.backgroundElevated,
    marginLeft: 16,
  },
  footer: {
    marginTop: 24,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: a.textMuted,
    textAlign: 'center',
  },
});
