/**
 * Metronome Components Module
 *
 * Modular components for metronome functionality
 */

// Core functionality
export { MetronomeCore } from './MetronomeCore.js';
export type {
  MetronomeNote,
  ClickSound,
  MetronomeConfig,
} from './MetronomeCore.js';

// Scheduling
export { MetronomeScheduler } from './MetronomeScheduler.js';
export type {
  MetronomePattern,
  MetronomeSchedulerOptions,
} from './MetronomeScheduler.js';

// Visual feedback
export { MetronomeVisualizer } from './MetronomeVisualizer.js';
export type {
  VisualState,
  VisualElement,
  VisualizerOptions,
} from './MetronomeVisualizer.js';

// State management
export { useMetronomeStore, commonTimeSignatures } from './MetronomeState.js';
export type {
  MetronomePreset,
  MetronomeStateData,
  MetronomeStateActions,
  MetronomeStore,
} from './MetronomeState.js';
