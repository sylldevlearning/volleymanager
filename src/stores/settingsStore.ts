import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AppTheme = 'dark' | 'light';
type AppLanguage = 'fr' | 'en';
/** Screens with first-use help bubbles */
export type HelpTipId = 'arbitrage' | 'tactical' | 'tournament';

interface SettingsState {
  theme: AppTheme;
  language: AppLanguage;
  hapticsEnabled: boolean;
  hasSeenOnboarding: boolean;
  seenTips: Partial<Record<HelpTipId, boolean>>;
  /** Store review prompt — see features/review/reviewPrompt.ts */
  finishedMatchCount: number;
  /** Last finished match ids, so a match is never counted twice */
  countedMatchIds: string[];
  /** Epoch ms of the first launch with this feature (install-date proxy) */
  firstLaunchAt: number | null;
  hasRequestedReview: boolean;
  setTheme: (theme: AppTheme) => void;
  setLanguage: (lang: AppLanguage) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  toggleTheme: () => void;
  markOnboardingSeen: () => void;
  markTipSeen: (id: HelpTipId) => void;
  /** "Revoir l'aide" — shows the onboarding and every help bubble again */
  resetHelp: () => void;
  recordMatchFinished: (matchId: string) => void;
  ensureFirstLaunchAt: (now: number) => void;
  markReviewRequested: () => void;
}

const COUNTED_MATCH_IDS_MAX = 20;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      language: 'fr',
      hapticsEnabled: true,
      hasSeenOnboarding: false,
      seenTips: {},
      finishedMatchCount: 0,
      countedMatchIds: [],
      firstLaunchAt: null,
      hasRequestedReview: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      markOnboardingSeen: () => set({ hasSeenOnboarding: true }),
      markTipSeen: (id) => set({ seenTips: { ...get().seenTips, [id]: true } }),
      resetHelp: () => set({ hasSeenOnboarding: false, seenTips: {} }),
      recordMatchFinished: (matchId) => {
        const { countedMatchIds, finishedMatchCount } = get();
        if (countedMatchIds.includes(matchId)) return;
        set({
          finishedMatchCount: finishedMatchCount + 1,
          countedMatchIds: [...countedMatchIds, matchId].slice(-COUNTED_MATCH_IDS_MAX),
        });
      },
      ensureFirstLaunchAt: (now) => {
        if (get().firstLaunchAt === null) set({ firstLaunchAt: now });
      },
      markReviewRequested: () => set({ hasRequestedReview: true }),
    }),
    {
      name: 'volleymanager-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
