import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { Alert, BackHandler } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TamaguiProvider } from 'tamagui';
import { useTranslation } from 'react-i18next';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import tamaguiConfig from '../tamagui.config';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useSettingsHydrated } from '../src/hooks/useSettingsHydrated';
import { seedDefaultDataIfEmpty } from '../src/services/seedService';
import { initAds } from '../src/features/ads/adsService';
import i18n from '../src/i18n';
import { useLocales } from 'expo-localization';
import { resolveLanguage } from '../src/i18n/languages';
import { SCREEN_HEADERS, darkHeaderOptions } from '../src/navigation/screenHeaders';

SplashScreen.preventAutoHideAsync();

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
      seedDefaultDataIfEmpty().catch(console.error);
      // After the splash screen: the GDPR consent form may need to show.
      initAds();
    }
  }, [loaded]);

  if (!loaded) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const theme = useSettingsStore((s) => s.theme);
  const language = useSettingsStore((s) => s.language);
  const hasSeenOnboarding = useSettingsStore((s) => s.hasSeenOnboarding);
  const settingsHydrated = useSettingsHydrated();
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
  const segmentsRef = useRef(segments);

  useEffect(() => { segmentsRef.current = segments; }, [segments]);

  const phoneLocales = useLocales();
  useEffect(() => {
    i18n.changeLanguage(resolveLanguage(language, phoneLocales));
  }, [language, phoneLocales]);

  // First launch, or "Revoir l'aide" in Settings → show the presentation.
  // Wait for AsyncStorage: before hydration the flag always reads "unseen".
  useEffect(() => {
    if (settingsHydrated) useSettingsStore.getState().ensureFirstLaunchAt(Date.now());
    if (!settingsHydrated || hasSeenOnboarding) return;
    if ((segmentsRef.current as string[])[0] === 'onboarding') return;
    router.push('/onboarding' as never);
  }, [settingsHydrated, hasSeenOnboarding]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      const segs = segmentsRef.current as string[];

      // In a live match referee screen → require explicit quit confirmation
      if (segs.includes('referee')) {
        Alert.alert(t('home.quitMatch'), '', [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('home.backToMenu'), style: 'destructive', onPress: () => router.replace('/') },
        ]);
        return true;
      }

      // At root tabs → block the system back (don't exit the app)
      if (segs.length <= 1 || segs[0] === '(tabs)') return true;

      // Everywhere else → standard back navigation
      router.back();
      return true;
    });
    return () => handler.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
        <Stack screenOptions={darkHeaderOptions}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {Object.entries(SCREEN_HEADERS).map(([name, header]) => (
            <Stack.Screen
              key={name}
              name={name}
              options={{
                ...header.options,
                ...(header.hidden ? { headerShown: false } : { title: t(header.titleKey!) }),
              }}
            />
          ))}
        </Stack>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}
