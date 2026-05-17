/**
 * BassLineWidget Module
 *
 * A modular bass widget for displaying and playing bass patterns.
 * Exports the main component and related utilities.
 */

// Main component - the refactored modular version
export { BassLineWidget } from './BassLineWidget.js';

// Types
export * from './types.js';

// Hooks
export { useVolumeControl } from './hooks/useVolumeControl.js';
export type {
  UseBassVolumeControlOptions,
  UseBassVolumeControlReturn,
} from './types.js';

export { useBassAudioContext } from './hooks/useBassAudioContext.js';
export type {
  UseBassAudioContextOptions,
  UseBassAudioContextReturn,
} from './types.js';

export { useSampleLoadingSync } from './hooks/useSampleLoadingSync.js';
export type {
  UseSampleLoadingSyncOptions,
  UseSampleLoadingSyncReturn,
} from './types.js';

export { useBassBufferRegistration } from './hooks/useBassBufferRegistration.js';
export type {
  UseBassBufferRegistrationOptions,
  UseBassBufferRegistrationReturn,
} from './types.js';

export { useBassPlayback } from './hooks/useBassPlayback.js';
export type { UseBassPlaybackOptions, UseBassPlaybackReturn } from './types.js';

export { useBassEventBus } from './hooks/useBassEventBus.js';
export type { UseBassEventBusOptions, UseBassEventBusReturn } from './types.js';

// Components
export { MiniFretboard } from './components/MiniFretboard.js';
export { ExpandedControls } from './components/ExpandedControls.js';
