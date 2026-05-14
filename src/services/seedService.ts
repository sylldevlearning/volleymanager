import { getAllTeams, createTeam } from './teamService';
import { createPlayer, getPlayersByTeam } from './playerService';
import type { PlayerPosition } from '../models/player';

type SeedPlayer = { number: number; firstName?: string; lastName: string; position: PlayerPosition | null };

// JO Paris 2024 roster
const FRANCE_PLAYERS: SeedPlayer[] = [
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

// JO Paris 2024 roster
const BRAZIL_PLAYERS: SeedPlayer[] = [
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

export async function seedDefaultDataIfEmpty(): Promise<void> {
  try {
    const teams = await getAllTeams();

    if (teams.length > 0) {
      // Guard: if teams already have players, skip seeding
      const firstTeamPlayers = await getPlayersByTeam(teams[0].id);
      if (firstTeamPlayers.length > 0) return;
      // Teams exist but no players → bad state from a previous failed seed — fall through to re-seed
      console.warn('[seed] Teams exist but no players found, re-seeding players');
    }

    const france = await createTeam({
      name: 'France',
      shortName: 'FRA',
      logoUri: null,
      color: '#1D4ED8',
    });

    if (!france?.id) {
      console.error('[seed] createTeam returned no id for France');
      return;
    }

    const brazil = await createTeam({
      name: 'Brésil',
      shortName: 'BRA',
      logoUri: null,
      color: '#F59E0B',
    });

    if (!brazil?.id) {
      console.error('[seed] createTeam returned no id for Brésil');
      return;
    }

    for (const p of FRANCE_PLAYERS) {
      try {
        await createPlayer({
          teamId: france.id,
          firstName: p.firstName ?? null,
          lastName: p.lastName,
          number: p.number,
          position: p.position,
          photoUri: null,
          isActive: true,
        });
      } catch (e) {
        console.error('[seed] Failed to create France player', p.number, p.lastName, e);
      }
    }

    for (const p of BRAZIL_PLAYERS) {
      try {
        await createPlayer({
          teamId: brazil.id,
          firstName: p.firstName ?? null,
          lastName: p.lastName,
          number: p.number,
          position: p.position,
          photoUri: null,
          isActive: true,
        });
      } catch (e) {
        console.error('[seed] Failed to create Brazil player', p.number, p.lastName, e);
      }
    }
  } catch (e) {
    console.error('[seed] seedDefaultDataIfEmpty failed:', e);
  }
}
