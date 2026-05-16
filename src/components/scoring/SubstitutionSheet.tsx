import React, { useState, useMemo } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react-native';
import type { Player } from '../../models/player';
import type { CourtMap } from '../../stores/scoringStore';
import type { LiberoState, SubstitutionPair } from '../../models/substitution';
import type { MatchConfig, MatchFormat } from '../../models/match';
import { palette } from '../../theme/tokens';
import { validateSubstitution, validateLiberoSubstitution } from '../../utils/substitutionRules';
import { InfoTooltip } from '../ui/InfoTooltip';

const LIBERO_COLOR = palette.libero;

interface SubstitutionSheetProps {
  visible: boolean;
  onClose: () => void;
  side: 'home' | 'away';
  teamName: string;
  teamColor: string;
  allPlayers: Player[];
  onCourt: CourtMap;
  bench: Player[];
  libero: LiberoState | null;
  pairs: SubstitutionPair[];
  subsUsed: number;
  config: MatchConfig;
  format: MatchFormat;
  mode: 'competition' | 'leisure';
  onConfirm: (opts: {
    playerOutId: string;
    playerInId: string;
    position: number;
    isLibero: boolean;
  }) => void;
}

type Step = 'selectOut' | 'selectIn';

export function SubstitutionSheet({
  visible, onClose, side, teamName, teamColor,
  allPlayers, onCourt, bench, libero, pairs,
  subsUsed, config, format, mode, onConfirm,
}: SubstitutionSheetProps) {
  const { t } = useTranslation();
  const [playerOutId, setPlayerOutId] = useState<string | null>(null);
  const [playerOutPos, setPlayerOutPos] = useState<number | null>(null);
  const [playerInId, setPlayerInId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('selectOut');

  const playerMap = useMemo(
    () => new Map(allPlayers.map((p) => [p.id, p])),
    [allPlayers],
  );

  const maxSubs = config.unlimitedSubstitutions ? null : (config.substitutionsPerSet ?? 6);
  const subsFull = maxSubs !== null && subsUsed >= maxSubs;

  const courtPositions = ([1, 2, 3, 4, 5, 6] as const).map((pos) => ({
    pos,
    playerId: onCourt[pos] ?? null,
    player: onCourt[pos] ? playerMap.get(onCourt[pos]) ?? null : null,
  }));

  function resetState() {
    setPlayerOutId(null);
    setPlayerOutPos(null);
    setPlayerInId(null);
    setStep('selectOut');
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function handleSelectOut(playerId: string, pos: number) {
    setPlayerOutId(playerId);
    setPlayerOutPos(pos);
    setPlayerInId(null);
    setStep('selectIn');
  }

  function handleSelectIn(playerId: string) {
    setPlayerInId(playerId);
  }

  function handleConfirm() {
    if (!playerOutId || !playerInId || playerOutPos === null) return;
    const isLiberoSwap = libero?.liberoId === playerInId || libero?.liberoId === playerOutId;
    onConfirm({ playerOutId, playerInId, position: playerOutPos, isLibero: isLiberoSwap });
    resetState();
    onClose();
  }

  function getPlayerInError(playerId: string): string | null {
    if (!playerOutId || playerOutPos === null) return null;
    const isLiberoSub = libero?.liberoId === playerId;
    if (isLiberoSub) {
      const r = validateLiberoSubstitution(playerOutPos, format);
      if (!r.ok) return t(`substitution.libero.backRowOnly`);
      return null;
    }
    const r = validateSubstitution(playerOutId, playerId, pairs, subsUsed, config, format, mode);
    if (!r.ok) {
      if (r.error === 'max_reached') return t('substitution.maxReached');
      if (r.error === 'reciprocity_violation') return t('substitution.notEligible');
      if (r.error === 'not_eligible') return t('substitution.notEligible');
    }
    return null;
  }

  const canConfirm = playerOutId && playerInId && playerOutPos !== null
    && getPlayerInError(playerInId) === null;

  const isLiberoOnCourt = libero?.isOnCourt;
  const liberoPlayer = libero ? playerMap.get(libero.liberoId) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={subStyles.backdrop} onPress={handleClose} />
      <View style={subStyles.sheet}>
        {/* Header */}
        <View style={subStyles.header}>
          <View>
            <Text style={subStyles.title}>{t('substitution.title')}</Text>
            <Text style={subStyles.teamName}>{teamName}</Text>
          </View>
          <View style={subStyles.headerRight}>
            <Text style={subStyles.counter}>
              {maxSubs !== null
                ? t('substitution.counter', { used: subsUsed, max: maxSubs })
                : t('substitution.counterUnlimited', { used: subsUsed })}
            </Text>
            <InfoTooltip textKey="help.substitution" />
            <Pressable onPress={handleClose} style={subStyles.closeBtn} accessibilityRole="button">
              <X size={20} color={palette.textSecondary} />
            </Pressable>
          </View>
        </View>

        {format === 'beach_2v2' ? (
          <View style={subStyles.beachMsg}>
            <Text style={subStyles.beachMsgText}>{t('substitution.beach.noSubstitution')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={subStyles.body} showsVerticalScrollIndicator={false}>

            {/* Step hint */}
            <Text style={subStyles.stepHint}>
              {step === 'selectOut' ? t('substitution.selectOut') : t('substitution.selectIn')}
            </Text>

            {/* ── ON COURT ── */}
            <Text style={subStyles.sectionTitle}>{t('substitution.onCourt')}</Text>
            <View style={subStyles.courtGrid}>
              {courtPositions.map(({ pos, playerId, player }) => {
                if (!playerId || !player) return (
                  <View key={pos} style={[subStyles.slot, subStyles.slotEmpty]}>
                    <Text style={subStyles.slotPosLabel}>P{pos}</Text>
                  </View>
                );
                const isOut = playerOutId === playerId;
                const isLib = libero?.liberoId === playerId;
                const bgColor = isLib ? LIBERO_COLOR + '30' : teamColor + '20';
                const borderColor = isOut ? palette.error : isLib ? LIBERO_COLOR : teamColor;
                return (
                  <Pressable
                    key={pos}
                    style={[subStyles.slot, isLib && subStyles.slotLibero, { backgroundColor: bgColor, borderColor }]}
                    onPress={() => step === 'selectOut' && handleSelectOut(playerId, pos)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isOut }}
                  >
                    <Text style={subStyles.slotPosLabel}>P{pos}</Text>
                    <Text style={[subStyles.slotNum, { color: isLib ? LIBERO_COLOR : teamColor }]}>
                      {player.number}
                    </Text>
                    <Text style={subStyles.slotName} numberOfLines={1}>
                      {player.lastName ?? player.firstName ?? `#${player.number}`}
                    </Text>
                    {isOut && <View style={subStyles.outBadge}><Text style={subStyles.outBadgeText}>OUT</Text></View>}
                    {isLib && <View style={subStyles.liberoBadge}><Text style={subStyles.liberoBadgeText}>L</Text></View>}
                  </Pressable>
                );
              })}
            </View>

            {/* ── BENCH ── */}
            {step === 'selectIn' && (
              <>
                <Text style={[subStyles.sectionTitle, { marginTop: 16 }]}>{t('substitution.bench')}</Text>

                {/* Libero (special row if on bench) */}
                {liberoPlayer && !isLiberoOnCourt && (
                  <LiberoRow
                    player={liberoPlayer}
                    isSelected={playerInId === liberoPlayer.id}
                    error={playerOutPos !== null ? getPlayerInError(liberoPlayer.id) : null}
                    onPress={() => handleSelectIn(liberoPlayer.id)}
                  />
                )}

                {/* Normal bench players */}
                {bench
                  .filter((p) => p.id !== libero?.liberoId)
                  .map((p) => {
                    const err = getPlayerInError(p.id);
                    const isIn = playerInId === p.id;
                    return (
                      <BenchRow
                        key={p.id}
                        player={p}
                        teamColor={teamColor}
                        isSelected={isIn}
                        error={err}
                        onPress={err ? undefined : () => handleSelectIn(p.id)}
                      />
                    );
                  })}

                {bench.filter((p) => p.id !== libero?.liberoId).length === 0 && !liberoPlayer && (
                  <Text style={subStyles.emptyBench}>{t('team.noPlayers')}</Text>
                )}
              </>
            )}
          </ScrollView>
        )}

        {/* Confirm */}
        {canConfirm && (
          <Pressable
            style={({ pressed }) => [subStyles.confirmBtn, pressed && { opacity: 0.8 }]}
            onPress={handleConfirm}
            accessibilityRole="button"
          >
            <Text style={subStyles.confirmText}>{t('substitution.confirm')}</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

function LiberoRow({
  player, isSelected, error, onPress,
}: { player: Player; isSelected: boolean; error: string | null; onPress: () => void }) {
  return (
    <Pressable
      style={[subStyles.benchRow, isSelected && subStyles.benchRowSelected, !!error && subStyles.benchRowDisabled,
        { borderColor: isSelected ? LIBERO_COLOR : 'transparent', backgroundColor: LIBERO_COLOR + '15' }]}
      onPress={error ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
    >
      <View style={[subStyles.liberoTag]}>
        <Text style={subStyles.liberoTagText}>⚡ L</Text>
      </View>
      <Text style={[subStyles.benchNum, { color: LIBERO_COLOR }]}>#{player.number}</Text>
      <Text style={subStyles.benchName} numberOfLines={1}>
        {player.lastName ?? player.firstName ?? `#${player.number}`}
      </Text>
      {error && <Text style={subStyles.benchError} numberOfLines={1}>{error}</Text>}
    </Pressable>
  );
}

function BenchRow({
  player, teamColor, isSelected, error, onPress,
}: { player: Player; teamColor: string; isSelected: boolean; error: string | null; onPress?: () => void }) {
  return (
    <Pressable
      style={[subStyles.benchRow,
        isSelected && [subStyles.benchRowSelected, { borderColor: teamColor, backgroundColor: teamColor + '15' }],
        !!error && subStyles.benchRowDisabled]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected, disabled: !!error }}
    >
      <Text style={[subStyles.benchNum, { color: isSelected ? teamColor : palette.textSecondary }]}>
        #{player.number}
      </Text>
      <Text style={[subStyles.benchName, !!error && { color: palette.textMuted }]} numberOfLines={1}>
        {player.lastName ?? player.firstName ?? `#${player.number}`}
        {player.position === 'libero' ? ' ⚡' : ''}
      </Text>
      {error && <Text style={subStyles.benchError} numberOfLines={1}>{error}</Text>}
    </Pressable>
  );
}

const subStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: palette.backgroundSurface,
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
    borderBottomColor: palette.backgroundElevated,
  },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  teamName: { fontSize: 13, fontFamily: 'Inter_400Regular', color: palette.textSecondary, marginTop: 2 },
  headerRight: { alignItems: 'flex-end', gap: 6 },
  counter: { fontSize: 12, fontFamily: 'Inter_500Medium', color: palette.textMuted },
  closeBtn: { padding: 4 },
  beachMsg: { padding: 24, alignItems: 'center' },
  beachMsgText: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textMuted, textAlign: 'center' },
  body: { padding: 16, gap: 8 },
  stepHint: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  courtGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slot: {
    width: '30%',
    flexBasis: '30%',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 8,
    alignItems: 'center',
    gap: 2,
    minHeight: 72,
    justifyContent: 'center',
  },
  slotEmpty: {
    borderColor: palette.backgroundElevated,
    backgroundColor: palette.backgroundElevated,
  },
  slotLibero: {
    borderStyle: 'dashed',
  },
  liberoBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E63946',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liberoBadgeText: { fontSize: 8, fontFamily: 'Inter_700Bold', color: '#fff' },
  slotPosLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: palette.textMuted, letterSpacing: 0.5 },
  slotNum: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  slotName: { fontSize: 10, fontFamily: 'Inter_400Regular', color: palette.textSecondary, maxWidth: 80 },
  outBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: palette.error + '30',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  outBadgeText: { fontSize: 8, fontFamily: 'Inter_700Bold', color: palette.error },
  benchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: palette.backgroundElevated,
    borderWidth: 1.5,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  benchRowSelected: { backgroundColor: palette.accentPrimaryMuted },
  benchRowDisabled: { opacity: 0.4 },
  benchNum: { fontSize: 16, fontFamily: 'Inter_700Bold', width: 36 },
  benchName: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', color: palette.textPrimary },
  benchError: { fontSize: 11, fontFamily: 'Inter_400Regular', color: palette.error },
  liberoTag: {
    backgroundColor: LIBERO_COLOR + '30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liberoTagText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: LIBERO_COLOR },
  emptyBench: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textMuted, textAlign: 'center', paddingVertical: 16 },
  confirmBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: palette.accentPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
});
