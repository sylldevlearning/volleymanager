import { act } from '@testing-library/react-native';
import * as StoreReview from 'expo-store-review';
import {
  shouldRequestReview,
  maybeRequestReview,
  REVIEW_MIN_FINISHED_MATCHES,
  REVIEW_MIN_DAYS_SINCE_INSTALL,
} from '../src/features/review/reviewPrompt';
import { useSettingsStore } from '../src/stores/settingsStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(),
  hasAction: jest.fn(),
  requestReview: jest.fn(),
}));

const mocked = StoreReview as jest.Mocked<typeof StoreReview>;
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 24, 12);

const eligible = {
  finishedMatchCount: 3,
  firstLaunchAt: NOW - 3 * DAY,
  hasRequestedReview: false,
  now: NOW,
};

describe('shouldRequestReview', () => {
  it('uses the agreed thresholds', () => {
    expect(REVIEW_MIN_FINISHED_MATCHES).toBe(3);
    expect(REVIEW_MIN_DAYS_SINCE_INSTALL).toBe(3);
  });

  it('asks after the 3rd finished match, 3 days after install', () => {
    expect(shouldRequestReview(eligible)).toBe(true);
  });

  it('does not ask before the 3rd finished match', () => {
    expect(shouldRequestReview({ ...eligible, finishedMatchCount: 2 })).toBe(false);
  });

  it('still asks on a later match if the 3rd one came too early', () => {
    expect(shouldRequestReview({ ...eligible, finishedMatchCount: 5 })).toBe(true);
  });

  it('does not ask less than 3 days after install', () => {
    expect(shouldRequestReview({ ...eligible, firstLaunchAt: NOW - 3 * DAY + 1 })).toBe(false);
  });

  it('does not ask when the install date is unknown', () => {
    expect(shouldRequestReview({ ...eligible, firstLaunchAt: null })).toBe(false);
  });

  it('never asks twice', () => {
    expect(shouldRequestReview({ ...eligible, hasRequestedReview: true })).toBe(false);
  });
});

describe('settingsStore — review counters', () => {
  beforeEach(() => {
    act(() => useSettingsStore.setState({ finishedMatchCount: 0, firstLaunchAt: null, hasRequestedReview: false }));
  });

  it('recordMatchFinished counts each finished match once', () => {
    act(() => {
      useSettingsStore.getState().recordMatchFinished('m1');
      useSettingsStore.getState().recordMatchFinished('m1');
      useSettingsStore.getState().recordMatchFinished('m2');
    });
    expect(useSettingsStore.getState().finishedMatchCount).toBe(2);
  });

  it('ensureFirstLaunchAt only sets the date once', () => {
    act(() => useSettingsStore.getState().ensureFirstLaunchAt(1000));
    act(() => useSettingsStore.getState().ensureFirstLaunchAt(5000));
    expect(useSettingsStore.getState().firstLaunchAt).toBe(1000);
  });

  it('resetHelp does not reset the review state', () => {
    act(() => {
      useSettingsStore.setState({ finishedMatchCount: 4, firstLaunchAt: 1, hasRequestedReview: true });
      useSettingsStore.getState().resetHelp();
    });
    const s = useSettingsStore.getState();
    expect([s.finishedMatchCount, s.firstLaunchAt, s.hasRequestedReview]).toEqual([4, 1, true]);
  });
});

describe('maybeRequestReview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mocked.isAvailableAsync.mockResolvedValue(true);
    mocked.hasAction.mockResolvedValue(true);
    mocked.requestReview.mockResolvedValue(undefined);
    act(() => useSettingsStore.setState({
      finishedMatchCount: 3,
      firstLaunchAt: NOW - 4 * DAY,
      hasRequestedReview: false,
    }));
  });

  it('shows the native Google dialog once, then never again', async () => {
    expect(await maybeRequestReview(NOW)).toBe(true);
    expect(await maybeRequestReview(NOW)).toBe(false);
    expect(mocked.requestReview).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState().hasRequestedReview).toBe(true);
  });

  it('does nothing when not eligible', async () => {
    act(() => useSettingsStore.setState({ finishedMatchCount: 2 }));
    expect(await maybeRequestReview(NOW)).toBe(false);
    expect(mocked.isAvailableAsync).not.toHaveBeenCalled();
    expect(mocked.requestReview).not.toHaveBeenCalled();
  });

  it('keeps the request for later when the store review API is unavailable', async () => {
    mocked.hasAction.mockResolvedValue(false);
    expect(await maybeRequestReview(NOW)).toBe(false);
    expect(mocked.requestReview).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().hasRequestedReview).toBe(false);
  });

  it('marks the request as done even if the dialog call fails (never retried)', async () => {
    mocked.requestReview.mockRejectedValue(new Error('quota'));
    expect(await maybeRequestReview(NOW)).toBe(false);
    expect(useSettingsStore.getState().hasRequestedReview).toBe(true);
  });
});
