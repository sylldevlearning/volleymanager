import {
  HOME_POSITION_COORDS,
  AWAY_POSITION_COORDS,
  buildInitialPositions,
  findNearestPlayer,
  clamp,
  easeInOut,
} from '../src/features/tactical/positionUtils';
import type { PlayerPosition } from '../src/models/tactical';

const MOCK_HOME = [
  { id: 'h1', number: 1, teamId: 'home' },
  { id: 'h2', number: 2, teamId: 'home' },
  { id: 'h3', number: 3, teamId: 'home' },
  { id: 'h4', number: 4, teamId: 'home' },
  { id: 'h5', number: 5, teamId: 'home' },
  { id: 'h6', number: 6, teamId: 'home' },
];

const MOCK_AWAY = [
  { id: 'a1', number: 7, teamId: 'away' },
  { id: 'a2', number: 8, teamId: 'away' },
  { id: 'a3', number: 9, teamId: 'away' },
  { id: 'a4', number: 10, teamId: 'away' },
  { id: 'a5', number: 11, teamId: 'away' },
  { id: 'a6', number: 12, teamId: 'away' },
];

describe('HOME_POSITION_COORDS', () => {
  it('has 6 positions', () => {
    expect(Object.keys(HOME_POSITION_COORDS)).toHaveLength(6);
  });

  it('all positions are in bottom half (y >= 0.5)', () => {
    for (const coord of Object.values(HOME_POSITION_COORDS)) {
      expect(coord.y).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('all x and y values are between 0 and 1', () => {
    for (const coord of Object.values(HOME_POSITION_COORDS)) {
      expect(coord.x).toBeGreaterThanOrEqual(0);
      expect(coord.x).toBeLessThanOrEqual(1);
      expect(coord.y).toBeGreaterThanOrEqual(0);
      expect(coord.y).toBeLessThanOrEqual(1);
    }
  });
});

describe('AWAY_POSITION_COORDS', () => {
  it('has 6 positions', () => {
    expect(Object.keys(AWAY_POSITION_COORDS)).toHaveLength(6);
  });

  it('all positions are in top half (y <= 0.5)', () => {
    for (const coord of Object.values(AWAY_POSITION_COORDS)) {
      expect(coord.y).toBeLessThanOrEqual(0.5);
    }
  });

  it('P3 is at center x for both teams', () => {
    expect(HOME_POSITION_COORDS[3].x).toBe(0.50);
    expect(AWAY_POSITION_COORDS[3].x).toBe(0.50);
  });
});

describe('buildInitialPositions', () => {
  it('returns 12 players for indoor 6v6', () => {
    const positions = buildInitialPositions(
      MOCK_HOME, MOCK_AWAY, 'home', 'away',
      'indoor_6v6', [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]
    );
    expect(positions).toHaveLength(12);
  });

  it('assigns isHome=true for home players', () => {
    const positions = buildInitialPositions(
      MOCK_HOME, MOCK_AWAY, 'home', 'away',
      'indoor_6v6', [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]
    );
    const homePlayers = positions.filter((p) => p.isHome);
    expect(homePlayers).toHaveLength(6);
    expect(homePlayers.every((p) => p.teamId === 'home')).toBe(true);
  });

  it('assigns isHome=false for away players', () => {
    const positions = buildInitialPositions(
      MOCK_HOME, MOCK_AWAY, 'home', 'away',
      'indoor_6v6', [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]
    );
    const awayPlayers = positions.filter((p) => !p.isHome);
    expect(awayPlayers).toHaveLength(6);
  });

  it('returns 4 players for beach 2v2', () => {
    const positions = buildInitialPositions(
      MOCK_HOME.slice(0, 2), MOCK_AWAY.slice(0, 2), 'home', 'away',
      'beach_2v2', [1, 2], [1, 2]
    );
    expect(positions).toHaveLength(4);
  });

  it('home positions are in bottom half for indoor', () => {
    const positions = buildInitialPositions(
      MOCK_HOME, MOCK_AWAY, 'home', 'away',
      'indoor_6v6', [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]
    );
    const home = positions.filter((p) => p.isHome);
    expect(home.every((p) => p.y >= 0.5)).toBe(true);
  });

  it('away positions are in top half for indoor', () => {
    const positions = buildInitialPositions(
      MOCK_HOME, MOCK_AWAY, 'home', 'away',
      'indoor_6v6', [1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, 6]
    );
    const away = positions.filter((p) => !p.isHome);
    expect(away.every((p) => p.y <= 0.5)).toBe(true);
  });

  it('handles empty player arrays gracefully', () => {
    const positions = buildInitialPositions(
      [], [], 'home', 'away',
      'indoor_6v6', [], []
    );
    expect(positions).toHaveLength(0);
  });
});

describe('findNearestPlayer', () => {
  const positions: PlayerPosition[] = [
    { playerId: 'p1', x: 0.2, y: 0.8, teamId: 'home', number: 1, label: '1', isHome: true },
    { playerId: 'p2', x: 0.5, y: 0.6, teamId: 'home', number: 2, label: '2', isHome: true },
    { playerId: 'p3', x: 0.8, y: 0.8, teamId: 'home', number: 3, label: '3', isHome: true },
  ];

  it('finds the nearest player', () => {
    const nearest = findNearestPlayer(positions, 0.19, 0.81);
    expect(nearest?.playerId).toBe('p1');
  });

  it('finds center player when equidistant', () => {
    const nearest = findNearestPlayer(positions, 0.5, 0.6);
    expect(nearest?.playerId).toBe('p2');
  });

  it('returns null for empty array', () => {
    expect(findNearestPlayer([], 0.5, 0.5)).toBeNull();
  });

  it('works with a single player', () => {
    const nearest = findNearestPlayer([positions[0]], 0.9, 0.1);
    expect(nearest?.playerId).toBe('p1');
  });
});

describe('clamp', () => {
  it('clamps above max', () => {
    expect(clamp(1.5, 0, 1)).toBe(1);
  });

  it('clamps below min', () => {
    expect(clamp(-0.1, 0, 1)).toBe(0);
  });

  it('passes through value in range', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe('easeInOut', () => {
  it('returns 0 at t=0', () => {
    expect(easeInOut(0)).toBe(0);
  });

  it('returns 1 at t=1', () => {
    expect(easeInOut(1)).toBe(1);
  });

  it('returns ~0.5 at t=0.5', () => {
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
  });

  it('is monotonically increasing', () => {
    let prev = 0;
    for (let t = 0.1; t <= 1.0; t += 0.1) {
      const val = easeInOut(t);
      expect(val).toBeGreaterThan(prev);
      prev = val;
    }
  });
});
