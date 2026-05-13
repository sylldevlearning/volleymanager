import { act, renderHook } from '@testing-library/react-native';
import { useTacticalStore } from '../src/features/tactical/tacticalStore';
import type { PlayerPosition, Arrow } from '../src/models/tactical';

// Mock database for generateId
jest.mock('../src/services/database', () => ({
  generateId: () => `mock-id-${Math.random().toString(36).slice(2, 8)}`,
  getDb: jest.fn(),
}));

function reset() {
  act(() => {
    useTacticalStore.getState().resetBoard();
  });
}

const mockPos = (id: string, x: number, y: number): PlayerPosition => ({
  playerId: id,
  x,
  y,
  teamId: 'home',
  number: 1,
  label: '1',
  isHome: true,
});

const mockArrow = (fromX: number, fromY: number, toX: number, toY: number): Omit<Arrow, 'id' | 'order' | 'group'> => ({
  type: 'solid',
  fromX,
  fromY,
  toX,
  toY,
  color: '#1D4ED8',
  thickness: 'thin',
});

describe('useTacticalStore — initial state', () => {
  beforeEach(reset);

  it('starts with empty positions', () => {
    const { positions } = useTacticalStore.getState();
    expect(positions).toHaveLength(0);
  });

  it('starts with empty arrows', () => {
    const { arrows } = useTacticalStore.getState();
    expect(arrows).toHaveLength(0);
  });

  it('starts with move tool', () => {
    expect(useTacticalStore.getState().selectedTool).toBe('move');
  });

  it('starts with playback speed 1', () => {
    expect(useTacticalStore.getState().playbackSpeed).toBe(1);
  });

  it('starts not playing', () => {
    expect(useTacticalStore.getState().isPlaying).toBe(false);
  });
});

describe('useTacticalStore — setPositions', () => {
  beforeEach(reset);

  it('sets positions array', () => {
    const { setPositions } = useTacticalStore.getState();
    act(() => {
      setPositions([mockPos('p1', 0.5, 0.7), mockPos('p2', 0.2, 0.8)]);
    });
    expect(useTacticalStore.getState().positions).toHaveLength(2);
  });
});

describe('useTacticalStore — movePlayer', () => {
  beforeEach(reset);

  it('updates x and y of specified player', () => {
    act(() => {
      useTacticalStore.getState().setPositions([mockPos('p1', 0.5, 0.5)]);
      useTacticalStore.getState().movePlayer('p1', 0.8, 0.9);
    });
    const { positions } = useTacticalStore.getState();
    expect(positions[0].x).toBe(0.8);
    expect(positions[0].y).toBe(0.9);
  });

  it('does not modify other players', () => {
    act(() => {
      useTacticalStore.getState().setPositions([
        mockPos('p1', 0.5, 0.5),
        mockPos('p2', 0.2, 0.8),
      ]);
      useTacticalStore.getState().movePlayer('p1', 0.9, 0.9);
    });
    const { positions } = useTacticalStore.getState();
    const p2 = positions.find((p) => p.playerId === 'p2');
    expect(p2?.x).toBe(0.2);
    expect(p2?.y).toBe(0.8);
  });

  it('ignores unknown player id', () => {
    act(() => {
      useTacticalStore.getState().setPositions([mockPos('p1', 0.5, 0.5)]);
      useTacticalStore.getState().movePlayer('unknown', 0.1, 0.1);
    });
    expect(useTacticalStore.getState().positions[0].x).toBe(0.5);
  });
});

describe('useTacticalStore — addArrow', () => {
  beforeEach(reset);

  it('adds an arrow with auto-generated id and order=1', () => {
    act(() => {
      useTacticalStore.getState().addArrow(mockArrow(0.1, 0.1, 0.5, 0.5));
    });
    const { arrows } = useTacticalStore.getState();
    expect(arrows).toHaveLength(1);
    expect(arrows[0].id).toBeTruthy();
    expect(arrows[0].order).toBe(1);
  });

  it('increments order for subsequent arrows', () => {
    act(() => {
      useTacticalStore.getState().addArrow(mockArrow(0.1, 0.1, 0.5, 0.5));
      useTacticalStore.getState().addArrow(mockArrow(0.5, 0.5, 0.9, 0.9));
    });
    const { arrows } = useTacticalStore.getState();
    expect(arrows[1].order).toBe(2);
  });

  it('preserves all arrow fields', () => {
    act(() => {
      useTacticalStore.getState().addArrow({
        type: 'dashed',
        fromX: 0.1, fromY: 0.2,
        toX: 0.7, toY: 0.8,
        color: '#FBBF24',
        thickness: 'thick',
      });
    });
    const arrow = useTacticalStore.getState().arrows[0];
    expect(arrow.type).toBe('dashed');
    expect(arrow.color).toBe('#FBBF24');
    expect(arrow.thickness).toBe('thick');
  });
});

describe('useTacticalStore — removeArrow', () => {
  beforeEach(reset);

  it('removes the arrow with given id', () => {
    act(() => {
      useTacticalStore.getState().addArrow(mockArrow(0.1, 0.1, 0.5, 0.5));
      useTacticalStore.getState().addArrow(mockArrow(0.5, 0.5, 0.9, 0.9));
    });
    const id = useTacticalStore.getState().arrows[0].id;
    act(() => {
      useTacticalStore.getState().removeArrow(id);
    });
    expect(useTacticalStore.getState().arrows).toHaveLength(1);
    expect(useTacticalStore.getState().arrows[0].id).not.toBe(id);
  });

  it('ignores unknown id', () => {
    act(() => {
      useTacticalStore.getState().addArrow(mockArrow(0.1, 0.1, 0.5, 0.5));
      useTacticalStore.getState().removeArrow('nonexistent');
    });
    expect(useTacticalStore.getState().arrows).toHaveLength(1);
  });
});

describe('useTacticalStore — clearArrows', () => {
  beforeEach(reset);

  it('removes all arrows', () => {
    act(() => {
      useTacticalStore.getState().addArrow(mockArrow(0.1, 0.1, 0.5, 0.5));
      useTacticalStore.getState().addArrow(mockArrow(0.5, 0.5, 0.9, 0.9));
      useTacticalStore.getState().clearArrows();
    });
    expect(useTacticalStore.getState().arrows).toHaveLength(0);
  });
});

describe('useTacticalStore — setTool', () => {
  beforeEach(reset);

  it('changes selectedTool', () => {
    act(() => {
      useTacticalStore.getState().setTool('arrow_solid');
    });
    expect(useTacticalStore.getState().selectedTool).toBe('arrow_solid');
  });
});

describe('useTacticalStore — setPlaying', () => {
  beforeEach(reset);

  it('sets isPlaying to true and resets currentStep', () => {
    act(() => {
      useTacticalStore.getState().setCurrentStep(3);
      useTacticalStore.getState().setPlaying(true);
    });
    expect(useTacticalStore.getState().isPlaying).toBe(true);
    expect(useTacticalStore.getState().currentStep).toBe(0);
  });

  it('sets isPlaying to false without resetting step', () => {
    act(() => {
      useTacticalStore.getState().setCurrentStep(2);
      useTacticalStore.getState().setPlaying(false);
    });
    expect(useTacticalStore.getState().isPlaying).toBe(false);
    expect(useTacticalStore.getState().currentStep).toBe(2);
  });
});

describe('useTacticalStore — setPlaybackSpeed', () => {
  beforeEach(reset);

  it('sets speed to 0.5', () => {
    act(() => {
      useTacticalStore.getState().setPlaybackSpeed(0.5);
    });
    expect(useTacticalStore.getState().playbackSpeed).toBe(0.5);
  });

  it('sets speed to 2', () => {
    act(() => {
      useTacticalStore.getState().setPlaybackSpeed(2);
    });
    expect(useTacticalStore.getState().playbackSpeed).toBe(2);
  });
});

describe('useTacticalStore — loadPlay', () => {
  beforeEach(reset);

  it('loads positions and arrows from play', () => {
    const play = {
      id: 'test',
      name: 'Test',
      format: 'indoor_6v6' as const,
      category: 'custom' as const,
      positions: [mockPos('p1', 0.5, 0.7)],
      arrows: [],
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    act(() => {
      useTacticalStore.getState().loadPlay(play);
    });
    expect(useTacticalStore.getState().positions).toHaveLength(1);
    expect(useTacticalStore.getState().selectedTool).toBe('move');
    expect(useTacticalStore.getState().isPlaying).toBe(false);
  });
});

describe('useTacticalStore — resetBoard', () => {
  beforeEach(reset);

  it('clears positions, arrows and resets state', () => {
    act(() => {
      useTacticalStore.getState().setPositions([mockPos('p1', 0.5, 0.5)]);
      useTacticalStore.getState().addArrow(mockArrow(0.1, 0.1, 0.9, 0.9));
      useTacticalStore.getState().setTool('arrow_dashed');
      useTacticalStore.getState().setPlaying(true);
      useTacticalStore.getState().resetBoard();
    });
    const state = useTacticalStore.getState();
    expect(state.positions).toHaveLength(0);
    expect(state.arrows).toHaveLength(0);
    expect(state.selectedTool).toBe('move');
    expect(state.isPlaying).toBe(false);
  });
});
