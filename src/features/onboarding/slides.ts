export type OnboardingSlideId = 'quickMatch' | 'arbitrage' | 'tournament' | 'tactical' | 'teams';

export interface OnboardingSlide {
  id: OnboardingSlideId;
  titleKey: string;
  bodyKey: string;
}

/** First-launch presentation — 5 pages, replayable from Settings */
export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  { id: 'quickMatch', titleKey: 'onboarding.quickMatch.title', bodyKey: 'onboarding.quickMatch.body' },
  { id: 'arbitrage', titleKey: 'onboarding.arbitrage.title', bodyKey: 'onboarding.arbitrage.body' },
  { id: 'tournament', titleKey: 'onboarding.tournament.title', bodyKey: 'onboarding.tournament.body' },
  { id: 'tactical', titleKey: 'onboarding.tactical.title', bodyKey: 'onboarding.tactical.body' },
  { id: 'teams', titleKey: 'onboarding.teams.title', bodyKey: 'onboarding.teams.body' },
];
