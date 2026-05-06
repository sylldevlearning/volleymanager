import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AppTheme = 'dark' | 'light';
type AppLanguage = 'fr' | 'en';

interface SettingsState {
  theme: AppTheme;
  language: AppLanguage;
  hapticsEnabled: boolean;
  setTheme: (theme: AppTheme) => void;
  setLanguage: (lang: AppLanguage) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  toggleTheme: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      language: 'fr',
      hapticsEnabled: true,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
    }),
    {
      name: 'volleymanager-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
