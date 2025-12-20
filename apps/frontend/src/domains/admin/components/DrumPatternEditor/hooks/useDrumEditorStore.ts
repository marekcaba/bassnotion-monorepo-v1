/**
 * Drum Editor Zustand Store
 *
 * State management for the drum pattern editor.
 * Handles pattern data, grid settings, selection, and history (undo/redo).
 *
 * NOTE: This store intentionally does NOT use immer middleware to avoid
 * React 19 compatibility issues with useSyncExternalStore.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  DrumEditorStore,
  DrumEditorState,
  DrumHit,
  MidiDrumType,
  MusicalPosition,
  GridResolution,
  EditMode,
  PatternMetadata,
  GridPosition,
  DrumLaneConfig,
} from '../types.js';
import {
  DEFAULT_DRUM_LANES,
  DEFAULT_VISIBLE_LANES,
  DEFAULT_EDITOR_SETTINGS,
  DEFAULT_VELOCITY,
  MAX_HISTORY_SIZE,
  DRUM_TO_MIDI_NOTE,
} from '../constants.js';
import {
  musicalToGridColumn,
  gridToMusicalPosition,
  positionsEqual,
  getTotalColumns,
} from '../utils/gridPositionUtils.js';

/**
 * Get fresh initial state (creates new object references each time)
 */
const getInitialState = (): DrumEditorState => ({
  // Pattern Data
  pattern: [],
  patternId: null,
  patternName: 'Untitled Pattern',
  bars: DEFAULT_EDITOR_SETTINGS.bars,
  timeSignature: { ...DEFAULT_EDITOR_SETTINGS.timeSignature },

  // Grid Settings
  gridResolution: DEFAULT_EDITOR_SETTINGS.gridResolution,
  snapEnabled: DEFAULT_EDITOR_SETTINGS.snapEnabled,
  zoomLevel: DEFAULT_EDITOR_SETTINGS.zoomLevel,

  // Groove Settings
  swingAmount: DEFAULT_EDITOR_SETTINGS.swingAmount,

  // Selection & Editing
  selectedHitIds: [],
  clipboard: [],
  editMode: 'draw',

  // Playback Preview
  isPlaying: false,
  isLooping: true,
  previewTempo: DEFAULT_EDITOR_SETTINGS.tempo,
  currentPlayheadTick: 0,

  // Lane Configuration
  lanes: DEFAULT_DRUM_LANES.map(lane => ({ ...lane })),
  visibleLanes: [...DEFAULT_VISIBLE_LANES],

  // History (Undo/Redo)
  history: [],
  historyIndex: -1,

  // Dirty flag
  isDirty: false,
});

/**
 * Create the Zustand store WITHOUT immer for React 19 compatibility
 */
export const useDrumEditorStore = create<DrumEditorStore>()((set, get) => ({
  ...getInitialState(),

  // ==================== Hit Management ====================

  addHit: (drum: MidiDrumType, position: MusicalPosition, velocity = DEFAULT_VELOCITY) => {
    const state = get();
    // Check if hit already exists at this position
    const existing = state.pattern.find(
      (h) => h.drum === drum && positionsEqual(h.position, position)
    );
    if (existing) return; // Don't add duplicate

    const newHit: DrumHit = {
      id: uuidv4(),
      drum,
      velocity,
      position: { ...position },
      durationTicks: 120, // Default duration (quarter of a beat at 480 PPQ)
      midiNote: DRUM_TO_MIDI_NOTE[drum] || 36,
    };

    set({
      pattern: [...state.pattern, newHit],
      isDirty: true,
    });
    get().pushHistory();
  },

  removeHit: (hitId: string) => {
    const state = get();
    const newPattern = state.pattern.filter((h) => h.id !== hitId);
    if (newPattern.length !== state.pattern.length) {
      set({
        pattern: newPattern,
        selectedHitIds: state.selectedHitIds.filter((id) => id !== hitId),
        isDirty: true,
      });
      get().pushHistory();
    }
  },

  toggleHit: (drum: MidiDrumType, position: MusicalPosition) => {
    const state = get();
    const existing = state.pattern.find(
      (h) => h.drum === drum && positionsEqual(h.position, position)
    );

    if (existing) {
      get().removeHit(existing.id);
    } else {
      get().addHit(drum, position);
    }
  },

  updateHitVelocity: (hitId: string, velocity: number) => {
    const state = get();
    const clampedVelocity = Math.max(1, Math.min(127, velocity));
    set({
      pattern: state.pattern.map((h) =>
        h.id === hitId ? { ...h, velocity: clampedVelocity } : h
      ),
      isDirty: true,
    });
    get().pushHistory();
  },

  moveHit: (hitId: string, newPosition: MusicalPosition) => {
    const state = get();
    set({
      pattern: state.pattern.map((h) =>
        h.id === hitId ? { ...h, position: { ...newPosition } } : h
      ),
      isDirty: true,
    });
    get().pushHistory();
  },

  // ==================== Settings ====================

  setSwing: (amount: number) => {
    set({
      swingAmount: Math.max(0, Math.min(100, amount)),
      isDirty: true,
    });
  },

  setGridResolution: (resolution: GridResolution) => {
    set({ gridResolution: resolution });
  },

  setBars: (bars: number) => {
    set({ bars, isDirty: true });
  },

  setTempo: (bpm: number) => {
    set({ previewTempo: Math.max(40, Math.min(300, bpm)) });
  },

  setEditMode: (mode: EditMode) => {
    set({ editMode: mode });
  },

  setZoomLevel: (zoom: number) => {
    // Clamp between 0.5 and 2.0 (from ZOOM_LIMITS)
    set({ zoomLevel: Math.max(0.5, Math.min(2.0, zoom)) });
  },

  // ==================== Selection ====================

  selectHit: (hitId: string, addToSelection = false) => {
    const state = get();
    if (addToSelection) {
      const idx = state.selectedHitIds.indexOf(hitId);
      if (idx !== -1) {
        set({
          selectedHitIds: state.selectedHitIds.filter((id) => id !== hitId),
        });
      } else {
        set({
          selectedHitIds: [...state.selectedHitIds, hitId],
        });
      }
    } else {
      set({ selectedHitIds: [hitId] });
    }
  },

  selectHitsInRange: (startPos: GridPosition, endPos: GridPosition) => {
    const state = get();
    const minCol = Math.min(startPos.col, endPos.col);
    const maxCol = Math.max(startPos.col, endPos.col);
    const minRow = Math.min(startPos.row, endPos.row);
    const maxRow = Math.max(startPos.row, endPos.row);

    const selected: string[] = [];
    state.pattern.forEach((hit) => {
      const col = musicalToGridColumn(
        hit.position,
        state.gridResolution,
        state.timeSignature
      );
      const row = state.lanes.findIndex((lane) => lane.drum === hit.drum);

      if (col >= minCol && col <= maxCol && row >= minRow && row <= maxRow) {
        selected.push(hit.id);
      }
    });

    set({ selectedHitIds: selected });
  },

  selectAll: () => {
    const state = get();
    set({ selectedHitIds: state.pattern.map((h) => h.id) });
  },

  clearSelection: () => {
    set({ selectedHitIds: [] });
  },

  deleteSelected: () => {
    const state = get();
    set({
      pattern: state.pattern.filter((h) => !state.selectedHitIds.includes(h.id)),
      selectedHitIds: [],
      isDirty: true,
    });
    get().pushHistory();
  },

  // ==================== Clipboard ====================

  copySelection: () => {
    const state = get();
    const selected = state.pattern.filter((h) =>
      state.selectedHitIds.includes(h.id)
    );
    set({
      clipboard: selected.map((h) => ({ ...h, position: { ...h.position } })),
    });
  },

  pasteClipboard: (position: MusicalPosition) => {
    const state = get();
    if (state.clipboard.length === 0) return;

    // Find the earliest position in clipboard to use as reference
    const minCol = Math.min(
      ...state.clipboard.map((h) =>
        musicalToGridColumn(h.position, state.gridResolution, state.timeSignature)
      )
    );
    const targetCol = musicalToGridColumn(
      position,
      state.gridResolution,
      state.timeSignature
    );
    const offset = targetCol - minCol;

    const newHits: DrumHit[] = state.clipboard.map((h) => {
      const originalCol = musicalToGridColumn(
        h.position,
        state.gridResolution,
        state.timeSignature
      );
      const newCol = originalCol + offset;
      const newPosition = gridToMusicalPosition(
        { row: 0, col: newCol },
        state.gridResolution,
        state.timeSignature
      );

      return {
        ...h,
        id: uuidv4(),
        position: { ...newPosition },
      };
    });

    set({
      pattern: [...state.pattern, ...newHits],
      selectedHitIds: newHits.map((h) => h.id),
      isDirty: true,
    });
    get().pushHistory();
  },

  // ==================== History (Undo/Redo) ====================

  pushHistory: () => {
    const state = get();
    let newHistory = state.history;

    // Remove any future history if we're not at the end
    if (state.historyIndex < state.history.length - 1) {
      newHistory = state.history.slice(0, state.historyIndex + 1);
    }

    // Add current state to history
    const snapshotPattern = state.pattern.map((h) => ({
      ...h,
      position: { ...h.position },
    }));
    newHistory = [...newHistory, snapshotPattern];

    // Trim history if too long
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory = newHistory.slice(-MAX_HISTORY_SIZE);
    }

    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      set({
        historyIndex: newIndex,
        pattern: state.history[newIndex].map((h) => ({
          ...h,
          position: { ...h.position },
        })),
        selectedHitIds: [],
      });
    }
  },

  redo: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      set({
        historyIndex: newIndex,
        pattern: state.history[newIndex].map((h) => ({
          ...h,
          position: { ...h.position },
        })),
        selectedHitIds: [],
      });
    }
  },

  // ==================== Pattern Operations ====================

  clearPattern: () => {
    set({
      pattern: [],
      selectedHitIds: [],
      isDirty: true,
    });
    get().pushHistory();
  },

  loadPattern: (pattern: DrumHit[], metadata?: Partial<PatternMetadata>) => {
    const updates: Partial<DrumEditorState> = {
      pattern: pattern.map((h) => ({ ...h, position: { ...h.position } })),
      selectedHitIds: [],
      history: [],
      historyIndex: -1,
      isDirty: false,
    };

    if (metadata) {
      if (metadata.id) updates.patternId = metadata.id;
      if (metadata.name) updates.patternName = metadata.name;
      if (metadata.bars) updates.bars = metadata.bars;
      if (metadata.timeSignature) {
        updates.timeSignature = { ...metadata.timeSignature };
      }
      if (metadata.tempo) updates.previewTempo = metadata.tempo;
    }

    set(updates);
    get().pushHistory();
  },

  resetToInitial: () => {
    set(getInitialState());
  },

  // ==================== Lane Management ====================

  toggleLaneMute: (drum: MidiDrumType) => {
    const state = get();
    set({
      lanes: state.lanes.map((lane) =>
        lane.drum === drum ? { ...lane, muted: !lane.muted } : lane
      ),
    });
  },

  toggleLaneCollapse: (drum: MidiDrumType) => {
    const state = get();
    set({
      lanes: state.lanes.map((lane) =>
        lane.drum === drum ? { ...lane, collapsed: !lane.collapsed } : lane
      ),
    });
  },

  setLaneVolume: (drum: MidiDrumType, volume: number) => {
    const state = get();
    const clampedVolume = Math.max(0, Math.min(1, volume));
    set({
      lanes: state.lanes.map((lane) =>
        lane.drum === drum ? { ...lane, volume: clampedVolume } : lane
      ),
    });
  },

  setVisibleLanes: (lanes: MidiDrumType[]) => {
    set({ visibleLanes: [...lanes] });
  },

  // ==================== Playback ====================

  play: () => {
    set({ isPlaying: true });
  },

  stop: () => {
    set({ isPlaying: false, currentPlayheadTick: 0 });
  },

  toggleLoop: () => {
    const state = get();
    set({ isLooping: !state.isLooping });
  },

  setPlayheadTick: (tick: number) => {
    set({ currentPlayheadTick: tick });
  },
}));

/**
 * Selectors for commonly used computed values
 */
export const selectTotalColumns = (state: DrumEditorStore) =>
  getTotalColumns(state.bars, state.gridResolution, state.timeSignature);

export const selectHitsForLane = (state: DrumEditorStore, drum: MidiDrumType) =>
  state.pattern.filter((h) => h.drum === drum);

export const selectVisibleLaneConfigs = (state: DrumEditorStore) =>
  state.lanes.filter((lane) => state.visibleLanes.includes(lane.drum));

export const selectCanUndo = (state: DrumEditorStore) => state.historyIndex > 0;

export const selectCanRedo = (state: DrumEditorStore) =>
  state.historyIndex < state.history.length - 1;

export const selectIsEmpty = (state: DrumEditorStore) =>
  state.pattern.length === 0;

export const selectHasSelection = (state: DrumEditorStore) =>
  state.selectedHitIds.length > 0;
