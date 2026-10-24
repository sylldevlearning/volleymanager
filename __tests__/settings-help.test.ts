import { act } from '@testing-library/react-native';
import { useSettingsStore } from '../src/stores/settingsStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('settingsStore — help flags', () => {
  beforeEach(() => {
    act(() => useSettingsStore.getState().resetHelp());
  });

  it('starts with the onboarding and every tip unseen', () => {
    const s = useSettingsStore.getState();
    expect(s.hasSeenOnboarding).toBe(false);
    expect(s.seenTips).toEqual({});
  });

  it('markOnboardingSeen flags the onboarding', () => {
    act(() => useSettingsStore.getState().markOnboardingSeen());
    expect(useSettingsStore.getState().hasSeenOnboarding).toBe(true);
  });

  it('markTipSeen flags only that screen', () => {
    act(() => useSettingsStore.getState().markTipSeen('arbitrage'));
    expect(useSettingsStore.getState().seenTips).toEqual({ arbitrage: true });
  });

  it('resetHelp clears the onboarding AND the tips', () => {
    act(() => {
      useSettingsStore.getState().markOnboardingSeen();
      useSettingsStore.getState().markTipSeen('arbitrage');
      useSettingsStore.getState().markTipSeen('tactical');
      useSettingsStore.getState().resetHelp();
    });
    const s = useSettingsStore.getState();
    expect(s.hasSeenOnboarding).toBe(false);
    expect(s.seenTips).toEqual({});
  });

  it('resetHelp keeps the other settings', () => {
    act(() => {
      useSettingsStore.getState().setHapticsEnabled(false);
      useSettingsStore.getState().resetHelp();
    });
    expect(useSettingsStore.getState().hapticsEnabled).toBe(false);
  });
});
