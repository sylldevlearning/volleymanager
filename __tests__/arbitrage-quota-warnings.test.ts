import fs from 'fs';
import path from 'path';
import i18n from 'i18next';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';
import { timeoutWarning, substitutionWarning } from '../src/features/match/quotaWarnings';
import { DEFAULT_INDOOR_CONFIG, type MatchConfig } from '../src/models/match';

const config: MatchConfig = {
  ...DEFAULT_INDOOR_CONFIG,
  timeoutsPerSet: 2, unlimitedTimeouts: false,
  substitutionsPerSet: 6, unlimitedSubstitutions: false,
};

describe('timeoutWarning', () => {
  it('after the 1st timeout: one left', () => {
    expect(timeoutWarning(1, config)).toBe('arbitrage.warn.lastTimeout');
  });
  it('after the 2nd: none left this set', () => {
    expect(timeoutWarning(2, config)).toBe('arbitrage.warn.noTimeout');
  });
  it('follows the configured number of timeouts', () => {
    expect(timeoutWarning(1, { ...config, timeoutsPerSet: 3 })).toBeNull();
    expect(timeoutWarning(2, { ...config, timeoutsPerSet: 3 })).toBe('arbitrage.warn.lastTimeout');
  });
  it('says nothing with unlimited timeouts', () => {
    expect(timeoutWarning(2, { ...config, unlimitedTimeouts: true })).toBeNull();
    expect(timeoutWarning(2, { ...config, timeoutsPerSet: null })).toBeNull();
  });
});

describe('substitutionWarning', () => {
  it('says nothing before the 5th', () => {
    for (const n of [1, 2, 3, 4]) expect(substitutionWarning(n, config)).toBeNull();
  });
  it('after the 5th: one left; after the 6th: quota reached', () => {
    expect(substitutionWarning(5, config)).toBe('arbitrage.warn.lastSub');
    expect(substitutionWarning(6, config)).toBe('arbitrage.warn.subQuota');
  });
  it('says nothing with unlimited substitutions', () => {
    expect(substitutionWarning(6, { ...config, unlimitedSubstitutions: true })).toBeNull();
  });
});

describe('warning texts', () => {
  it('reads like the agreed French wording', async () => {
    const t = i18n.createInstance();
    await t.init({ lng: 'fr', resources: { fr: { translation: fr } } });
    expect(t.t('arbitrage.warn.lastTimeout', { team: 'Lyon' })).toBe('Plus qu\'un temps mort pour Lyon');
    expect(t.t('arbitrage.warn.noTimeout', { team: 'Lyon' })).toBe('Plus de temps mort pour Lyon dans ce set');
    expect(t.t('arbitrage.warn.lastSub', { team: 'Lyon' })).toBe('Plus qu\'un remplacement pour Lyon');
    expect(t.t('arbitrage.warn.subQuota', { team: 'Lyon' })).toBe('Quota de remplacements atteint pour Lyon');
  });

  it('exists in English too', () => {
    const warn = (en.arbitrage as Record<string, unknown>).warn as Record<string, string>;
    for (const k of ['lastTimeout', 'noTimeout', 'lastSub', 'subQuota']) expect(warn[k]).toContain('{{team}}');
  });
});

describe('arbitrage screen wiring', () => {
  const screen = fs.readFileSync(path.join(__dirname, '../app/match/[id]/arbitrage.tsx'), 'utf8');

  it('shows the warnings in a non-blocking banner', () => {
    expect(screen).toContain('<WarningBanner');
    expect(screen).toContain('timeoutWarning(');
    expect(screen).toContain('substitutionWarning(');
  });

  it('has a "Temps mort" button per team next to "Remplacement", and keeps the counter tap', () => {
    expect(screen.match(/label=\{t\('arbitrage\.timeoutButton'\)\}/g)).toHaveLength(2);
    expect(screen.match(/onPress=\{\(\) => handleTimeout\((left|right)Data\.side\)\}/g)!.length).toBeGreaterThanOrEqual(4);
  });

  it('mentions the timeout button and the counter tap in the "?" and the bubble', () => {
    for (const dict of [fr, en]) {
      const d = dict as unknown as { help: Record<string, string>; tips: { arbitrage: Record<string, string> }; arbitrage: Record<string, string> };
      expect(d.help.arbitrage).toContain(d.arbitrage.timeoutButton);
      expect(d.tips.arbitrage.actions).toContain(d.arbitrage.timeoutButton);
    }
    expect(fr.help.arbitrage).toMatch(/pastille/);
    expect(fr.tips.arbitrage.actions).toMatch(/pastille/);
  });
});
