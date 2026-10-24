import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AppTheme = 'dark' | 'light';
type AppLanguage = 'fr' | 'en';
/** Screens with first-use help bubbles */
export type HelpTipId = 'arbitrage' | 'tactical';

interface SettingsState {
  theme: AppTheme;
  language: AppLanguage;
  hapticsEnabled: boolean;
  hasSeenOnboarding: boolean;
  seenTips: Partial<Record<HelpTipId, boolean>>;
  setTheme: (theme: AppTheme) => void;
  setLanguage: (lang: AppLanguage) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  toggleTheme: () => void;
  markOnboardingSeen: () => void;
  markTipSeen: (id: HelpTipId) => void;
  /** "Revoir l'aide" — shows the onboarding and every help bubble again */
  resetHelp: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      language: 'fr',
      hapticsEnabled: true,
      hasSeenOnboarding: false,
      seenTips: {},
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      markOnboardingSeen: () => set({ hasSeenOnboarding: true }),
      markTipSeen: (id) => set({ seenTips: { ...get().seenTips, [id]: true } }),
      resetHelp: () => set({ hasSeenOnboarding: false, seenTips: {} }),
    }),
    {
      name: 'volleymanager-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
