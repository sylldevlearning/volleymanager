export type PlayerPosition =
  | 'setter'
  | 'outside'
  | 'opposite'
  | 'middle'
  | 'libero'
  | 'universal';

export interface Player {
  id: string;
  teamId: string;
  firstName: string | null;
  lastName: string | null;
  number: number;
  position: PlayerPosition | null;
  photoUri: string | null;
  isActive: boolean;
  createdAt: string;
}

export type PlayerInput = Omit<Player, 'id' | 'createdAt'>;

export function playerDisplayName(player: Pick<Player, 'firstName' | 'lastName' | 'number'>): string {
  const first = (player.firstName ?? '').trim();
  const last = (player.lastName ?? '').trim();
  if (first && last) return `#${player.number} ${first} ${last}`;
  if (last) return `#${player.number} ${last}`;
  if (first) return `#${player.number} ${first}`;
  return `#${player.number}`;
}
