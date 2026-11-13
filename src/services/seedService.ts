import { removeUntouchedLegacyTeams } from './legacySeedCleanup';
import { createSampleDataIfEmpty } from './sampleDataService';

/**
 * Data tasks run once the app has started: the teams of real players created
 * by older versions are removed when untouched and unused, then a fresh
 * install (nothing left) receives the sample data, once.
 */
export async function runStartupDataTasks(opts: { tournamentName: string }): Promise<void> {
  try {
    await removeUntouchedLegacyTeams();
  } catch (e) {
    console.error('[startup] legacy teams cleanup failed:', e);
  }
  try {
    await createSampleDataIfEmpty(opts);
  } catch (e) {
    console.error('[startup] sample data failed:', e);
  }
}
