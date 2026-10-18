/**
 * Real ads only in the EAS "production" profile (EXPO_PUBLIC_APP_ENV is set in
 * eas.json). Dev, preview and local builds always get test ads so testers'
 * clicks can't get the AdMob account banned.
 */
export const IS_PRODUCTION_BUILD =
  !__DEV__ && process.env.EXPO_PUBLIC_APP_ENV === 'production';

/** Picks the real banner unit ID in production, Google's test unit everywhere else. */
export function resolveBannerUnitId(
  realId: string | undefined,
  isProductionBuild: boolean,
  testId: string,
): string {
  return isProductionBuild && realId ? realId : testId;
}
