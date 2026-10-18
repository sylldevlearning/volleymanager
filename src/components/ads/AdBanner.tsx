import { StyleSheet, View } from 'react-native';
import { palette } from '../../theme/tokens';
import { getAdsModule, useAdsStore } from '../../features/ads/adsService';
import { IS_PRODUCTION_BUILD, resolveBannerUnitId } from '../../features/ads/adUnit';

// Real unit IDs come from EAS env vars (see ADMOB_IDS in src/utils/constants.ts).
interface AdBannerProps {
  unitId: string | undefined;
}

/** AdMob banner. Renders nothing until consent allows ads, nor in Expo Go. */
export function AdBanner({ unitId }: AdBannerProps) {
  const canShowAds = useAdsStore((s) => s.canShowAds);
  const ads = getAdsModule();
  if (!canShowAds || !ads) return null;

  return (
    <View style={styles.container} accessibilityLabel="Advertisement">
      <ads.BannerAd
        unitId={resolveBannerUnitId(unitId, IS_PRODUCTION_BUILD, ads.TestIds.BANNER)}
        size={ads.BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.backgroundSurface,
    borderTopWidth: 1,
    borderTopColor: palette.backgroundElevated,
    alignItems: 'center',
  },
});
