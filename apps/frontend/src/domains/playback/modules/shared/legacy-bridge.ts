/**
 * Legacy Bridge - Temporary re-exports for smooth transition
 *
 * This file provides clean re-exports from the legacy services folder
 * to help modules transition to the new architecture without breaking imports.
 *
 * TODO: These should eventually be replaced with proper modules implementations
 */

/* eslint-disable no-restricted-imports */
// This file is part of the shared module and needs to import from services for legacy compatibility

// Re-export legacy utilities that modules still need
export { CachedToneBufferLoader } from '../storage/loaders/ToneBufferLoader.js';
export {
  getPersistentAudioContext,
  ensureToneUsesPersistentContext,
} from '../../utils/audioContext.js';

// Storage re-exports (these already exist in modules)
export { GlobalSampleCache } from '../storage/cache/GlobalSampleCache.js';

// Monitoring and cache utilities
export { cacheMonitor } from '../../services/monitoring/CacheMonitor.js';

// Processors (now in modules)
export { MetronomeInstrumentProcessor } from '../instruments/implementations/metronome/MetronomeInstrumentProcessor.js';
export { ClickSoundType } from '../instruments/implementations/metronome/MetronomeInstrumentProcessor.js';
