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

describe('help: home Tournament button, ⋯ menu bubble, arbitrage setup', () => {
  it('home "?": the Tournament button', () => {
    expect(fr.help.home).toMatch(/Tournoi :/);
    expect(en.help.home).toMatch(/Tournament:/);
  });

  it('tournament ⋯ menu bubble: "Exporter"', () => {
    expect(fr.tips.tournament.menu).toMatch(/« Exporter »/);
    expect(en.tips.tournament.menu).toMatch(/"Export"/);
  });

  it('arbitrage setup has a "?" on format and Leisure / Official rules', () => {
    const screen = require('fs').readFileSync(require('path').join(__dirname, '../app/arbitrage/new.tsx'), 'utf8');
    expect(screen).toContain('<InfoTooltip textKey="help.arbitrageSetup" />');
    const text = (fr.help as Record<string, string>).arbitrageSetup;
    for (const word of ['6×6', '4×4', '3×3', '2×2', 'Loisir', 'Officiel', 'remplacements', 'temps mort']) {
      expect(text).toContain(word);
    }
  });
});
