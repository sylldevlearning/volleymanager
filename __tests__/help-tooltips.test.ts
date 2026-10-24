import fs from 'fs';
import path from 'path';
import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';

const ROOT = path.join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

const usedKeys = [...sourceFiles(path.join(ROOT, 'app')), ...sourceFiles(path.join(ROOT, 'src'))]
  .flatMap((file) => [...fs.readFileSync(file, 'utf8').matchAll(/textKey="help\.([A-Za-z]+)"/g)].map((m) => m[1]));

describe('"?" help buttons', () => {
  it('finds the help buttons in the source', () => {
    expect(usedKeys.length).toBeGreaterThan(10);
  });

  it.each(['fr', 'en'] as const)('every help text exists in %s', (lang) => {
    const help = (lang === 'fr' ? fr : en).help as Record<string, string>;
    for (const key of usedKeys) {
      expect(typeof help[key]).toBe('string');
    }
  });

  it.each([
    ['app/match/[id]/arbitrage.tsx', 'arbitrage'],
    ['app/match/[id]/lineup.tsx', 'lineup'],
    ['app/team/[id].tsx', 'team'],
  ])('%s has a "?" button', (file, key) => {
    expect(read(file)).toContain(`textKey="help.${key}"`);
  });
});
