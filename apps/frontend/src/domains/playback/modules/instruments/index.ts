/**
 * Instruments Module
 *
 * This module provides a unified interface for all instrument types in the playback domain.
 * It includes base classes, adapters for legacy processors, and type definitions.
 *
 * The module supports:
 * - Bass instruments (synth and sample-based)
 * - Drum kits with multi-sample support
 * - Harmony instruments (piano, rhodes, organ, etc.)
 * - Metronome with configurable sounds
 * - WAM (Web Audio Modules) integration
 *
 * Architecture:
 * - Base classes provide common functionality
 * - Adapters wrap existing processors for backward compatibility
 * - Implementations can be pure or use external libraries (Tone.js, WAM)
 * - All instruments follow the same lifecycle and event patterns
 */

// Base classes
export { BaseInstrument } from './base/Instrument.js';
export { Sampler } from './base/Sampler.js';
export {
  InstrumentAdapter,
  createInstrumentAdapter,
} from './base/InstrumentAdapter.js';

// Types
export * from './types/index.js';

// Note: Actual instrument implementations will be migrated from services/plugins/
// For now, they can be accessed via the InstrumentAdapter

/**
 * Example usage with existing processors:
 *
 * ```typescript
 * import { createInstrumentAdapter } from '@/domains/playback/modules/instruments';
 * import { BassInstrumentProcessor } from '@/domains/playback/services/plugins/BassInstrumentProcessor';
 *
 * // Create adapter for existing processor
 * const bassProcessor = new BassInstrumentProcessor();
 * const bassInstrument = createInstrumentAdapter('bass', bassProcessor);
 *
 * // Use through standard interface
 * await bassInstrument.initialize();
 * bassInstrument.trigger({
 *   audioTime: context.currentTime,
 *   timestamp: Date.now(),
 *   velocity: 0.8,
 *   data: { note: 'E2' }
 * });
 * ```
 */

// Instrument implementations
export { Metronome } from './implementations/metronome/Metronome.js';
export type { MetronomeInstrumentConfig } from './implementations/metronome/Metronome.js';

export { BassInstrument } from './implementations/bass/BassInstrument.js';
export type { BassInstrumentConfig } from './implementations/bass/BassInstrument.js';

// Legacy processors - available for backward compatibility
export { BassInstrumentProcessor } from './implementations/bass/BassInstrumentProcessor.js';
export { BassProcessor } from './implementations/bass/BassProcessor.js';
export { DrumInstrumentProcessor } from './implementations/drums/DrumInstrumentProcessor.js';
export { DrumProcessor } from './implementations/drums/DrumProcessor.js';

export { DrumKit } from './implementations/drums/DrumKit.js';
export type { DrumKitInstrumentConfig } from './implementations/drums/DrumKit.js';

export { HarmonyInstrument } from './implementations/harmony/HarmonyInstrument.js';
export type { HarmonyInstrumentConfig } from './implementations/harmony/HarmonyInstrument.js';

// WAM (Web Audio Modules) adapters
export { WamPluginAdapter } from './adapters/wam/WamPluginAdapter.js';
export { WamHostManager } from './adapters/wam/WamHostManager.js';
export { WamDeviceOptimizer } from './adapters/wam/WamDeviceOptimizer.js';
export { WamDrummer } from './adapters/wam/WamDrummer.js';
export { WamBass } from './adapters/wam/WamBass.js';
export { WamKeyboard } from './adapters/wam/WamKeyboard.js';
export { WamMetronome } from './adapters/wam/WamMetronome.js';
export { WamHarmonyProcessor } from './adapters/wam/WamHarmonyProcessor.js';
