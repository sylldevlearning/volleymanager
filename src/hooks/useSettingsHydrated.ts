import { useEffect, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * True once the persisted settings have been read back from AsyncStorage.
 * Help flags must not be trusted before that — they start at "unseen".
 */
export function useSettingsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useSettingsStore.persist.hasHydrated());

  useEffect(() => {
    if (hydrated) return;
    const unsub = useSettingsStore.persist.onFinishHydration(() => setHydrated(true));
    // Hydration may have finished between the initial render and this effect
    if (useSettingsStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, [hydrated]);

  return hydrated;
}
