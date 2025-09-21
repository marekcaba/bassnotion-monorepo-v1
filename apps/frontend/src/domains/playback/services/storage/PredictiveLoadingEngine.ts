/**
 * Predictive Loading Engine
 *
 * This file now re-exports from the modular implementation.
 * The original functionality has been moved to modules/loading/PredictiveLoadingEngine.ts
 *
 * @deprecated Use imports from '@/domains/playback/modules/loading' directly
 */

export {
  PredictiveLoadingEngine,
  type LoadingPrediction,
  type PredictiveConfig,
  type LoadingStrategy,
  type PredictionAnalytics,
} from '../../modules/loading/PredictiveLoadingEngine.js';
