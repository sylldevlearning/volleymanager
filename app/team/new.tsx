import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createTeam } from '../../src/services/teamService';
import { palette } from '../../src/theme/tokens';

const PRESET_COLORS = [
  '#1D4ED8', '#E63946', '#2EA043', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

export default function NewTeamScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('team.nameRequired'));
      return;
    }
    setLoading(true);
    try {
      const team = await createTeam({
        name: name.trim(),
        shortName: shortName.trim() || null,
        logoUri: null,
        color,
      });
      router.replace(`/team/${team.id}`);
    } catch (e) {
      Alert.alert(t('common.error'), String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormField label={t('team.name')} required>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ex: Volley Club Paris"
            placeholderTextColor={palette.textMuted}
            maxLength={60}
            autoFocus
            accessibilityLabel={t('team.name')}
          />
        </FormField>

        <FormField label={t('team.shortName')}>
          <TextInput
            style={styles.input}
            value={shortName}
            onChangeText={setShortName}
            placeholder="Ex: VCP"
            placeholderTextColor={palette.textMuted}
            maxLength={6}
            autoCapitalize="characters"
            accessibilityLabel={t('team.shortName')}
          />
        </FormField>

        <FormField label={t('team.color')}>
          <View style={styles.colorGrid}>
            {PRESET_COLORS.map((c) => (
              <Pressable
                key={c}
                style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSwatchActive]}
                onPress={() => setColor(c)}
                accessibilityLabel={c}
                accessibilityRole="radio"
                accessibilityState={{ selected: color === c }}
              />
            ))}
          </View>
        </FormField>

        <Pressable
          style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
          accessibilityLabel={t('common.save')}
          accessibilityRole="button"
        >
          <Text style={styles.saveButtonText}>
            {loading ? t('common.loading') : t('common.save')}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 20, gap: 0, paddingBottom: 40 },
  field: { marginBottom: 20 },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: palette.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  required: { color: palette.accentPrimary },
  input: {
    backgroundColor: palette.backgroundSurface,
    borderWidth: 1,
    borderColor: palette.backgroundElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: palette.textPrimary,
  },
  colorGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: palette.textPrimary,
    transform: [{ scale: 1.1 }],
  },
  saveButton: {
    backgroundColor: palette.accentPrimary,
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonPressed: { opacity: 0.85 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
});
