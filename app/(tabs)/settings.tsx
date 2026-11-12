import { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, View, Switch, Pressable } from 'react-native';
import { Text } from '../../src/components/ui/Text';
import { useTranslation } from 'react-i18next';
import { Zap, Globe, Info, ChevronRight, LifeBuoy, ShieldCheck, Check } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useLocales } from 'expo-localization';
import { LANGUAGES, deviceLanguage, type LanguagePreference } from '../../src/i18n/languages';
import { APP_VERSION, ADMOB_IDS } from '../../src/utils/constants';
import { InfoTooltip } from '../../src/components/ui/InfoTooltip';
import { AdBanner } from '../../src/components/ads/AdBanner';
import { deleteAllMatches } from '../../src/services/matchService';
import { isPrivacyOptionsRequired, openPrivacyOptions } from '../../src/features/ads/adsService';
import type { Appearance } from '../../src/theme/colors';
import { DriveBackupSection } from '../../src/components/settings/DriveBackupSection';
import { isDriveAvailable } from '../../src/features/backup/googleAccount';
import { useThemedStyles, useAppTheme, type AppTheme } from '../../src/theme/useAppTheme';

const APPEARANCES: Appearance[] = ['system', 'light', 'dark'];

export default function SettingsScreen() {
  const colors = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const router = useRouter();
  const { hapticsEnabled, setHapticsEnabled, language, setLanguage, resetHelp, appearance, setAppearance } = useSettingsStore();

  // UMP only offers the privacy form where it's required (EEA / UK) — re-checked on
  // each visit since consent is gathered asynchronously at startup.
  const [privacyRequired, setPrivacyRequired] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    isPrivacyOptionsRequired().then((required) => { if (active) setPrivacyRequired(required); });
    return () => { active = false; };
  }, []));

  // The root layout applies it (phone language resolved there)
  const [languageOpen, setLanguageOpen] = useState(false);
  const phoneLanguage = deviceLanguage(useLocales());
  const nameOf = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code;
  const languageLabel = (pref: LanguagePreference) =>
    (pref === 'system' ? t('settings.languageSystem', { name: nameOf(phoneLanguage) }) : nameOf(pref));
  const languageChoices: LanguagePreference[] = ['system', ...LANGUAGES.map((l) => l.code)];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <InfoTooltip textKey="help.settings" />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => setLanguageOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t('settings.language')} : ${languageLabel(language)}`}
          >
            <Globe size={20} color={colors.color} />
            <Text style={styles.rowLabel} numberOfLines={1}>{languageLabel(language)}</Text>
            <ChevronRight size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.appearance.title')}</Text>
        <View style={styles.card}>
          {APPEARANCES.map((choice, i) => (
            <View key={choice}>
              {i > 0 && <View style={styles.divider} />}
              <LanguageOption
                label={t(`settings.appearance.${choice}`)}
                active={appearance === choice}
                onPress={() => setAppearance(choice)}
              />
            </View>
          ))}
        </View>
      </View>

      {isDriveAvailable() && <DriveBackupSection />}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.haptics')}</Text>
        <View style={styles.card}>
          <SettingRow
            icon={<Zap size={20} color={colors.warning} />}
            label={t('settings.hapticsDesc')}
            right={
              <Switch
                value={hapticsEnabled}
                onValueChange={setHapticsEnabled}
                trackColor={{ false: colors.backgroundHover, true: colors.secondaryFill }}
                thumbColor="#fff"
              />
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.help')}</Text>
        <View style={styles.card}>
          {/* Resets the presentation AND the help bubbles; the root layout then opens the presentation */}
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={resetHelp}
            accessibilityRole="button"
          >
            <LifeBuoy size={20} color={colors.accentSecondary} />
            <Text style={styles.rowLabel}>{t('settings.replayHelp')}</Text>
            <ChevronRight size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => router.push('/about' as never)}
            accessibilityRole="button"
          >
            <Info size={20} color={colors.textMuted} />
            <Text style={styles.rowLabel}>{t('about.title')}</Text>
            <ChevronRight size={16} color={colors.textMuted} />
          </Pressable>
          {privacyRequired && (
            <>
              <View style={styles.divider} />
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => { openPrivacyOptions(); }}
                accessibilityRole="button"
              >
                <ShieldCheck size={20} color={colors.textMuted} />
                <Text style={styles.rowLabel}>{t('settings.privacyOptions')}</Text>
                <ChevronRight size={16} color={colors.textMuted} />
              </Pressable>
            </>
          )}
          <View style={styles.divider} />
          <SettingRow
            icon={<Info size={20} color={colors.textMuted} />}
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
            <Text style={[styles.rowLabel, { color: colors.error }]}>
              {t('match.deleteAll')}
            </Text>
          </Pressable>
        </View>
      </View>
      </ScrollView>
      <AdBanner unitId={ADMOB_IDS.BANNER_SETTINGS} />

      <Modal visible={languageOpen} transparent animationType="fade" onRequestClose={() => setLanguageOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLanguageOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('settings.language')}</Text>
            <FlatList
              data={languageChoices}
              keyExtractor={(code) => code}
              ItemSeparatorComponent={() => <View style={styles.divider} />}
              renderItem={({ item }) => (
                <LanguageOption
                  label={languageLabel(item)}
                  active={language === item}
                  onPress={() => { setLanguage(item); setLanguageOpen(false); }}
                />
              )}
            />
          </View>
        </Pressable>
      </Modal>
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
  const styles = useThemedStyles(makeStyles);
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
  const colors = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.rowLabel, active && { color: colors.color }]}>{label}</Text>
      {active && <Check size={18} color={colors.color} />}
    </Pressable>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: a.background },
  scroll: { padding: 16 },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: a.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: a.backgroundSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: a.backgroundElevated,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  rowPressed: { backgroundColor: a.backgroundElevated },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: a.textPrimary,
  },
  divider: { height: 1, backgroundColor: a.backgroundElevated, marginLeft: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  sheet: {
    maxHeight: '80%', backgroundColor: a.backgroundSurface, borderRadius: 16,
    borderWidth: 1, borderColor: a.backgroundElevated, overflow: 'hidden',
  },
  sheetTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', color: a.textPrimary, padding: 16, paddingBottom: 8 },
});
