import { DEFAULT_PLAYS } from '../src/features/tactical/defaultPlays';
import type { TacticalPlay } from '../src/models/tactical';

describe('DEFAULT_PLAYS', () => {
  it('has exactly 6 plays', () => {
    expect(DEFAULT_PLAYS).toHaveLength(6);
  });

  it('all plays are marked as default', () => {
    expect(DEFAULT_PLAYS.every((p) => p.isDefault)).toBe(true);
  });

  it('all plays have unique ids', () => {
    const ids = DEFAULT_PLAYS.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(DEFAULT_PLAYS.length);
  });

  it('all plays have a non-empty name', () => {
    for (const play of DEFAULT_PLAYS) {
      expect(play.name.length).toBeGreaterThan(0);
    }
  });

  it('all plays are for indoor_6v6', () => {
    for (const play of DEFAULT_PLAYS) {
      expect(play.format).toBe('indoor_6v6');
    }
  });

  it('all plays have valid categories', () => {
    const validCategories = ['reception', 'attack', 'defense', 'coverage', 'serve', 'custom'];
    for (const play of DEFAULT_PLAYS) {
      expect(validCategories).toContain(play.category);
    }
  });

  it('all player positions have x and y in [0,1]', () => {
    for (const play of DEFAULT_PLAYS) {
      for (const pos of play.positions) {
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThanOrEqual(1);
        expect(pos.y).toBeGreaterThanOrEqual(0);
        expect(pos.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('all arrow positions are in [0,1]', () => {
    for (const play of DEFAULT_PLAYS) {
      for (const arrow of play.arrows) {
        expect(arrow.fromX).toBeGreaterThanOrEqual(0);
        expect(arrow.fromX).toBeLessThanOrEqual(1);
        expect(arrow.fromY).toBeGreaterThanOrEqual(0);
        expect(arrow.fromY).toBeLessThanOrEqual(1);
        expect(arrow.toX).toBeGreaterThanOrEqual(0);
        expect(arrow.toX).toBeLessThanOrEqual(1);
        expect(arrow.toY).toBeGreaterThanOrEqual(0);
        expect(arrow.toY).toBeLessThanOrEqual(1);
      }
    }
  });

  it('all arrows have valid type', () => {
    const validTypes = ['solid', 'dashed', 'curved'];
    for (const play of DEFAULT_PLAYS) {
      for (const arrow of play.arrows) {
        expect(validTypes).toContain(arrow.type);
      }
    }
  });

  it('all arrows have valid thickness', () => {
    for (const play of DEFAULT_PLAYS) {
      for (const arrow of play.arrows) {
        expect(['thin', 'thick']).toContain(arrow.thickness);
      }
    }
  });

  it('each play has at least 6 home + 6 away positions for indoor 6v6', () => {
    for (const play of DEFAULT_PLAYS) {
      if (play.format === 'indoor_6v6') {
        const home = play.positions.filter((p) => p.isHome);
        const away = play.positions.filter((p) => !p.isHome);
        expect(home.length).toBe(6);
        expect(away.length).toBe(6);
      }
    }
  });

  it('home players are in bottom half (y >= 0.5)', () => {
    for (const play of DEFAULT_PLAYS) {
      const home = play.positions.filter((p) => p.isHome);
      for (const pos of home) {
        expect(pos.y).toBeGreaterThanOrEqual(0.5);
      }
    }
  });

  it('away players are in top half (y <= 0.5)', () => {
    for (const play of DEFAULT_PLAYS) {
      const away = play.positions.filter((p) => !p.isHome);
      for (const pos of away) {
        expect(pos.y).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('has at least one reception play', () => {
    expect(DEFAULT_PLAYS.some((p) => p.category === 'reception')).toBe(true);
  });

  it('has at least one defense play', () => {
    expect(DEFAULT_PLAYS.some((p) => p.category === 'defense')).toBe(true);
  });

  it('has at least one attack play', () => {
    expect(DEFAULT_PLAYS.some((p) => p.category === 'attack')).toBe(true);
  });

  it('all plays have valid createdAt ISO strings', () => {
    for (const play of DEFAULT_PLAYS) {
      expect(() => new Date(play.createdAt)).not.toThrow();
      expect(isNaN(new Date(play.createdAt).getTime())).toBe(false);
    }
  });
});
