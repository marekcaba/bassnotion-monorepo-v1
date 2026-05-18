/**
 * MetronomeWidget Module
 *
 * A modular metronome widget for beat visualization and audio playback.
 * Exports the main component and related utilities.
 */

// Main component - the refactored modular version
export { MetronomeWidget } from './MetronomeWidget.js';

// Types
export * from './types.js';

// Hooks
export { useVolumeControl } from './hooks/useVolumeControl.js';
export type {
  UseMetronomeVolumeControlOptions,
  UseMetronomeVolumeControlReturn,
} from './types.js';

export { usePluginLoading } from './hooks/usePluginLoading.js';
export type {
  UsePluginLoadingOptions,
  UsePluginLoadingReturn,
} from './hooks/usePluginLoading.js';

export { usePluginCreation } from './hooks/usePluginCreation.js';
export type {
  UsePluginCreationOptions,
  UsePluginCreationReturn,
} from './hooks/usePluginCreation.js';

export { useMetronomePattern } from './hooks/useMetronomePattern.js';
export type {
  UseMetronomePatternOptions,
  UseMetronomePatternReturn,
} from './types.js';

export { useTimeSignature } from './hooks/useTimeSignature.js';
export type {
  UseTimeSignatureOptions,
  UseTimeSignatureReturn,
} from './types.js';

export { useMetronomeRegistration } from './hooks/useMetronomeRegistration.js';
export type {
  UseMetronomeRegistrationOptions,
  UseMetronomeRegistrationReturn,
} from './hooks/useMetronomeRegistration.js';

// Components
export { BeatIndicators } from './components/BeatIndicators.js';
export { ExpandedControls } from './components/ExpandedControls.js';
