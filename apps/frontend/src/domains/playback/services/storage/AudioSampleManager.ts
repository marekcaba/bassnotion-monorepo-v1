/**
 * AudioSampleManager - DEPRECATED
 *
 * This file now re-exports from the modular storage system.
 * All functionality has been moved to modules/storage for better architecture.
 *
 * Migration path:
 * 1. This file provides backward compatibility via AudioSampleManagerAdapter
 * 2. New code should import from modules/storage directly
 * 3. Existing code will continue to work through this adapter
 *
 * @deprecated Use modules/storage components directly
 */

export {
  AudioSampleManagerAdapter as AudioSampleManager,
  createAudioSampleManager,
} from '../../modules/storage/adapters/AudioSampleManagerAdapter.js';

// Re-export types for backward compatibility
export type {
  AudioSampleManagerConfig,
  AudioSampleMetadata,
  AudioSampleFormat,
  AudioSampleQualityProfile,
  AudioSampleCategory,
  AudioSampleOperationResult,
  AudioSampleLibrary,
} from '@bassnotion/contracts';
