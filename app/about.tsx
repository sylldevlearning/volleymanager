import { Image, StyleSheet, Text, View, Pressable, Linking } from 'react-native';

const BALL_IMG = require('../assets/images/ballon.png');
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail, Globe, Info } from 'lucide-react-native';
import { palette } from '../src/theme/tokens';
import { APP_VERSION, COMPANY, COMPANY_EMAIL, COMPANY_WEBSITE } from '../src/utils/constants';

export default function AboutScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <ArrowLeft size={22} color={palette.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('about.title')}</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* App identity */}
      <View style={styles.heroBlock}>
        <Image source={BALL_IMG} style={styles.heroEmoji} resizeMode="contain" />
        <Text style={styles.heroName}>VolleyManager</Text>
        <Text style={styles.heroVersion}>{t('about.version')} {APP_VERSION}</Text>
      </View>

      {/* Info rows */}
      <View style={styles.section}>
        <View style={styles.card}>
          <InfoRow icon={<Info size={18} color={palette.textMuted} />} label={t('about.developedBy')} value={COMPANY} />
          <View style={styles.divider} />
          <InfoRow icon={<Mail size={18} color={palette.textMuted} />} label={t('about.contact')} value={COMPANY_EMAIL}
            onPress={() => Linking.openURL(`mailto:${COMPANY_EMAIL}`)} />
          <View style={styles.divider} />
          <InfoRow icon={<Globe size={18} color={palette.textMuted} />} label={t('about.website')} value="GitHub"
            onPress={() => Linking.openURL(COMPANY_WEBSITE)} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const Inner = (
    <View style={styles.row}>
      {icon}
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, onPress && styles.rowValueLink]}>{value}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.rowPressed]} accessibilityRole="link">
        {Inner}
      </Pressable>
    );
  }
  return Inner;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  backBtn: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary, textAlign: 'center' },
  heroBlock: { alignItems: 'center', paddingVertical: 36, gap: 6 },
  heroEmoji: { width: 72, height: 72 },
  heroName: { fontSize: 26, fontFamily: 'Inter_900Black', color: palette.textPrimary, marginTop: 8 },
  heroVersion: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textMuted },
  section: { paddingHorizontal: 16 },
  card: {
    backgroundColor: palette.backgroundSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowPressed: { backgroundColor: palette.backgroundElevated },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: palette.textPrimary },
  rowValue: { fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  rowValueLink: { color: palette.accentSecondary },
  divider: { height: 1, backgroundColor: palette.backgroundElevated, marginLeft: 14 },
});
