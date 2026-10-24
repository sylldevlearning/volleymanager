import * as StoreReview from 'expo-store-review';
import { useSettingsStore } from '../../stores/settingsStore';

export const REVIEW_MIN_FINISHED_MATCHES = 3;
export const REVIEW_MIN_DAYS_SINCE_INSTALL = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReviewEligibility {
  finishedMatchCount: number;
  firstLaunchAt: number | null;
  hasRequestedReview: boolean;
  now: number;
}

/** 3rd finished match or later, ≥ 3 days after install, never asked before. */
export function shouldRequestReview({
  finishedMatchCount,
  firstLaunchAt,
  hasRequestedReview,
  now,
}: ReviewEligibility): boolean {
  if (hasRequestedReview || firstLaunchAt === null) return false;
  if (finishedMatchCount < REVIEW_MIN_FINISHED_MATCHES) return false;
  return now - firstLaunchAt >= REVIEW_MIN_DAYS_SINCE_INSTALL * DAY_MS;
}

/**
 * Shows Google's in-app review dialog directly — no "Do you like the app?"
 * pre-prompt (forbidden by Google Play). Called only on the summary screen right
 * after a match ends, never during a match. Asked once: the flag is set before
 * the call, so a failure or a dismissed dialog is never retried.
 * Returns true when the dialog was requested.
 */
export async function maybeRequestReview(now: number = Date.now()): Promise<boolean> {
  const state = useSettingsStore.getState();
  if (!shouldRequestReview({ ...state, now })) return false;

  try {
    if (!(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) return false;
  } catch {
    return false;
  }

  state.markReviewRequested();
  try {
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
