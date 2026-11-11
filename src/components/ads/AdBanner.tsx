import { StyleSheet, View } from 'react-native';
import { getAdsModule, useAdsStore } from '../../features/ads/adsService';
import { IS_PRODUCTION_BUILD, resolveBannerUnitId } from '../../features/ads/adUnit';
import { useThemedStyles, type AppTheme } from '../../theme/useAppTheme';

// Real unit IDs come from EAS env vars (see ADMOB_IDS in src/utils/constants.ts).
interface AdBannerProps {
  unitId: string | undefined;
}

/** AdMob banner. Renders nothing until consent allows ads, nor in Expo Go. */
export function AdBanner({ unitId }: AdBannerProps) {
  const styles = useThemedStyles(makeStyles);
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

const makeStyles = (a: AppTheme) => StyleSheet.create({
  container: {
    backgroundColor: a.backgroundSurface,
    borderTopWidth: 1,
    borderTopColor: a.backgroundElevated,
    alignItems: 'center',
  },
});
