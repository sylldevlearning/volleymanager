import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import { palette } from '../../theme/tokens';
import type { ResultQr } from '../../features/tournament/matchQr';

/** Referee: the result of a quick match started from a tournament QR, scanned by the organiser. */
export function ResultQrCard({ value, result }: { value: string; result: ResultQr }) {
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

const styles = StyleSheet.create({
  card: {
    alignItems: 'center', gap: 8, padding: 16, borderRadius: 16, marginBottom: 16,
    backgroundColor: palette.backgroundSurface, borderWidth: 1, borderColor: palette.backgroundElevated,
  },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  teams: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary, textAlign: 'center' },
  sets: { fontSize: 15, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  qrBox: { marginTop: 8, padding: 16, borderRadius: 12, backgroundColor: '#FFFFFF' },
  hint: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textSecondary, lineHeight: 20, textAlign: 'center' },
});
