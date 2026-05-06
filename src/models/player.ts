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
  firstName: string;
  lastName: string;
  number: number;
  position: PlayerPosition | null;
  photoUri: string | null;
  isActive: boolean;
  createdAt: string;
}

export type PlayerInput = Omit<Player, 'id' | 'createdAt'>;

export function playerDisplayName(player: Player): string {
  return `#${player.number} ${player.firstName} ${player.lastName}`;
}
