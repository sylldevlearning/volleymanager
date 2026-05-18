import { useState, useEffect, useCallback } from 'react';
import { ADMOB_IDS } from '../../utils/constants';

// Dynamic require — silently no-ops on Expo Go
let InterstitialAd: { createForAdRequest: (id: string) => InterstitialInstance } | null = null;
let AdEventType: Record<string, string> | null = null;
let TestIds: Record<string, string> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admob = require('react-native-google-mobile-ads');
  InterstitialAd = admob.InterstitialAd;
  AdEventType = admob.AdEventType;
  TestIds = admob.TestIds;
} catch {
  // Module unavailable (Expo Go)
}

interface InterstitialInstance {
  addAdEventListener: (event: string, handler: () => void) => () => void;
  load: () => void;
  show: () => void;
}

let interstitial: InterstitialInstance | null = null;
if (InterstitialAd && TestIds) {
  const adUnitId = __DEV__
    ? TestIds.INTERSTITIAL
    : ADMOB_IDS.INTERSTITIAL_POST_MATCH;
  interstitial = InterstitialAd.createForAdRequest(adUnitId);
}

export function useInterstitialAd() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!interstitial || !AdEventType) return;

    const unsubLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      setLoaded(true);
    });
    const unsubClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setLoaded(false);
      interstitial!.load();
    });

    interstitial.load();

    return () => {
      unsubLoaded();
      unsubClosed();
    };
  }, []);

  const show = useCallback(() => {
    if (loaded && interstitial) {
      interstitial.show();
    }
  }, [loaded]);

  return { show, loaded };
}
