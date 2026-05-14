import { getAllTeams, createTeam } from './teamService';
import { createPlayer } from './playerService';
import type { PlayerPosition } from '../models/player';

type SeedPlayer = { number: number; firstName?: string; lastName: string; position: PlayerPosition | null };

const FRANCE_PLAYERS: SeedPlayer[] = [
  { number: 1,  lastName: 'Brizard',      position: 'setter' },
  { number: 2,  lastName: 'Ngapeth',      position: 'outside' },
  { number: 3,  lastName: 'Le Goff',      position: 'middle' },
  { number: 4,  lastName: 'Clevenot',     position: 'outside' },
  { number: 6,  lastName: 'Patry',        position: 'opposite' },
  { number: 7,  lastName: 'Chinenyeze',   position: 'middle' },
  { number: 8,  lastName: 'Toniutti',     position: 'setter' },
  { number: 9,  lastName: 'Boyer',        position: 'outside' },
  { number: 10, lastName: 'Louati',       position: 'middle' },
  { number: 11, lastName: 'Tillie',       position: 'outside' },
  { number: 12, lastName: 'Jouffroy',     position: 'opposite' },
  { number: 14, lastName: 'Diez',         position: 'outside' },
  { number: 20, lastName: 'Grebennikov', position: 'libero' },
];

const BRAZIL_PLAYERS: SeedPlayer[] = [
  { number: 1,  lastName: 'Bruninho',   position: 'setter' },
  { number: 2,  lastName: 'Lucão',      position: 'middle' },
  { number: 3,  lastName: 'Leal',       position: 'outside' },
  { number: 4,  lastName: 'Lucarelli',  position: 'outside' },
  { number: 5,  lastName: 'Darlan',     position: 'opposite' },
  { number: 6,  lastName: 'Fernando',   position: 'setter' },
  { number: 8,  lastName: 'Isac',       position: 'middle' },
  { number: 9,  lastName: 'Alan',       position: 'outside' },
  { number: 10, lastName: 'Flávio',     position: 'middle' },
  { number: 11, lastName: 'Adriano',    position: 'outside' },
  { number: 13, lastName: 'Vaccari',    position: 'opposite' },
  { number: 14, lastName: 'Otávio',     position: 'middle' },
  { number: 18, lastName: 'Thales',     position: 'libero' },
];

export async function seedDefaultDataIfEmpty(): Promise<void> {
  const teams = await getAllTeams();
  if (teams.length > 0) return;

  const france = await createTeam({
    name: 'France',
    shortName: 'FRA',
    logoUri: null,
    color: '#1D4ED8',
  });

  const brazil = await createTeam({
    name: 'Brésil',
    shortName: 'BRA',
    logoUri: null,
    color: '#F59E0B',
  });

  for (const p of FRANCE_PLAYERS) {
    await createPlayer({
      teamId: france.id,
      firstName: p.firstName ?? null,
      lastName: p.lastName,
      number: p.number,
      position: p.position,
      photoUri: null,
      isActive: true,
    });
  }

  for (const p of BRAZIL_PLAYERS) {
    await createPlayer({
      teamId: brazil.id,
      firstName: p.firstName ?? null,
      lastName: p.lastName,
      number: p.number,
      position: p.position,
      photoUri: null,
      isActive: true,
    });
  }
}
