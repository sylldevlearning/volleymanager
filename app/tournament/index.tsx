import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../src/i18n/format';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, Plus, ScanQrCode, Trophy } from 'lucide-react-native';
import { InfoTooltip } from '../../src/components/ui/InfoTooltip';
import { getTournaments } from '../../src/services/tournamentService';
import type { Tournament } from '../../src/models/tournament';
import { useThemedStyles, useAppTheme, type AppTheme } from '../../src/theme/useAppTheme';

export default function TournamentListScreen() {
  const colors = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);

  // Reloads when coming back from the wizard
  useFocusEffect(useCallback(() => {
    let active = true;
    getTournaments().then((list) => { if (active) setTournaments(list); });
    return () => { active = false; };
  }, []));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerRight: () => <InfoTooltip textKey="help.tournaments" /> }} />
      {/* Referee side: quick match filled from the "QR du match" of a tournament run on another phone.
          Above the list, so it shows even with no tournament here. */}
      <Pressable
        style={({ pressed }) => [styles.scanButton, pressed && styles.cardPressed]}
        onPress={() => router.push('/scan')}
        accessibilityLabel={t('tournament.list.scanMatchQr')}
        accessibilityRole="button"
      >
        <ScanQrCode size={26} color={colors.success} strokeWidth={1.5} />
        <View style={styles.scanContent}>
          <Text style={styles.scanTitle}>{t('tournament.list.scanMatchQr')}</Text>
          <Text style={styles.scanDesc}>{t('tournament.list.scanMatchQrDesc')}</Text>
        </View>
        <ChevronRight size={20} color={colors.textMuted} />
      </Pressable>
      <FlatList
        data={tournaments ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={tournaments ? (
          <View style={styles.empty}>
            <Trophy size={40} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>{t('tournament.list.empty')}</Text>
            <Text style={styles.emptyHint}>{t('tournament.list.emptyHint')}</Text>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push(`/tournament/${item.id}`)}
            accessibilityRole="button"
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
              <View style={[styles.status, item.status === 'finished' && styles.statusFinished]}>
                <Text style={[styles.statusText, item.status === 'finished' && styles.statusTextFinished]}>
                  {item.status === 'finished' ? t('tournament.list.finished') : t('tournament.list.live')}
                </Text>
              </View>
            </View>
            <Text style={styles.cardLine}>
              {[formatDate(item.date, i18n.language), item.location].filter(Boolean).join(' · ')}
            </Text>
            <Text style={styles.cardLine}>
              {t(`tournament.gameType.${item.gameType}`)} · {t(`tournament.format.${item.format}`)}
            </Text>
          </Pressable>
        )}
      />
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.newButton, pressed && styles.newButtonPressed]}
          onPress={() => router.push('/tournament/new')}
          accessibilityRole="button"
        >
          <Plus size={20} color={colors.onFill} />
          <Text style={styles.newButtonText}>{t('tournament.list.new')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: a.background },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  scanButton: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, marginTop: 16,
    padding: 16, borderRadius: 16, backgroundColor: 'rgba(46, 160, 67, 0.10)',
    borderWidth: 1, borderColor: 'rgba(46, 160, 67, 0.35)',
  },
  scanContent: { flex: 1, gap: 2 },
  scanTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: a.textPrimary },
  scanDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', color: a.textSecondary },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24, paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: a.textPrimary, textAlign: 'center' },
  emptyHint: { fontSize: 14, fontFamily: 'Inter_400Regular', color: a.textSecondary, textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: a.backgroundSurface, borderRadius: 16, borderWidth: 1,
    borderColor: a.backgroundElevated, padding: 16, gap: 4,
  },
  cardPressed: { opacity: 0.85 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 2 },
  cardTitle: { flex: 1, fontSize: 16, fontFamily: 'Inter_700Bold', color: a.textPrimary },
  cardLine: { fontSize: 13, fontFamily: 'Inter_400Regular', color: a.textSecondary },
  status: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(46, 160, 67, 0.15)' },
  statusFinished: { backgroundColor: a.backgroundElevated },
  statusText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: a.success },
  statusTextFinished: { color: a.textSecondary },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: a.backgroundElevated },
  newButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: a.fill, paddingVertical: 16, borderRadius: 14,
  },
  newButtonPressed: { opacity: 0.85 },
  newButtonText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: a.onFill },
});
