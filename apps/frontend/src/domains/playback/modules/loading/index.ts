/**
 * Intelligent Loading System Module
 * 
 * Machine learning-based predictive loading with adaptive streaming,
 * progressive downloads, and intelligent asset management.
 */

export { PredictiveLoadingEngine } from './PredictiveLoadingEngine';
export { AdaptiveAudioStreamer } from './AdaptiveAudioStreamer';

export type {
  // Predictive Loading Engine Types
  PredictiveLoadingEngineConfig,
  LearningEvent,
  AssetPrediction,
  UserBehaviorProfile,
  PracticePattern,
  AssetUsagePattern,
  PredictionContext,
  PrefetchRequest,
  PrefetchResult,
  ModelPerformanceMetrics,
  AdaptiveLearningMetrics,
  PrefetchResourceLimits,
  NetworkCondition,
  IPredictiveLoadingEngine,
  
  // Adaptive Audio Streaming Types
  AdaptiveAudioStreamingConfig,
  AudioSampleMetadata,
  StreamingSession,
  NetworkConditions,
  QualityTransition,
  StreamingChunk,
  StreamingResult,
  StreamingPerformanceMetrics,
  DownloadOptions,
  IAdaptiveAudioStreamer,
  
  // Shared Types
  PredictionPriority,
  AssetType,
  PracticePatternType,
  AudioSampleFormat,
  AudioSampleQualityProfile,
} from './types';