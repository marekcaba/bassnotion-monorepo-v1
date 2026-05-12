/**
 * DrummerWidget Module
 *
 * Exports the DrummerWidget component and related utilities.
 */

// Main component
export { DrummerWidget } from './DrummerWidget.js';

// Types
export * from './types.js';

// Hooks
export { useDrumPatternGrid } from './hooks/useDrumPatternGrid.js';
export type {
  UseDrumPatternGridOptions,
  UseDrumPatternGridReturn,
} from './hooks/useDrumPatternGrid.js';

export { useDrumPlugin } from './hooks/useDrumPlugin.js';
export type {
  UseDrumPluginOptions,
  UseDrumPluginReturn,
} from './hooks/useDrumPlugin.js';

// Components
export { CompactBeatGrid } from './components/CompactBeatGrid.js';
export type { CompactBeatGridProps } from './components/CompactBeatGrid.js';

export { ExpandedPatternEditor } from './components/ExpandedPatternEditor.js';
export type { ExpandedPatternEditorProps } from './components/ExpandedPatternEditor.js';

// Utilities
export {
  getPatternMeasureCount,
  drumHitsToGridPattern,
  convertMidiToDrumPattern,
  createDrumPatternFromPreset,
  createFallbackPatternByGenre,
} from './utils/drum-pattern-utils.js';
