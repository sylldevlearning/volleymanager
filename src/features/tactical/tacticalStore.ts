import { create } from 'zustand';
import type { PlayerPosition, Arrow, FreehandPath, TacticalPlay, TacticalTool, ArrowThickness } from '../../models/tactical';
import { generateId } from '../../services/database';

type DrawingEntry = { type: 'arrow'; id: string } | { type: 'freehand'; id: string };

interface TacticalState {
  positions: PlayerPosition[];
  arrows: Arrow[];
  freehandPaths: FreehandPath[];
  /** LIFO stack tracking insertion order across arrows and freehand paths */
  drawingOrder: DrawingEntry[];
  selectedTool: TacticalTool;
  arrowThickness: ArrowThickness;
  currentPlayId: string | null;
  currentPlayName: string | null;
  /** Current group number for new arrows */
  currentGroup: number;
  /** When true, successive arrows share the same group (animate simultaneously) */
  groupMode: boolean;

  setPositions: (positions: PlayerPosition[]) => void;
  movePlayer: (playerId: string, x: number, y: number) => void;
  updatePlayerInfo: (playerId: string, data: { number?: number; firstName?: string | null; lastName?: string | null; label?: string; customColor?: string }) => void;
  addArrow: (arrow: Omit<Arrow, 'id' | 'order' | 'group'>) => void;
  removeArrow: (id: string) => void;
  clearArrows: () => void;
  addFreehandPath: (d: string, color: string, hasArrow?: boolean, group?: number) => void;
  clearFreehandPaths: () => void;
  undoLastDrawing: () => void;
  toggleGroupMode: () => void;
  setTool: (tool: TacticalTool) => void;
  setArrowThickness: (thickness: ArrowThickness) => void;
  loadPlay: (play: TacticalPlay) => void;
  resetBoard: () => void;
}

export const useTacticalStore = create<TacticalState>()((set) => ({
  positions: [],
  arrows: [],
  freehandPaths: [],
  drawingOrder: [],
  selectedTool: 'move',
  arrowThickness: 'thin',
  currentPlayId: null,
  currentPlayName: null,
  currentGroup: 1,
  groupMode: false,

  setPositions: (positions) => set({ positions }),

  movePlayer: (playerId, x, y) =>
    set((state) => ({
      positions: state.positions.map((p) =>
        p.playerId === playerId ? { ...p, x, y } : p
      ),
    })),

  updatePlayerInfo: (playerId, data) =>
    set((state) => ({
      positions: state.positions.map((p) =>
        p.playerId === playerId ? { ...p, ...data } : p
      ),
    })),

  addArrow: (arrow) =>
    set((state) => {
      const order = state.arrows.length > 0
        ? Math.max(...state.arrows.map((a) => a.order)) + 1
        : 1;
      const group = state.currentGroup;
      const nextGroup = state.groupMode ? group : group + 1;
      const newId = generateId();
      return {
        arrows: [...state.arrows, { ...arrow, id: newId, order, group }],
        drawingOrder: [...state.drawingOrder, { type: 'arrow', id: newId }],
        currentGroup: nextGroup,
      };
    }),

  toggleGroupMode: () =>
    set((state) => {
      if (state.groupMode) {
        return { groupMode: false, currentGroup: state.currentGroup + 1 };
      }
      return { groupMode: true };
    }),

  removeArrow: (id) =>
    set((state) => ({
      arrows: state.arrows.filter((a) => a.id !== id),
      drawingOrder: state.drawingOrder.filter((d) => d.id !== id),
    })),

  clearArrows: () => set({ arrows: [], freehandPaths: [], drawingOrder: [], currentGroup: 1, groupMode: false }),

  addFreehandPath: (d, color, hasArrow, group) =>
    set((state) => {
      const newId = generateId();
      return {
        freehandPaths: [
          ...state.freehandPaths,
          { id: newId, d, color, hasArrow, group: group ?? state.currentGroup },
        ],
        drawingOrder: [...state.drawingOrder, { type: 'freehand', id: newId }],
      };
    }),

  clearFreehandPaths: () => set({ freehandPaths: [] }),

  undoLastDrawing: () =>
    set((state) => {
      if (state.drawingOrder.length === 0) return state;
      const last = state.drawingOrder[state.drawingOrder.length - 1];
      const newOrder = state.drawingOrder.slice(0, -1);
      if (last.type === 'arrow') {
        return { arrows: state.arrows.filter((a) => a.id !== last.id), drawingOrder: newOrder };
      }
      return { freehandPaths: state.freehandPaths.filter((fp) => fp.id !== last.id), drawingOrder: newOrder };
    }),

  setTool: (tool) => set({ selectedTool: tool }),

  setArrowThickness: (thickness) => set({ arrowThickness: thickness }),

  loadPlay: (play) =>
    set({
      positions: play.positions,
      arrows: play.arrows,
      freehandPaths: [],
      drawingOrder: [],
      selectedTool: 'move',
      currentGroup: 1,
      groupMode: false,
      currentPlayId: play.isDefault ? null : play.id,
      currentPlayName: play.name,
    }),

  resetBoard: () =>
    set({
      positions: [],
      arrows: [],
      freehandPaths: [],
      drawingOrder: [],
      selectedTool: 'move',
      currentGroup: 1,
      groupMode: false,
      currentPlayId: null,
      currentPlayName: null,
    }),
}));
