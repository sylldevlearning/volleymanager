import { removeUntouchedLegacyTeams } from './legacySeedCleanup';

/**
 * Data tasks run once the app has started: the teams of real players created
 * by older versions are removed when untouched and unused.
 */
export async function runStartupDataTasks(): Promise<void> {
  try {
    await removeUntouchedLegacyTeams();
  } catch (e) {
    console.error('[startup] legacy teams cleanup failed:', e);
  }
}
