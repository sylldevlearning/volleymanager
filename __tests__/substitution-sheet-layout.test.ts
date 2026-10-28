import fs from 'fs';
import path from 'path';

const sheet = fs.readFileSync(path.join(__dirname, '../src/components/scoring/SubstitutionSheet.tsx'), 'utf8');

describe('substitution sheet — refused substitution message', () => {
  it('is never cut to one line (it used to run off the right edge)', () => {
    const errorTexts = [...sheet.matchAll(/<Text style=\{[^}]*benchError[^>]*>/g)].map((m) => m[0]);
    expect(errorTexts.length).toBeGreaterThanOrEqual(2); // bench row + libero row
    for (const tag of errorTexts) expect(tag).not.toContain('numberOfLines');
  });

  it('sits under the player name, inside a column that takes the remaining width', () => {
    expect(sheet).toMatch(/benchInfo: \{ flex: 1, minWidth: 0/);
    expect(sheet.match(/<View style=\{subStyles\.benchInfo\}>/g)).toHaveLength(2);
  });
});
