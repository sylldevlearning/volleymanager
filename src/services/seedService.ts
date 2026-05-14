import { getAllTeams, createTeam, getTeamByName } from './teamService';
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

const SEED_TEAMS = [
  { name: 'France', shortName: 'FRA', color: '#1D4ED8', players: FRANCE_PLAYERS },
  { name: 'Brésil',  shortName: 'BRA', color: '#F59E0B', players: BRAZIL_PLAYERS },
] as const;

async function seedPlayersForTeam(teamId: string, players: readonly SeedPlayer[]): Promise<void> {
  for (const p of players) {
    try {
      await createPlayer({
        teamId,
        firstName: p.firstName ?? null,
        lastName: p.lastName,
        number: p.number,
        position: p.position,
        photoUri: null,
        isActive: true,
      });
    } catch (e) {
      console.error('[seed] Failed to create player', p.number, p.lastName, e);
    }
  }
}

export async function seedDefaultDataIfEmpty(): Promise<void> {
  try {
    const teams = await getAllTeams();

    if (teams.length === 0) {
      // First launch: check by name first (UNIQUE guard), then create
      for (const def of SEED_TEAMS) {
        const existing = await getTeamByName(def.name);
        const team = existing ?? await createTeam({ name: def.name, shortName: def.shortName, logoUri: null, color: def.color });
        if (!team?.id) { console.error(`[seed] createTeam returned no id for ${def.name}`); continue; }
        await seedPlayersForTeam(team.id, def.players);
      }
      return;
    }

    // Teams exist — check if first team has players
    const firstTeamPlayers = await getPlayersByTeam(teams[0].id);
    if (firstTeamPlayers.length > 0) return;

    // Teams exist but no players → seed players into existing teams matched by name
    console.warn('[seed] Teams exist but no players found, re-seeding players');
    for (const team of teams) {
      const def = SEED_TEAMS.find((d) => d.name === team.name);
      if (!def) continue;
      await seedPlayersForTeam(team.id, def.players);
    }
  } catch (e) {
    console.error('[seed] seedDefaultDataIfEmpty failed:', e);
  }
}
