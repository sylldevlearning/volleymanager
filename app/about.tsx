import { Image, StyleSheet, Text, View } from 'react-native';

const BALL_IMG = require('../assets/images/ballon.png');
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Info } from 'lucide-react-native';
import { palette } from '../src/theme/tokens';
import { APP_VERSION, COMPANY } from '../src/utils/constants';

export default function AboutScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* App identity */}
      <View style={styles.heroBlock}>
        <Image source={BALL_IMG} style={styles.heroEmoji} resizeMode="contain" />
        <Text style={styles.heroName}>VolleyManager</Text>
        <Text style={styles.heroVersion}>{t('about.version')} {APP_VERSION}</Text>
      </View>

      {/* Info rows */}
      <View style={styles.section}>
        <View style={styles.card}>
          <View style={styles.row}>
            <Info size={18} color={palette.textMuted} />
            <Text style={styles.rowLabel}>{t('about.developedBy')}</Text>
            <Text style={styles.rowValue}>{COMPANY}</Text>
          </View>
        </View>

        <Text style={styles.storeHint}>{t('about.contactViaStore')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  heroBlock: { alignItems: 'center', paddingVertical: 36, gap: 6 },
  heroEmoji: { width: 72, height: 72 },
  heroName: { fontSize: 26, fontFamily: 'Inter_900Black', color: palette.textPrimary, marginTop: 8 },
  heroVersion: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textMuted },
  section: { paddingHorizontal: 16, gap: 16 },
  card: {
    backgroundColor: palette.backgroundSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: palette.textPrimary },
  rowValue: { fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  storeHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
