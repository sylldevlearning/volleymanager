import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TamaguiProvider } from 'tamagui';
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
      seedDefaultDataIfEmpty().catch(() => {});
    }
  }, [loaded]);

  if (!loaded) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const theme = useSettingsStore((s) => s.theme);
  const language = useSettingsStore((s) => s.language);

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="match/new" options={{ title: 'Nouveau match', presentation: 'modal' }} />
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
