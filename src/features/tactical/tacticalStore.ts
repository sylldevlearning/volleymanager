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
  /** Current group number — all new drawings are stamped with this group */
  currentGroup: number;

  setPositions: (positions: PlayerPosition[]) => void;
  movePlayer: (playerId: string, x: number, y: number) => void;
  updatePlayerInfo: (playerId: string, data: { number?: number; firstName?: string | null; lastName?: string | null; label?: string; customColor?: string }) => void;
  addArrow: (arrow: Omit<Arrow, 'id' | 'order' | 'group'>) => void;
  removeArrow: (id: string) => void;
  clearArrows: () => void;
  addFreehandPath: (d: string, color: string, hasArrow?: boolean, group?: number) => void;
  clearFreehandPaths: () => void;
  undoLastDrawing: () => void;
  /** Advance to the next group (tap the group button) */
  advanceGroup: () => void;
  /** Reset to group 1 (long-press the group button) */
  resetGroup: () => void;
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
      const newId = generateId();
      return {
        arrows: [...state.arrows, { ...arrow, id: newId, order, group: state.currentGroup }],
        drawingOrder: [...state.drawingOrder, { type: 'arrow', id: newId }],
        // currentGroup stays — user advances manually via advanceGroup
      };
    }),

  removeArrow: (id) =>
    set((state) => ({
      arrows: state.arrows.filter((a) => a.id !== id),
      drawingOrder: state.drawingOrder.filter((d) => d.id !== id),
    })),

  clearArrows: () => set({ arrows: [], freehandPaths: [], drawingOrder: [], currentGroup: 1 }),

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

  advanceGroup: () => set((state) => ({ currentGroup: state.currentGroup + 1 })),

  resetGroup: () => set({ currentGroup: 1 }),

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
      currentPlayId: null,
      currentPlayName: null,
    }),
}));
