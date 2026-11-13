// Rosters of the teams created at first launch up to 1.2.3 (real players).
// Kept only in the tests: the app recognises them by fingerprint to remove
// them when they were never changed nor used.
import type { PlayerPosition } from '../../src/models/player';

export type LegacySeedPlayer = { number: number; firstName?: string; lastName: string; position: PlayerPosition | null };

export const FRANCE_PLAYERS: LegacySeedPlayer[] = [
  { number: 1,  lastName: 'Chinenyeze', position: 'middle' },
  { number: 2,  lastName: 'Grebennikov', position: 'libero' },
  { number: 4,  lastName: 'Patry',       position: 'opposite' },
  { number: 6,  lastName: 'Toniutti',    position: 'setter' },
  { number: 7,  lastName: 'Tillie',      position: 'outside' },
  { number: 9,  lastName: 'Ngapeth',     position: 'outside' },
  { number: 11, lastName: 'Brizard',     position: 'setter' },
  { number: 14, lastName: 'Le Goff',     position: 'middle' },
  { number: 17, lastName: 'Clévenot',    position: 'outside' },
  { number: 19, lastName: 'Louati',      position: 'outside' },
  { number: 21, lastName: 'Faure',       position: 'opposite' },
  { number: 23, lastName: 'Carle',       position: 'outside' },
  { number: 25, lastName: 'Jouffroy',    position: 'middle' },
];

export const BRAZIL_PLAYERS: LegacySeedPlayer[] = [
  { number: 1,  firstName: 'Bruno', lastName: 'Rezende',  position: 'setter' },
  { number: 3,  lastName: 'Leal',       position: 'outside' },
  { number: 5,  lastName: 'Isac',       position: 'middle' },
  { number: 6,  lastName: 'Cachopa',    position: 'setter' },
  { number: 7,  lastName: 'Thales',     position: 'libero' },
  { number: 8,  lastName: 'Honorato',   position: 'outside' },
  { number: 9,  lastName: 'Adriano',    position: 'outside' },
  { number: 10, lastName: 'Bergmann',   position: 'outside' },
  { number: 14, lastName: 'Saatkamp',   position: 'middle' },
  { number: 18, lastName: 'Lucarelli',  position: 'outside' },
  { number: 21, lastName: 'Alan',       position: 'opposite' },
  { number: 23, lastName: 'Flávio',     position: 'middle' },
  { number: 28, lastName: 'Darlan',     position: 'opposite' },
];

export const LEGACY_TEAMS = [
  { name: 'France', shortName: 'FRA', color: '#1D4ED8', players: FRANCE_PLAYERS },
  { name: 'Brésil', shortName: 'BRA', color: '#F59E0B', players: BRAZIL_PLAYERS },
] as const;
