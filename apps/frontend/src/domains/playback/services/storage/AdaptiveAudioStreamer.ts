/**
 * Adaptive Audio Streamer
 *
 * This file now re-exports from the modular implementation.
 * The original functionality has been moved to modules/loading/AdaptiveAudioStreamer.ts
 *
 * @deprecated Use imports from '@/domains/playback/modules/loading' directly
 */

export {
  AdaptiveAudioStreamer,
  type StreamingConfig,
  type StreamMetrics,
  type QualityProfile,
  type AdaptiveStrategy,
} from '../../modules/loading/AdaptiveAudioStreamer.js';
