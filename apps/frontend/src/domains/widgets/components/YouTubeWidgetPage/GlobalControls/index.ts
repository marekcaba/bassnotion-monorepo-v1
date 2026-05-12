/**
 * GlobalControls Module
 *
 * Exports the GlobalControls component and related utilities.
 */

// Main component - re-export from original location for now
// Will be replaced with modular version after full refactoring
export { GlobalControls } from '../components/GlobalControls.js';

// Types
export * from './types.js';

// Hooks
export { useSocialInteractions } from './hooks/useSocialInteractions.js';
export type {
  UseSocialInteractionsOptions,
  UseSocialInteractionsReturn,
} from './hooks/useSocialInteractions.js';

export { useTempoControl } from './hooks/useTempoControl.js';
export type {
  UseTempoControlOptions,
  UseTempoControlReturn,
  TempoControlTransport,
} from './hooks/useTempoControl.js';

export { usePlaybackControl } from './hooks/usePlaybackControl.js';
export type {
  UsePlaybackControlOptions,
  UsePlaybackControlReturn,
  PlaybackControlTransport,
  PlaybackControlTrack,
  CountdownState,
  RegionProcessor,
} from './hooks/usePlaybackControl.js';

export { useExerciseLoader } from './hooks/useExerciseLoader.js';
export type {
  UseExerciseLoaderOptions,
  UseExerciseLoaderReturn,
  ExerciseLoaderTrack,
  ExerciseLoaderTransport,
} from './hooks/useExerciseLoader.js';

// Components
export { CountdownIndicator } from './components/CountdownIndicator.js';
export { SparkleAnimation } from './components/SparkleAnimation.js';
export { PlaybackControlsBar } from './components/PlaybackControlsBar.js';
export type {
  PlaybackControlsBarProps,
  PlaybackCountdownState,
} from './components/PlaybackControlsBar.js';

// Utilities
export {
  convertNoteDurationToVexFlow,
  convertNoteToVexFlow,
  getOctaveFromNote,
  getStemDirection,
  getDurationInQuarterNotes,
  convertDurationToRests,
} from './utils/vexflow-converters.js';

export {
  normalizeDrumTypeToBufferKey,
  getTone,
} from './utils/drum-utilities.js';
