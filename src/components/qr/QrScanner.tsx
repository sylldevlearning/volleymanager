import { useEffect, useRef } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScanQrCode } from 'lucide-react-native';
import { palette } from '../../theme/tokens';

interface QrScannerProps {
  /** Text over the camera */
  aim: string;
  /** Called once per scan; scanning resumes when `active` goes back to true */
  onScan: (data: string) => void;
  active: boolean;
}

/** Camera reading QR codes, with the permission request. The image is processed on the phone only. */
export function QrScanner({ aim, onScan, active }: QrScannerProps) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  // The camera reports the same code many times per second: read it once
  const lockRef = useRef(false);

  useEffect(() => {
    if (active) lockRef.current = false;
  }, [active]);

  if (!permission) return <View style={styles.flex} />;

  if (!permission.granted) {
    return (
      <View style={[styles.flex, styles.centered]}>
        <ScanQrCode size={48} color={palette.textSecondary} strokeWidth={1.5} />
        <Text style={styles.title}>{t('scan.permissionTitle')}</Text>
        <Text style={styles.text}>{t('scan.permissionText')}</Text>
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>{permission.canAskAgain ? t('scan.allow') : t('scan.openSettings')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <CameraView
        style={styles.flex}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (!active || lockRef.current) return;
          lockRef.current = true;
          onScan(data);
        }}
      />
      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.aim}>{aim}</Text>
      </View>
    </View>
  );
}

const FRAME = 240;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 20 },
  frame: { width: FRAME, height: FRAME, borderRadius: 20, borderWidth: 3, borderColor: '#fff' },
  aim: {
    fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff', textAlign: 'center',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', color: palette.textPrimary, textAlign: 'center' },
  text: { fontSize: 14, fontFamily: 'Inter_400Regular', color: palette.textSecondary, lineHeight: 20, textAlign: 'center' },
  primary: { backgroundColor: palette.accentPrimary, paddingVertical: 16, paddingHorizontal: 24, borderRadius: 14, alignItems: 'center', alignSelf: 'stretch' },
  primaryText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  pressed: { opacity: 0.85 },
});
