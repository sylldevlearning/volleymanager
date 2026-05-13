import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { palette } from '../../theme/tokens';

/**
 * Placeholder AdBanner — replace with real ad SDK (e.g. expo-ads-admob) when ready.
 * Renders a subtle strip that won't distract from the UI.
 */
export function AdBanner() {
  const { t } = useTranslation();
  return (
    <View style={styles.container} accessibilityLabel="Advertisement">
      <Text style={styles.label}>{t('ads.loading')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 50,
    backgroundColor: palette.backgroundSurface,
    borderTopWidth: 1,
    borderTopColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: palette.textMuted,
    letterSpacing: 0.5,
  },
});
