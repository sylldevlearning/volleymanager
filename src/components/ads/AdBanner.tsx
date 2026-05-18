import React from 'react';

// Dynamic require so the component silently does nothing on Expo Go
// (react-native-google-mobile-ads requires a native build).
let BannerAd: React.ComponentType<Record<string, unknown>> | null = null;
let BannerAdSize: Record<string, string> | null = null;
let TestIds: Record<string, string> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admob = require('react-native-google-mobile-ads');
  BannerAd = admob.BannerAd;
  BannerAdSize = admob.BannerAdSize;
  TestIds = admob.TestIds;
} catch {
  // Module unavailable (Expo Go) — ads will simply not render
}

interface AdBannerProps {
  unitId: string;
}

export function AdBanner({ unitId }: AdBannerProps) {
  if (!BannerAd || !BannerAdSize || !TestIds) return null;

  return (
    <BannerAd
      unitId={__DEV__ ? TestIds.BANNER : unitId}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      onAdFailedToLoad={(error: unknown) => {
        if (__DEV__) console.log('Ad failed to load:', error);
      }}
    />
  );
}
