import { useCallback } from 'react';

// Stub — real interstitial via react-native-google-mobile-ads
// will be wired at EAS Build time (requires native build, not Expo Go).
// SummaryScreen already calls show() on mount; it will fire once the
// real SDK is integrated.
export function useInterstitialAd() {
  const show = useCallback(() => {
    // no-op until native build
  }, []);

  return { show, loaded: false };
}
