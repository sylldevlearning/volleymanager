import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';
import { palette } from '../theme/tokens';

type StackScreenOptions = Exclude<ComponentProps<typeof Stack>['screenOptions'], (...args: never[]) => unknown> & object;

/** Root stack bar, in the app's dark theme — back arrow without "Retour" text on iOS */
export const darkHeaderOptions = {
  headerStyle: { backgroundColor: palette.background },
  headerTintColor: palette.textPrimary,
  headerTitleStyle: { fontFamily: 'Inter_700Bold', color: palette.textPrimary },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: palette.background },
} satisfies StackScreenOptions;

export interface ScreenHeader {
  /** Immersive screens keep their own buttons */
  hidden?: boolean;
  /** i18n key of the bar title */
  titleKey?: string;
  options?: StackScreenOptions;
}

/**
 * Header choice of every root stack screen. A screen missing here would show
 * Expo Router's default bar with its route as title (e.g. "arbitrage/new").
 */
export const SCREEN_HEADERS: Record<string, ScreenHeader> = {
  onboarding: { hidden: true, options: { presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' } },
  'arbitrage/new': { titleKey: 'nav.arbitrageSetup' },
  'match/new': { titleKey: 'nav.newMatch', options: { presentation: 'modal' } },
  'match/[id]/arbitrage': { hidden: true },
  'match/[id]/referee': { hidden: true },
  'match/[id]/lineup': { hidden: true },
  'match/[id]/coach': { hidden: true },
  'match/[id]/stats': { hidden: true },
  'match/[id]/player-stats/[playerId]': { hidden: true },
  'match/[id]/summary': { titleKey: 'nav.summary' },
  'player/[id]/stats': { hidden: true },
  'team/new': { titleKey: 'nav.newTeam', options: { presentation: 'modal' } },
  // The screen replaces it with the team name once loaded
  'team/[id]': { titleKey: 'nav.team' },
  about: { titleKey: 'nav.about' },
  '+not-found': { titleKey: 'nav.notFound' },
};
