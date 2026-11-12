import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from '../ui/Text';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import type { ResultQr } from '../../features/tournament/matchQr';
import { useThemedStyles, type AppTheme } from '../../theme/useAppTheme';

/** Referee: the result of a quick match started from a tournament QR, scanned by the organiser. */
export function ResultQrCard({ value, result }: { value: string; result: ResultQr }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const size = Math.min(width - 112, 280);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('resultQr.title')}</Text>
      <Text style={styles.teams}>{result.home} – {result.away}</Text>
      <Text style={styles.sets}>{result.sets.map(([h, a]) => `${h}-${a}`).join('  ')}</Text>
      {/* White background and margin: readable by the camera even on a dark screen */}
      <View style={styles.qrBox}>
        <QRCode value={value} size={size} color="#000000" backgroundColor="#FFFFFF" ecl="M" />
      </View>
      <Text style={styles.hint}>{t('resultQr.hint')}</Text>
    </View>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  card: {
    alignItems: 'center', gap: 8, padding: 16, borderRadius: 16, marginBottom: 16,
    backgroundColor: a.backgroundSurface, borderWidth: 1, borderColor: a.backgroundElevated,
  },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: a.textPrimary },
  teams: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: a.textPrimary, textAlign: 'center' },
  sets: { fontSize: 15, fontFamily: 'Inter_500Medium', color: a.textSecondary },
  qrBox: { marginTop: 8, padding: 16, borderRadius: 12, backgroundColor: '#FFFFFF' },
  hint: { fontSize: 14, fontFamily: 'Inter_400Regular', color: a.textSecondary, lineHeight: 20, textAlign: 'center' },
});
