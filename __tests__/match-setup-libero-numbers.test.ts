import fs from 'fs';
import path from 'path';

jest.mock('../src/services/teamService', () => ({ createAdHocTeam: jest.fn() }));
jest.mock('../src/services/playerService', () => ({ createPlayer: jest.fn() }));
jest.mock('../src/services/matchService', () => ({ createMatch: jest.fn(), setMatchCaptains: jest.fn() }));

import {
  LIBERO_COLOR_CHOICES,
  defaultLiberoColor,
  resolveLiberoColor,
} from '../src/features/teams/liberoColor';
import { jerseyNumbers, COMPACT_MAX_NUMBER } from '../src/features/teams/jerseyNumbers';
import { validateAdHocTeam } from '../src/utils/adHocSetupValidation';
import { createAdHocMatch } from '../src/services/adHocMatchService';
import { createAdHocTeam } from '../src/services/teamService';
import { createPlayer } from '../src/services/playerService';
import { createMatch } from '../src/services/matchService';
import { LIBERO_PRESET_COLORS, PRESET_TEAM_COLORS } from '../src/utils/constants';
import { DEFAULT_INDOOR_CONFIG } from '../src/models/match';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('libero jersey colour', () => {
  it('defaults to a preset libero colour distinct from the team', () => {
    expect(defaultLiberoColor('#1D4ED8')).toBe(LIBERO_PRESET_COLORS[0]);
    // Team already wears the first libero preset → the next one
    expect(defaultLiberoColor(LIBERO_PRESET_COLORS[0])).toBe(LIBERO_PRESET_COLORS[1]);
  });

  it('offers the libero presets and the team colours, once each', () => {
    expect(new Set(LIBERO_COLOR_CHOICES).size).toBe(LIBERO_COLOR_CHOICES.length);
    for (const c of [...LIBERO_PRESET_COLORS, ...PRESET_TEAM_COLORS]) expect(LIBERO_COLOR_CHOICES).toContain(c);
  });

  it('never keeps the team colour: falls back to the distinct default', () => {
    expect(resolveLiberoColor('#EC4899', '#1D4ED8')).toBe('#EC4899');
    expect(resolveLiberoColor('#1D4ED8', '#1D4ED8')).toBe(defaultLiberoColor('#1D4ED8'));
    expect(resolveLiberoColor(null, '#1D4ED8')).toBe(defaultLiberoColor('#1D4ED8'));
  });

  it('is refused by the setup validation when it equals the team colour', () => {
    const draft = {
      name: 'Lyon',
      players: [1, 2, 3, 4, 5, 6].map((number) => ({ number, name: '' })),
      captainNumber: 1,
      liberoNumbers: [6],
      color: '#1D4ED8',
    };
    expect(validateAdHocTeam({ ...draft, liberoColor: '#06B6D4' })).toEqual([]);
    expect(validateAdHocTeam({ ...draft, liberoColor: '#1D4ED8' }))
      .toContain('Le maillot du libéro doit être d\'une autre couleur que celui de l\'équipe.');
  });

  it('is saved with the team of the match', async () => {
    (createAdHocTeam as jest.Mock).mockImplementation(async (input) => ({ id: input.name, ...input }));
    (createPlayer as jest.Mock).mockImplementation(async (p) => ({ id: `p${p.number}`, ...p }));
    (createMatch as jest.Mock).mockResolvedValue({ id: 'm1' });
    const side = (name: string, color: string, liberoColor: string) => ({
      name, color, liberoColor, coachName: null, captainNumber: 1,
      players: [1, 2, 3, 4, 5, 6].map((number) => ({ number, isLibero: number === 6 })),
    });
    await createAdHocMatch({
      format: 'indoor_6v6', mode: 'competition', config: DEFAULT_INDOOR_CONFIG,
      home: side('Lyon', '#1D4ED8', '#EC4899'), away: side('Paris', '#E63946', '#F59E0B'),
    });
    expect(createAdHocTeam).toHaveBeenCalledWith(expect.objectContaining({ name: 'Lyon', liberoColor: '#EC4899' }));
    expect(createAdHocTeam).toHaveBeenCalledWith(expect.objectContaining({ name: 'Paris', liberoColor: '#F59E0B' }));
  });

  it('is drawn on the arbitrage court for that team', () => {
    expect(read('src/components/court/FullCourt.tsx')).toContain('side.liberoColor ?? palette.libero');
    expect(read('app/match/[id]/arbitrage.tsx').match(/liberoColor: (left|right)Data\.team\.liberoColor/g)).toHaveLength(2);
  });

  it('is picked on the setup screen', () => {
    const setup = read('app/arbitrage/new.tsx');
    expect(setup).toContain("t('arbitrageSetup.liberoColor')");
    expect(setup).toContain('LIBERO_COLOR_CHOICES.map(');
  });
});

describe('jersey number grid', () => {
  it('shows 0 to 20 first', () => {
    expect(COMPACT_MAX_NUMBER).toBe(20);
    expect(jerseyNumbers(false)).toEqual(Array.from({ length: 21 }, (_, n) => n));
  });

  it('"+" unrolls the numbers up to 99', () => {
    expect(jerseyNumbers(true)).toEqual(Array.from({ length: 100 }, (_, n) => n));
  });

  it('uses bigger buttons and a "+" toggle on the setup screen', () => {
    const setup = read('app/arbitrage/new.tsx');
    expect(setup).toContain('jerseyNumbers(showAllNumbers)');
    expect(setup).toMatch(/numberCell: \{\s*width: 44, height: 44/);
    expect(setup).toContain("t('arbitrageSetup.moreNumbers')");
  });
});
