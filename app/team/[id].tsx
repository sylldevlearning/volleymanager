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
import { Plus, Trash2, Edit2, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTeamById, updateTeam, deleteTeam } from '../../src/services/teamService';
import { getPlayersByTeam, createPlayer, deletePlayer } from '../../src/services/playerService';
import type { Team } from '../../src/models/team';
import type { Player, PlayerPosition } from '../../src/models/player';
import { palette } from '../../src/theme/tokens';

const POSITIONS: PlayerPosition[] = ['setter', 'outside', 'opposite', 'middle', 'libero', 'universal'];

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [t, p] = await Promise.all([getTeamById(id), getPlayersByTeam(id)]);
    setTeam(t);
    setPlayers(p);
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
            if (id) {
              await deleteTeam(id);
              router.back();
            }
          },
        },
      ]
    );
  };

  if (!team) return null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Team header */}
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
          accessibilityLabel={`Supprimer ${team.name}`}
          accessibilityRole="button"
        >
          <Trash2 size={18} color={palette.error} />
        </Pressable>
      </View>

      {/* Players list */}
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
            onDelete={async () => {
              await deletePlayer(item.id);
              load();
            }}
          />
        )}
      />

      {/* Add player button */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => setShowAddPlayer(true)}
        accessibilityLabel={t('team.addPlayer')}
        accessibilityRole="button"
      >
        <Plus size={26} color="#fff" />
      </Pressable>

      {/* Add player modal */}
      <AddPlayerModal
        visible={showAddPlayer}
        teamId={id!}
        onClose={() => setShowAddPlayer(false)}
        onAdded={() => { setShowAddPlayer(false); load(); }}
      />
    </SafeAreaView>
  );
}

function PlayerRow({ player, onDelete }: { player: Player; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.playerRow}>
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>{player.number}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{player.firstName} {player.lastName}</Text>
        {player.position && (
          <Text style={styles.playerPosition}>{t(`player.positions.${player.position}`)}</Text>
        )}
      </View>
      <Pressable
        onPress={onDelete}
        style={styles.deleteRowBtn}
        accessibilityLabel={`Supprimer ${player.firstName}`}
        accessibilityRole="button"
      >
        <Trash2 size={16} color={palette.textMuted} />
      </Pressable>
    </View>
  );
}

function AddPlayerModal({
  visible,
  teamId,
  onClose,
  onAdded,
}: {
  visible: boolean;
  teamId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [number, setNumber] = useState('');
  const [position, setPosition] = useState<PlayerPosition | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => { setFirstName(''); setLastName(''); setNumber(''); setPosition(null); };

  const handleAdd = async () => {
    if (!firstName.trim() || !lastName.trim() || !number) {
      Alert.alert(t('common.error'), 'Prénom, nom et numéro sont requis.');
      return;
    }
    const num = parseInt(number, 10);
    if (isNaN(num) || num < 0 || num > 99) {
      Alert.alert(t('common.error'), 'Numéro invalide (0–99).');
      return;
    }
    setLoading(true);
    try {
      await createPlayer({
        teamId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        number: num,
        position,
        photoUri: null,
        isActive: true,
      });
      reset();
      onAdded();
    } catch (e) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('team.addPlayer')}</Text>
          <Pressable onPress={onClose} accessibilityLabel={t('common.close')} accessibilityRole="button">
            <X size={24} color={palette.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.modalBody}>
          <Row>
            <ModalInput label={t('player.firstName')} value={firstName} onChangeText={setFirstName} placeholder="Jean" />
            <ModalInput label={t('player.lastName')} value={lastName} onChangeText={setLastName} placeholder="Dupont" />
          </Row>
          <ModalInput
            label={`${t('player.number')} (0–99)`}
            value={number}
            onChangeText={setNumber}
            placeholder="7"
            keyboardType="number-pad"
            maxLength={2}
          />

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
                <Text style={[styles.positionChipText, position === pos && styles.positionChipTextActive]}>
                  {t(`player.positions.${pos}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed, loading && styles.addButtonDisabled]}
          onPress={handleAdd}
          disabled={loading}
          accessibilityLabel={t('common.add')}
          accessibilityRole="button"
        >
          <Text style={styles.addButtonText}>{loading ? t('common.loading') : t('team.addPlayer')}</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: 12 }}>{children}</View>;
}

function ModalInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  maxLength?: number;
}) {
  return (
    <View style={{ flex: 1, marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
        accessibilityLabel={label}
      />
    </View>
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
  shortName: { fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.textSecondary, marginTop: 2 },
  playerCount: { fontSize: 13, fontFamily: 'Inter_400Regular', color: palette.textMuted, marginTop: 4 },
  deleteBtn: { padding: 16 },
  list: { padding: 16, gap: 8, paddingBottom: 80 },
  emptyText: { textAlign: 'center', color: palette.textMuted, fontFamily: 'Inter_400Regular', marginTop: 40 },
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
  playerPosition: { fontSize: 12, fontFamily: 'Inter_400Regular', color: palette.textSecondary, marginTop: 2 },
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  modalTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  modalBody: { flex: 1, padding: 20 },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
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
  positionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  positionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: palette.backgroundElevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  positionChipActive: { borderColor: palette.accentPrimary, backgroundColor: palette.accentPrimaryMuted },
  positionChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: palette.textSecondary },
  positionChipTextActive: { color: palette.textPrimary },
  addButton: {
    margin: 20,
    backgroundColor: palette.accentPrimary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  addButtonPressed: { opacity: 0.85 },
  addButtonDisabled: { opacity: 0.5 },
  addButtonText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
});
