import { getAllTeams, createTeam } from './teamService';
import { createPlayer } from './playerService';
import type { PlayerPosition } from '../models/player';

type SeedPlayer = { number: number; lastName: string; position: PlayerPosition | null };

const SEED_PLAYERS_A: SeedPlayer[] = [
  { number: 1, lastName: 'Martin', position: 'setter' },
  { number: 2, lastName: 'Bernard', position: 'outside' },
  { number: 3, lastName: 'Thomas', position: 'middle' },
  { number: 4, lastName: 'Petit', position: 'opposite' },
  { number: 5, lastName: 'Robert', position: 'outside' },
  { number: 6, lastName: 'Richard', position: 'libero' },
  { number: 7, lastName: 'Durand', position: 'setter' },
  { number: 8, lastName: 'Leroy', position: 'outside' },
  { number: 9, lastName: 'Moreau', position: 'middle' },
  { number: 10, lastName: 'Simon', position: 'opposite' },
  { number: 11, lastName: 'Laurent', position: 'outside' },
  { number: 12, lastName: 'Michel', position: 'middle' },
  { number: 13, lastName: 'Garcia', position: 'libero' },
];

const SEED_PLAYERS_B: SeedPlayer[] = [
  { number: 1, lastName: 'David', position: 'setter' },
  { number: 2, lastName: 'Bertrand', position: 'outside' },
  { number: 3, lastName: 'Roux', position: 'middle' },
  { number: 4, lastName: 'Vincent', position: 'opposite' },
  { number: 5, lastName: 'Fournier', position: 'outside' },
  { number: 6, lastName: 'Morel', position: 'libero' },
  { number: 7, lastName: 'Girard', position: 'setter' },
  { number: 8, lastName: 'Andre', position: 'outside' },
  { number: 9, lastName: 'Lefevre', position: 'middle' },
  { number: 10, lastName: 'Mercier', position: 'opposite' },
  { number: 11, lastName: 'Dupont', position: 'outside' },
  { number: 12, lastName: 'Lambert', position: 'middle' },
  { number: 13, lastName: 'Bonnet', position: 'libero' },
];

export async function seedDefaultDataIfEmpty(): Promise<void> {
  const teams = await getAllTeams();
  if (teams.length > 0) return;

  const teamA = await createTeam({
    name: 'Équipe Locale',
    shortName: 'LOC',
    logoUri: null,
    color: '#E63946',
  });

  const teamB = await createTeam({
    name: 'Équipe Visiteur',
    shortName: 'VIS',
    logoUri: null,
    color: '#1D4ED8',
  });

  for (const p of SEED_PLAYERS_A) {
    await createPlayer({
      teamId: teamA.id,
      firstName: null,
      lastName: p.lastName,
      number: p.number,
      position: p.position,
      photoUri: null,
      isActive: true,
    });
  }

  for (const p of SEED_PLAYERS_B) {
    await createPlayer({
      teamId: teamB.id,
      firstName: null,
      lastName: p.lastName,
      number: p.number,
      position: p.position,
      photoUri: null,
      isActive: true,
    });
  }
}
