import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LanguagePreference } from '../i18n/languages';
import { isAppearance, type Appearance } from '../theme/colors';

/** Screens with first-use help bubbles */
export type HelpTipId = 'arbitrage' | 'tactical' | 'tournament';

interface SettingsState {
  /** Settings › Appearance: 'system' (Automatique) follows the phone */
  appearance: Appearance;
  /** 'system' follows the phone */
  language: LanguagePreference;
  hapticsEnabled: boolean;
  /** E-mail of the Google account used for the Drive backup (shown in Settings), null = not signed in */
  driveAccount: string | null;
  hasSeenOnboarding: boolean;
  seenTips: Partial<Record<HelpTipId, boolean>>;
  /** Store review prompt — see features/review/reviewPrompt.ts */
  finishedMatchCount: number;
  /** Last finished match ids, so a match is never counted twice */
  countedMatchIds: string[];
  /** Epoch ms of the first launch with this feature (install-date proxy) */
  firstLaunchAt: number | null;
  hasRequestedReview: boolean;
  setAppearance: (appearance: Appearance) => void;
  setLanguage: (lang: LanguagePreference) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setDriveAccount: (account: string | null) => void;
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
      appearance: 'system',
      language: 'system',
      hapticsEnabled: true,
      driveAccount: null,
      hasSeenOnboarding: false,
      seenTips: {},
      finishedMatchCount: 0,
      countedMatchIds: [],
      firstLaunchAt: null,
      hasRequestedReview: false,
      setAppearance: (appearance) => set({ appearance }),
      setLanguage: (language) => set({ language }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setDriveAccount: (driveAccount) => set({ driveAccount }),
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
      version: 1,
      migrate: (persisted, version) => migrateSettings(persisted, version) as SettingsState,
      // Settings saved before 1.2.0 have no appearance (and an unused theme field): Automatique.
      // An unknown value goes back to Automatique too.
      merge: (persisted, current) => {
        const { theme: _theme, accentColor: _accent, ...saved } =
          (persisted ?? {}) as Partial<SettingsState> & { theme?: unknown; accentColor?: unknown };
        return {
          ...current,
          ...saved,
          appearance: isAppearance(saved.appearance) ? saved.appearance : current.appearance,
        };
      },
    }
  )
);

/**
 * v0 → v1: French was the default, not always a choice. It now follows the
 * phone (a French phone stays in French); English stays a manual choice.
 */
export function migrateSettings(persisted: unknown, version: number): unknown {
  if (version < 1 && persisted && typeof persisted === 'object') {
    const state = persisted as { language?: string };
    if (state.language === 'fr' || state.language === undefined) return { ...state, language: 'system' };
  }
  return persisted;
}
