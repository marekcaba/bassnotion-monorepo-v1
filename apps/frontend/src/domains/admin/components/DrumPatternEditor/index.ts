/**
 * Drum Pattern Editor
 *
 * Grid-based drum pattern editor with 18 lanes and playback preview.
 * Used by content creators to create and edit drum patterns for exercises.
 */

// Main components
export { DrumPatternEditorModal } from './DrumPatternEditorModal.js';
export { DrumGrid } from './DrumGrid.js';
export { DrumLaneRow } from './DrumLaneRow.js';
export { DrumCell } from './DrumCell.js';
export { DrumEditorTransport } from './DrumEditorTransport.js';

// Types
export type {
  GridResolution,
  EditMode,
  DrumLaneConfig,
  PatternMetadata,
  GridPosition,
  GridCellData,
  PlaybackState,
  SwingConfig,
  DrumEditorState,
  DrumEditorActions,
  DrumEditorStore,
  DrumPatternEditorModalProps,
  DrumGridProps,
  DrumLaneRowProps,
  DrumCellProps,
  DrumEditorTransportProps,
} from './types.js';

// Re-export contract types
export type { DrumHit, MidiDrumType, MusicalPosition } from './types.js';

// Constants
export {
  DEFAULT_DRUM_LANES,
  DEFAULT_VISIBLE_LANES,
  ESSENTIAL_LANES,
  MIDI_NOTE_TO_DRUM,
  DRUM_TO_MIDI_NOTE,
  RESOLUTION_TO_TICKS,
  RESOLUTION_TO_CELLS_PER_BEAT,
  DEFAULT_EDITOR_SETTINGS,
  DEFAULT_VELOCITY,
  VELOCITY_PRESETS,
  MAX_HISTORY_SIZE,
  CELL_DIMENSIONS,
  PPQ,
  ZOOM_LIMITS,
  BAR_OPTIONS,
  GRID_RESOLUTION_OPTIONS,
  TEMPO_LIMITS,
} from './constants.js';

// Utilities
export {
  gridToMusicalPosition,
  musicalToGridColumn,
  musicalToTicks,
  ticksToMusical,
  musicalToSeconds,
  secondsToTicks,
  getTotalColumns,
  getTotalTicks,
  snapToGrid,
  isBeatBoundary,
  isMeasureBoundary,
  applySwing,
  comparePositions,
  positionsEqual,
  tickToColumn,
} from './utils/gridPositionUtils.js';

// Hooks
export {
  useDrumEditorStore,
  selectTotalColumns,
  selectHitsForLane,
  selectVisibleLaneConfigs,
  selectCanUndo,
  selectCanRedo,
  selectIsEmpty,
  selectHasSelection,
} from './hooks/useDrumEditorStore.js';

export {
  useDrumEditorPlayback,
  type DrumPlaybackState,
  type UseDrumEditorPlaybackReturn,
} from './hooks/useDrumEditorPlayback.js';
