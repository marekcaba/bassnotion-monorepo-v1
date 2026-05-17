/**
 * HarmonyWidget Module
 *
 * A modular harmony widget for displaying and playing chord progressions.
 * Exports the main component and related utilities.
 */

// Main component - the refactored modular version
export { HarmonyWidget } from './HarmonyWidget.js';

// Types
export * from './types.js';

// Hooks
export { useVolumeControl } from './hooks/useVolumeControl.js';
export type {
  UseVolumeControlOptions,
  UseVolumeControlReturn,
} from './hooks/useVolumeControl.js';

export { useHarmonyInstrument } from './hooks/useHarmonyInstrument.js';
export type {
  UseHarmonyInstrumentOptions,
  UseHarmonyInstrumentReturn,
} from './hooks/useHarmonyInstrument.js';

export {
  useChordProgression,
  CHORD_PROGRESSIONS,
} from './hooks/useChordProgression.js';
export type {
  UseChordProgressionOptions,
  UseChordProgressionReturn,
} from './hooks/useChordProgression.js';

export { useHarmonyPlugin } from './hooks/useHarmonyPlugin.js';
export type {
  UseHarmonyPluginOptions,
  UseHarmonyPluginReturn,
} from './hooks/useHarmonyPlugin.js';

export { useSampleLoadingSync } from './hooks/useSampleLoadingSync.js';
export type {
  UseSampleLoadingSyncOptions,
  UseSampleLoadingSyncReturn,
} from './hooks/useSampleLoadingSync.js';

export { useHarmonyRegistration } from './hooks/useHarmonyRegistration.js';
export type {
  UseHarmonyRegistrationOptions,
  UseHarmonyRegistrationReturn,
} from './hooks/useHarmonyRegistration.js';

// Components
export { HarmonyDisplay } from './components/HarmonyDisplay.js';
export { InstrumentSelector } from './components/InstrumentSelector.js';
export { PatternLibraryButton } from './components/PatternLibraryButton.js';
export { ChordProgressionView } from './components/ChordProgressionView.js';
