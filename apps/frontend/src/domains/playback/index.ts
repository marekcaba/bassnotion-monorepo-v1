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

// Export new core services from Epic 3.18
export {
  ServiceRegistry,
  AudioEngine,
  EventBus,
  UnifiedTransport,
  PluginManager,
  CoreServices,
  createCoreServices,
} from './services/core/index.js';

// ============================================================================
// PERFORMANCE OPTIMIZATION - Removed in Epic 3.18
// ============================================================================

// A/B Testing framework removed as part of service consolidation

// ============================================================================
// PLUGIN ARCHITECTURE - Extensible audio processing
// ============================================================================

// PluginManager is now part of core services, exported above
// BaseAudioPlugin removed - use plugin types instead

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
} from './services/errors/index';

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
} from './types/audio';

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
} from './types/plugin';

// ============================================================================
// REACT INTEGRATION - Hooks and state management
// ============================================================================

// Provider for new architecture
export { AudioProvider } from './providers/AudioProvider.js';

// New hooks from Epic 3.18 architecture
export { useAudio } from './hooks/useAudio.js';
export { useTransport } from './hooks/useTransport.js';
export { usePlugins } from './hooks/usePlugins.js';
export { useToneInit } from './hooks/useToneInit.js';

// Legacy hooks - these should be migrated to new hooks
export { useCorePlaybackEngine } from './hooks/useCorePlaybackEngine';

// ============================================================================
// STATE MANAGEMENT - Zustand store
// ============================================================================

export {
  usePlaybackStore,
  playbackSelectors,
  type PlaybackStore,
} from './store/playbackStore';

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
} from './utils/deviceDetection';

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

export { PluginCategory, PluginPriority, PluginState } from './types/plugin';
export * from './types/pattern';
export * from './types/region';
export * from './types/timing';
export * from './types/track';

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
 * @deprecated Use AudioEngine from core services instead
 * Legacy exports removed in Epic 3.18
 */

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
      logger.warn(
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
      logger.warn(
        'Test utils not yet implemented - will be added in future subtasks',
      );
    }
    return null;
  },
} as const;

// State persistence types removed - use core services state management

// MOBILE OPTIMIZATION - Removed in Epic 3.18
// Mobile optimization is now handled by monitoring services
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
} from './types/audio';

// Resource Management & Cleanup - Removed in Epic 3.18
// Resource management is now handled within core services

// Audio Compression - Removed in Epic 3.18
// Compression functionality moved to plugin architecture

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
} from './types/audio';

// ============================================================================
// ENHANCED REACT HOOKS - NEW for Task 15.3: Widget Consumption Hooks
// ============================================================================

// NEW: Widget-optimized hooks for easy consumption
export { usePlaybackState } from './hooks/usePlaybackState';
export type { UsePlaybackStateReturn } from './hooks/usePlaybackState';

export { useAssetLoading } from './hooks/useAssetLoading';
export type { UseAssetLoadingReturn } from './hooks/useAssetLoading';
