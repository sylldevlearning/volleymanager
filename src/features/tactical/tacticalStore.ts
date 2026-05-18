import { create } from 'zustand';
import type { PlayerPosition, Arrow, FreehandPath, TacticalPlay, TacticalTool, ArrowThickness, StepSnapshot } from '../../models/tactical';
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

  /** Ordered list of every group that was advanced via handleAdvanceGroup */
  history: StepSnapshot[];

  setPositions: (positions: PlayerPosition[]) => void;
  movePlayer: (playerId: string, x: number, y: number) => void;
  updatePlayerInfo: (playerId: string, data: { number?: number; firstName?: string | null; lastName?: string | null; label?: string; customColor?: string }) => void;
  addArrow: (arrow: Omit<Arrow, 'id' | 'order' | 'group'>) => void;
  removeArrow: (id: string) => void;
  clearArrows: () => void;
  addFreehandPath: (d: string, color: string, hasArrow?: boolean, group?: number, linkedPlayerId?: string | null) => void;
  clearFreehandPaths: () => void;
  undoLastDrawing: () => void;
  /** Advance to the next group (tap the group button) */
  advanceGroup: () => void;
  /** Reset to group 1 (long-press the group button) */
  resetGroup: () => void;
  /** Remove all arrows and traced-arrow freehand paths from a given group */
  removeGroupDrawings: (group: number) => void;
  /** Push a snapshot of a completed step into history */
  addHistorySnapshot: (snapshot: StepSnapshot) => void;
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
  history: [],

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

  clearArrows: () => set({ arrows: [], freehandPaths: [], drawingOrder: [], currentGroup: 1, history: [] }),

  addFreehandPath: (d, color, hasArrow, group, linkedPlayerId) =>
    set((state) => {
      const newId = generateId();
      return {
        freehandPaths: [
          ...state.freehandPaths,
          { id: newId, d, color, hasArrow, group: group ?? state.currentGroup, linkedPlayerId: linkedPlayerId ?? null },
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

  removeGroupDrawings: (group) =>
    set((state) => {
      const removedArrowIds = new Set(state.arrows.filter((a) => a.group === group).map((a) => a.id));
      const removedPathIds = new Set(
        state.freehandPaths.filter((fp) => fp.hasArrow && fp.group === group).map((fp) => fp.id)
      );
      return {
        arrows: state.arrows.filter((a) => a.group !== group),
        freehandPaths: state.freehandPaths.filter((fp) => !(fp.hasArrow && fp.group === group)),
        drawingOrder: state.drawingOrder.filter((d) => !removedArrowIds.has(d.id) && !removedPathIds.has(d.id)),
      };
    }),

  addHistorySnapshot: (snapshot) =>
    set((state) => ({ history: [...state.history, snapshot] })),

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
      history: [],
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
      history: [],
    }),
}));
