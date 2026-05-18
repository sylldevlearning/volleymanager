import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Images, Plus, X } from 'lucide-react-native';
import { palette } from '../../theme/tokens';
import { isOcrAvailable, recognizeText } from './ocrService';
import { parseNames, type DetectedPlayer } from './ocrParser';
import { createPlayer } from '../../services/playerService';
import type { Player } from '../../models/player';

interface ScannerSheetProps {
  visible: boolean;
  teamId: string;
  existingPlayers: Player[];
  onClose: () => void;
  onImported: () => void;
}

export function ScannerSheet({
  visible,
  teamId,
  existingPlayers,
  onClose,
  onImported,
}: ScannerSheetProps) {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [detected, setDetected] = useState<DetectedPlayer[]>([]);
  const [phase, setPhase] = useState<'photos' | 'results'>('photos');

  const reset = useCallback(() => {
    setPhotos([]);
    setDetected([]);
    setPhase('photos');
    setAnalyzing(false);
  }, []);

  function handleClose() {
    reset();
    onClose();
  }

  async function pickCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), 'Permission caméra refusée');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((p) => [...p, result.assets[0].uri]);
    }
  }

  async function pickGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((p) => [...p, result.assets[0].uri]);
    }
  }

  function removePhoto(index: number) {
    setPhotos((p) => p.filter((_, i) => i !== index));
  }

  async function analyze() {
    if (photos.length === 0) return;
    setAnalyzing(true);
    try {
      const allBlocks: ReturnType<typeof parseNames> = [];
      for (const uri of photos) {
        const blocks = await recognizeText(uri);
        const names = parseNames(blocks);
        allBlocks.push(...names);
      }
      // Deduplicate across photos
      const seen = new Set<string>();
      const merged = allBlocks.filter((p) => {
        const key = `${p.lastName}|${p.firstName}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setDetected(merged);
      setPhase('results');
    } catch (e) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  function toggleSelect(id: string) {
    setDetected((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isSelected: !p.isSelected } : p))
    );
  }

  function updateNumber(id: string, value: string) {
    const num = value === '' ? null : parseInt(value, 10);
    setDetected((prev) =>
      prev.map((p) => (p.id === id ? { ...p, number: isNaN(num as number) ? null : num } : p))
    );
  }

  function addManually() {
    setDetected((prev) => [
      ...prev,
      { id: `manual_${Date.now()}`, lastName: '', firstName: '', number: null, licenseNumber: null, isSelected: true },
    ]);
  }

  async function handleImport() {
    const existingNames = new Set(
      existingPlayers.map(
        (p) => `${(p.lastName ?? '').toLowerCase()}|${(p.firstName ?? '').toLowerCase()}`
      )
    );

    const toImport = detected.filter((p) => p.isSelected && p.number !== null);
    if (toImport.length === 0) {
      Alert.alert(t('common.error'), 'Aucun joueur avec numéro sélectionné');
      return;
    }

    let imported = 0;
    for (const player of toImport) {
      const key = `${player.lastName.toLowerCase()}|${player.firstName.toLowerCase()}`;
      if (existingNames.has(key)) continue;
      try {
        await createPlayer({
          teamId,
          firstName: player.firstName || null,
          lastName: player.lastName || null,
          number: player.number!,
          position: null,
          photoUri: null,
          licenseNumber: player.licenseNumber ?? null,
          isActive: true,
        });
        imported++;
      } catch {
        // Skip duplicate numbers silently
      }
    }

    Alert.alert('', t('scanner.imported', { count: imported }));
    onImported();
    reset();
  }

  const ocrAvailable = isOcrAvailable();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('scanner.title')}</Text>
          <Pressable onPress={handleClose} style={styles.closeBtn} accessibilityRole="button">
            <X size={20} color={palette.textSecondary} />
          </Pressable>
        </View>

        {/* Not available banner */}
        {!ocrAvailable && (
          <View style={styles.notAvailableBanner}>
            <Text style={styles.notAvailableText}>{t('scanner.notAvailable')}</Text>
          </View>
        )}

        {phase === 'photos' ? (
          <>
            {/* Photo thumbnails */}
            {photos.length > 0 && (
              <View style={styles.thumbnailRow}>
                {photos.map((uri, i) => (
                  <View key={uri} style={styles.thumb}>
                    <Image source={{ uri }} style={styles.thumbImg} />
                    <Pressable
                      style={styles.thumbRemove}
                      onPress={() => removePhoto(i)}
                      accessibilityRole="button"
                    >
                      <X size={12} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Photo action buttons */}
            <View style={styles.photoActions}>
              <Pressable
                style={[styles.photoBtn, !ocrAvailable && styles.photoBtnDisabled]}
                onPress={pickCamera}
                disabled={!ocrAvailable}
                accessibilityRole="button"
              >
                <Camera size={20} color={ocrAvailable ? palette.accentPrimary : palette.textMuted} />
                <Text style={[styles.photoBtnText, !ocrAvailable && styles.photoBtnTextDisabled]}>
                  {photos.length === 0 ? t('scanner.takePhoto') : t('scanner.addPage')}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.photoBtn, !ocrAvailable && styles.photoBtnDisabled]}
                onPress={pickGallery}
                disabled={!ocrAvailable}
                accessibilityRole="button"
              >
                <Images size={20} color={ocrAvailable ? palette.accentPrimary : palette.textMuted} />
                <Text style={[styles.photoBtnText, !ocrAvailable && styles.photoBtnTextDisabled]}>
                  {t('scanner.choosePhoto')}
                </Text>
              </Pressable>
            </View>

            <View style={styles.spacer} />

            <Pressable
              style={[styles.analyzeBtn, (photos.length === 0 || analyzing) && styles.analyzeBtnDisabled]}
              onPress={analyze}
              disabled={photos.length === 0 || analyzing}
              accessibilityRole="button"
            >
              {analyzing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.analyzeBtnText}>{t('scanner.analyze')}</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            {/* Results */}
            <Text style={styles.detectedCount}>
              {t('scanner.detected', { count: detected.length })}
            </Text>

            <FlatList
              data={detected}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.resultList}
              renderItem={({ item }) => (
                <PlayerResultRow
                  player={item}
                  onToggle={() => toggleSelect(item.id)}
                  onNumberChange={(v) => updateNumber(item.id, v)}
                />
              )}
              ListFooterComponent={
                <Pressable
                  style={styles.addManuallyBtn}
                  onPress={addManually}
                  accessibilityRole="button"
                >
                  <Plus size={16} color={palette.accentPrimary} />
                  <Text style={styles.addManuallyText}>{t('scanner.addManually')}</Text>
                </Pressable>
              }
            />

            <View style={styles.resultFooter}>
              <Pressable style={styles.cancelBtn} onPress={handleClose} accessibilityRole="button">
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable style={styles.importBtn} onPress={handleImport} accessibilityRole="button">
                <Text style={styles.importBtnText}>{t('scanner.import')}</Text>
              </Pressable>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function PlayerResultRow({
  player,
  onToggle,
  onNumberChange,
}: {
  player: DetectedPlayer;
  onToggle: () => void;
  onNumberChange: (v: string) => void;
}) {
  return (
    <View style={styles.resultRow}>
      <Pressable
        onPress={onToggle}
        style={[styles.checkbox, player.isSelected && styles.checkboxSelected]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: player.isSelected }}
      >
        {player.isSelected && <Text style={styles.checkMark}>✓</Text>}
      </Pressable>
      <View style={styles.playerInfo}>
        <Text style={[styles.playerName, !player.isSelected && styles.playerNameDimmed]} numberOfLines={1}>
          {player.lastName}{player.firstName ? ` ${player.firstName}` : ''}
        </Text>
        {player.licenseNumber && (
          <Text style={[styles.licenseText, !player.isSelected && styles.playerNameDimmed]}>
            Lic. {player.licenseNumber}
          </Text>
        )}
      </View>
      <TextInput
        style={[styles.numberInput, !player.isSelected && styles.numberInputDimmed]}
        placeholder="#"
        placeholderTextColor={palette.textMuted}
        keyboardType="number-pad"
        maxLength={2}
        value={player.number !== null ? String(player.number) : ''}
        onChangeText={onNumberChange}
        editable={player.isSelected}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: palette.textPrimary,
  },
  closeBtn: { padding: 4 },

  notAvailableBanner: {
    margin: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1,
    borderColor: palette.warning + '40',
  },
  notAvailableText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: palette.warning,
    textAlign: 'center',
  },

  thumbnailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  thumb: { width: 80, height: 80, borderRadius: 8, overflow: 'visible' },
  thumbImg: { width: 80, height: 80, borderRadius: 8 },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.error,
    alignItems: 'center',
    justifyContent: 'center',
  },

  photoActions: { gap: 12, paddingHorizontal: 20, paddingTop: 20 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
  },
  photoBtnDisabled: { opacity: 0.4 },
  photoBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: palette.accentPrimary,
  },
  photoBtnTextDisabled: { color: palette.textMuted },

  spacer: { flex: 1 },

  analyzeBtn: {
    margin: 20,
    padding: 16,
    borderRadius: 14,
    backgroundColor: palette.accentPrimary,
    alignItems: 'center',
  },
  analyzeBtnDisabled: { opacity: 0.4 },
  analyzeBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },

  detectedCount: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },

  resultList: { paddingHorizontal: 16, paddingBottom: 12 },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.backgroundElevated,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: palette.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: palette.accentPrimary,
    borderColor: palette.accentPrimary,
  },
  checkMark: { fontSize: 13, color: '#fff', fontFamily: 'Inter_700Bold' },
  playerInfo: { flex: 1 },
  playerName: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: palette.textPrimary,
  },
  licenseText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: palette.textMuted,
    marginTop: 1,
  },
  playerNameDimmed: { color: palette.textMuted },
  numberInput: {
    width: 44,
    height: 36,
    borderRadius: 8,
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    color: palette.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    textAlign: 'center',
  },
  numberInputDimmed: { opacity: 0.35 },

  addManuallyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    marginTop: 4,
  },
  addManuallyText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: palette.accentPrimary,
  },

  resultFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: palette.backgroundElevated,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: palette.backgroundSurface,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textSecondary,
  },
  importBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    backgroundColor: palette.accentPrimary,
    alignItems: 'center',
  },
  importBtnText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
});
