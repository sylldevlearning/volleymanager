import type { TacticalPlay, PlayerPosition, Arrow } from '../../models/tactical';

function makeId(n: number): string {
  return `default_play_${n}`;
}

function makePlayerId(team: 'h' | 'a', n: number): string {
  return `default_${team}_${n}`;
}

const HOME = 'team_home';
const AWAY = 'team_away';

function hp(n: number, x: number, y: number): PlayerPosition {
  return { playerId: makePlayerId('h', n), x, y, teamId: HOME, number: n, label: String(n), isHome: true };
}

function ap(n: number, x: number, y: number): PlayerPosition {
  return { playerId: makePlayerId('a', n), x, y, teamId: AWAY, number: n, label: String(n), isHome: false };
}

let arrowId = 0;
function arrow(
  type: Arrow['type'],
  fromX: number, fromY: number,
  toX: number, toY: number,
  color: string,
  thickness: Arrow['thickness'] = 'thin',
  order = ++arrowId,
  cx?: number, cy?: number,
): Arrow {
  return {
    id: `default_arrow_${order}`,
    type,
    fromX, fromY, toX, toY,
    controlX: cx,
    controlY: cy,
    color,
    thickness,
    order,
  };
}

// Standard home positions P1-P6 (bottom half)
const HOME_POS = {
  1: [0.83, 0.85], 2: [0.83, 0.60], 3: [0.50, 0.60],
  4: [0.17, 0.60], 5: [0.17, 0.85], 6: [0.50, 0.85],
};
// Standard away positions (top half, mirrored)
const AWAY_POS = {
  1: [0.17, 0.15], 2: [0.17, 0.40], 3: [0.50, 0.40],
  4: [0.83, 0.40], 5: [0.83, 0.15], 6: [0.50, 0.15],
};

function homePlayers(): PlayerPosition[] {
  return [1, 2, 3, 4, 5, 6].map((n) => hp(n, HOME_POS[n as 1][0], HOME_POS[n as 1][1]));
}

function awayPlayers(): PlayerPosition[] {
  return [1, 2, 3, 4, 5, 6].map((n) => ap(n, AWAY_POS[n as 1][0], AWAY_POS[n as 1][1]));
}

const BLUE = '#1D4ED8';
const RED = '#E63946';
const YELLOW = '#FBBF24';
const NOW = new Date().toISOString();

// 1. Réception W (5-1) — 3 receivers in W shape, setter infiltrates
const receptionW: TacticalPlay = {
  id: makeId(1),
  name: 'Réception W (5-1)',
  format: 'indoor_6v6',
  category: 'reception',
  isDefault: true,
  createdAt: NOW,
  updatedAt: NOW,
  positions: [
    // Home side — W reception: P1, P6, P5 receive; P2 setter; P4 left attacker
    hp(1, 0.78, 0.82), // right receiver
    hp(6, 0.50, 0.78), // center receiver (W bottom)
    hp(5, 0.22, 0.82), // left receiver
    hp(3, 0.50, 0.63), // center blocker near net
    hp(4, 0.17, 0.60), // left attacker near net
    hp(2, 0.83, 0.54), // setter (infiltrates near net)
    ...awayPlayers(),
  ],
  arrows: [
    // Ball coming from serve (from away back line to center)
    arrow('dashed', 0.50, 0.10, 0.50, 0.78, YELLOW, 'thin', 1),
    // Setter run to position 2
    arrow('solid', 0.83, 0.60, 0.83, 0.54, BLUE, 'thick', 2),
    // Left attacker run
    arrow('curved', 0.17, 0.85, 0.17, 0.60, BLUE, 'thin', 3, 0.10, 0.72),
  ],
};

// 2. Réception en U — 4 receivers in arc
const receptionU: TacticalPlay = {
  id: makeId(2),
  name: 'Réception en U',
  format: 'indoor_6v6',
  category: 'reception',
  isDefault: true,
  createdAt: NOW,
  updatedAt: NOW,
  positions: [
    hp(1, 0.85, 0.80), // right
    hp(6, 0.65, 0.75), // center-right
    hp(5, 0.35, 0.75), // center-left
    hp(4, 0.15, 0.80), // left
    hp(3, 0.50, 0.63), // center blocker at net
    hp(2, 0.83, 0.55), // setter infiltrated
    ...awayPlayers(),
  ],
  arrows: [
    arrow('dashed', 0.50, 0.10, 0.50, 0.76, YELLOW, 'thin', 4),
    arrow('solid', 0.83, 0.60, 0.83, 0.55, BLUE, 'thick', 5),
  ],
};

// 3. Attaque combinaison — pipe (P6) + antenne (P4)
const attackCombination: TacticalPlay = {
  id: makeId(3),
  name: 'Attaque Combinaison',
  format: 'indoor_6v6',
  category: 'attack',
  isDefault: true,
  createdAt: NOW,
  updatedAt: NOW,
  positions: [
    hp(1, 0.83, 0.85), // right back (serve receive)
    hp(2, 0.83, 0.58), // right front
    hp(3, 0.50, 0.58), // setter at net center
    hp(4, 0.17, 0.58), // left attacker ready
    hp(5, 0.17, 0.85),
    hp(6, 0.50, 0.80), // pipe attacker (run from back)
    ...awayPlayers(),
  ],
  arrows: [
    // Ball to setter
    arrow('dashed', 0.65, 0.78, 0.50, 0.58, YELLOW, 'thin', 6),
    // Pipe approach run: P6 runs to center net
    arrow('curved', 0.50, 0.80, 0.50, 0.55, BLUE, 'thick', 7, 0.42, 0.67),
    // Left antenne approach: P4 runs to left net
    arrow('curved', 0.17, 0.58, 0.10, 0.53, BLUE, 'thick', 8, 0.12, 0.55),
  ],
};

// 4. Défense 2-1-3
const defense213: TacticalPlay = {
  id: makeId(4),
  name: 'Défense 2-1-3',
  format: 'indoor_6v6',
  category: 'defense',
  isDefault: true,
  createdAt: NOW,
  updatedAt: NOW,
  positions: [
    hp(2, 0.78, 0.53), // block right
    hp(3, 0.50, 0.53), // block center
    hp(4, 0.22, 0.53), // no block — defense left wing
    hp(5, 0.15, 0.75), // left back
    hp(1, 0.85, 0.75), // right back
    hp(6, 0.50, 0.82), // libero back center
    ...awayPlayers(),
  ],
  arrows: [
    // Ball from away attacker to P3 position
    arrow('dashed', 0.50, 0.42, 0.50, 0.55, YELLOW, 'thin', 9),
    // P4 coverage left
    arrow('solid', 0.22, 0.60, 0.22, 0.70, BLUE, 'thin', 10),
  ],
};

// 5. Défense 3-2-1
const defense321: TacticalPlay = {
  id: makeId(5),
  name: 'Défense 3-2-1',
  format: 'indoor_6v6',
  category: 'defense',
  isDefault: true,
  createdAt: NOW,
  updatedAt: NOW,
  positions: [
    hp(2, 0.83, 0.53), // block right
    hp(3, 0.50, 0.53), // block center
    hp(4, 0.17, 0.53), // block left
    hp(1, 0.83, 0.72), // right wing defense
    hp(5, 0.17, 0.72), // left wing defense
    hp(6, 0.50, 0.88), // libero deep center
    ...awayPlayers(),
  ],
  arrows: [
    arrow('dashed', 0.50, 0.42, 0.50, 0.55, YELLOW, 'thin', 11),
    arrow('solid', 0.83, 0.72, 0.83, 0.80, BLUE, 'thin', 12),
    arrow('solid', 0.17, 0.72, 0.17, 0.80, BLUE, 'thin', 13),
  ],
};

// 6. Couverture d'attaque — star formation around attacker
const coverage: TacticalPlay = {
  id: makeId(6),
  name: 'Couverture d\'Attaque',
  format: 'indoor_6v6',
  category: 'coverage',
  isDefault: true,
  createdAt: NOW,
  updatedAt: NOW,
  positions: [
    hp(4, 0.10, 0.55), // attacker at left net
    hp(3, 0.40, 0.60), // coverage near left
    hp(2, 0.70, 0.60), // coverage near right
    hp(5, 0.15, 0.75), // coverage far left
    hp(1, 0.85, 0.75), // coverage far right
    hp(6, 0.50, 0.80), // libero center deep
    ...awayPlayers(),
  ],
  arrows: [
    // Ball from attacker (P4)
    arrow('dashed', 0.10, 0.55, 0.10, 0.65, YELLOW, 'thin', 14),
    // Coverage positions
    arrow('solid', 0.50, 0.85, 0.40, 0.62, BLUE, 'thin', 15),
    arrow('solid', 0.83, 0.85, 0.70, 0.62, BLUE, 'thin', 16),
  ],
};

export const DEFAULT_PLAYS: TacticalPlay[] = [
  receptionW,
  receptionU,
  attackCombination,
  defense213,
  defense321,
  coverage,
];
