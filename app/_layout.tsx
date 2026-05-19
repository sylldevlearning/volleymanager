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
import { seedDefaultDataIfEmpty } from '../src/services/seedService';
import i18n from '../src/i18n';

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
    }
  }, [loaded]);

  if (!loaded) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const theme = useSettingsStore((s) => s.theme);
  const language = useSettingsStore((s) => s.language);
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
  const segmentsRef = useRef(segments);

  useEffect(() => { segmentsRef.current = segments; }, [segments]);

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);

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
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="match/new" options={{ title: 'Nouveau match', presentation: 'modal' }} />
          <Stack.Screen name="match/[id]/lineup" options={{ headerShown: false }} />
          <Stack.Screen name="match/[id]/referee" options={{ headerShown: false }} />
          <Stack.Screen name="match/[id]/coach" options={{ headerShown: false }} />
          <Stack.Screen name="match/[id]/summary" options={{ title: 'Résumé' }} />
          <Stack.Screen name="match/[id]/stats" options={{ headerShown: false }} />
          <Stack.Screen name="match/[id]/player-stats/[playerId]" options={{ headerShown: false }} />
          <Stack.Screen name="player/[id]/stats" options={{ headerShown: false }} />
          <Stack.Screen name="team/new" options={{ title: 'Nouvelle équipe', presentation: 'modal' }} />
          <Stack.Screen name="team/[id]" options={{ title: 'Équipe' }} />
        </Stack>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}
