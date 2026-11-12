import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../ui/Text';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import type { Player } from '../../models/player';
import type { SanctionType } from '../../utils/sanctionRules';
import { useThemedStyles, useAppTheme, type AppTheme } from '../../theme/useAppTheme';

interface SanctionSheetProps {
  visible: boolean;
  onClose: () => void;
  teamName: string;
  teamColor: string;
  /** Full roster (on-court + bench) — any registered player may be sanctioned. */
  players: Player[];
  onConfirm: (opts: { sanctionType: SanctionType; playerId: string | null }) => void;
}

const SANCTION_TYPES: { type: SanctionType; color: string }[] = [
  { type: 'warning', color: '#F2C14E' },
  { type: 'penalty', color: '#E63946' },
  { type: 'expulsion', color: '#F2994A' },
  { type: 'disqualification', color: '#C62828' },
  { type: 'delay', color: '#F2C14E' },
];

export function SanctionSheet({ visible, onClose, teamName, teamColor, players, onConfirm }: SanctionSheetProps) {
  const colors = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [playerId, setPlayerId] = useState<string | null | undefined>(undefined);
  const [sanctionType, setSanctionType] = useState<SanctionType | null>(null);

  useEffect(() => {
    if (visible) {
      setPlayerId(undefined);
      setSanctionType(null);
    }
  }, [visible]);

  function handleClose() {
    onClose();
  }

  function handleConfirm() {
    if (playerId === undefined || !sanctionType) return;
    onConfirm({ sanctionType, playerId });
    onClose();
  }

  const canConfirm = playerId !== undefined && sanctionType !== null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={[styles.sheet, { paddingBottom: 24 + insets.bottom }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t('sanction.title')}</Text>
            <Text style={styles.teamName}>{teamName}</Text>
          </View>
          <Pressable onPress={handleClose} style={styles.closeBtn} accessibilityRole="button">
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>{t('sanction.target')}</Text>
          <View style={styles.targetList}>
            <Pressable
              style={[styles.targetRow, playerId === null && [styles.targetRowSelected, { borderColor: teamColor, backgroundColor: teamColor + '15' }]]}
              onPress={() => setPlayerId(null)}
              accessibilityRole="radio"
              accessibilityState={{ selected: playerId === null }}
            >
              <Text style={styles.targetName}>{t('sanction.staff')}</Text>
            </Pressable>
            {players.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.targetRow, playerId === p.id && [styles.targetRowSelected, { borderColor: teamColor, backgroundColor: teamColor + '15' }]]}
                onPress={() => setPlayerId(p.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: playerId === p.id }}
              >
                <Text style={[styles.targetNum, { color: teamColor }]}>#{p.number}</Text>
                <Text style={styles.targetName} numberOfLines={1}>
                  {p.lastName ?? p.firstName ?? `#${p.number}`}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{t('sanction.type')}</Text>
          <View style={styles.typeGrid}>
            {SANCTION_TYPES.map(({ type, color }) => {
              const isSelected = sanctionType === type;
              return (
                <Pressable
                  key={type}
                  style={[styles.typeChip, { borderColor: color }, isSelected && { backgroundColor: color + '25' }]}
                  onPress={() => setSanctionType(type)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={[styles.typeDot, { backgroundColor: color }]} />
                  <Text style={styles.typeLabel}>{t(`sanction.types.${type}`)}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <Pressable
          style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!canConfirm}
          accessibilityRole="button"
        >
          <Text style={styles.confirmText}>{t('sanction.confirm')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const makeStyles = (a: AppTheme) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: a.backgroundSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: a.backgroundElevated,
  },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: a.textPrimary },
  teamName: { fontSize: 13, fontFamily: 'Inter_400Regular', color: a.textSecondary, marginTop: 2 },
  closeBtn: { padding: 4 },
  body: { padding: 16, gap: 8 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: a.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  targetList: { gap: 6 },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: a.backgroundElevated,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  targetRowSelected: {},
  targetNum: { fontSize: 15, fontFamily: 'Inter_700Bold', width: 36 },
  targetName: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: a.textPrimary },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: a.backgroundElevated,
  },
  typeDot: { width: 10, height: 10, borderRadius: 5 },
  typeLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: a.textPrimary },
  confirmBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: a.fill,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: a.onFill },
});
