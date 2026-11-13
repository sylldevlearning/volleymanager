import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import { useThemedStyles, type AppTheme } from '../../theme/useAppTheme';

/** « Exemple »: marks sample teams, matches and tournaments. */
export function SampleBadge() {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  return (
    <View style={styles.badge} accessibilityLabel={t('sample.badge')}>
      <Text style={styles.text} numberOfLines={1}>{t('sample.badge')}</Text>
    </View>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: a.accentSecondary + '66',
    backgroundColor: a.accentSecondary + '1A',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  text: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: a.accentSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
});
