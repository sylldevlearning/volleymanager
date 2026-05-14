import { create } from 'zustand';
import type { PlayerPosition, Arrow, FreehandPath, TacticalPlay, TacticalTool, ArrowThickness } from '../../models/tactical';
import { generateId } from '../../services/database';

interface TacticalState {
  positions: PlayerPosition[];
  arrows: Arrow[];
  freehandPaths: FreehandPath[];
  selectedTool: TacticalTool;
  arrowThickness: ArrowThickness;
  isPlaying: boolean;
  playbackSpeed: 0.5 | 1 | 2;
  currentStep: number;
  currentPlayId: string | null;
  currentPlayName: string | null;
  /** Current group number for new arrows */
  currentGroup: number;
  /** When true, successive arrows share the same group (animate simultaneously) */
  groupMode: boolean;

  setPositions: (positions: PlayerPosition[]) => void;
  movePlayer: (playerId: string, x: number, y: number) => void;
  updatePlayerInfo: (playerId: string, data: { number?: number; firstName?: string | null; lastName?: string | null; label?: string }) => void;
  addArrow: (arrow: Omit<Arrow, 'id' | 'order' | 'group'>) => void;
  removeArrow: (id: string) => void;
  clearArrows: () => void;
  addFreehandPath: (d: string, color: string, hasArrow?: boolean, group?: number) => void;
  clearFreehandPaths: () => void;
  toggleGroupMode: () => void;
  setTool: (tool: TacticalTool) => void;
  setArrowThickness: (thickness: ArrowThickness) => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: 0.5 | 1 | 2) => void;
  setCurrentStep: (step: number) => void;
  loadPlay: (play: TacticalPlay) => void;
  resetBoard: () => void;
}

export const useTacticalStore = create<TacticalState>()((set, get) => ({
  positions: [],
  arrows: [],
  freehandPaths: [],
  selectedTool: 'move',
  arrowThickness: 'thin',
  isPlaying: false,
  playbackSpeed: 1,
  currentStep: 0,
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
      return {
        arrows: [...state.arrows, { ...arrow, id: generateId(), order, group }],
        currentGroup: nextGroup,
      };
    }),

  toggleGroupMode: () =>
    set((state) => {
      if (state.groupMode) {
        // Leaving group mode: advance to a new group for the next arrow
        return { groupMode: false, currentGroup: state.currentGroup + 1 };
      }
      return { groupMode: true };
    }),

  removeArrow: (id) =>
    set((state) => ({
      arrows: state.arrows.filter((a) => a.id !== id),
    })),

  clearArrows: () => set({ arrows: [], freehandPaths: [], currentGroup: 1, groupMode: false }),

  addFreehandPath: (d, color, hasArrow, group) =>
    set((state) => ({
      freehandPaths: [
        ...state.freehandPaths,
        { id: generateId(), d, color, hasArrow, group: group ?? state.currentGroup },
      ],
    })),

  clearFreehandPaths: () => set({ freehandPaths: [] }),

  setTool: (tool) => set({ selectedTool: tool }),

  setArrowThickness: (thickness) => set({ arrowThickness: thickness }),

  setPlaying: (playing) => set({ isPlaying: playing, currentStep: playing ? 0 : get().currentStep }),

  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),

  setCurrentStep: (step) => set({ currentStep: step }),

  loadPlay: (play) =>
    set({
      positions: play.positions,
      arrows: play.arrows,
      freehandPaths: [],
      selectedTool: 'move',
      isPlaying: false,
      currentStep: 0,
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
      selectedTool: 'move',
      isPlaying: false,
      currentStep: 0,
      currentGroup: 1,
      groupMode: false,
      currentPlayId: null,
      currentPlayName: null,
    }),
}));
