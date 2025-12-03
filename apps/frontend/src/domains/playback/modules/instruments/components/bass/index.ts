/**
 * Bass Components
 *
 * Modular components for bass instruments
 */

export * from './BassSynthEngine.js';
// REMOVED: BassSequencer.js (legacy, unused)
export * from './BassArticulation.js';
export * from './BassEffectsChain.js';

// Re-export types
export type {
  BassNote,
  BassSynthOptions,
  BassPreset,
} from './BassSynthEngine.js';

// REMOVED: BassSequencer types (legacy, unused)

export type {
  ArticulationParams,
  TechniqueDefinition,
  ArticulationState,
} from './BassArticulation.js';

export type {
  BassEffectParams,
  BassEffectsConfig,
} from './BassEffectsChain.js';
