import { create } from 'zustand';

type AdsModule = typeof import('react-native-google-mobile-ads');

// Dynamic require — react-native-google-mobile-ads needs a native build.
// On Expo Go / web / Jest the module is unavailable: no ads, no crash.
let adsModule: AdsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  adsModule = require('react-native-google-mobile-ads');
} catch {
  // Native module unavailable
}

export function getAdsModule(): AdsModule | null {
  return adsModule;
}

interface AdsState {
  /** True once consent allows ad requests and the SDK is initialized. */
  canShowAds: boolean;
}

export const useAdsStore = create<AdsState>(() => ({ canShowAds: false }));

let started = false;

/**
 * GDPR: asks Google's UMP SDK for consent (it shows the form only when needed,
 * e.g. first launch in the EEA, and stores the choice itself), then initializes
 * the SDK only if ads may be requested. A failed update falls back to the
 * stored choice. Safe to call more than once.
 */
export async function initAds(): Promise<void> {
  if (!adsModule || started) return;
  started = true;

  try {
    await adsModule.AdsConsent.gatherConsent();
  } catch (e) {
    if (__DEV__) console.warn('Ads consent error:', e);
  }

  let canRequestAds = false;
  try {
    const info = await adsModule.AdsConsent.getConsentInfo();
    canRequestAds = info.canRequestAds === true;
  } catch {
    // Unknown consent state → no ads
  }
  if (!canRequestAds) return;

  try {
    await adsModule.default().initialize();
  } catch (e) {
    if (__DEV__) console.warn('MobileAds init error:', e);
  }
  useAdsStore.setState({ canShowAds: true });
}
