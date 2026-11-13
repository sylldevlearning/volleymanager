/**
 * Sample data shown on a fresh install (« Exemple »): invented, common names
 * only — no real player or club.
 */
import type { PlayerPosition } from '../../models/player';

export interface SamplePlayer {
  number: number;
  firstName: string;
  lastName: string;
  position: PlayerPosition;
}

/** Sample team names come from the locale of the phone (sample.teams.<key>) */
export const SAMPLE_TEAM_KEYS = ['gulls', 'herons', 'lynxes', 'albatrosses', 'beavers', 'otters', 'puffins', 'hedgehogs'] as const;
export type SampleTeamKey = (typeof SAMPLE_TEAM_KEYS)[number];
export type SampleTeamNames = Record<SampleTeamKey, { name: string; short: string }>;

export interface SampleTeam {
  key: SampleTeamKey;
  color: string;
  /** Jersey number of the captain */
  captain: number;
  /** 5-1 starting lineup: court position → jersey number */
  lineup: Record<1 | 2 | 3 | 4 | 5 | 6, number>;
  players: SamplePlayer[];
}

export const SAMPLE_HOME: SampleTeam = {
  key: 'gulls',
  color: '#1D4ED8',
  captain: 1,
  // Setter 1, outside 2, middle 3, opposite 4, outside 5, middle 6
  lineup: { 1: 2, 2: 1, 3: 3, 4: 4, 5: 5, 6: 7 },
  players: [
    { number: 1, firstName: 'Lucas', lastName: 'Martin', position: 'outside' },
    { number: 2, firstName: 'Hugo', lastName: 'Bernard', position: 'setter' },
    { number: 3, firstName: 'Théo', lastName: 'Petit', position: 'middle' },
    { number: 4, firstName: 'Nathan', lastName: 'Robert', position: 'opposite' },
    { number: 5, firstName: 'Enzo', lastName: 'Richard', position: 'outside' },
    { number: 6, firstName: 'Louis', lastName: 'Durand', position: 'libero' },
    { number: 7, firstName: 'Jules', lastName: 'Moreau', position: 'middle' },
    { number: 8, firstName: 'Tom', lastName: 'Laurent', position: 'outside' },
    { number: 9, firstName: 'Maxime', lastName: 'Simon', position: 'middle' },
    { number: 10, firstName: 'Antoine', lastName: 'Michel', position: 'setter' },
    { number: 11, firstName: 'Paul', lastName: 'Lefèvre', position: 'opposite' },
    { number: 12, firstName: 'Léo', lastName: 'Garcia', position: 'outside' },
  ],
};

export const SAMPLE_AWAY: SampleTeam = {
  key: 'herons',
  color: '#F59E0B',
  captain: 3,
  lineup: { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7, 6: 9 },
  players: [
    { number: 2, firstName: 'Adrien', lastName: 'Roux', position: 'setter' },
    { number: 3, firstName: 'Bastien', lastName: 'Fournier', position: 'outside' },
    { number: 5, firstName: 'Clément', lastName: 'Girard', position: 'middle' },
    { number: 6, firstName: 'Damien', lastName: 'Bonnet', position: 'opposite' },
    { number: 7, firstName: 'Étienne', lastName: 'Dupont', position: 'outside' },
    { number: 8, firstName: 'Florian', lastName: 'Lambert', position: 'libero' },
    { number: 9, firstName: 'Gabriel', lastName: 'Fontaine', position: 'middle' },
    { number: 10, firstName: 'Julien', lastName: 'Rousseau', position: 'outside' },
    { number: 11, firstName: 'Kevin', lastName: 'Vincent', position: 'middle' },
    { number: 12, firstName: 'Mathis', lastName: 'Muller', position: 'setter' },
    { number: 14, firstName: 'Romain', lastName: 'Lefebvre', position: 'opposite' },
    { number: 17, firstName: 'Yanis', lastName: 'Mercier', position: 'outside' },
  ],
};

export interface SampleSetPlan {
  /** Final score; the winner takes the last point */
  home: number;
  away: number;
  /** Team serving first */
  serve: 'home' | 'away';
  /** Timeouts: when the total of points reaches `at` */
  timeouts: { at: number; side: 'home' | 'away' }[];
  /** Regular substitution and its return (same pair, same place) */
  subs: { at: number; side: 'home' | 'away'; out: number; in: number }[];
}

/** 3-1 for Les Mouettes */
export const SAMPLE_SETS: SampleSetPlan[] = [
  { home: 25, away: 21, serve: 'home', timeouts: [{ at: 18, side: 'away' }, { at: 36, side: 'away' }], subs: [] },
  {
    home: 23, away: 25, serve: 'away', timeouts: [{ at: 20, side: 'home' }, { at: 41, side: 'away' }],
    subs: [{ at: 26, side: 'home', out: 4, in: 11 }, { at: 40, side: 'home', out: 11, in: 4 }],
  },
  {
    home: 25, away: 19, serve: 'home', timeouts: [{ at: 14, side: 'away' }, { at: 30, side: 'away' }],
    subs: [{ at: 22, side: 'away', out: 7, in: 17 }, { at: 34, side: 'away', out: 17, in: 7 }],
  },
  {
    home: 25, away: 22, serve: 'away', timeouts: [{ at: 24, side: 'home' }, { at: 40, side: 'away' }],
    subs: [{ at: 30, side: 'home', out: 5, in: 12 }],
  },
];

export const SAMPLE_MATCH_SEED = 20261113;

/** Tournament of 8 invented teams (pools + finals), half played */
export const SAMPLE_TOURNAMENT = {
  seed: 2026,
  teams: [
    { key: 'gulls', color: '#1D4ED8' },
    { key: 'herons', color: '#F59E0B' },
    { key: 'lynxes', color: '#10B981' },
    { key: 'albatrosses', color: '#8B5CF6' },
    { key: 'beavers', color: '#EF4444' },
    { key: 'otters', color: '#06B6D4' },
    { key: 'puffins', color: '#A16207' },
    { key: 'hedgehogs', color: '#EC4899' },
  ] as { key: SampleTeamKey; color: string }[],
};
