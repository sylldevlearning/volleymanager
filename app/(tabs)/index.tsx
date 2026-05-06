import { ScrollView, StyleSheet, View, Text, Pressable, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Volleyball, Users, History, ChevronRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette } from '../../src/theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🏐</Text>
          <Text style={styles.title}>{t('home.title')}</Text>
          <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
        </View>

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

        {/* Mode Cards */}
        <View style={styles.section}>
          <ModeCard
            icon={<Volleyball size={24} color={palette.accentPrimary} />}
            title={t('home.modeReferee')}
            desc={t('home.modeRefereeDesc')}
            color={palette.accentPrimary}
            onPress={() => router.push('/match/new')}
          />
          <ModeCard
            icon={<Users size={24} color={palette.accentSecondary} />}
            title={t('home.modeCoach')}
            desc={t('home.modeCoachDesc')}
            color={palette.accentSecondary}
            onPress={() => router.push('/match/new')}
          />
        </View>

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
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeCard({
  icon,
  title,
  desc,
  color,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.modeIconBg, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <View style={styles.modeContent}>
        <Text style={styles.modeTitle}>{title}</Text>
        <Text style={styles.modeDesc}>{desc}</Text>
      </View>
      <ChevronRight size={16} color={palette.textMuted} />
    </Pressable>
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
    fontSize: 56,
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
  section: {
    gap: 12,
    marginBottom: 24,
  },
  modeCard: {
    backgroundColor: palette.backgroundSurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
  },
  modeCardPressed: {
    opacity: 0.8,
    backgroundColor: palette.backgroundElevated,
  },
  modeIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeContent: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textPrimary,
    marginBottom: 3,
  },
  modeDesc: {
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
});
