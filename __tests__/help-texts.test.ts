import fr from '../src/i18n/fr.json';
import en from '../src/i18n/en.json';

describe('help covers the features added after it was written', () => {
  it('presentation, Arbitrage page: small formats and Leisure / Official rules', () => {
    expect(fr.onboarding.arbitrage.body).toMatch(/4×4, 3×3 ou 2×2/);
    expect(fr.onboarding.arbitrage.body).toMatch(/Loisir ou Officiel/);
    expect(en.onboarding.arbitrage.body).toMatch(/4×4, 3×3 or 2×2/);
  });

  it('tournament "?": export on every tab, teams that can leave', () => {
    for (const key of ['tournamentPlanning', 'tournamentMatches', 'tournamentStandings'] as const) {
      expect(fr.help[key]).toMatch(/« Exporter » \(menu ⋯\).*PDF ou en image/);
    }
    expect(fr.help.tournamentMatches).toMatch(/peuvent partir/);
    expect(fr.help.tournamentStandings).toMatch(/« Terminé »/);
  });

  it('Settings "?": the phone language by default', () => {
    expect(fr.help.settings).toMatch(/langue du téléphone/);
    expect(en.help.settings).toMatch(/phone language/);
  });
});
