export interface Team {
  id: string;
  name: string;
  shortName: string | null;
  logoUri: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export type TeamInput = Omit<Team, 'id' | 'createdAt' | 'updatedAt'>;
