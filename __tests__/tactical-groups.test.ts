import { useTacticalStore } from '../src/features/tactical/tacticalStore';

const { getState, setState } = useTacticalStore;

function reset() {
  setState({
    positions: [], arrows: [], freehandPaths: [],
    selectedTool: 'move', arrowThickness: 'thin',
    currentGroup: 1, groupMode: false,
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

describe('tacticalStore — group mode', () => {
  beforeEach(reset);

  it('sequential mode: each arrow gets an incrementing group', () => {
    const { addArrow } = getState();
    addArrow(baseArrow());
    addArrow(baseArrow());
    const { arrows } = getState();
    expect(arrows[0].group).toBe(1);
    expect(arrows[1].group).toBe(2);
  });

  it('group mode ON: successive arrows share the same group', () => {
    const store = getState();
    store.toggleGroupMode(); // enter group mode
    store.addArrow(baseArrow());
    store.addArrow(baseArrow());
    const { arrows } = getState();
    expect(arrows[0].group).toBe(arrows[1].group);
  });

  it('group mode OFF after toggle: next arrow gets new group', () => {
    const store = getState();
    store.addArrow(baseArrow()); // group 1
    store.toggleGroupMode();     // ON: currentGroup stays 2 (after sequential increment)
    store.addArrow(baseArrow()); // group 2
    store.addArrow(baseArrow()); // group 2 still
    store.toggleGroupMode();     // OFF: currentGroup becomes 3
    store.addArrow(baseArrow()); // group 3
    const { arrows } = getState();
    expect(arrows[0].group).toBe(1);
    expect(arrows[1].group).toBe(arrows[2].group); // same group
    expect(arrows[3].group).toBeGreaterThan(arrows[2].group);
  });

  it('clearArrows resets group state', () => {
    const store = getState();
    store.addArrow(baseArrow());
    store.toggleGroupMode();
    store.clearArrows();
    const { currentGroup, groupMode, arrows, freehandPaths } = getState();
    expect(currentGroup).toBe(1);
    expect(groupMode).toBe(false);
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
});
