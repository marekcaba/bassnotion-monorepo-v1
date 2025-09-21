/**
 * Bass Components
 *
 * Modular components for bass instruments
 */

export * from './BassSynthEngine.js';
export * from './BassSequencer.js';
export * from './BassArticulation.js';
export * from './BassEffectsChain.js';

// Re-export types
export type {
  BassNote,
  BassSynthOptions,
  BassPreset,
} from './BassSynthEngine.js';

export type {
  BassPattern,
  BassSequence,
  BasslineAnalysis,
} from './BassSequencer.js';

export type {
  ArticulationParams,
  TechniqueDefinition,
  ArticulationState,
} from './BassArticulation.js';

export type {
  BassEffectParams,
  BassEffectsConfig,
} from './BassEffectsChain.js';
