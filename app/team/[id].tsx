import { useCallback, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  Pressable,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, X, BarChart2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTeamById, updateTeam, deleteTeam } from '../../src/services/teamService';
import { getPlayersByTeam, createPlayer, deletePlayer } from '../../src/services/playerService';
import type { Team } from '../../src/models/team';
import type { Player, PlayerPosition as PPos } from '../../src/models/player';
import { getPlayerDisplayName } from '../../src/features/players/player-helpers';
import { palette } from '../../src/theme/tokens';

const POSITIONS: PPos[] = ['setter', 'outside', 'opposite', 'middle', 'libero', 'universal'];

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [tm, pl] = await Promise.all([getTeamById(id), getPlayersByTeam(id)]);
    setTeam(tm);
    setPlayers(pl);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDeleteTeam = () => {
    Alert.alert(
      t('common.delete'),
      `Supprimer l'équipe "${team?.name}" ?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            if (id) { await deleteTeam(id); router.back(); }
          },
        },
      ]
    );
  };

  if (!team) return null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <View style={[styles.colorBand, { backgroundColor: team.color }]} />
        <View style={styles.headerContent}>
          <Text style={styles.teamName}>{team.name}</Text>
          {team.shortName && <Text style={styles.shortName}>{team.shortName}</Text>}
          <Text style={styles.playerCount}>{t('team.playerCount', { count: players.length })}</Text>
        </View>
        <Pressable
          onPress={handleDeleteTeam}
          style={styles.deleteBtn}
          accessibilityRole="button"
        >
          <Trash2 size={18} color={palette.error} />
        </Pressable>
      </View>

      <FlatList
        data={players}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('team.noPlayers')}</Text>
        }
        renderItem={({ item }) => (
          <PlayerRow
            player={item}
            onDelete={async () => { await deletePlayer(item.id); load(); }}
          />
        )}
      />

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => setShowAddPlayer(true)}
        accessibilityLabel={t('team.addPlayer')}
        accessibilityRole="button"
      >
        <Plus size={26} color="#fff" />
      </Pressable>

      <AddPlayerModal
        visible={showAddPlayer}
        teamId={id!}
        existingNumbers={players.map((p) => p.number)}
        onClose={() => setShowAddPlayer(false)}
        onAdded={() => { setShowAddPlayer(false); load(); }}
        onAddedAnother={() => load()}
      />
    </SafeAreaView>
  );
}

function PlayerRow({ player, onDelete }: { player: Player; onDelete: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const name = getPlayerDisplayName(player);
  return (
    <View style={styles.playerRow}>
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>{player.number}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{name}</Text>
        {player.position && (
          <Text style={styles.playerPosition}>{t(`player.positions.${player.position}`)}</Text>
        )}
      </View>
      <Pressable
        onPress={() => router.push(`/player/${player.id}/stats` as never)}
        style={styles.statsRowBtn}
        accessibilityRole="button"
        accessibilityLabel={t('stats.career.title')}
      >
        <BarChart2 size={16} color={palette.textMuted} />
      </Pressable>
      <Pressable onPress={onDelete} style={styles.deleteRowBtn} accessibilityRole="button">
        <Trash2 size={16} color={palette.textMuted} />
      </Pressable>
    </View>
  );
}

function AddPlayerModal({
  visible,
  teamId,
  existingNumbers,
  onClose,
  onAdded,
  onAddedAnother,
}: {
  visible: boolean;
  teamId: string;
  existingNumbers: number[];
  onClose: () => void;
  onAdded: () => void;
  onAddedAnother: () => void;
}) {
  const { t } = useTranslation();
  const [lastName, setLastName] = useState('');
  const [number, setNumber] = useState('');
  const [position, setPosition] = useState<PPos | null>(null);
  const [loading, setLoading] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  const reset = () => { setLastName(''); setNumber(''); setPosition(null); };

  async function handleAdd(addAnother: boolean) {
    const num = parseInt(number, 10);
    if (isNaN(num) || num < 0 || num > 99) {
      Alert.alert(t('common.error'), t('player.numberRequired'));
      return;
    }
    setLoading(true);
    try {
      await createPlayer({
        teamId,
        firstName: null,
        lastName: lastName.trim() || null,
        number: num,
        position,
        photoUri: null,
        isActive: true,
      });
      if (addAnother) {
        setAddedCount((c) => c + 1);
        reset();
        onAddedAnother();
      } else {
        setAddedCount(0);
        onAdded();
      }
    } catch (e) {
      const msg = String(e);
      if (msg.includes('DUPLICATE_NUMBER')) {
        Alert.alert(t('common.error'), t('player.numberDuplicate'));
      } else {
        Alert.alert(t('common.error'), msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    reset();
    setAddedCount(0);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>{t('team.addPlayer')}</Text>
            {addedCount > 0 && (
              <Text style={styles.batchCount}>
                {addedCount} ajouté{addedCount > 1 ? 's' : ''}
              </Text>
            )}
          </View>
          <Pressable onPress={handleClose} accessibilityRole="button">
            <X size={24} color={palette.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.modalBody}>
          <View style={styles.row}>
            <View style={styles.numberInput}>
              <Text style={styles.fieldLabel}>{t('player.numberOnly')} *</Text>
              <TextInput
                style={[styles.input, styles.inputCenter]}
                value={number}
                onChangeText={setNumber}
                placeholder="7"
                placeholderTextColor={palette.textMuted}
                keyboardType="number-pad"
                maxLength={2}
                autoFocus
                selectTextOnFocus
                accessibilityLabel={t('player.numberOnly')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>{t('player.namePlaceholder')}</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder={t('player.namePlaceholder')}
                placeholderTextColor={palette.textMuted}
                autoCapitalize="words"
                returnKeyType="done"
                accessibilityLabel="Nom"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>{t('player.position')}</Text>
          <View style={styles.positionsGrid}>
            {POSITIONS.map((pos) => (
              <Pressable
                key={pos}
                style={[styles.positionChip, position === pos && styles.positionChipActive]}
                onPress={() => setPosition(position === pos ? null : pos)}
                accessibilityRole="radio"
                accessibilityState={{ selected: position === pos }}
              >
                <Text
                  style={[
                    styles.positionChipText,
                    position === pos && styles.positionChipTextActive,
                  ]}
                >
                  {t(`player.positions.${pos}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.modalButtons}>
          <Pressable
            style={({ pressed }) => [
              styles.batchBtn,
              pressed && styles.batchBtnPressed,
              loading && styles.btnDisabled,
            ]}
            onPress={() => handleAdd(true)}
            disabled={loading}
            accessibilityRole="button"
          >
            <Text style={styles.batchBtnText}>{t('player.addAnother')}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
              loading && styles.btnDisabled,
            ]}
            onPress={() => handleAdd(false)}
            disabled={loading}
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>
              {loading ? t('common.loading') : t('player.done')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    backgroundColor: palette.backgroundSurface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
  },
  colorBand: { width: 8, alignSelf: 'stretch' },
  headerContent: { flex: 1, padding: 16 },
  teamName: { fontSize: 20, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  shortName: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: palette.textSecondary,
    marginTop: 2,
  },
  playerCount: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: palette.textMuted,
    marginTop: 4,
  },
  deleteBtn: { padding: 16 },
  list: { padding: 16, gap: 8, paddingBottom: 80 },
  emptyText: {
    textAlign: 'center',
    color: palette.textMuted,
    fontFamily: 'Inter_400Regular',
    marginTop: 40,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.backgroundSurface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
  },
  numberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: palette.textPrimary },
  playerPosition: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: palette.textSecondary,
    marginTop: 2,
  },
  statsRowBtn: { padding: 8 },
  deleteRowBtn: { padding: 8 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },
  modal: { flex: 1, backgroundColor: palette.backgroundSurface },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  batchCount: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: palette.success,
    marginTop: 3,
  },
  modalBody: { flex: 1, padding: 20 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 0 },
  numberInput: { width: 72 },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: palette.backgroundElevated,
    borderWidth: 1,
    borderColor: palette.backgroundHover,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: palette.textPrimary,
  },
  inputCenter: { textAlign: 'center', fontSize: 20, fontFamily: 'Inter_700Bold' },
  positionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  positionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: palette.backgroundElevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  positionChipActive: {
    borderColor: palette.accentPrimary,
    backgroundColor: palette.accentPrimaryMuted,
  },
  positionChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  positionChipTextActive: { color: palette.textPrimary },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: palette.backgroundElevated,
  },
  batchBtn: {
    flex: 1,
    backgroundColor: palette.backgroundElevated,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.backgroundHover,
  },
  batchBtnPressed: { opacity: 0.8 },
  batchBtnText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textSecondary,
  },
  addButton: {
    flex: 1,
    backgroundColor: palette.accentPrimary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  addButtonPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
  addButtonText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
});
