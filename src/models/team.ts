export interface Team {
  id: string;
  name: string;
  shortName: string | null;
  logoUri: string | null;
  color: string;
  coachName: string | null;
  /** Libero jersey colour, never the team's own colour (null: app default) */
  liberoColor: string | null;
  /** True for a team created just for a single arbitrage match — hidden from the team library. */
  isAdHoc: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TeamInput = Omit<Team, 'id' | 'createdAt' | 'updatedAt' | 'isAdHoc' | 'coachName' | 'liberoColor'> & {
  coachName?: string | null;
  liberoColor?: string | null;
};
