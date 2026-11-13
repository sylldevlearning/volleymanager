/**
 * Sanctions (arbitrage mode): the sheet asks for the sanction type first, then
 * shows the list of players below it.
 */
import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(path.join(__dirname, '../src/components/arbitrage/SanctionSheet.tsx'), 'utf8');

describe('SanctionSheet', () => {
  it('shows the sanction types before the players', () => {
    const types = src.indexOf("t('sanction.type')");
    const target = src.indexOf("t('sanction.target')");
    const typeGrid = src.indexOf('SANCTION_TYPES.map(');
    const playerList = src.indexOf('players.map(');
    expect(types).toBeGreaterThan(-1);
    expect(target).toBeGreaterThan(-1);
    expect(types).toBeLessThan(target);
    expect(typeGrid).toBeLessThan(playerList);
    expect(typeGrid).toBeLessThan(target);
  });
});
