/**
 * Playback Domain - Comprehensive Export Structure
 *
 * This file provides the main export interface for the playback domain,
 * optimized for tree-shaking and organized by functional categories.
 *
 * Part of Story 2.1: Task 1, Subtask 1.5
 */

// ============================================================================
// CORE SERVICES - Main engine components
// ============================================================================

export { CorePlaybackEngine } from './services/CorePlaybackEngine.js';
export { AudioContextManager } from './services/AudioContextManager.js';
export { PerformanceMonitor } from './services/PerformanceMonitor.js';
export { WorkerPoolManager } from './services/WorkerPoolManager.js';
export { StatePersistenceManager } from './services/StatePersistenceManager.js';
export { N8nPayloadProcessor } from './services/N8nPayloadProcessor.js';
export { AssetManifestProcessor } from './services/AssetManifestProcessor.js';
export { AssetManager } from './services/AssetManager.js';
export { NetworkLatencyMonitor } from './services/NetworkLatencyMonitor.js';
export { CacheMetricsCollector } from './services/CacheMetricsCollector.js';

// ============================================================================
// PERFORMANCE OPTIMIZATION - A/B Testing and Analytics
// ============================================================================

export {
  ABTestFramework,
  type ExperimentConfig,
  type ExperimentVariant,
  type ExperimentStatus,
  type OptimizationCategory,
  type AudioOptimizationConfig,
  type ExperimentResult,
  type ExperimentAnalysis,
  type RollbackCondition,
  type DeviceTargeting,
  type UserTargeting,
  type ExperimentMetrics,
  type StatisticalMetrics,
  type DeviceInfo,
  type VariantAnalysis,
  type RiskAssessment,
  type ExperimentRecommendation,
} from './services/ABTestFramework.js';

// ============================================================================
// PLUGIN ARCHITECTURE - Extensible audio processing
// ============================================================================

export { BaseAudioPlugin } from './services/BaseAudioPlugin.js';
export { PluginManager } from './services/PluginManager.js';

// ============================================================================
// ERROR HANDLING - Comprehensive error management
// ============================================================================

export {
  // Base error classes
  PlaybackError,
  type ErrorSeverity,
  type ErrorCategory,
  type ErrorContext,

  // Specialized error types
  AudioContextError,
  createAudioContextError,
  type AudioContextErrorCode,
  PerformanceError,
  createPerformanceError,
  type PerformanceErrorCode,
  ResourceError,
  createResourceError,
  type ResourceErrorCode,
  NetworkError,
  createNetworkError,
  type NetworkErrorCode,
  MobileError,
  createMobileError,
  type MobileErrorCode,
  ValidationError,
  createValidationError,
  type ValidationErrorCode,

  // Error utilities
  ErrorClassifier,
  ErrorRecovery,
  ErrorReporter,

  // Type guards
  isPlaybackError,
  isAudioContextError,
  isPerformanceError,
  isResourceError,
  isNetworkError,
  isMobileError,
  isValidationError,
} from './services/errors/index.js';

// ============================================================================
// TYPE DEFINITIONS - TypeScript interfaces and types
// ============================================================================

export type {
  // Core audio types
  CorePlaybackEngineConfig,
  CoreAudioEngineConfig,
  AudioContextState,
  PlaybackState,
  AudioSourceType,
  AudioContextError as AudioContextErrorType,
  AudioPerformanceMetrics,
  PerformanceAlert,
  AudioSourceConfig,
  MobileAudioConfig,
  AudioVisualizationData,
  AudioEngineEvents,
  // Epic 2 - N8n Payload Processing types
  N8nPayloadConfig,
  AssetReference,
  AssetManifest,
  AssetLoadingState,
  N8nPayloadProcessorConfig,
  // Epic 2 - Asset Manifest Processing types
  AssetDependency,
  AssetOptimization,
  ProcessedAssetManifest,
  AssetLoadingGroup,
  // Epic 2 - Asset Manager types
  AssetManagerConfig,
  AssetLoadResult,
  AssetLoadError,
  AssetLoadProgress,
  // Worker Thread Types
  WorkerThreadType,
  WorkerThreadConfig,
  AudioWorkerMessage,
  WorkerMessageType,
  WorkerPool,
  WorkerInstance,
  WorkerJob,
  WorkerJobQueue,
  WorkerError,
  WorkerState,
  WorkerCapabilities,
  WorkerMetrics,
  WorkerPoolMetrics,
  BackgroundProcessingConfig,
  AudioProcessingPayload,
  MidiProcessingPayload,
  WorkerInitPayload,
  AudioStreamConfig,
  SharedAudioBuffer,
} from './types/audio.js';

export type {
  // Plugin system types
  AudioPlugin,
  PluginMetadata,
  PluginConfig,
  PluginCapabilities,
  PluginParameter,
  PluginEvents,
  PluginAudioContext,
  PluginProcessingResult,

  // Plugin manager types
  PluginManagerConfig,
  PluginManagerEvents,
  PluginRegistryEntry,
} from './types/plugin.js';

// ============================================================================
// REACT INTEGRATION - Hooks and state management
// ============================================================================

export { useCorePlaybackEngine } from './hooks/useCorePlaybackEngine.js';

// ============================================================================
// STATE MANAGEMENT - Zustand store
// ============================================================================

export {
  usePlaybackStore,
  playbackSelectors,
  type PlaybackStore,
} from './store/playbackStore.js';

// ============================================================================
// UTILITIES - Helper functions and device detection
// ============================================================================

export {
  // Device detection
  detectDeviceCapabilities,
  getMobileAudioConstraints,
  supportsLowLatencyAudio,
  getRecommendedAudioContextConfig,
  requiresUserGesture,
  getDevicePerformanceTier,
  getBatteryOptimizationRecommendations,

  // Type exports for device detection
  type DeviceCapabilities,
  type MobileAudioConstraints,
} from './utils/deviceDetection.js';

// ============================================================================
// CONSTANTS - Configuration defaults and enums
// ============================================================================

export {
  // Audio engine defaults
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_MOBILE_CONFIG,
  DEFAULT_BUFFER_SIZES,
  DEFAULT_SAMPLE_RATES,

  // Performance thresholds
  PERFORMANCE_THRESHOLDS,
  LATENCY_TARGETS,

  // Plugin system constants
  PLUGIN_CATEGORIES,
  PLUGIN_PRIORITIES,

  // Error codes
  ERROR_CODES,

  // Additional constants
  SUPPORTED_AUDIO_FORMATS,
  MIME_TYPE_MAPPINGS,
  TIMING_CONSTANTS,
  DEVICE_LIMITS,
  FEATURE_FLAGS,
  MIN_BROWSER_VERSIONS,
  WEB_AUDIO_FEATURES,
} from './constants';

// ============================================================================
// ENUMS - Direct enum exports for external use
// ============================================================================

export { PluginCategory, PluginPriority, PluginState } from './types/plugin.js';

// ============================================================================
// VERSION INFO - For debugging and compatibility
// ============================================================================

export const PLAYBACK_DOMAIN_VERSION = '2.1.0';
export const SUPPORTED_FEATURES = [
  'web-audio-api',
  'tone-js-integration',
  'plugin-architecture',
  'performance-monitoring',
  'error-recovery',
  'mobile-optimization',
  'tree-shaking',
] as const;

/**
 * Feature detection for runtime capability checking
 */
export const isFeatureSupported = (
  feature: (typeof SUPPORTED_FEATURES)[number],
): boolean => {
  return SUPPORTED_FEATURES.includes(feature);
};

// ============================================================================
// MIGRATION HELPERS - For Epic 2 transition
// ============================================================================

/**
 * @deprecated Use CorePlaybackEngine instead
 * This alias is provided for backward compatibility during Epic 2 transition
 */
export { CorePlaybackEngine as CoreAudioEngine } from './services/CorePlaybackEngine.js';

// ============================================================================
// LAZY IMPORTS - For optional features that don't exist yet
// ============================================================================

/**
 * Lazy loading utilities for optional features
 * These are only loaded when explicitly requested
 *
 * Note: Some modules may not exist yet - they will be created in future subtasks
 */
export const LazyImports = {
  /**
   * Load development tools (future implementation)
   */
  loadDevTools: async () => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        'Dev tools not yet implemented - will be added in future subtasks',
      );
    }
    return null;
  },

  /**
   * Load testing utilities (future implementation)
   */
  loadTestUtils: async () => {
    if (process.env.NODE_ENV === 'test') {
      console.warn(
        'Test utils not yet implemented - will be added in future subtasks',
      );
    }
    return null;
  },
} as const;

export type {
  // State Persistence Types
  PersistenceConfig,
  PersistedState,
  StorageQuota,
  PersistenceMetrics,
} from './services/StatePersistenceManager.js';

// MOBILE OPTIMIZATION - Task 7: Adaptive Quality Scaling and Battery Management
export { MobileOptimizer } from './services/MobileOptimizer.js';
export { BackgroundProcessor } from './services/BackgroundProcessor.js';
export { IOSOptimizer } from './services/IOSOptimizer.js';
export { AndroidOptimizer } from './services/AndroidOptimizer.js';
export {
  BatteryManager,
  type BatteryUsageMetrics,
  type PowerManagementSettings,
  type BatteryOptimizationSuggestion,
  type BatteryHistoryEntry,
} from './services/BatteryManager.js';
export type {
  DeviceClass,
  QualityLevel,
  PowerMode,
  ThermalState,
  BatteryStatus,
  ThermalStatus,
  AdaptiveQualityConfig,
  UserOptimizationPreferences,
  OptimizationDecision,
  OptimizationReasoning,
  OptimizationImpact,
  // Background Processing types
  CPUUsageMetrics,
  BackgroundProcessingStrategy,
  ProcessingJob,
  BackgroundProcessingStats,
  SmartSchedulingConfig,
  // iOS-Specific types
  IOSAudioSessionCategory,
  IOSAudioSessionMode,
  IOSPlaybackState,
  IOSAudioSessionConfig,
  IOSBackgroundAudioConfig,
  SafariOptimizationConfig,
  PWAOptimizationConfig,
  IOSAudioInterruption,
  IOSRouteChangeEvent,
  IOSOptimizationDecision,
  // Android-Specific types
  AndroidAudioStreamType,
  AndroidAudioUsage,
  AndroidAudioContentType,
  AndroidPlaybackState,
  AndroidAudioManagerConfig,
  AndroidPowerManagerConfig,
  AndroidBackgroundAudioConfig,
  AndroidChromeOptimizationConfig,
  AndroidWebViewOptimizationConfig,
  AndroidAudioInterruption,
  AndroidAudioRouteChangeEvent,
  AndroidOptimizationDecision,
} from './types/audio.js';

// Resource Management & Cleanup
export { ResourceManager } from './services/ResourceManager.js';
export { MemoryLeakDetector } from './services/MemoryLeakDetector.js';
export { GarbageCollectionOptimizer } from './services/GarbageCollectionOptimizer.js';
export { AudioResourceDisposer } from './services/AudioResourceDisposer.js';
export { ResourceUsageMonitor } from './services/ResourceUsageMonitor.js';

// Enhanced mobile optimization exports - NEW for Task 12.1
export type {
  DeviceModel,
  NetworkCapabilities,
  BrowserCapabilities,
  DeviceSpecificConfig,
  NetworkAdaptiveConfig,
  ProgressiveEnhancementConfig,
  DynamicOptimizationState,
  EnhancedOptimizationRules,
  DeviceOptimizationMetrics,
} from './types/audio.js';
