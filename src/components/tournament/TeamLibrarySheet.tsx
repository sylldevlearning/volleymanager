import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';
import { palette } from '../../theme/tokens';
import { getAllTeams } from '../../services/teamService';
import type { Team } from '../../models/team';

interface Props {
  visible: boolean;
  /** "Mes équipes" ids already in the tournament */
  alreadyAdded: Set<string>;
  onClose: () => void;
  onAdd: (teams: Team[]) => void;
}

/** Picks teams from "Mes équipes" for a tournament. */
export function TeamLibrarySheet({ visible, alreadyAdded, onClose, onAdd }: Props) {
  const { t } = useTranslation();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setSelected(new Set());
    getAllTeams().then(setTeams);
  }, [visible]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('tournament.wizard.libraryTitle')}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <X size={22} color={palette.textPrimary} />
          </Pressable>
        </View>
        <FlatList
          data={teams ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={teams ? <Text style={styles.empty}>{t('tournament.wizard.libraryEmpty')}</Text> : null}
          renderItem={({ item }) => {
            const added = alreadyAdded.has(item.id);
            const isSelected = selected.has(item.id);
            return (
              <Pressable
                style={[styles.row, added && styles.rowDisabled]}
                onPress={() => !added && toggle(item.id)}
                disabled={added}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected || added, disabled: added }}
              >
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <View style={styles.rowText}>
                  <Text style={styles.name}>{item.name}</Text>
                  {added && <Text style={styles.added}>{t('tournament.wizard.alreadyAdded')}</Text>}
                </View>
                <View style={[styles.check, (isSelected || added) && styles.checkOn]}>
                  {(isSelected || added) && <Check size={16} color="#fff" />}
                </View>
              </Pressable>
            );
          }}
        />
        <View style={styles.footer}>
          <Pressable
            style={[styles.addButton, selected.size === 0 && styles.addButtonDisabled]}
            disabled={selected.size === 0}
            onPress={() => onAdd((teams ?? []).filter((team) => selected.has(team.id)))}
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>{t('tournament.wizard.libraryAdd', { count: selected.size })}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  list: { paddingHorizontal: 16, paddingBottom: 16 },
  empty: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textSecondary, textAlign: 'center', paddingVertical: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: palette.backgroundElevated,
  },
  rowDisabled: { opacity: 0.5 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontFamily: 'Inter_500Medium', color: palette.textPrimary },
  added: { fontSize: 12, fontFamily: 'Inter_400Regular', color: palette.textSecondary, marginTop: 2 },
  check: {
    width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: palette.textMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: palette.accentPrimary, borderColor: palette.accentPrimary },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: palette.backgroundElevated },
  addButton: { backgroundColor: palette.accentPrimary, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  addButtonDisabled: { opacity: 0.4 },
  addButtonText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
});
