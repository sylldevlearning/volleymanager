import {
  getPlayerDisplayName,
  getPlayerShortName,
} from '../src/features/players/player-helpers';

describe('getPlayerDisplayName', () => {
  it('shows full name when both names present', () => {
    expect(getPlayerDisplayName({ firstName: 'Jean', lastName: 'Dupont', number: 7 })).toBe('Jean Dupont');
  });

  it('shows lastName only when no firstName', () => {
    expect(getPlayerDisplayName({ firstName: null, lastName: 'Dupont', number: 7 })).toBe('Dupont');
  });

  it('shows firstName only when no lastName', () => {
    expect(getPlayerDisplayName({ firstName: 'Jean', lastName: null, number: 7 })).toBe('Jean');
  });

  it('shows #number when both names are null', () => {
    expect(getPlayerDisplayName({ firstName: null, lastName: null, number: 7 })).toBe('#7');
  });

  it('shows #number when both names are empty strings', () => {
    expect(getPlayerDisplayName({ firstName: '', lastName: '', number: 3 })).toBe('#3');
  });

  it('trims whitespace before deciding', () => {
    expect(getPlayerDisplayName({ firstName: '  ', lastName: '  ', number: 5 })).toBe('#5');
  });

  it('handles undefined fields like null', () => {
    expect(getPlayerDisplayName({ firstName: undefined, lastName: undefined, number: 9 })).toBe('#9');
  });

  it('number 0 renders as #0', () => {
    expect(getPlayerDisplayName({ firstName: null, lastName: null, number: 0 })).toBe('#0');
  });
});

describe('getPlayerShortName', () => {
  it('shows lastName when available', () => {
    expect(getPlayerShortName({ firstName: 'Jean', lastName: 'Dupont', number: 7 })).toBe('Dupont');
  });

  it('falls back to firstName when no lastName', () => {
    expect(getPlayerShortName({ firstName: 'Jean', lastName: null, number: 7 })).toBe('Jean');
  });

  it('falls back to firstName when lastName is empty', () => {
    expect(getPlayerShortName({ firstName: 'Jean', lastName: '', number: 7 })).toBe('Jean');
  });

  it('shows #number when both names are null', () => {
    expect(getPlayerShortName({ firstName: null, lastName: null, number: 7 })).toBe('#7');
  });

  it('shows #number when both names are empty', () => {
    expect(getPlayerShortName({ firstName: '', lastName: '', number: 11 })).toBe('#11');
  });

  it('handles undefined fields', () => {
    expect(getPlayerShortName({ firstName: undefined, lastName: undefined, number: 5 })).toBe('#5');
  });

  it('trims whitespace from lastName', () => {
    expect(getPlayerShortName({ firstName: 'Jean', lastName: '  ', number: 7 })).toBe('Jean');
  });
});
