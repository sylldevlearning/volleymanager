import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { captureRef } from 'react-native-view-shot';
import { Share2 } from 'lucide-react-native';
import { palette } from '../../../src/theme/tokens';
import { Chip } from '../../../src/components/tournament/WizardSteps';
import { ExportView } from '../../../src/components/tournament/ExportView';
import { getTournamentBundle, type TournamentBundle } from '../../../src/services/tournamentService';
import {
  buildExportDoc,
  exportFileName,
  exportHtml,
  exportOptions,
  imageExportSize,
  type ExportContent,
  type ExportFormat,
} from '../../../src/features/tournament/exportDoc';

/** Gives the shared file a readable name (mail attachment, Drive…). */
async function renamed(uri: string, name: string): Promise<string> {
  const target = new File(Paths.cache, name);
  if (target.exists) target.delete();
  await new File(uri).move(target);
  return target.uri;
}

/** Export of the tournament: content and format, then the phone's share sheet. */
export default function TournamentExportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [bundle, setBundle] = useState<TournamentBundle | null>(null);
  const [content, setContent] = useState<ExportContent>('planning');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [busy, setBusy] = useState(false);
  const previewRef = useRef<ScrollView>(null);
  // Preview size (dp): the image keeps its proportions at a fixed width, and is refused when too tall
  const [previewSize, setContentSize] = useState({ w: 0, h: 0 });
  const size = imageExportSize(previewSize.w, previewSize.h);
  const imageTooTall = format === 'png' && previewSize.h > 0 && size === null;

  useEffect(() => {
    getTournamentBundle(id).then(setBundle);
  }, [id]);

  const options = useMemo(() => (bundle ? exportOptions(bundle, t) : []), [bundle, t]);
  const doc = useMemo(() => (bundle ? buildExportDoc(bundle, content, t, lang) : null), [bundle, content, t, lang]);

  async function share() {
    if (!bundle || !doc || busy) return;
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t('common.error'), t('tournament.export.unavailable'));
        return;
      }
      const name = exportFileName(bundle, content, t, format);
      let uri: string;
      if (format === 'pdf') {
        // A4 in points
        const printed = await Print.printToFileAsync({ html: exportHtml(doc, lang), width: 595, height: 842 });
        uri = await renamed(printed.uri, name);
      } else {
        if (!size) return;
        const shot = await captureRef(previewRef, {
          format: 'png', quality: 1, result: 'tmpfile', snapshotContentContainer: true,
          width: size.width, height: size.height,
        });
        uri = await renamed(shot, name);
      }
      // The system share sheet: the user picks e-mail, Drive, Quick Share…
      await Sharing.shareAsync(uri, {
        mimeType: format === 'pdf' ? 'application/pdf' : 'image/png',
        UTI: format === 'pdf' ? 'com.adobe.pdf' : 'public.png',
        dialogTitle: name,
      });
    } catch {
      Alert.alert(t('common.error'), t('tournament.export.error'));
    } finally {
      setBusy(false);
    }
  }

  if (!bundle || !doc) return <SafeAreaView style={styles.container} edges={['bottom']} />;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.choices}>
        <Text style={styles.label}>{t('tournament.export.content')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {options.map((o) => <Chip key={o.id} label={o.label} active={content === o.id} onPress={() => setContent(o.id)} />)}
        </ScrollView>
        <Text style={styles.label}>{t('tournament.export.format')}</Text>
        <View style={styles.chips}>
          <Chip label={t('tournament.export.pdf')} active={format === 'pdf'} onPress={() => setFormat('pdf')} />
          <Chip label={t('tournament.export.image')} active={format === 'png'} onPress={() => setFormat('png')} />
        </View>
        <Text style={styles.hint}>{t('tournament.export.hint')}</Text>
        {imageTooTall && <Text style={styles.warning}>{t('tournament.export.imageTooTall')}</Text>}
      </View>

      {/* Preview — also the image that is shared */}
      <ScrollView
        ref={previewRef}
        style={styles.preview}
        contentContainerStyle={styles.previewContent}
        onContentSizeChange={(w, h) => setContentSize({ w, h })}
      >
        <ExportView doc={doc} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.pressed, (busy || imageTooTall) && styles.disabled]}
          onPress={share}
          disabled={busy || imageTooTall}
          accessibilityRole="button"
        >
          {busy ? (
            <>
              <ActivityIndicator color="#fff" />
              <Text style={styles.primaryText}>{t('tournament.export.preparing')}</Text>
            </>
          ) : (
            <>
              <Share2 size={18} color="#fff" />
              <Text style={styles.primaryText}>{t('tournament.export.share')}</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  choices: { padding: 16, paddingBottom: 8, gap: 8 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: palette.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontSize: 13, fontFamily: 'Inter_400Regular', color: palette.textSecondary, lineHeight: 18 },
  warning: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: palette.warning, lineHeight: 18 },
  preview: { flex: 1, marginHorizontal: 16, borderRadius: 12, backgroundColor: '#FFFFFF' },
  previewContent: { backgroundColor: '#FFFFFF' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: palette.backgroundElevated },
  primary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: palette.accentPrimary, paddingVertical: 16, borderRadius: 14,
  },
  primaryText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
