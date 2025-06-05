/**
 * @fileoverview BassNotion Playback Engine - Package Type Definitions
 *
 * This file provides package-level type definitions for the playback engine,
 * including module structure, exports, and compatibility information.
 *
 * @version 2.1.0
 * @packageDocumentation
 */

/**
 * Main package exports for @bassnotion/playback
 */
declare module '@bassnotion/playback' {
  export * from './index';
}

/**
 * Extended type definitions
 */
declare module '@bassnotion/playback/types' {
  export * from './types';
}

/**
 * Error handling module
 */
declare module '@bassnotion/playback/errors' {
  export {
    PlaybackError,
    AudioContextError,
    PerformanceError,
    ResourceError,
    NetworkError,
    MobileError,
    ValidationError,
    ErrorClassifier,
    ErrorRecovery,
    ErrorReporter,
    createAudioContextError,
    createPerformanceError,
    createResourceError,
    createNetworkError,
    createMobileError,
    createValidationError,
    isPlaybackError,
    isAudioContextError,
    isPerformanceError,
    isResourceError,
    isNetworkError,
    isMobileError,
    isValidationError,
    type ErrorSeverity,
    type ErrorCategory,
    type ErrorContext,
    type AudioContextErrorCode,
    type PerformanceErrorCode,
    type ResourceErrorCode,
    type NetworkErrorCode,
    type MobileErrorCode,
    type ValidationErrorCode,
    type ClassifiedError,
    type RecoveryResult,
    type RecoveryStrategy,
    type ErrorLog,
  } from '@bassnotion/playback';
}

/**
 * Core engine module
 */
declare module '@bassnotion/playback/core' {
  export {
    CoreAudioEngine,
    AudioContextManager,
    PerformanceMonitor,
    type CoreAudioEngineConfig,
    type AudioContextState,
    type PlaybackState,
    type AudioPerformanceMetrics,
    type PerformanceAlert,
  } from '@bassnotion/playback';
}

/**
 * Plugin system module
 */
declare module '@bassnotion/playback/plugins' {
  export {
    BaseAudioPlugin,
    PluginManager,
    type AudioPlugin,
    type PluginMetadata,
    type PluginConfig,
    type PluginCapabilities,
    type PluginParameter,
    type PluginEvents,
    type PluginAudioContext,
    type PluginProcessingResult,
    type PluginManagerConfig,
    type PluginManagerEvents,
    type PluginRegistryEntry,
    PluginCategory,
    PluginPriority,
    PluginState,
  } from '@bassnotion/playback';
}

/**
 * Mobile optimization module
 */
declare module '@bassnotion/playback/mobile' {
  export {
    MobileOptimizer,
    BatteryManager,
    BackgroundProcessor,
    IOSOptimizer,
    AndroidOptimizer,
    type DeviceClass,
    type QualityLevel,
    type PowerMode,
    type ThermalState,
    type BatteryStatus,
    type ThermalStatus,
    type AdaptiveQualityConfig,
    type UserOptimizationPreferences,
    type OptimizationDecision,
    type OptimizationReasoning,
    type OptimizationImpact,
    type BatteryUsageMetrics,
    type PowerManagementSettings,
    type BatteryOptimizationSuggestion,
    type BatteryHistoryEntry,
    type CPUUsageMetrics,
    type BackgroundProcessingStrategy,
    type ProcessingJob,
    type BackgroundProcessingStats,
    type SmartSchedulingConfig,
    type IOSAudioSessionCategory,
    type IOSAudioSessionMode,
    type IOSPlaybackState,
    type IOSAudioSessionConfig,
    type IOSBackgroundAudioConfig,
    type SafariOptimizationConfig,
    type PWAOptimizationConfig,
    type IOSAudioInterruption,
    type IOSRouteChangeEvent,
    type IOSOptimizationDecision,
    type AndroidAudioStreamType,
    type AndroidAudioUsage,
    type AndroidAudioContentType,
    type AndroidPlaybackState,
    type AndroidAudioManagerConfig,
    type AndroidPowerManagerConfig,
    type AndroidBackgroundAudioConfig,
    type AndroidChromeOptimizationConfig,
    type AndroidWebViewOptimizationConfig,
    type AndroidAudioInterruption,
    type AndroidAudioRouteChangeEvent,
    type AndroidOptimizationDecision,
  } from '@bassnotion/playback';
}

/**
 * Resource management module
 */
declare module '@bassnotion/playback/resources' {
  export {
    ResourceManager,
    MemoryLeakDetector,
    GarbageCollectionOptimizer,
    AudioResourceDisposer,
    ResourceUsageMonitor,
    type ResourceType,
    type ResourcePriority,
    type ResourceState,
    type CleanupStrategy,
    type ResourceMetadata,
    type ManagedResource,
    type CleanupReport,
    type ResourceUsageReport,
    type MemoryLeakReport,
    type SuspectedLeak,
    type LeakCategory,
    type RemediationType,
    type SafetyLevel,
    type MemoryPressureLevel,
    type GCStrategy,
    type GCTrigger,
    type DisposalStrategy,
    type FadeType,
    type AudioResourceType,
  } from '@bassnotion/playback';
}

/**
 * A/B Testing module
 */
declare module '@bassnotion/playback/testing' {
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
  } from '@bassnotion/playback';
}

/**
 * Worker pool module
 */
declare module '@bassnotion/playback/workers' {
  export {
    WorkerPoolManager,
    type WorkerThreadType,
    type WorkerThreadConfig,
    type AudioWorkerMessage,
    type WorkerMessageType,
    type WorkerPool,
    type WorkerInstance,
    type WorkerJob,
    type WorkerJobQueue,
    type WorkerError,
    type WorkerState,
    type WorkerCapabilities,
    type WorkerMetrics,
    type WorkerPoolMetrics,
    type BackgroundProcessingConfig,
    type AudioProcessingPayload,
    type MidiProcessingPayload,
    type WorkerInitPayload,
    type AudioStreamConfig,
    type SharedAudioBuffer,
    WorkerThreadType as WorkerType,
    JobPriority,
  } from '@bassnotion/playback';
}

/**
 * State persistence module
 */
declare module '@bassnotion/playback/persistence' {
  export {
    StatePersistenceManager,
    type PersistenceConfig,
    type PersistedState,
    type StorageQuota,
    type PersistenceMetrics,
  } from '@bassnotion/playback';
}

/**
 * React integration module
 */
declare module '@bassnotion/playback/react' {
  export {
    useCorePlaybackEngine,
    usePlaybackStore,
    playbackSelectors,
    type PlaybackStore,
  } from '@bassnotion/playback';
}

/**
 * Utilities module
 */
declare module '@bassnotion/playback/utils' {
  export {
    detectDeviceCapabilities,
    getMobileAudioConstraints,
    supportsLowLatencyAudio,
    getRecommendedAudioContextConfig,
    requiresUserGesture,
    getDevicePerformanceTier,
    getBatteryOptimizationRecommendations,
    isFeatureSupported,
    type DeviceCapabilities,
    type MobileAudioConstraints,
    type SupportedFeature,
  } from '@bassnotion/playback';
}

/**
 * Constants module
 */
declare module '@bassnotion/playback/constants' {
  export {
    DEFAULT_AUDIO_CONFIG,
    DEFAULT_MOBILE_CONFIG,
    DEFAULT_BUFFER_SIZES,
    DEFAULT_SAMPLE_RATES,
    PERFORMANCE_THRESHOLDS,
    LATENCY_TARGETS,
    PLUGIN_CATEGORIES,
    PLUGIN_PRIORITIES,
    ERROR_CODES,
    SUPPORTED_AUDIO_FORMATS,
    MIME_TYPE_MAPPINGS,
    TIMING_CONSTANTS,
    DEVICE_LIMITS,
    FEATURE_FLAGS,
    MIN_BROWSER_VERSIONS,
    WEB_AUDIO_FEATURES,
    PLAYBACK_DOMAIN_VERSION,
    SUPPORTED_FEATURES,
  } from '@bassnotion/playback';
}

/**
 * Lazy loading module
 */
declare module '@bassnotion/playback/lazy' {
  export { LazyImports } from '@bassnotion/playback';
}

/**
 * Legacy compatibility module
 */
declare module '@bassnotion/playback/legacy' {
  /**
   * @deprecated Use CoreAudioEngine instead
   */
  export { CorePlaybackEngine } from '@bassnotion/playback';
}

// ============================================================================
// PACKAGE METADATA AND COMPATIBILITY
// ============================================================================

/**
 * Package metadata for external tooling
 */
declare const __PACKAGE_METADATA__: {
  readonly name: '@bassnotion/playback';
  readonly version: '2.1.0';
  readonly description: 'Professional-grade audio playback engine for bass learning applications';
  readonly main: './index.js';
  readonly types: './index.d.ts';
  readonly module: './index.esm.js';
  readonly exports: {
    readonly '.': {
      readonly import: './index.esm.js';
      readonly require: './index.js';
      readonly types: './index.d.ts';
    };
    readonly './types': {
      readonly types: './types.d.ts';
    };
    readonly './errors': {
      readonly import: './errors/index.esm.js';
      readonly require: './errors/index.js';
      readonly types: './errors/index.d.ts';
    };
    readonly './core': {
      readonly import: './core/index.esm.js';
      readonly require: './core/index.js';
      readonly types: './core/index.d.ts';
    };
    readonly './plugins': {
      readonly import: './plugins/index.esm.js';
      readonly require: './plugins/index.js';
      readonly types: './plugins/index.d.ts';
    };
    readonly './mobile': {
      readonly import: './mobile/index.esm.js';
      readonly require: './mobile/index.js';
      readonly types: './mobile/index.d.ts';
    };
    readonly './resources': {
      readonly import: './resources/index.esm.js';
      readonly require: './resources/index.js';
      readonly types: './resources/index.d.ts';
    };
    readonly './testing': {
      readonly import: './testing/index.esm.js';
      readonly require: './testing/index.js';
      readonly types: './testing/index.d.ts';
    };
    readonly './workers': {
      readonly import: './workers/index.esm.js';
      readonly require: './workers/index.js';
      readonly types: './workers/index.d.ts';
    };
    readonly './persistence': {
      readonly import: './persistence/index.esm.js';
      readonly require: './persistence/index.js';
      readonly types: './persistence/index.d.ts';
    };
    readonly './react': {
      readonly import: './react/index.esm.js';
      readonly require: './react/index.js';
      readonly types: './react/index.d.ts';
    };
    readonly './utils': {
      readonly import: './utils/index.esm.js';
      readonly require: './utils/index.js';
      readonly types: './utils/index.d.ts';
    };
    readonly './constants': {
      readonly import: './constants/index.esm.js';
      readonly require: './constants/index.js';
      readonly types: './constants/index.d.ts';
    };
    readonly './lazy': {
      readonly import: './lazy/index.esm.js';
      readonly require: './lazy/index.js';
      readonly types: './lazy/index.d.ts';
    };
    readonly './legacy': {
      readonly import: './legacy/index.esm.js';
      readonly require: './legacy/index.js';
      readonly types: './legacy/index.d.ts';
    };
  };
  readonly engines: {
    readonly node: '>=16.0.0';
    readonly npm: '>=8.0.0';
    readonly pnpm: '>=7.0.0';
  };
  readonly browserslist: readonly [
    'Chrome >= 66',
    'Firefox >= 60',
    'Safari >= 14.1',
    'Edge >= 79',
    'iOS >= 14.5',
    'Android >= 90',
  ];
  readonly peerDependencies: {
    readonly tone: '^15.0.4';
    readonly react: '>=18.0.0';
    readonly zustand: '^5.0.0';
  };
  readonly optionalDependencies: {
    readonly '@types/web-audio-api': '^0.0.29';
    readonly 'workbox-core': '^7.0.0';
    readonly comlink: '^4.4.1';
  };
  readonly keywords: readonly [
    'audio',
    'playback',
    'web-audio',
    'tone.js',
    'bass',
    'music',
    'education',
    'low-latency',
    'mobile',
    'performance',
    'typescript',
  ];
  readonly license: 'MIT';
  readonly repository: {
    readonly type: 'git';
    readonly url: 'https://github.com/bassnotion/bassnotion-monorepo';
    readonly directory: 'apps/frontend/src/domains/playback';
  };
  readonly bugs: {
    readonly url: 'https://github.com/bassnotion/bassnotion-monorepo/issues';
  };
  readonly homepage: 'https://bassnotion.com';
  readonly author: {
    readonly name: 'BassNotion Team';
    readonly email: 'dev@bassnotion.com';
    readonly url: 'https://bassnotion.com';
  };
  readonly contributors: readonly string[];
  readonly funding: {
    readonly type: 'github';
    readonly url: 'https://github.com/sponsors/bassnotion';
  };
};

/**
 * Compatibility matrix for external consumption
 */
declare const __COMPATIBILITY_MATRIX__: {
  readonly browsers: {
    readonly chrome: { readonly min: 66; readonly features: readonly string[] };
    readonly firefox: {
      readonly min: 60;
      readonly features: readonly string[];
    };
    readonly safari: {
      readonly min: 14.1;
      readonly features: readonly string[];
    };
    readonly edge: { readonly min: 79; readonly features: readonly string[] };
  };
  readonly mobile: {
    readonly ios: {
      readonly min: 14.5;
      readonly limitations: readonly string[];
    };
    readonly android: {
      readonly min: 90;
      readonly limitations: readonly string[];
    };
  };
  readonly frameworks: {
    readonly react: { readonly min: 18; readonly tested: readonly string[] };
    readonly vue: { readonly min: 3; readonly status: 'experimental' };
    readonly angular: { readonly min: 15; readonly status: 'planned' };
    readonly svelte: { readonly min: 4; readonly status: 'planned' };
  };
  readonly bundlers: {
    readonly webpack: {
      readonly min: 5;
      readonly optimizations: readonly string[];
    };
    readonly vite: {
      readonly min: 3;
      readonly optimizations: readonly string[];
    };
    readonly rollup: {
      readonly min: 3;
      readonly optimizations: readonly string[];
    };
    readonly esbuild: {
      readonly min: 0.17;
      readonly optimizations: readonly string[];
    };
  };
};

/**
 * Feature detection matrix
 */
declare const __FEATURE_MATRIX__: {
  readonly core: {
    readonly 'web-audio-api': {
      readonly required: true;
      readonly fallback: null;
    };
    readonly 'tone-js-integration': {
      readonly required: true;
      readonly fallback: null;
    };
    readonly 'audio-worklet': {
      readonly required: false;
      readonly fallback: 'ScriptProcessorNode';
    };
    readonly 'shared-array-buffer': {
      readonly required: false;
      readonly fallback: 'ArrayBuffer';
    };
  };
  readonly performance: {
    readonly 'low-latency': {
      readonly required: false;
      readonly graceful: true;
    };
    readonly 'background-audio': {
      readonly required: false;
      readonly graceful: true;
    };
    readonly 'battery-api': {
      readonly required: false;
      readonly graceful: true;
    };
    readonly 'performance-observer': {
      readonly required: false;
      readonly graceful: true;
    };
  };
  readonly mobile: {
    readonly 'ios-audio-session': {
      readonly required: false;
      readonly platform: 'ios';
    };
    readonly 'android-audio-manager': {
      readonly required: false;
      readonly platform: 'android';
    };
    readonly 'wake-lock': { readonly required: false; readonly graceful: true };
    readonly 'device-orientation': {
      readonly required: false;
      readonly graceful: true;
    };
  };
  readonly experimental: {
    readonly 'audio-decoder': {
      readonly required: false;
      readonly status: 'experimental';
    };
    readonly 'web-codecs': {
      readonly required: false;
      readonly status: 'experimental';
    };
    readonly 'web-transport': {
      readonly required: false;
      readonly status: 'planned';
    };
  };
};

export {};
