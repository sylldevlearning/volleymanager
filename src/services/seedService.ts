import { removeLegacyTeamsOnce } from './legacySeedCleanup';
import { createSampleDataIfEmpty, type SampleTexts } from './sampleDataService';

/**
 * Data tasks run once the app has started: the teams of real players created
 * by older versions are removed (once, in every case), then a fresh
 * install (nothing left) receives the sample data, once.
 */
export async function runStartupDataTasks(opts: SampleTexts): Promise<void> {
  try {
    await removeLegacyTeamsOnce();
  } catch (e) {
    console.error('[startup] legacy teams cleanup failed:', e);
  }
  try {
    await createSampleDataIfEmpty(opts);
  } catch (e) {
    console.error('[startup] sample data failed:', e);
  }
}
