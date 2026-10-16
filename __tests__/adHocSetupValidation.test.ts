import { validateAdHocTeam, validateAdHocRules, type AdHocTeamDraft } from '../src/utils/adHocSetupValidation';
import { DEFAULT_INDOOR_CONFIG } from '../src/models/match';

function draft(overrides: Partial<AdHocTeamDraft> = {}): AdHocTeamDraft {
  return {
    name: 'Les Aigles',
    players: Array.from({ length: 6 }, (_, i) => ({ number: i + 1, name: '' })),
    captainNumber: 1,
    liberoNumbers: [],
    ...overrides,
  };
}

// ─── Team name ──────────────────────────────────────────────────────────────

test('rejects a name shorter than 2 letters', () => {
  const errors = validateAdHocTeam(draft({ name: 'A' }));
  expect(errors).toContain("Le nom de l'équipe doit contenir au moins 2 lettres.");
});

test('rejects a blank/whitespace-only name', () => {
  const errors = validateAdHocTeam(draft({ name: '   ' }));
  expect(errors).toContain("Le nom de l'équipe doit contenir au moins 2 lettres.");
});

test('accepts a 2-letter name', () => {
  const errors = validateAdHocTeam(draft({ name: 'FC' }));
  expect(errors).not.toContain("Le nom de l'équipe doit contenir au moins 2 lettres.");
});

// ─── Player count ───────────────────────────────────────────────────────────

test('rejects fewer than 6 selected players', () => {
  const errors = validateAdHocTeam(draft({ players: [{ number: 1, name: '' }], captainNumber: 1 }));
  expect(errors).toContain('Il faut au moins 6 joueurs sélectionnés.');
});

test('accepts exactly 6 selected players', () => {
  const errors = validateAdHocTeam(draft());
  expect(errors).not.toContain('Il faut au moins 6 joueurs sélectionnés.');
});

// ─── Captain ────────────────────────────────────────────────────────────────

test('rejects no captain chosen when players exist', () => {
  const errors = validateAdHocTeam(draft({ captainNumber: null }));
  expect(errors).toContain('Choisissez un capitaine.');
});

test('rejects a captain number that is not among the selected players', () => {
  const errors = validateAdHocTeam(draft({ captainNumber: 42 }));
  expect(errors).toContain('Le capitaine doit être un joueur sélectionné.');
});

test('accepts a captain among the selected players', () => {
  const errors = validateAdHocTeam(draft({ captainNumber: 3 }));
  expect(errors).not.toContain('Le capitaine doit être un joueur sélectionné.');
});

// ─── Libero(s) ──────────────────────────────────────────────────────────────

test('rejects more than 2 liberos', () => {
  const errors = validateAdHocTeam(draft({ liberoNumbers: [1, 2, 3] }));
  expect(errors).toContain('Maximum 2 libéros.');
});

test('accepts 0, 1 or 2 liberos', () => {
  expect(validateAdHocTeam(draft({ liberoNumbers: [] }))).not.toContain('Maximum 2 libéros.');
  expect(validateAdHocTeam(draft({ liberoNumbers: [2] }))).not.toContain('Maximum 2 libéros.');
  expect(validateAdHocTeam(draft({ liberoNumbers: [2, 3] }))).not.toContain('Maximum 2 libéros.');
});

test('rejects a libero number that is not among the selected players', () => {
  const errors = validateAdHocTeam(draft({ liberoNumbers: [77] }));
  expect(errors).toContain('Le libéro doit être un joueur sélectionné.');
});

test('rejects the captain also being a libero (FIVB: the libero cannot be team captain)', () => {
  const errors = validateAdHocTeam(draft({ captainNumber: 2, liberoNumbers: [2] }));
  expect(errors).toContain('Le libéro ne peut pas être capitaine.');
});

// ─── Rules tab ──────────────────────────────────────────────────────────────

test('FIVB default config has no validation errors', () => {
  expect(validateAdHocRules(DEFAULT_INDOOR_CONFIG)).toEqual([]);
});

test('rejects zero or negative points per set', () => {
  expect(validateAdHocRules({ ...DEFAULT_INDOOR_CONFIG, pointsPerSet: 0 })).toContain('Points par set invalide.');
});

test('rejects zero sets to win', () => {
  expect(validateAdHocRules({ ...DEFAULT_INDOOR_CONFIG, setsToWin: 0 })).toContain('Nombre de sets gagnants invalide.');
});
