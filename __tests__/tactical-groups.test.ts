import { useTacticalStore } from '../src/features/tactical/tacticalStore';

const { getState, setState } = useTacticalStore;

function reset() {
  setState({
    positions: [], arrows: [], freehandPaths: [], drawingOrder: [],
    selectedTool: 'move', arrowThickness: 'thin',
    currentGroup: 1,
    currentPlayId: null, currentPlayName: null,
  });
}

const baseArrow = () => ({
  type: 'solid' as const,
  fromX: 0.1, fromY: 0.1,
  toX: 0.9, toY: 0.9,
  color: '#fff',
  thickness: 'thin' as const,
});

describe('tacticalStore — group cycling', () => {
  beforeEach(reset);

  it('all arrows use currentGroup by default (no auto-increment)', () => {
    const { addArrow } = getState();
    addArrow(baseArrow());
    addArrow(baseArrow());
    const { arrows } = getState();
    expect(arrows[0].group).toBe(1);
    expect(arrows[1].group).toBe(1);
  });

  it('advanceGroup increments currentGroup', () => {
    getState().advanceGroup();
    expect(getState().currentGroup).toBe(2);
    getState().advanceGroup();
    expect(getState().currentGroup).toBe(3);
  });

  it('arrows after advanceGroup get the new group', () => {
    getState().addArrow(baseArrow()); // group 1
    getState().advanceGroup();
    getState().addArrow(baseArrow()); // group 2
    getState().addArrow(baseArrow()); // group 2 still
    const { arrows } = getState();
    expect(arrows[0].group).toBe(1);
    expect(arrows[1].group).toBe(2);
    expect(arrows[2].group).toBe(2);
  });

  it('resetGroup goes back to group 1', () => {
    getState().advanceGroup();
    getState().advanceGroup();
    expect(getState().currentGroup).toBe(3);
    getState().resetGroup();
    expect(getState().currentGroup).toBe(1);
  });

  it('clearArrows resets to group 1', () => {
    getState().advanceGroup();
    getState().addArrow(baseArrow());
    getState().clearArrows();
    const { currentGroup, arrows, freehandPaths } = getState();
    expect(currentGroup).toBe(1);
    expect(arrows).toHaveLength(0);
    expect(freehandPaths).toHaveLength(0);
  });

  it('addFreehandPath stores path with id', () => {
    const { addFreehandPath } = getState();
    addFreehandPath('M 10 10 L 50 50', '#E63946');
    const { freehandPaths } = getState();
    expect(freehandPaths).toHaveLength(1);
    expect(freehandPaths[0].d).toBe('M 10 10 L 50 50');
    expect(freehandPaths[0].color).toBe('#E63946');
    expect(freehandPaths[0].id).toBeTruthy();
  });

  it('freehand paths use currentGroup', () => {
    getState().advanceGroup(); // group 2
    getState().addFreehandPath('M 0 0 L 1 1', '#fff');
    expect(getState().freehandPaths[0].group).toBe(2);
  });
});
