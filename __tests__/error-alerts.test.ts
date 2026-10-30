import fs from 'fs';
import path from 'path';
import fr from '../src/i18n/fr.json';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('a failed save says so instead of failing silently', () => {
  it.each([
    'app/scan.tsx',
    'app/tournament/[id]/scan-result.tsx',
    'app/tournament/[id]/match/[matchId].tsx',
    'app/tournament/[id]/index.tsx',
    'app/tournament/[id]/teams.tsx',
  ])('%s: catch → "Erreur" alert', (file) => {
    const screen = read(file);
    expect(screen).toMatch(/catch\s*\{[^}]*Alert\.alert\(t\('common\.error'\), t\('common\.actionFailed'\)\)/s);
  });

  it('the message exists (and in every language, through the key test)', () => {
    expect(fr.common.error).toBe('Erreur');
    expect(fr.common.actionFailed).toBeTruthy();
  });
});
