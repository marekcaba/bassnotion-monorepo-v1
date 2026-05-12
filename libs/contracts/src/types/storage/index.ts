/**
 * Storage Types - Barrel Export File
 *
 * This file re-exports all storage types from their respective modules.
 * Maintains backward compatibility with the original monolithic storage.ts
 *
 * @module storage
 */

// Base types - foundational types with no dependencies
export type {
  // Type aliases
  CircuitBreakerState,
  ErrorSeverity,
  ErrorCategory,
  DegradationLevel,
  CacheLayer,
  SyncPriority,
  // Interfaces
  StorageError,
  AssetMetadata,
  DeviceInfo,
  LocationInfo,
  BandwidthMonitor,
  ConnectionHealth,
  StorageMetrics,
  RetryConfig,
  CacheRequestConfig,
  CircuitBreakerConfig,
  CircuitBreaker,
  GeographicOptimizationConfig,
  DownloadOptions,
  DownloadResult,
  StorageProvider,
  DeliveryOptimization,
  AdvancedCacheConfig,
  PredictiveLoadingConfig,
  AssetProcessingConfig,
  OfflineStorageConfig,
  AssetSyncStatus,
  AssetAnalytics,
  LoadingExperienceConfig,
  SmartPrefetchConfig,
  AssetOptimizationResult,
  AssetRequestConfig,
} from './base.types.js';

// Authentication types - auth, tokens, sessions, security
export type {
  SecurityAlertThresholds,
  TokenRefreshConfig,
  SessionManagementConfig,
  SecurityMonitoringConfig,
  AuthenticationConfig,
  TokenInfo,
  SessionState,
  SecurityContext,
  AuthenticationMetrics,
  AuthenticationError,
  AuthenticationEvent,
  SecurityIncident,
} from './authentication.types.js';

// Audio sample types - most actively used storage types
export type {
  // Type aliases
  AudioSampleFormat,
  AudioSampleQualityProfile,
  AudioSampleCategory,
  // Metadata
  AudioSampleMetadata,
  // Library configuration
  AudioSampleQualityThresholds,
  AudioSampleLibraryConfig,
  AudioSampleLibraryStatistics,
  AudioSampleLibrary,
  // Streaming
  BandwidthThresholds,
  LatencyThresholds,
  AdaptiveAudioStreamingConfig,
  // Cache
  IntelligentSampleCacheConfig,
  SampleCacheEntry,
  // Analytics configuration
  SampleQualityThresholds,
  SamplePerformanceThresholds,
  SampleAlertThresholds,
  SampleAnalyticsConfig,
  // Metrics
  SamplePlaybackMetrics,
  SampleQualityMetrics,
  SamplePerformanceMetrics,
  SampleUsageMetrics,
  SampleInteractionMetrics,
  SampleAnalyticsData,
  // Manager
  AudioSampleManagerConfig,
  AudioSampleOperationResult,
} from './audio-samples.types.js';

// Error recovery types - error handling, circuit breakers, recovery
export type {
  // Type aliases
  ErrorType,
  RecoveryStrategyType,
  // Retry configuration
  RetryBudget,
  RetryPolicy,
  // Circuit breaker
  EnhancedCircuitBreakerConfig,
  // Health checks
  HealthCheckEndpoint,
  CustomHealthCheck,
  HealthCheckConfig,
  // Error recovery
  ErrorRecoveryConfig,
  FallbackOption,
  RecoveryStrategy,
  ErrorClassification,
  // Analytics
  ErrorPattern,
  ErrorAnalytics,
  RecoveryResult,
  // Health status
  HealthTrend,
  ComponentHealth,
  DetailedHealthStatus,
} from './error-recovery.types.js';

// Bucket management types - organization, versioning, search, cleanup
export type {
  // Type aliases
  BucketCategory,
  BucketOperation,
  // Retention policies
  RetentionCondition,
  RetentionAction,
  RetentionPolicy,
  // Bucket configuration
  BucketManagementConfig,
  BucketIssue,
  BucketHealthStatus,
  BucketPermissions,
  BucketInfo,
  // Versioning
  AssetVersionMetadata,
  AssetVersion,
  VersioningConfig,
  VersionChange,
  VersionDiff,
  // Metadata and search
  ExtractedMetadata,
  AssetRelationship,
  AssetMetadataIndex,
  MetadataIndexingConfig,
  AssetSearchFilters,
  AssetSearchSorting,
  SearchPagination,
  AssetSearchQuery,
  FacetValue,
  SearchFacet,
  AssetSearchResult,
  // Cleanup
  CleanupSchedule,
  OrphanedAssetCleanupConfig,
  DuplicateDetectionConfig,
  StorageOptimizationConfig,
  ArchivalConfig,
  CleanupNotificationConfig,
  AutomatedCleanupConfig,
  CleanupError,
  CleanupResult,
  // Analytics
  AnalyticsPeriod,
  DataPoint,
  CategoryUsage,
  AssetSizeInfo,
  StorageUsageAnalytics,
  PopularAssetInfo,
  UserAccessPattern,
  AccessPatternAnalytics,
  SlowOperationInfo,
  BucketPerformanceMetrics,
  CategoryCost,
  StorageCostAnalytics,
  BucketRecommendation,
  BucketAnalytics,
  // Extended types
  StorageTokenInfo,
  BucketAuditLog,
} from './bucket-management.types.js';

// Health monitoring types - monitoring, analytics, alerting, dashboards
export type {
  // Type aliases
  WidgetType,
  HealthWebhookEvent,
  RealTimeEventType,
  // Monitoring configuration
  RealTimeMonitoringConfig,
  ComponentMonitoringConfig,
  HealthThresholdConfig,
  HealthMonitoringConfig,
  PerformanceAnalyticsConfig,
  // Performance metrics
  PerformanceMetrics,
  PerformanceDataPoint,
  SeasonalPattern,
  PredictedValue,
  PredictionFactor,
  PerformancePrediction,
  PerformanceTrend,
  AnomalyContext,
  PerformanceAnomaly,
  // Alerting
  AlertCondition,
  AlertRule,
  AlertThreshold,
  AlertDetails,
  AlertAcknowledgment,
  AlertNotification,
  RateLimitConfig,
  NotificationRetryPolicy,
  AlertFilterRule,
  AlertChannelConfig,
  AlertChannel,
  EscalationCondition,
  EscalationLevel,
  EscalationPolicy,
  AlertGroupingConfig,
  AlertSuppressionRule,
  RecurrencePattern,
  MaintenanceWindow,
  AlertingConfig,
  // Dashboard
  TimeRange,
  WidgetThreshold,
  WidgetConfiguration,
  WidgetSize,
  WidgetPosition,
  WidgetDataSource,
  WidgetPermissions,
  HealthWidget,
  LayoutBreakpoint,
  DashboardLayout,
  DashboardPermissions,
  FilterOption,
  DashboardFilter,
  HealthDashboard,
  // Health reports
  OverallHealthStatus,
  ComponentMetrics,
  ComponentIssue,
  ComponentHealthReport,
  PerformanceTrendSummary,
  PerformanceBottleneck,
  PerformanceSummary,
  TopAlertRule,
  AlertSummary,
  HealthRecommendation,
  HealthTrendSummary,
  IncidentSummary,
  ChartConfiguration,
  ChartDataPoint,
  ReportChart,
  CustomReportSection,
  HealthReport,
  InsightEvidence,
  HealthInsight,
  // Monitoring integration
  OAuth2Config,
  AuthConfig,
  MonitoringIntegrationConfig,
  ExportRetryPolicy,
  MetricsFilterRule,
  MetricsTransformationRule,
  MetricsExportConfig,
  WebhookRetryPolicy,
  HealthWebhook,
  MonitoringIntegration,
  // Real-time monitoring
  RealTimeMonitoringEvent,
  SessionFilter,
  MonitoringSubscription,
  MonitoringSession,
} from './health-monitoring.types.js';

// CDN optimization types - global CDN, edge locations, caching, streaming
export type {
  // Core configuration
  CDNOptimizationConfig,
  CDNProvider,
  CDNEdgeConfig,
  EdgeLocation,
  EdgeFeature,
  // Geographic distribution
  GeographicDistributionConfig,
  EdgeSelectionStrategy,
  EdgeSelectionCriteria,
  GeographicLoadBalancingConfig,
  GeographicFailoverStrategy,
  // Edge routing and load balancing
  EdgeRoutingStrategy,
  RoutingWeights,
  RoutingRule,
  LoadBalancingConfig,
  LoadBalancingRetryPolicy,
  // Health checking and failover
  EdgeHealthCheckConfig,
  CustomEdgeHealthCheck,
  EdgeFailoverConfig,
  // Caching strategy
  EdgeCachingStrategy,
  CacheRule,
  CachePurgeStrategy,
  // Content optimization
  ContentOptimizationConfig,
  ImageOptimizationConfig,
  AudioOptimizationConfig,
  QualityLevel,
  AudioQualityLevel,
  CDNCompressionConfig,
  FormatConversionConfig,
  ImageConversionRule,
  AudioConversionRule,
  // Bandwidth and quality adaptation
  BandwidthAdaptationConfig,
  NetworkDetectionConfig,
  BandwidthAdaptationRule,
  CDNNetworkCondition,
  BufferManagementConfig,
  QualityAdaptationConfig,
  DeviceDetectionConfig,
  UserPreferenceConfig,
  QualityAdaptationRule,
  AdaptationCondition,
  // Adaptive streaming
  AdaptiveStreamingConfig,
  StreamingQualityLevel,
  BitrateAdaptationConfig,
  StreamingBufferConfig,
  StreamingFallbackConfig,
  // CDN performance monitoring
  CDNPerformanceMonitoringConfig,
  CDNMetricsCollectionConfig,
  CDNMetricType,
  CustomCDNMetric,
  CDNPerformanceThresholds,
  // CDN alerting and reporting
  CDNAlertingConfig,
  CDNAlertRule,
  CDNAlertSuppressionRule,
  CDNReportingConfig,
  CDNReportType,
  ReportSchedule,
  CustomCDNReport,
  CDNRealTimeMonitoringConfig,
  // CDN analytics
  CDNAnalyticsConfig,
  CDNDataCollectionConfig,
  CDNAnalysisConfig,
  CDNOptimizationAnalysisConfig,
  CDNAnalyticsReportingConfig,
  CDNAnalyticsIntegrationConfig,
  GoogleAnalyticsIntegration,
  DatadogIntegration,
  NewRelicIntegration,
  CustomAnalyticsIntegration,
  // CDN fallback strategy
  CDNFallbackStrategy,
  CDNFallbackOption,
  // CDN performance metrics
  CDNPerformanceMetrics,
  EdgePerformanceMetric,
  GeographicMetric,
  // CDN optimization recommendations
  CDNOptimizationRecommendation,
  OptimizationImpact,
  OptimizationImplementation,
  OptimizationMetrics,
  // CDN health status
  CDNHealthStatus,
  CDNComponentHealth,
  EdgeLocationHealth,
  CDNHealthIssue,
} from './cdn-optimization.types.js';

// Predictive loading types - ML-based asset prediction and prefetching
export type {
  // Core engine configuration
  PredictiveLoadingEngineConfig,
  // Machine learning configuration
  MachineLearningConfig,
  ModelTrainingConfig,
  FeatureEngineeringConfig,
  RegularizationConfig,
  EarlyStoppingConfig,
  TrainingSchedule,
  RetrainingTrigger,
  ModelPersistenceConfig,
  ModelRetentionPolicy,
  PredictionThresholds,
  ActionThreshold,
  ContextualThreshold,
  CrossValidationConfig,
  // Feature configuration
  TemporalFeatureConfig,
  BehavioralFeatureConfig,
  ContextualFeatureConfig,
  AssetFeatureConfig,
  SequentialFeatureConfig,
  FeatureNormalizationConfig,
  // Behavior analysis
  BehaviorAnalysisConfig,
  PatternRecognitionConfig,
  SessionAnalysisConfig,
  PracticeRoutineAnalysisConfig,
  UserSegmentationConfig,
  TemporalPatternConfig,
  CorrelationAnalysisConfig,
  // Intelligent prefetching
  IntelligentPrefetchingConfig,
  PrefetchingStrategy,
  PrefetchPrioritizationConfig,
  PrioritizationWeights,
  PrefetchResourceManagementConfig,
  ResourceAllocationStrategy,
  QuotaManagementConfig,
  ThrottlingConfig,
  NetworkAwarePrefetchingConfig,
  NetworkQualityThresholds,
  NetworkQualityRange,
  BackgroundPrefetchingConfig,
  BackgroundLimits,
  PrefetchValidationConfig,
  ValidationRule,
  ExpirationHandlingStrategy,
  // Predictive model configuration
  PredictiveModelConfig,
  ExerciseProgressionModelConfig,
  ExerciseProgressionFeatures,
  AssetDemandModelConfig,
  AssetDemandFeatures,
  UserIntentModelConfig,
  UserIntentFeatures,
  IntentCategory,
  SessionLengthModelConfig,
  SessionLengthFeatures,
  SkillDevelopmentModelConfig,
  SkillDevelopmentFeatures,
  MasteryThreshold,
  ModelEnsembleConfig,
  // Adaptive learning
  AdaptiveLearningConfig,
  FeedbackLoopConfig,
  FeedbackAggregationStrategy,
  FeedbackWeightingConfig,
  RewardSignalConfig,
  RewardSignal,
  PenaltySignalConfig,
  PenaltySignal,
  FeedbackValidationConfig,
  ModelUpdateStrategy,
  UpdateFrequency,
  RollbackStrategy,
  RollbackCriteria,
  ModelVersionControl,
  OnlineLearningConfig,
  TransferLearningConfig,
  SourceModelConfig,
  ContinuousImprovementConfig,
  ImprovementMetric,
  ExperimentationConfig,
  ExperimentType,
  ABTestingConfig,
  PerformanceBaselineConfig,
  AdaptivePerformanceThresholds,
  PerformanceThreshold,
  ResourceThreshold,
  AdaptationTrigger,
  DegradationThreshold,
  // Performance and analytics
  PredictivePerformanceConfig,
  AccuracyMetricsConfig,
  AccuracyMetric,
  AccuracyAlertThreshold,
  LatencyRequirementsConfig,
  ResourceLimitsConfig,
  OptimizationTargetsConfig,
  OptimizationConstraint,
  PredictiveMonitoringConfig,
  AnalyticsIntegrationConfig,
  BehaviorPatternIntegrationConfig,
  PracticeSessionIntegrationConfig,
  ProgressAnalysisIntegrationConfig,
  DataExchangeProtocolConfig,
  // Type aliases
  PredictionPriority,
  PracticePatternType,
  AssetType,
  LearningEventType,
  PatternType,
  FeedbackSource,
  ModelUpdateTrigger,
  // Prediction result types
  AssetPrediction,
  PredictionContext,
  PredictionTrigger,
  PredictionMetadata,
  // User behavior profile types
  UserBehaviorProfile,
  PracticePattern,
  TimeOfDayPattern,
  DurationPattern,
  IntensityPattern,
  AssetPreferencePattern,
  ProgressionStylePattern,
  AssetUsagePattern,
  AssetAccessSequence,
  ContextualUsage,
  SeasonalTrend,
  CorrelatedAsset,
  LearningCharacteristics,
  UserPreferences,
  SkillProgression,
  PlateauIndicator,
  SessionCharacteristics,
  BreakPattern,
  IntensityProfile,
  FocusPattern,
  PredictiveMetrics,
  PredictionHistoryEntry,
  // Learning event types
  LearningEvent,
  LearningEventContext,
  LearningEventAsset,
  LearningOutcome,
  LearningEventFeatures,
  LearningEventLabels,
  // Prefetch types
  PrefetchRequest,
  PrefetchNetworkCondition,
  PrefetchResourceLimits,
  PrefetchValidationRule,
  PrefetchRequestMetadata,
  PrefetchResult,
  PrefetchAssetResult,
  PrefetchResourceUsage,
  PrefetchPerformance,
  // Model performance types
  ModelPerformanceMetrics,
  ConfusionMatrix,
  TrainingHistoryEntry,
  AdaptiveLearningMetrics,
  AdaptationHistoryEntry,
  // User segmentation types
  UserSegment,
  SegmentCriteria,
  SegmentCharacteristics,
  CorrelationMatrix,
  // Prefetch strategy types
  PrefetchStrategy,
  PrefetchStrategyParameters,
  PrefetchCondition,
  // Type aliases for compatibility
  PredictiveModelsConfig,
  PerformanceOptimizationConfig,
} from './predictive-loading.types.js';

// Cache management types - multi-level caching, ML optimization, synchronization
export type {
  // Type aliases (CacheLayer is already exported from base.types)
  CacheConflictResolution,
  CacheOptimizationCategory,
  // Core configuration
  AdvancedCacheManagerConfig,
  GlobalCacheConfig,
  // Cache layer configurations
  MemoryCacheLayerConfig,
  IndexedDBCacheLayerConfig,
  ServiceWorkerCacheLayerConfig,
  // Routing configuration
  CacheRoutingConfig,
  // ML optimization
  MLCacheOptimizationConfig,
  // Compression configuration
  IntelligentCompressionConfig,
  AudioCompressionConfig,
  MIDICompressionConfig,
  MetadataCompressionConfig,
  // Synchronization
  CacheSynchronizationConfig,
  // Analytics configuration
  CacheAnalyticsConfig,
  CachePerformanceThresholds,
  // Advanced cache entry
  AdvancedCacheEntry,
  CacheLayerDistribution,
  // ML predictions
  AccessPrediction,
  LayerPrediction,
  CompressionBenefit,
  CachePredictionFactor,
  // Synchronization types
  CacheSyncStatus,
  SyncOperation,
  CacheSyncConflict,
  // Operation results
  AdvancedCacheOperationResult,
  // Analytics
  AdvancedCacheAnalytics,
  CacheOptimizationSuggestion,
} from './cache-management.types.js';

// MIDI orchestration types - MIDI asset management, version control, collaboration
export type {
  // Audio analysis types
  AudioMetadata,
  AnalysisConfig,
  TempoDetectionResult,
  KeyDetectionResult,
  FrequencyBinData,
  HarmonicContent,
  SpectralAnalysisResult,
  QualityAssessmentResult,
  MusicalFeatures,
  OnsetDetectionResult,
  AnalysisResult,
  // MIDI format type aliases
  MIDIFormat,
  MIDIType,
  MIDITrackType,
  MIDIInstrumentCategory,
  MIDIConflictResolutionStrategy,
  MIDIPermissionLevel,
  MIDIUpdateType,
  MIDITaggingStrategy,
  MIDIComplexityMetric,
  MIDIOptimizationCategory,
  // MIDI core configuration
  MIDIAssetOrchestratorConfig,
  SupabaseAssetClientConfig,
  // MIDI metadata
  MIDIMetadata,
  MIDITrackInfo,
  MIDIChannelInfo,
  MIDIInstrument,
  // Musical analysis
  MIDIComplexityAnalysis,
  MIDIComplexityFactor,
  MIDIHarmonicAnalysis,
  MIDIChord,
  MIDIModulation,
  MIDIRhythmicAnalysis,
  MIDIRhythmicPattern,
  MIDIGroove,
  // Timing and range
  MIDINoteRange,
  MIDIVelocityInfo,
  MIDITempoChange,
  MIDITimeSignatureChange,
  MIDIKeySignatureChange,
  // Version control
  MIDIVersionControlConfig,
  MIDIVersionInfo,
  MIDIVersionChange,
  MIDIMusicalImpact,
  MIDIVersionDiff,
  // Collaborative editing
  MIDICollaborativeConfig,
  MIDICollaborator,
  MIDIContribution,
  MIDICollaboratorPreferences,
  // Real-time synchronization
  MIDIRealTimeSyncConfig,
  MIDIRealtimeUpdate,
  MIDIOperation,
  // Metadata processing
  MIDIMetadataProcessingConfig,
  MIDIValidationRule,
  MIDIValidationResult,
  MIDIValidationMessage,
  // Analytics
  MIDIAnalyticsConfig,
  MIDIPerformanceThresholds,
  MIDIAlertThresholds,
  MIDIAnalyticsData,
  MIDIUsageMetrics,
  MIDIComplexityMetrics,
  MIDIPerformanceMetrics,
  MIDICollaborationMetrics,
  MIDIQualityMetrics,
  // Operation results
  MIDIOperationResult,
  MIDIConflictInfo,
} from './midi-orchestration.types.js';

// Compression and sync types - data compression, cache synchronization, conflict resolution
export type {
  // Type aliases
  ConflictType,
  ResolutionStrategy,
  SyncEventType,
  SynchronizationStrategy,
  // Compression benefit analysis
  CompressionBenefitAnalysis,
  CompressionFactor,
  // Compression strategy
  CompressionStrategy,
  CompressionConfig,
  CompressionPreset,
  CompressionProfile,
  NetworkAdaptiveConfig,
  // Compression results
  CompressionOperationResult,
  CompressionResult,
  CompressionQualityAssessment,
  CompressionQualityMetrics,
  CompressionPerformanceMetrics,
  CompressionAnalytics,
  // Cache layer configuration
  CacheLayerConfig,
  CacheEntry,
  CacheMetadata,
  // Synchronization results
  SynchronizationResult,
  SyncOperationResult,
  SynchronizationEvent,
  // Conflict management
  ConflictInfo,
  ConflictResolutionResult,
  MergeStrategy,
  // Sync analytics and state
  SyncAnalytics,
  CrossLayerSyncConfig,
  SyncState,
  LayerSyncStatus,
  SyncPerformanceMetrics,
} from './compression-sync.types.js';
