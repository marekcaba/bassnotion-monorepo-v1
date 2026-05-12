/**
 * Predictive Asset Loading Engine Types
 * Story 2.4 Task 3: Predictive Asset Loading Engine - Advanced ML-Based Contracts
 *
 * @module storage/predictive-loading
 */

import type { MaintenanceWindow } from './health-monitoring.types.js';

// ============================================================================
// Core Engine Configuration
// ============================================================================

/**
 * Enhanced Predictive Loading Engine Configuration
 */
export interface PredictiveLoadingEngineConfig {
  enabled: boolean;
  learningConfig: MachineLearningConfig;
  behaviorAnalysisConfig: BehaviorAnalysisConfig;
  prefetchingConfig: IntelligentPrefetchingConfig;
  modelConfig: PredictiveModelConfig;
  adaptiveLearningConfig: AdaptiveLearningConfig;
  performanceOptimization: PredictivePerformanceConfig;
  analyticsIntegration: AnalyticsIntegrationConfig;
}

// ============================================================================
// Machine Learning Configuration
// ============================================================================

/**
 * Machine Learning Configuration
 */
export interface MachineLearningConfig {
  enabled: boolean;
  modelType: 'neural_network' | 'decision_tree' | 'ensemble' | 'hybrid';
  trainingConfig: ModelTrainingConfig;
  featureEngineering: FeatureEngineeringConfig;
  modelPersistence: ModelPersistenceConfig;
  predictionThresholds: PredictionThresholds;
  crossValidation: CrossValidationConfig;
}

/**
 * Model Training Configuration
 */
export interface ModelTrainingConfig {
  batchSize: number;
  maxEpochs: number;
  learningRate: number;
  regularization: RegularizationConfig;
  earlyStopping: EarlyStoppingConfig;
  optimizerType: 'adam' | 'sgd' | 'rmsprop' | 'adagrad';
  lossFunction: 'mse' | 'binary_crossentropy' | 'categorical_crossentropy';
  trainingSchedule: TrainingSchedule;
}

/**
 * Feature Engineering Configuration
 */
export interface FeatureEngineeringConfig {
  enabled: boolean;
  temporalFeatures: TemporalFeatureConfig;
  behavioralFeatures: BehavioralFeatureConfig;
  contextualFeatures: ContextualFeatureConfig;
  assetFeatures: AssetFeatureConfig;
  sequentialFeatures: SequentialFeatureConfig;
  featureNormalization: FeatureNormalizationConfig;
}

/**
 * Regularization Configuration
 */
export interface RegularizationConfig {
  l1Penalty: number;
  l2Penalty: number;
  dropoutRate: number;
  batchNormalization: boolean;
  weightDecay: number;
}

/**
 * Early Stopping Configuration
 */
export interface EarlyStoppingConfig {
  enabled: boolean;
  patience: number; // epochs to wait for improvement
  minImprovement: number; // minimum improvement required
  monitorMetric: 'loss' | 'accuracy' | 'val_loss' | 'val_accuracy';
  restoreBestWeights: boolean;
}

/**
 * Training Schedule
 */
export interface TrainingSchedule {
  frequency: 'continuous' | 'hourly' | 'daily' | 'weekly';
  batchTraining: boolean;
  incrementalLearning: boolean;
  retrainingTriggers: RetrainingTrigger[];
  maintenanceWindow: MaintenanceWindow;
}

/**
 * Retraining Trigger
 */
export interface RetrainingTrigger {
  triggerId: string;
  condition: string;
  threshold: number;
  enabled: boolean;
}

/**
 * Model Persistence Configuration
 */
export interface ModelPersistenceConfig {
  enabled: boolean;
  storageLocation: 'local' | 'cloud' | 'distributed';
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
  versioning: boolean;
  backupStrategy: 'incremental' | 'full' | 'differential';
  retentionPolicy: ModelRetentionPolicy;
  syncInterval: number; // ms
}

/**
 * Model Retention Policy
 */
export interface ModelRetentionPolicy {
  maxVersions: number;
  retentionPeriod: number; // ms
  autoCleanup: boolean;
  archiveOldVersions: boolean;
}

/**
 * Prediction Thresholds
 */
export interface PredictionThresholds {
  minimumConfidence: number; // 0-1
  optimalConfidence: number; // 0-1
  highConfidenceThreshold: number; // 0-1
  uncertaintyThreshold: number; // 0-1
  actionThresholds: ActionThreshold[];
  contextualThresholds: ContextualThreshold[];
}

/**
 * Action Threshold
 */
export interface ActionThreshold {
  action: string;
  threshold: number; // 0-1
  hysteresis: number; // 0-1 to prevent oscillation
}

/**
 * Contextual Threshold
 */
export interface ContextualThreshold {
  context: string;
  thresholds: Record<string, number>;
  adaptiveAdjustment: boolean;
}

/**
 * Cross Validation Configuration
 */
export interface CrossValidationConfig {
  enabled: boolean;
  folds: number;
  stratified: boolean;
  timeSeriesSplit: boolean;
  validationStrategy: 'k_fold' | 'stratified_k_fold' | 'time_series' | 'custom';
  testSize: number; // 0-1
  randomState?: number;
  shuffle: boolean;
}

// ============================================================================
// Feature Configuration Types
// ============================================================================

/**
 * Temporal Feature Configuration
 */
export interface TemporalFeatureConfig {
  timeOfDay: boolean;
  dayOfWeek: boolean;
  seasonality: boolean;
  timeSinceLastPractice: boolean;
  practiceSessionLength: boolean;
  sequencePosition: boolean;
  historicalTrends: boolean;
  cyclicalPatterns: boolean;
}

/**
 * Behavioral Feature Configuration
 */
export interface BehavioralFeatureConfig {
  practiceConsistency: boolean;
  skillProgressionRate: boolean;
  errorPatterns: boolean;
  preferenceShifts: boolean;
  engagementLevel: boolean;
  difficultyProgression: boolean;
  exerciseTypePreference: boolean;
  controlUsagePatterns: boolean;
}

/**
 * Contextual Feature Configuration
 */
export interface ContextualFeatureConfig {
  deviceType: boolean;
  networkCondition: boolean;
  sessionContext: boolean;
  environmentalFactors: boolean;
  userState: boolean;
  applicationState: boolean;
  externalFactors: boolean;
  socialContext: boolean;
}

/**
 * Asset Feature Configuration
 */
export interface AssetFeatureConfig {
  assetType: boolean;
  assetComplexity: boolean;
  assetPopularity: boolean;
  assetRelationships: boolean;
  assetMetadata: boolean;
  historicalPerformance: boolean;
  technicalProperties: boolean;
  contentCharacteristics: boolean;
}

/**
 * Sequential Feature Configuration
 */
export interface SequentialFeatureConfig {
  sequenceLength: number;
  lookbackWindow: number; // time window to consider
  sequenceEncoding: 'rnn' | 'lstm' | 'transformer' | 'attention';
  sequenceWeighting: 'linear' | 'exponential' | 'attention_based';
  paddingStrategy: 'zero' | 'repeat' | 'interpolate';
}

/**
 * Feature Normalization Configuration
 */
export interface FeatureNormalizationConfig {
  method: 'min_max' | 'z_score' | 'robust' | 'quantile';
  perFeature: boolean;
  onlineNormalization: boolean;
  adaptiveNormalization: boolean;
}

// ============================================================================
// Behavior Analysis Configuration
// ============================================================================

/**
 * Behavior Analysis Configuration
 */
export interface BehaviorAnalysisConfig {
  enabled: boolean;
  patternRecognition: PatternRecognitionConfig;
  sessionAnalysis: SessionAnalysisConfig;
  practiceRoutineAnalysis: PracticeRoutineAnalysisConfig;
  userSegmentation: UserSegmentationConfig;
  temporalPatterns: TemporalPatternConfig;
  correlationAnalysis: CorrelationAnalysisConfig;
}

/**
 * Pattern Recognition Configuration
 */
export interface PatternRecognitionConfig {
  algorithmType:
    | 'clustering'
    | 'classification'
    | 'association_rules'
    | 'ensemble';
  minPatternSupport: number; // 0-1
  confidenceThreshold: number; // 0-1
  patternTypes: PatternType[];
  temporalPatterns: boolean;
  hierarchicalPatterns: boolean;
  crossDomainPatterns: boolean;
}

/**
 * Session Analysis Configuration
 */
export interface SessionAnalysisConfig {
  sessionSegmentation: boolean;
  transitionAnalysis: boolean;
  intentRecognition: boolean;
  goalInference: boolean;
  anomalyDetection: boolean;
  sessionSimilarity: boolean;
  outcomePredicition: boolean;
}

/**
 * Practice Routine Analysis Configuration
 */
export interface PracticeRoutineAnalysisConfig {
  routineIdentification: boolean;
  routineEvolution: boolean;
  routineEffectiveness: boolean;
  routinePersonalization: boolean;
  routineRecommendation: boolean;
  routineOptimization: boolean;
}

/**
 * User Segmentation Configuration
 */
export interface UserSegmentationConfig {
  segmentationMethod: 'behavioral' | 'demographic' | 'skill_based' | 'hybrid';
  numberOfSegments: number;
  segmentStability: boolean;
  dynamicSegmentation: boolean;
  personalization: boolean;
  segmentTransitions: boolean;
}

/**
 * Temporal Pattern Configuration
 */
export interface TemporalPatternConfig {
  circadianPatterns: boolean;
  weeklyPatterns: boolean;
  seasonalPatterns: boolean;
  learningCurvePatterns: boolean;
  motivationPatterns: boolean;
  performancePatterns: boolean;
}

/**
 * Correlation Analysis Configuration
 */
export interface CorrelationAnalysisConfig {
  featureCorrelations: boolean;
  assetCorrelations: boolean;
  behaviorCorrelations: boolean;
  outcomeCorrelations: boolean;
  crossModalCorrelations: boolean;
  temporalCorrelations: boolean;
}

// ============================================================================
// Intelligent Prefetching Configuration
// ============================================================================

/**
 * Intelligent Prefetching Configuration
 */
export interface IntelligentPrefetchingConfig {
  enabled: boolean;
  strategy: PrefetchingStrategy;
  prioritization: PrefetchPrioritizationConfig;
  resourceManagement: PrefetchResourceManagementConfig;
  networkAware: NetworkAwarePrefetchingConfig;
  backgroundPrefetching: BackgroundPrefetchingConfig;
  prefetchValidation: PrefetchValidationConfig;
}

/**
 * Prefetching Strategy
 */
export interface PrefetchingStrategy {
  primaryStrategy: 'proactive' | 'reactive' | 'hybrid' | 'adaptive';
  lookAheadWindow: number; // milliseconds
  confidenceThreshold: number; // 0-1
  resourceAwareness: boolean;
  networkAwareness: boolean;
  userAwareness: boolean;
  contextAwareness: boolean;
}

/**
 * Prefetch Prioritization Configuration
 */
export interface PrefetchPrioritizationConfig {
  primaryCriteria:
    | 'confidence'
    | 'time_to_need'
    | 'asset_size'
    | 'user_importance';
  weightingFactors: PrioritizationWeights;
  dynamicPriorities: boolean;
  userPreferences: boolean;
  contextualFactors: boolean;
  systemConstraints: boolean;
}

/**
 * Prioritization Weights
 */
export interface PrioritizationWeights {
  confidenceWeight: number; // 0-1
  urgencyWeight: number; // 0-1
  sizeWeight: number; // 0-1
  popularityWeight: number; // 0-1
  userValueWeight: number; // 0-1
  resourceCostWeight: number; // 0-1
}

/**
 * Prefetch Resource Management Configuration
 */
export interface PrefetchResourceManagementConfig {
  maxConcurrentPrefetches: number;
  maxPrefetchBandwidth: number; // bytes/sec
  maxPrefetchMemory: number; // bytes
  maxPrefetchStorage: number; // bytes
  resourceAllocation: ResourceAllocationStrategy;
  quotaManagement: QuotaManagementConfig;
  throttling: ThrottlingConfig;
}

/**
 * Resource Allocation Strategy
 */
export interface ResourceAllocationStrategy {
  strategy: 'greedy' | 'weighted' | 'optimization' | 'adaptive';
  priorityBased: boolean;
  fairnessConstraints: boolean;
  dynamicAdjustment: boolean;
  resourceReservation: boolean;
}

/**
 * Quota Management Configuration
 */
export interface QuotaManagementConfig {
  enabled: boolean;
  bandwidthQuota: number; // bytes per time period
  storageQuota: number; // bytes
  requestQuota: number; // requests per time period
  quotaPeriod: number; // ms
  quotaExceededAction: 'throttle' | 'defer' | 'reject';
}

/**
 * Throttling Configuration
 */
export interface ThrottlingConfig {
  enabled: boolean;
  maxRequestsPerSecond: number;
  maxConcurrentRequests: number;
  backoffStrategy: 'linear' | 'exponential' | 'adaptive';
  priorityBased: boolean;
  gracefulDegradation: boolean;
}

/**
 * Network Aware Prefetching Configuration
 */
export interface NetworkAwarePrefetchingConfig {
  enabled: boolean;
  networkQualityThresholds: NetworkQualityThresholds;
  adaptiveQuality: boolean;
  connectionTypeOptimization: boolean;
  latencyOptimization: boolean;
  bandwidthOptimization: boolean;
  costAwareness: boolean;
}

/**
 * Network Quality Thresholds
 */
export interface NetworkQualityThresholds {
  excellent: NetworkQualityRange;
  good: NetworkQualityRange;
  fair: NetworkQualityRange;
  poor: NetworkQualityRange;
}

/**
 * Network Quality Range
 */
export interface NetworkQualityRange {
  minBandwidth: number; // bytes/sec
  maxLatency: number; // ms
  minReliability: number; // 0-1
  connectionTypes: string[];
}

/**
 * Background Prefetching Configuration
 */
export interface BackgroundPrefetchingConfig {
  enabled: boolean;
  idleTimeDetection: boolean;
  lowPriorityPrefetching: boolean;
  opportunisticPrefetching: boolean;
  backgroundLimits: BackgroundLimits;
  interruptibility: boolean;
  powerAwareness: boolean;
}

/**
 * Background Limits
 */
export interface BackgroundLimits {
  maxBackgroundTasks: number;
  maxBackgroundBandwidth: number; // bytes/sec
  maxBackgroundMemory: number; // bytes
  maxBackgroundTime: number; // ms
  batteryThreshold: number; // 0-100
}

/**
 * Prefetch Validation Configuration
 */
export interface PrefetchValidationConfig {
  enabled: boolean;
  validationRules: ValidationRule[];
  checksumValidation: boolean;
  integrityChecks: boolean;
  expiredAssetHandling: ExpirationHandlingStrategy;
  corruptionDetection: boolean;
  rollbackCapability: boolean;
}

/**
 * Validation Rule
 */
export interface ValidationRule {
  ruleId: string;
  ruleType: 'size' | 'format' | 'checksum' | 'expiration' | 'signature';
  parameters: Record<string, unknown>;
  severity: 'warning' | 'error' | 'critical';
  enabled: boolean;
}

/**
 * Expiration Handling Strategy
 */
export interface ExpirationHandlingStrategy {
  strategy: 'refresh' | 'remove' | 'mark_stale' | 'extend_ttl';
  gracePerioD: number; // ms
  backgroundRefresh: boolean;
  userNotification: boolean;
}

// ============================================================================
// Predictive Model Configuration
// ============================================================================

/**
 * Predictive Model Configuration
 */
export interface PredictiveModelConfig {
  exerciseProgressionModel: ExerciseProgressionModelConfig;
  assetDemandModel: AssetDemandModelConfig;
  userIntentModel: UserIntentModelConfig;
  sessionLengthModel: SessionLengthModelConfig;
  skillDevelopmentModel: SkillDevelopmentModelConfig;
  modelEnsembleConfig: ModelEnsembleConfig;
}

/**
 * Exercise Progression Model Configuration
 */
export interface ExerciseProgressionModelConfig {
  enabled: boolean;
  modelType: 'sequence_prediction' | 'classification' | 'regression';
  features: ExerciseProgressionFeatures;
  predictionHorizon: number; // exercises to predict ahead
  difficultyModeling: boolean;
  skillTransferModeling: boolean;
  personalizedProgression: boolean;
}

/**
 * Exercise Progression Features
 */
export interface ExerciseProgressionFeatures {
  currentSkillLevel: boolean;
  practiceHistory: boolean;
  difficultyHistory: boolean;
  errorPatterns: boolean;
  timeSpent: boolean;
  userPreferences: boolean;
}

/**
 * Asset Demand Model Configuration
 */
export interface AssetDemandModelConfig {
  enabled: boolean;
  modelType:
    | 'time_series'
    | 'collaborative_filtering'
    | 'content_based'
    | 'hybrid';
  features: AssetDemandFeatures;
  temporalModeling: boolean;
  popularityModeling: boolean;
  contextualModeling: boolean;
  coldStartHandling: boolean;
}

/**
 * Asset Demand Features
 */
export interface AssetDemandFeatures {
  historical: boolean;
  seasonal: boolean;
  contextual: boolean;
  collaborative: boolean;
  content: boolean;
  popularity: boolean;
}

/**
 * User Intent Model Configuration
 */
export interface UserIntentModelConfig {
  enabled: boolean;
  modelType: 'classification' | 'clustering' | 'neural_network';
  features: UserIntentFeatures;
  intentCategories: IntentCategory[];
  realTimeInference: boolean;
  contextWindow: number; // ms
  uncertaintyHandling: boolean;
}

/**
 * User Intent Features
 */
export interface UserIntentFeatures {
  currentActivity: boolean;
  sessionContext: boolean;
  historicalBehavior: boolean;
  timePatterns: boolean;
  deviceContext: boolean;
  environmentalContext: boolean;
}

/**
 * Intent Category
 */
export interface IntentCategory {
  categoryId: string;
  name: string;
  description: string;
  features: string[];
  confidence: number; // 0-1
}

/**
 * Session Length Model Configuration
 */
export interface SessionLengthModelConfig {
  enabled: boolean;
  modelType: 'regression' | 'survival_analysis' | 'time_series';
  features: SessionLengthFeatures;
  predictionInterval: number; // minutes
  dynamicUpdates: boolean;
  attentionModeling: boolean;
  fatigueModeling: boolean;
}

/**
 * Session Length Features
 */
export interface SessionLengthFeatures {
  historical: boolean;
  timeOfDay: boolean;
  dayOfWeek: boolean;
  userState: boolean;
  sessionGoals: boolean;
  environmentalFactors: boolean;
}

/**
 * Skill Development Model Configuration
 */
export interface SkillDevelopmentModelConfig {
  enabled: boolean;
  modelType: 'bayesian' | 'neural_network' | 'knowledge_tracing';
  features: SkillDevelopmentFeatures;
  skillHierarchy: boolean;
  prerequisites: boolean;
  forgettingCurve: boolean;
  masteryThresholds: MasteryThreshold[];
}

/**
 * Skill Development Features
 */
export interface SkillDevelopmentFeatures {
  practiceTime: boolean;
  errorRates: boolean;
  progressionRate: boolean;
  retentionRate: boolean;
  transferEffects: boolean;
  motivationLevel: boolean;
}

/**
 * Mastery Threshold
 */
export interface MasteryThreshold {
  skill: string;
  threshold: number; // 0-1
  consistency: number; // 0-1
  retention: number; // 0-1
}

/**
 * Model Ensemble Configuration
 */
export interface ModelEnsembleConfig {
  enabled: boolean;
  ensembleMethod: 'voting' | 'averaging' | 'stacking' | 'blending';
  modelWeights: Record<string, number>;
  dynamicWeighting: boolean;
  diversityMaintenance: boolean;
  adaptiveEnsemble: boolean;
}

// ============================================================================
// Adaptive Learning Configuration
// ============================================================================

/**
 * Adaptive Learning Configuration
 */
export interface AdaptiveLearningConfig {
  enabled: boolean;
  feedbackLoop: FeedbackLoopConfig;
  modelUpdateStrategy: ModelUpdateStrategy;
  performanceThresholds: AdaptivePerformanceThresholds;
  onlineLearning: OnlineLearningConfig;
  transferLearning: TransferLearningConfig;
  continuousImprovement: ContinuousImprovementConfig;
}

/**
 * Feedback Loop Configuration
 */
export interface FeedbackLoopConfig {
  enabled: boolean;
  feedbackSources: FeedbackSource[];
  feedbackAggregation: FeedbackAggregationStrategy;
  feedbackWeighting: FeedbackWeightingConfig;
  rewardSignals: RewardSignalConfig;
  penaltySignals: PenaltySignalConfig;
  feedbackValidation: FeedbackValidationConfig;
}

/**
 * Feedback Aggregation Strategy
 */
export interface FeedbackAggregationStrategy {
  strategy:
    | 'weighted_average'
    | 'majority_vote'
    | 'expert_consensus'
    | 'adaptive';
  weights: Record<FeedbackSource, number>;
  confidenceThreshold: number; // 0-1
  minimumSamples: number;
}

/**
 * Feedback Weighting Configuration
 */
export interface FeedbackWeightingConfig {
  timeDecay: boolean;
  sourceReliability: boolean;
  contextualRelevance: boolean;
  userExpertise: boolean;
  feedbackFrequency: boolean;
}

/**
 * Reward Signal Configuration
 */
export interface RewardSignalConfig {
  signals: RewardSignal[];
  weighting: Record<string, number>;
  normalization: boolean;
  temporalAggregation: boolean;
}

/**
 * Reward Signal
 */
export interface RewardSignal {
  signalId: string;
  source: string;
  weight: number; // 0-1
  delay: number; // ms
}

/**
 * Penalty Signal Configuration
 */
export interface PenaltySignalConfig {
  signals: PenaltySignal[];
  weighting: Record<string, number>;
  threshold: number;
  gracePeriod: number; // ms
}

/**
 * Penalty Signal
 */
export interface PenaltySignal {
  signalId: string;
  source: string;
  weight: number; // 0-1
  severity: 'low' | 'medium' | 'high';
}

/**
 * Feedback Validation Configuration
 */
export interface FeedbackValidationConfig {
  enabled: boolean;
  outlierDetection: boolean;
  consistencyChecks: boolean;
  sourceVerification: boolean;
  fraudDetection: boolean;
}

/**
 * Model Update Strategy
 */
export interface ModelUpdateStrategy {
  updateTriggers: ModelUpdateTrigger[];
  updateFrequency: UpdateFrequency;
  incrementalUpdates: boolean;
  batchUpdates: boolean;
  gradualRollout: boolean;
  rollbackStrategy: RollbackStrategy;
  versionControl: ModelVersionControl;
}

/**
 * Update Frequency
 */
export interface UpdateFrequency {
  interval: number; // ms
  condition: 'time_based' | 'event_based' | 'performance_based' | 'hybrid';
  minInterval: number; // ms
  maxInterval: number; // ms
}

/**
 * Rollback Strategy
 */
export interface RollbackStrategy {
  enabled: boolean;
  criteria: RollbackCriteria[];
  automaticRollback: boolean;
  rollbackDelay: number; // ms
  maxRollbacks: number;
}

/**
 * Rollback Criteria
 */
export interface RollbackCriteria {
  criteriaId: string;
  condition: string;
  threshold: number;
  timeWindow: number; // ms
}

/**
 * Model Version Control
 */
export interface ModelVersionControl {
  enabled: boolean;
  versioningStrategy: 'semantic' | 'timestamp' | 'hash' | 'sequential';
  maxVersions: number;
  branchingSupport: boolean;
  mergingSupport: boolean;
}

/**
 * Online Learning Configuration
 */
export interface OnlineLearningConfig {
  enabled: boolean;
  learningRate: number;
  adaptationSpeed: 'slow' | 'medium' | 'fast' | 'adaptive';
  forgettingFactor: number; // 0-1
  conceptDriftDetection: boolean;
  distributionShiftHandling: boolean;
  catastrophicForgettingPrevention: boolean;
}

/**
 * Transfer Learning Configuration
 */
export interface TransferLearningConfig {
  enabled: boolean;
  sourceModels: SourceModelConfig[];
  transferStrategy: 'feature_extraction' | 'fine_tuning' | 'domain_adaptation';
  similarityThreshold: number; // 0-1
  knowledgeDistillation: boolean;
  multitaskLearning: boolean;
}

/**
 * Source Model Configuration
 */
export interface SourceModelConfig {
  modelId: string;
  domain: string;
  similarity: number; // 0-1
  transferLayers: string[];
  freezeLayers: string[];
}

/**
 * Continuous Improvement Configuration
 */
export interface ContinuousImprovementConfig {
  enabled: boolean;
  improvementMetrics: ImprovementMetric[];
  experimentationFramework: ExperimentationConfig;
  abTesting: ABTestingConfig;
  performanceBaseline: PerformanceBaselineConfig;
  innovationRate: number; // 0-1
  conservativeness: number; // 0-1
}

/**
 * Improvement Metric
 */
export interface ImprovementMetric {
  metricId: string;
  name: string;
  target: number;
  weight: number; // 0-1
  timeframe: number; // ms
}

/**
 * Experimentation Configuration
 */
export interface ExperimentationConfig {
  enabled: boolean;
  experimentTypes: ExperimentType[];
  statisticalSignificance: number; // 0-1
  minimumSampleSize: number;
  maxExperimentDuration: number; // ms
}

/**
 * Experiment Type
 */
export interface ExperimentType {
  typeId: string;
  name: string;
  description: string;
  parameters: string[];
  metrics: string[];
}

/**
 * A/B Testing Configuration
 */
export interface ABTestingConfig {
  enabled: boolean;
  trafficSplit: Record<string, number>; // variant -> percentage
  minimumSampleSize: number;
  confidenceLevel: number; // 0-1
  maxTestDuration: number; // ms
}

/**
 * Performance Baseline Configuration
 */
export interface PerformanceBaselineConfig {
  enabled: boolean;
  baselineMetrics: string[];
  updateFrequency: number; // ms
  historicalWindow: number; // ms
  alertOnRegression: boolean;
}

/**
 * Adaptive Performance Thresholds
 */
export interface AdaptivePerformanceThresholds {
  accuracyThresholds: PerformanceThreshold;
  latencyThresholds: PerformanceThreshold;
  resourceThresholds: ResourceThreshold;
  userSatisfactionThresholds: PerformanceThreshold;
  adaptationTriggers: AdaptationTrigger[];
  degradationThresholds: DegradationThreshold[];
}

/**
 * Performance Threshold
 */
export interface PerformanceThreshold {
  warning: number;
  critical: number;
  optimal: number;
  target: number;
}

/**
 * Resource Threshold
 */
export interface ResourceThreshold {
  memory: PerformanceThreshold;
  cpu: PerformanceThreshold;
  network: PerformanceThreshold;
  storage: PerformanceThreshold;
}

/**
 * Adaptation Trigger
 */
export interface AdaptationTrigger {
  triggerId: string;
  condition: string;
  threshold: number;
  enabled: boolean;
}

/**
 * Degradation Threshold
 */
export interface DegradationThreshold {
  metric: string;
  threshold: number;
  timeWindow: number; // ms
  action: string;
}

// ============================================================================
// Performance and Analytics Configuration
// ============================================================================

/**
 * Predictive Performance Configuration
 */
export interface PredictivePerformanceConfig {
  accuracyMetrics: AccuracyMetricsConfig;
  latencyRequirements: LatencyRequirementsConfig;
  resourceLimits: ResourceLimitsConfig;
  optimizationTargets: OptimizationTargetsConfig;
  monitoringConfig: PredictiveMonitoringConfig;
}

/**
 * Accuracy Metrics Configuration
 */
export interface AccuracyMetricsConfig {
  enabled: boolean;
  primaryMetrics: AccuracyMetric[];
  secondaryMetrics: AccuracyMetric[];
  realTimeTracking: boolean;
  historicalComparison: boolean;
  benchmarkComparison: boolean;
  reportingInterval: number; // ms
  alertThresholds: AccuracyAlertThreshold[];
}

/**
 * Accuracy Metric
 */
export interface AccuracyMetric {
  metricId: string;
  name: string;
  description: string;
  weight: number; // 0-1
  target: number; // 0-1
}

/**
 * Accuracy Alert Threshold
 */
export interface AccuracyAlertThreshold {
  metric: string;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
}

/**
 * Latency Requirements Configuration
 */
export interface LatencyRequirementsConfig {
  maxPredictionLatency: number; // ms
  maxPrefetchLatency: number; // ms
  realTimeRequirements: boolean;
  latencyBudget: number; // ms
}

/**
 * Resource Limits Configuration
 */
export interface ResourceLimitsConfig {
  maxMemoryUsage: number; // bytes
  maxCpuUsage: number; // percentage
  maxNetworkUsage: number; // bytes/sec
  maxStorageUsage: number; // bytes
}

/**
 * Optimization Targets Configuration
 */
export interface OptimizationTargetsConfig {
  primaryTarget:
    | 'accuracy'
    | 'latency'
    | 'resource_efficiency'
    | 'user_satisfaction';
  secondaryTargets: string[];
  tradeoffWeights: Record<string, number>;
  constraints: OptimizationConstraint[];
}

/**
 * Optimization Constraint
 */
export interface OptimizationConstraint {
  constraintId: string;
  type: 'hard' | 'soft';
  condition: string;
  penalty: number;
}

/**
 * Predictive Monitoring Configuration
 */
export interface PredictiveMonitoringConfig {
  enabled: boolean;
  metricsCollection: boolean;
  performanceTracking: boolean;
  errorTracking: boolean;
  alerting: boolean;
  dashboards: boolean;
}

/**
 * Analytics Integration Configuration
 */
export interface AnalyticsIntegrationConfig {
  story23AnalyticsEngine: boolean; // Integration with completed Story 2.3 AnalyticsEngine
  behaviorPatternIntegration: BehaviorPatternIntegrationConfig;
  practiceSessionIntegration: PracticeSessionIntegrationConfig;
  progressAnalysisIntegration: ProgressAnalysisIntegrationConfig;
  dataExchangeProtocol: DataExchangeProtocolConfig;
}

/**
 * Behavior Pattern Integration Configuration
 */
export interface BehaviorPatternIntegrationConfig {
  enabled: boolean;
  patternTypes: string[];
  syncInterval: number; // ms
  dataTransformation: boolean;
  realTimeSync: boolean;
}

/**
 * Practice Session Integration Configuration
 */
export interface PracticeSessionIntegrationConfig {
  enabled: boolean;
  sessionTracking: boolean;
  metricsExtraction: boolean;
  contextualData: boolean;
  realTimeUpdates: boolean;
}

/**
 * Progress Analysis Integration Configuration
 */
export interface ProgressAnalysisIntegrationConfig {
  enabled: boolean;
  skillTracking: boolean;
  achievementTracking: boolean;
  trendAnalysis: boolean;
  predictiveInsights: boolean;
}

/**
 * Data Exchange Protocol Configuration
 */
export interface DataExchangeProtocolConfig {
  protocol: 'rest' | 'graphql' | 'grpc' | 'websocket';
  encryption: boolean;
  compression: boolean;
  batchSize: number;
  syncStrategy: 'push' | 'pull' | 'bidirectional';
}

// ============================================================================
// Core Prediction Types
// ============================================================================

/**
 * Prediction Priority
 */
export type PredictionPriority =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'background';

/**
 * Practice Pattern Type
 */
export type PracticePatternType =
  | 'tempo_progression'
  | 'key_exploration'
  | 'difficulty_advancement'
  | 'exercise_sequencing'
  | 'session_structure'
  | 'break_patterns'
  | 'repetition_patterns'
  | 'exploration_patterns';

/**
 * Asset Type
 */
export type AssetType =
  | 'midi_file'
  | 'audio_sample'
  | 'backing_track'
  | 'exercise_asset'
  | 'ambient_track'
  | 'user_recording'
  | 'system_asset';

/**
 * Learning Event Type
 */
export type LearningEventType =
  | 'asset_access'
  | 'practice_session'
  | 'skill_demonstration'
  | 'error_correction'
  | 'achievement_unlock'
  | 'preference_update'
  | 'context_change';

/**
 * Pattern Type
 */
export type PatternType =
  | 'sequential'
  | 'temporal'
  | 'frequency'
  | 'association'
  | 'clustering'
  | 'anomaly';

/**
 * Feedback Source
 */
export type FeedbackSource =
  | 'user_explicit'
  | 'user_implicit'
  | 'system_performance'
  | 'accuracy_metrics'
  | 'usage_analytics'
  | 'error_analysis';

/**
 * Model Update Trigger
 */
export type ModelUpdateTrigger =
  | 'performance_degradation'
  | 'new_data_available'
  | 'scheduled_update'
  | 'concept_drift_detected'
  | 'user_feedback'
  | 'external_event';

// ============================================================================
// Prediction Result Types
// ============================================================================

/**
 * Asset Prediction Result
 */
export interface AssetPrediction {
  predictionId: string;
  assetId: string;
  assetPath: string;
  bucket: string;
  confidence: number; // 0-1
  timeToNeed: number; // milliseconds until asset is likely needed
  priority: PredictionPriority;
  context: PredictionContext;
  triggers: PredictionTrigger[];
  metadata: PredictionMetadata;
  validUntil: number; // timestamp
}

/**
 * Prediction Context
 */
export interface PredictionContext {
  sessionId: string;
  userId: string;
  currentAsset?: string;
  practiceGoal?: string;
  sessionPhase: 'warmup' | 'main' | 'cooldown';
  timeRemaining: number; // estimated ms remaining in session
  skillLevel: string;
  environmentalFactors: Record<string, unknown>;
}

/**
 * Prediction Trigger
 */
export interface PredictionTrigger {
  triggerType: 'pattern_match' | 'time_based' | 'event_based' | 'contextual';
  confidence: number; // 0-1
  evidence: string[];
  triggerTime: number;
}

/**
 * Prediction Metadata
 */
export interface PredictionMetadata {
  modelVersion: string;
  predictionTime: number;
  features: Record<string, number>;
  explanations: string[];
  debugInfo?: Record<string, unknown>;
}

// ============================================================================
// User Behavior Profile Types
// ============================================================================

/**
 * User Behavior Profile
 */
export interface UserBehaviorProfile {
  userId: string;
  profileId: string;
  createdAt: number;
  lastUpdated: number;
  practicePatterns: PracticePattern[];
  assetUsagePatterns: AssetUsagePattern[];
  learningCharacteristics: LearningCharacteristics;
  preferences: UserPreferences;
  skillProgression: SkillProgression;
  sessionCharacteristics: SessionCharacteristics;
  predictiveMetrics: PredictiveMetrics;
}

/**
 * Practice Pattern
 */
export interface PracticePattern {
  patternId: string;
  type: PracticePatternType;
  frequency: number;
  consistency: number; // 0-1
  timeOfDay: TimeOfDayPattern;
  duration: DurationPattern;
  intensity: IntensityPattern;
  assetPreference: AssetPreferencePattern;
  progressionStyle: ProgressionStylePattern;
  confidence: number; // 0-1
  lastObserved: number;
}

/**
 * Time of Day Pattern
 */
export interface TimeOfDayPattern {
  preferredHours: number[]; // 0-23
  peakPerformanceHours: number[];
  consistencyScore: number; // 0-1
  flexibilityScore: number; // 0-1
}

/**
 * Duration Pattern
 */
export interface DurationPattern {
  averageDuration: number; // ms
  minimumDuration: number; // ms
  maximumDuration: number; // ms
  variabilityScore: number; // 0-1
  attentionDecay: number; // rate of attention decline
}

/**
 * Intensity Pattern
 */
export interface IntensityPattern {
  averageIntensity: number; // 0-1
  peakIntensity: number; // 0-1
  intensityProgression: 'increasing' | 'decreasing' | 'stable' | 'variable';
  focusDistribution: number[]; // intensity over time
}

/**
 * Asset Preference Pattern
 */
export interface AssetPreferencePattern {
  assetTypePreferences: Record<AssetType, number>; // 0-1
  complexityPreference: number; // 0-1
  noveltyPreference: number; // 0-1
  familiarityBalance: number; // 0-1
}

/**
 * Progression Style Pattern
 */
export interface ProgressionStylePattern {
  style: 'linear' | 'exponential' | 'plateau' | 'cyclical';
  pacePreference: 'slow' | 'moderate' | 'fast' | 'variable';
  challengeSeekingBehavior: number; // 0-1
  riskTolerance: number; // 0-1
}

/**
 * Asset Usage Pattern
 */
export interface AssetUsagePattern {
  patternId: string;
  assetType: AssetType;
  usageFrequency: number;
  accessSequence: AssetAccessSequence[];
  contextualUsage: ContextualUsage[];
  seasonalTrends: SeasonalTrend[];
  correlatedAssets: CorrelatedAsset[];
  predictiveValue: number; // how useful this pattern is for prediction
}

/**
 * Asset Access Sequence
 */
export interface AssetAccessSequence {
  assetId: string;
  accessOrder: number;
  timeOffset: number; // ms from session start
  duration: number; // ms spent with asset
  context: string;
}

/**
 * Contextual Usage
 */
export interface ContextualUsage {
  context: string;
  frequency: number;
  effectiveness: number; // 0-1
  userSatisfaction: number; // 0-1
}

/**
 * Seasonal Trend
 */
export interface SeasonalTrend {
  season: 'spring' | 'summer' | 'fall' | 'winter';
  usageMultiplier: number; // relative to baseline
  confidence: number; // 0-1
}

/**
 * Correlated Asset
 */
export interface CorrelatedAsset {
  assetId: string;
  correlationStrength: number; // 0-1
  correlationType: 'sequential' | 'simultaneous' | 'alternative';
  confidence: number; // 0-1
}

/**
 * Learning Characteristics
 */
export interface LearningCharacteristics {
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  pacePreference: 'slow' | 'moderate' | 'fast' | 'variable';
  challengePreference: 'incremental' | 'steep' | 'plateau' | 'mixed';
  feedbackPreference: 'immediate' | 'periodic' | 'minimal';
  attentionSpan: number; // minutes
  retentionRate: number; // 0-1
  transferAbility: number; // 0-1
}

/**
 * User Preferences
 */
export interface UserPreferences {
  assetTypePreferences: Record<AssetType, number>; // 0-1
  qualityVsSpeed: number; // 0-1, 0=speed, 1=quality
  dataUsageAwareness: number; // 0-1
  batteryAwareness: number; // 0-1
  privacyLevel: 'minimal' | 'moderate' | 'strict';
  adaptationConsent: boolean;
}

/**
 * Skill Progression
 */
export interface SkillProgression {
  currentLevel: Record<string, number>; // skill -> level (0-100)
  progressionRate: Record<string, number>; // skill -> rate per week
  strengthAreas: string[];
  improvementAreas: string[];
  learningVelocity: number; // overall rate of improvement
  consistencyScore: number; // 0-1
  plateauIndicators: PlateauIndicator[];
}

/**
 * Plateau Indicator
 */
export interface PlateauIndicator {
  skillArea: string;
  plateauStart: number; // timestamp
  plateauDuration: number; // ms
  confidenceLevel: number; // 0-1
  interventionSuggested: boolean;
}

/**
 * Session Characteristics
 */
export interface SessionCharacteristics {
  averageDuration: number; // ms
  preferredStartTime: number; // hour of day
  typicalBreakPattern: BreakPattern[];
  intensityProfile: IntensityProfile;
  focusPattern: FocusPattern;
  motivationLevel: number; // 0-1
  dropoffRisk: number; // 0-1
}

/**
 * Break Pattern
 */
export interface BreakPattern {
  frequency: number; // breaks per hour
  averageDuration: number; // ms
  timing: 'regular' | 'fatigue_based' | 'achievement_based';
  effectiveness: number; // 0-1
}

/**
 * Intensity Profile
 */
export interface IntensityProfile {
  warmupIntensity: number; // 0-1
  peakIntensity: number; // 0-1
  cooldownIntensity: number; // 0-1
  sustainedIntensity: number; // 0-1
  intensityVariability: number; // 0-1
}

/**
 * Focus Pattern
 */
export interface FocusPattern {
  attentionSpan: number; // minutes
  distractionSusceptibility: number; // 0-1
  deepFocusPeriods: number[]; // timestamps during session
  multitaskingTendency: number; // 0-1
}

/**
 * Predictive Metrics
 */
export interface PredictiveMetrics {
  predictionAccuracy: number; // 0-1
  confidenceCalibration: number; // 0-1
  adaptationRate: number; // how quickly user patterns change
  predictabilityScore: number; // 0-1, how predictable this user is
  modelFitness: number; // 0-1, how well the model fits this user
  lastModelUpdate: number;
  predictionHistory: PredictionHistoryEntry[];
}

/**
 * Prediction History Entry
 */
export interface PredictionHistoryEntry {
  predictionId: string;
  timestamp: number;
  actualOutcome: boolean;
  confidence: number; // 0-1
  accuracy: number; // 0-1
  timeToActual: number; // ms
}

// ============================================================================
// Learning Event Types
// ============================================================================

/**
 * Learning Event
 */
export interface LearningEvent {
  eventId: string;
  timestamp: number;
  eventType: LearningEventType;
  context: LearningEventContext;
  assets: LearningEventAsset[];
  outcome: LearningOutcome;
  features: LearningEventFeatures;
  labels: LearningEventLabels;
}

/**
 * Learning Event Context
 */
export interface LearningEventContext {
  sessionId: string;
  sessionPhase: string;
  timeInSession: number; // ms
  practiceGoal: string;
  difficulty: number; // 0-100
  userState: string;
  environmentalFactors: Record<string, unknown>;
}

/**
 * Learning Event Asset
 */
export interface LearningEventAsset {
  assetId: string;
  role: 'primary' | 'secondary' | 'reference' | 'fallback';
  interactionType: 'view' | 'play' | 'practice' | 'study';
  duration: number; // ms
  effectiveness: number; // 0-1
}

/**
 * Learning Outcome
 */
export interface LearningOutcome {
  outcomeType: 'success' | 'partial_success' | 'failure' | 'abandoned';
  metrics: Record<string, number>;
  userFeedback?: number; // 0-1
  objectively_measured?: boolean;
}

/**
 * Learning Event Features
 */
export interface LearningEventFeatures {
  temporal: Record<string, number>;
  behavioral: Record<string, number>;
  contextual: Record<string, number>;
  asset: Record<string, number>;
  sequential: number[];
}

/**
 * Learning Event Labels
 */
export interface LearningEventLabels {
  nextAssetNeeded?: string;
  timeToNextAsset?: number;
  sessionContinuation?: boolean;
  skillImprovement?: number;
  satisfactionLevel?: number;
}

// ============================================================================
// Prefetch Types
// ============================================================================

/**
 * Prefetch Request
 */
export interface PrefetchRequest {
  requestId: string;
  userId: string;
  predictions: AssetPrediction[];
  priority: PredictionPriority;
  networkCondition: PrefetchNetworkCondition;
  resourceLimits: PrefetchResourceLimits;
  validationRules: PrefetchValidationRule[];
  metadata: PrefetchRequestMetadata;
}

/**
 * Prefetch Network Condition
 */
export interface PrefetchNetworkCondition {
  minBandwidth?: number; // bytes/sec
  maxBandwidth?: number; // bytes/sec
  maxLatency?: number; // ms
  connectionType?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  connectionQuality?: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Prefetch Resource Limits
 */
export interface PrefetchResourceLimits {
  maxBandwidth: number; // bytes/sec
  maxMemory: number; // bytes
  maxStorage: number; // bytes
  maxConcurrentDownloads: number;
  timeLimit: number; // ms
}

/**
 * Prefetch Validation Rule
 */
export interface PrefetchValidationRule {
  ruleId: string;
  condition: string;
  action: 'allow' | 'deny' | 'warn';
  priority: number;
}

/**
 * Prefetch Request Metadata
 */
export interface PrefetchRequestMetadata {
  requestedAt: number;
  requestSource:
    | 'user_action'
    | 'pattern_prediction'
    | 'scheduled'
    | 'fallback';
  urgency: 'immediate' | 'soon' | 'eventual' | 'background';
  context: Record<string, unknown>;
}

/**
 * Prefetch Result
 */
export interface PrefetchResult {
  requestId: string;
  results: PrefetchAssetResult[];
  totalSize: number; // bytes
  totalTime: number; // ms
  successRate: number; // 0-1
  networkEfficiency: number; // 0-1
  cacheUtilization: number; // 0-1
  resourceUsage: PrefetchResourceUsage;
  performance: PrefetchPerformance;
}

/**
 * Prefetch Asset Result
 */
export interface PrefetchAssetResult {
  assetId: string;
  status: 'success' | 'failed' | 'partial' | 'skipped';
  downloadTime: number; // ms
  size: number; // bytes
  source: string;
  quality: number; // 0-1
  cacheLocation: string;
  error?: string;
}

/**
 * Prefetch Resource Usage
 */
export interface PrefetchResourceUsage {
  bandwidthUsed: number; // bytes
  memoryUsed: number; // bytes
  storageUsed: number; // bytes
  cpuTime: number; // ms
  powerConsumption: number; // estimated mWh
}

/**
 * Prefetch Performance
 */
export interface PrefetchPerformance {
  hitRate: number; // 0-1, how many prefetched assets were actually used
  wasteRate: number; // 0-1, how many were prefetched but not used
  timeToFirstByte: number; // ms
  timeToFullDownload: number; // ms
  networkEfficiency: number; // 0-1
  userPerceptionScore: number; // 0-1
}

// ============================================================================
// Model Performance Types
// ============================================================================

/**
 * Model Performance Metrics
 */
export interface ModelPerformanceMetrics {
  modelId: string;
  accuracy: number; // 0-1
  precision: number; // 0-1
  recall: number; // 0-1
  f1Score: number; // 0-1
  auc: number; // 0-1 Area Under Curve
  confusionMatrix: ConfusionMatrix;
  crossValidationScore: number; // 0-1
  generalizationError: number;
  trainingHistory: TrainingHistoryEntry[];
  predictionLatency: number; // ms
  lastEvaluated: number;
}

/**
 * Confusion Matrix
 */
export interface ConfusionMatrix {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
}

/**
 * Training History Entry
 */
export interface TrainingHistoryEntry {
  epoch: number;
  loss: number;
  accuracy: number;
  valLoss: number;
  valAccuracy: number;
  timestamp: number;
  learningRate: number;
}

/**
 * Adaptive Learning Metrics
 */
export interface AdaptiveLearningMetrics {
  adaptationRate: number; // how quickly the model adapts
  improvementTrend: 'improving' | 'stable' | 'degrading';
  feedbackIncorporation: number; // 0-1 how well feedback is used
  modelStability: number; // 0-1
  knowledgeRetention: number; // 0-1
  transferEffectiveness: number; // 0-1
  continuousAccuracy: number; // 0-1
  adaptationHistory: AdaptationHistoryEntry[];
}

/**
 * Adaptation History Entry
 */
export interface AdaptationHistoryEntry {
  timestamp: number;
  adaptationType: 'gradual' | 'sudden' | 'correction';
  triggerEvent: string;
  performanceBefore: number;
  performanceAfter: number;
  adaptationSuccess: boolean;
  userFeedback?: number;
}

// ============================================================================
// User Segmentation Types
// ============================================================================

/**
 * User Segment
 */
export interface UserSegment {
  segmentId: string;
  name: string;
  description: string;
  criteria: SegmentCriteria[];
  userIds: string[];
  characteristics: SegmentCharacteristics;
  createdAt: number;
  updatedAt: number;
}

/**
 * Segment Criteria
 */
export interface SegmentCriteria {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: unknown;
  weight: number; // 0-1
}

/**
 * Segment Characteristics
 */
export interface SegmentCharacteristics {
  averageSessionLength: number;
  preferredAssetTypes: AssetType[];
  skillLevel: number; // 0-100
  engagementLevel: number; // 0-1
  retentionRate: number; // 0-1
}

/**
 * Correlation Matrix
 */
export interface CorrelationMatrix {
  matrixId: string;
  assets: string[];
  correlations: number[][]; // correlation coefficients matrix
  confidence: number; // 0-1
  sampleSize: number;
  lastUpdated: number;
  significanceLevel: number; // 0-1
}

// ============================================================================
// Prefetch Strategy Types
// ============================================================================

/**
 * Prefetch Strategy
 */
export interface PrefetchStrategy {
  strategyId: string;
  name: string;
  type: 'aggressive' | 'conservative' | 'adaptive' | 'user_driven';
  parameters: PrefetchStrategyParameters;
  conditions: PrefetchCondition[];
  enabled: boolean;
}

/**
 * Prefetch Strategy Parameters
 */
export interface PrefetchStrategyParameters {
  lookaheadTime: number; // ms
  maxPrefetchSize: number; // bytes
  minConfidence: number; // 0-1
  networkThreshold: number; // minimum bandwidth for prefetching
  batteryThreshold: number; // 0-100, minimum battery level
}

/**
 * Prefetch Condition
 */
export interface PrefetchCondition {
  conditionId: string;
  type: 'time_based' | 'usage_based' | 'context_based' | 'performance_based';
  parameters: Record<string, unknown>;
  enabled: boolean;
}

// ============================================================================
// Type Aliases for Compatibility
// ============================================================================

/**
 * Predictive Models Config (alias for compatibility)
 */
export type PredictiveModelsConfig = PredictiveModelConfig;

/**
 * Performance Optimization Config (alias for compatibility)
 */
export type PerformanceOptimizationConfig = PredictivePerformanceConfig;
