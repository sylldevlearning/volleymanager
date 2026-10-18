import { useCallback } from 'react';

// Intentionally a no-op: the app only shows banner ads (see AdBanner).
// SummaryScreen calls show() on mount; wire a real InterstitialAd here if
// interstitials are ever wanted.
export function useInterstitialAd() {
  const show = useCallback(() => {
    // no-op until native build
  }, []);

  return { show, loaded: false };
}
