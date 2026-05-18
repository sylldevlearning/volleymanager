import { Alert, StyleSheet, Text, View, Switch, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Zap, Globe, Info, ChevronRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { palette } from '../../src/theme/tokens';
import i18n from '../../src/i18n';
import { APP_VERSION, ADMOB_IDS } from '../../src/utils/constants';
import { InfoTooltip } from '../../src/components/ui/InfoTooltip';
import { AdBanner } from '../../src/components/ads/AdBanner';
import { deleteAllMatches } from '../../src/services/matchService';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { hapticsEnabled, setHapticsEnabled, language, setLanguage } = useSettingsStore();

  const changeLanguage = (lang: 'fr' | 'en') => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.topBar}>
        <InfoTooltip textKey="help.settings" />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        <View style={styles.card}>
          <LanguageOption
            label="Français"
            active={language === 'fr'}
            onPress={() => changeLanguage('fr')}
          />
          <View style={styles.divider} />
          <LanguageOption
            label="English"
            active={language === 'en'}
            onPress={() => changeLanguage('en')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.haptics')}</Text>
        <View style={styles.card}>
          <SettingRow
            icon={<Zap size={20} color={palette.warning} />}
            label={t('settings.hapticsDesc')}
            right={
              <Switch
                value={hapticsEnabled}
                onValueChange={setHapticsEnabled}
                trackColor={{ false: palette.backgroundHover, true: palette.accentSecondary }}
                thumbColor="#fff"
              />
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => router.push('/about' as never)}
            accessibilityRole="button"
          >
            <Info size={20} color={palette.textMuted} />
            <Text style={styles.rowLabel}>{t('about.title')}</Text>
            <ChevronRight size={16} color={palette.textMuted} />
          </Pressable>
          <View style={styles.divider} />
          <SettingRow
            icon={<Info size={20} color={palette.textMuted} />}
            label={`${t('settings.version')} ${APP_VERSION}`}
            right={null}
          />
        </View>
      </View>
      <View style={styles.section}>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => {
              Alert.alert(
                t('match.deleteAll'),
                `${t('match.deleteAllConfirm')}\n${t('match.irreversible')}`,
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => deleteAllMatches(),
                  },
                ]
              );
            }}
            accessibilityRole="button"
          >
            <Text style={[styles.rowLabel, { color: palette.error }]}>
              {t('match.deleteAll')}
            </Text>
          </Pressable>
        </View>
      </View>
      <AdBanner unitId={ADMOB_IDS.BANNER_SETTINGS} />
    </SafeAreaView>
  );
}

function SettingRow({
  icon,
  label,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  right: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      {icon}
      <Text style={styles.rowLabel}>{label}</Text>
      {right}
    </View>
  );
}

function LanguageOption({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Globe size={20} color={active ? palette.accentPrimary : palette.textMuted} />
      <Text style={[styles.rowLabel, active && { color: palette.accentPrimary }]}>{label}</Text>
      {active && <View style={styles.activeDot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background, padding: 16, gap: 0 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: palette.backgroundSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  rowPressed: { backgroundColor: palette.backgroundElevated },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: palette.textPrimary,
  },
  divider: { height: 1, backgroundColor: palette.backgroundElevated, marginLeft: 14 },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.accentPrimary,
  },
});
