/**
 * Intelligent Loading System Types
 *
 * Type definitions for machine learning-based predictive loading,
 * adaptive streaming, and intelligent asset management.
 */

// Predictive Loading Engine Types
export interface PredictiveLoadingEngineConfig {
  enabled: boolean;
  learningConfig: {
    enabled: boolean;
    featureEngineering: {
      enabled: boolean;
    };
  };
  behaviorAnalysisConfig?: any;
  modelConfig: {
    exerciseProgressionModel: { enabled: boolean };
    assetDemandModel: { enabled: boolean };
    userIntentModel: { enabled: boolean };
    sessionLengthModel: { enabled: boolean };
    skillDevelopmentModel: { enabled: boolean };
  };
  adaptiveLearningConfig: {
    enabled: boolean;
  };
  analyticsIntegration: {
    story23AnalyticsEngine: boolean;
  };
  prefetchingConfig: {
    enabled: boolean;
    backgroundPrefetching: {
      enabled: boolean;
    };
  };
  performanceOptimization: {
    accuracyMetrics: {
      enabled: boolean;
    };
  };
}

export interface LearningEvent {
  eventId: string;
  eventType: string;
  timestamp: number;
  context: {
    sessionId: string;
    practiceGoal?: string;
    sessionPhase: string;
    environmentalFactors?: any;
  };
  assets: Array<{
    assetId: string;
    bucket?: string;
    path?: string;
  }>;
}

export interface AssetPrediction {
  predictionId: string;
  assetId: string;
  assetPath: string;
  bucket: string;
  confidence: number;
  timeToNeed: number;
  priority: PredictionPriority;
  context: PredictionContext;
  triggers: Array<{
    triggerType: string;
    confidence: number;
    evidence: string[];
    triggerTime: number;
  }>;
  metadata: {
    modelVersion: string;
    predictionTime: number;
    features: Record<string, number>;
    explanations: string[];
  };
  validUntil: number;
}

export interface UserBehaviorProfile {
  userId: string;
  profileId: string;
  createdAt: number;
  lastUpdated: number;
  practicePatterns: PracticePattern[];
  assetUsagePatterns: AssetUsagePattern[];
  learningCharacteristics: {
    learningStyle: string;
    pacePreference: string;
    challengePreference: string;
    feedbackPreference: string;
    attentionSpan: number;
    retentionRate: number;
    transferAbility: number;
  };
  preferences: {
    assetTypePreferences: Record<AssetType, number>;
    qualityVsSpeed: number;
    dataUsageAwareness: number;
    batteryAwareness: number;
    privacyLevel: string;
    adaptationConsent: boolean;
  };
  skillProgression: {
    currentLevel: Record<string, number>;
    progressionRate: Record<string, number>;
    strengthAreas: string[];
    improvementAreas: string[];
    learningVelocity: number;
    consistencyScore: number;
    plateauIndicators: any[];
  };
  sessionCharacteristics: {
    averageDuration: number;
    preferredStartTime: number;
    typicalBreakPattern: any[];
    intensityProfile: {
      warmupIntensity: number;
      peakIntensity: number;
      cooldownIntensity: number;
      sustainedIntensity: number;
      intensityVariability: number;
    };
    focusPattern: {
      attentionSpan: number;
      distractionSusceptibility: number;
      deepFocusPeriods: any[];
      multitaskingTendency: number;
    };
    motivationLevel: number;
    dropoffRisk: number;
  };
  predictiveMetrics: {
    predictionAccuracy: number;
    confidenceCalibration: number;
    adaptationRate: number;
    predictabilityScore: number;
    modelFitness: number;
    lastModelUpdate: number;
    predictionHistory: any[];
  };
}

export interface PracticePattern {
  patternId: string;
  type: PracticePatternType;
  frequency: number;
  consistency: number;
  timeOfDay: {
    preferredHours: number[];
    peakPerformanceHours: number[];
    consistencyScore: number;
    flexibilityScore: number;
  };
  duration: {
    averageDuration: number;
    minimumDuration: number;
    maximumDuration: number;
    variabilityScore: number;
    attentionDecay: number;
  };
  intensity: {
    averageIntensity: number;
    peakIntensity: number;
    intensityProgression: string;
    focusDistribution: number[];
  };
  assetPreference: {
    assetTypePreferences: Record<AssetType, number>;
    complexityPreference: number;
    noveltyPreference: number;
    familiarityBalance: number;
  };
  progressionStyle: {
    style: string;
    pacePreference: string;
    challengeSeekingBehavior: number;
    riskTolerance: number;
  };
  confidence: number;
  lastObserved: number;
}

export interface AssetUsagePattern {
  patternId: string;
  assetType: AssetType;
  usageFrequency: number;
  accessSequence: any[];
  contextualUsage: any[];
  seasonalTrends: any[];
  correlatedAssets: any[];
  predictiveValue: number;
}

export interface PredictionContext {
  sessionId: string;
  userId: string;
  currentAsset?: string;
  practiceGoal?: string;
  sessionPhase: 'warmup' | 'practice' | 'cooldown' | 'review';
  timeRemaining: number;
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  environmentalFactors?: any;
}

export interface PrefetchRequest {
  requestId: string;
  userId: string;
  predictions: AssetPrediction[];
  priority: PredictionPriority;
  networkCondition: NetworkCondition;
  resourceLimits: PrefetchResourceLimits;
  validationRules: any[];
  metadata: {
    requestedAt: number;
    requestSource: string;
    urgency: string;
    context: any;
  };
}

export interface PrefetchResult {
  requestId: string;
  results: Array<{
    assetId: string;
    status: 'success' | 'failed' | 'skipped';
    downloadTime: number;
    size: number;
    source: string;
    quality: number;
    cacheLocation: string;
  }>;
  totalSize: number;
  totalTime: number;
  successRate: number;
  networkEfficiency: number;
  cacheUtilization: number;
  resourceUsage: {
    bandwidthUsed: number;
    memoryUsed: number;
    storageUsed: number;
    cpuTime: number;
    powerConsumption: number;
  };
  performance: {
    hitRate: number;
    wasteRate: number;
    timeToFirstByte: number;
    timeToFullDownload: number;
    networkEfficiency: number;
    userPerceptionScore: number;
  };
}

export interface ModelPerformanceMetrics {
  modelId: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  confusionMatrix: {
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  crossValidationScore: number;
  generalizationError: number;
  trainingHistory: any[];
  predictionLatency: number;
  trainingTime: number;
  inferenceTime: number;
  memoryUsage: number;
  modelSize: number;
  lastEvaluated: number;
}

export interface AdaptiveLearningMetrics {
  adaptationRate: number;
  improvementTrend: 'improving' | 'stable' | 'declining';
  feedbackIncorporation: number;
  modelStability: number;
  knowledgeRetention: number;
  transferEffectiveness: number;
  continuousAccuracy: number;
  adaptationHistory: Array<{
    timestamp: number;
    adaptationType: string;
    triggerEvent: string;
    performanceBefore: number;
    performanceAfter: number;
    adaptationSuccess: boolean;
    userFeedback: number;
  }>;
}

export interface PrefetchResourceLimits {
  maxBandwidth: number;
  maxMemory: number;
  maxStorage: number;
  maxConcurrentDownloads: number;
  timeLimit: number;
}

export interface NetworkCondition {
  minBandwidth: number;
  connectionType: string;
  connectionQuality: string;
}

// Adaptive Audio Streaming Types
export interface AdaptiveAudioStreamingConfig {
  enabled: boolean;
  enableNetworkMonitoring: boolean;
  enableFormatOptimization: boolean;
  enableProgressiveLoading: boolean;
  enableQualityAdaptation: boolean;
  chunkSize: number;
  preloadChunks: number;
  maxConcurrentStreams: number;
  preferredFormats: AudioSampleFormat[];
  bandwidthThresholds: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  latencyThresholds: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
}

export interface AudioSampleMetadata {
  sampleId: string;
  bucket: string;
  path: string;
  format: AudioSampleFormat;
  size: number;
  duration: number;
  category: string;
}

export interface StreamingSession {
  sessionId: string;
  sampleId: string;
  metadata: AudioSampleMetadata;
  currentQuality: AudioSampleQualityProfile;
  targetQuality: AudioSampleQualityProfile;
  isStreaming: boolean;
  startTime: number;
  totalChunks: number;
  loadedChunks: number;
  bufferHealth: number;
  networkConditions: NetworkConditions;
  qualityTransitions: QualityTransition[];
}

export interface NetworkConditions {
  bandwidth: number;
  latency: number;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  stability: number;
  lastMeasured: number;
}

export interface QualityTransition {
  timestamp: number;
  fromQuality: AudioSampleQualityProfile;
  toQuality: AudioSampleQualityProfile;
  reason: 'bandwidth' | 'latency' | 'buffer_health' | 'user_preference';
  transitionTime: number;
}

export interface StreamingChunk {
  chunkId: string;
  sessionId: string;
  index: number;
  data: ArrayBuffer;
  size: number;
  quality: AudioSampleQualityProfile;
  format: AudioSampleFormat;
  isOptimized: boolean;
  loadTime: number;
  compressionRatio?: number;
}

export interface StreamingResult {
  success: boolean;
  sessionId: string;
  data?: ArrayBuffer;
  metadata?: AudioSampleMetadata;
  chunks?: StreamingChunk[];
  finalQuality?: AudioSampleQualityProfile;
  finalFormat?: AudioSampleFormat;
  totalLoadTime: number;
  bytesTransferred: number;
  compressionSavings: number;
  qualityAdaptations: number;
  error?: Error;
  performance: StreamingPerformanceMetrics;
}

export interface StreamingPerformanceMetrics {
  averageChunkLoadTime: number;
  totalBufferTime: number;
  networkUtilization: number;
  qualityStability: number;
  bufferUnderruns: number;
  formatOptimizationSavings: number;
}

export interface DownloadOptions {
  priority: 'low' | 'medium' | 'high';
  useCache: boolean;
  allowCDNFallback: boolean;
  qualityPreference: 'speed' | 'quality' | 'balanced';
}

// Enum types
export type PredictionPriority =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'background';
export type AssetType =
  | 'midi_file'
  | 'audio_sample'
  | 'backing_track'
  | 'exercise_asset'
  | 'ambient_track'
  | 'user_recording'
  | 'system_asset';
export type PracticePatternType =
  | 'tempo_progression'
  | 'key_exploration'
  | 'difficulty_advancement'
  | 'session_structure';
export type AudioSampleFormat = 'wav' | 'mp3' | 'ogg' | 'flac';
export type AudioSampleQualityProfile =
  | 'studio'
  | 'performance'
  | 'practice'
  | 'preview'
  | 'mobile'
  | 'streaming';

// Interface definitions for main classes
export interface IPredictiveLoadingEngine {
  initialize(): Promise<void>;
  processLearningEvent(event: LearningEvent): Promise<void>;
  generatePredictions(
    userId: string,
    context: PredictionContext,
  ): Promise<AssetPrediction[]>;
  executePrefetching(
    userId: string,
    predictions: AssetPrediction[],
  ): Promise<PrefetchResult>;
  getPerformanceMetrics(): ModelPerformanceMetrics;
  getAdaptiveLearningMetrics(): AdaptiveLearningMetrics;
  getUserBehaviorProfile(userId: string): UserBehaviorProfile | undefined;
}

export interface IAdaptiveAudioStreamer {
  initialize(): Promise<void>;
  streamSample(
    sampleId: string,
    metadata: AudioSampleMetadata,
    options?: {
      preferredQuality?: AudioSampleQualityProfile;
      startPlaybackEarly?: boolean;
      enableOptimization?: boolean;
    },
  ): Promise<StreamingResult>;
  getNetworkConditions(): NetworkConditions;
  getActiveSessions(): StreamingSession[];
  getPerformanceMetrics(sessionId: string): StreamingPerformanceMetrics | null;
  cancelSession(sessionId: string): Promise<boolean>;
  cleanup(): Promise<void>;
}
