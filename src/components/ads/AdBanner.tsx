import { StyleSheet, Text, View } from 'react-native';
import { palette } from '../../theme/tokens';

// Placeholder — real AdMob integration via react-native-google-mobile-ads
// will be added at EAS Build time (requires native build, not Expo Go).
// Unit IDs are defined in src/utils/constants.ts (ADMOB_IDS).
interface AdBannerProps {
  unitId: string;
}

export function AdBanner({ unitId: _unitId }: AdBannerProps) {
  return (
    <View style={styles.container} accessibilityLabel="Advertisement">
      <Text style={styles.label}>Publicité</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 50,
    backgroundColor: palette.backgroundSurface,
    borderTopWidth: 1,
    borderTopColor: palette.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: palette.textMuted,
  },
});
