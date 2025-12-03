/**
 * Drum Components
 *
 * Modular components for drum instruments
 */

export * from './DrumSampleEngine.js';
// REMOVED: DrumPatternScheduler.js (legacy, unused)
export * from './DrumMixerChannel.js';
export * from './DrumEffectsRack.js';

// Re-export types
export type {
  DrumNote,
  DrumKit,
  DrumKitPiece,
  DrumSampleEngineOptions,
} from './DrumSampleEngine.js';

// REMOVED: DrumPatternScheduler types (legacy, unused)

export type {
  DrumChannelConfig,
  DrumChannelState,
  ChannelPreset,
} from './DrumMixerChannel.js';

export type { DrumEffectParams, DrumEffectsConfig } from './DrumEffectsRack.js';
