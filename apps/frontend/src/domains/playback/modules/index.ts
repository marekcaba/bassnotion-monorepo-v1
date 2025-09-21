/**
 * Playback Modules - Modular architecture for audio playback
 *
 * This is the main entry point for all playback modules.
 * Each module is responsible for a specific domain within
 * the playback architecture.
 */

// Shared Module - Cross-cutting concerns (EventBus, CircuitBreaker, etc.)
// Export everything except MusicalPosition (conflicts with transport)
export {
  EventBus,
  CircuitBreaker,
  createStructuredLogger,
  useCorrelation,
  ServiceRegistry,
} from './shared/index.js';
export type { Service } from './shared/index.js';

export type {
  EventHandler,
  EventData,
  EventMetadata,
  EventBusConfig,
  EventSchema,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  InstrumentType,
  ServiceConfig,
} from './shared/index.js';

// Audio Engine Module - Core audio processing
// Export everything except SamplerConfig (conflicts with instruments)
export {
  AudioEngine,
  AudioNodeManager,
  AudioContextManager,
  ToneWrapper,
  EffectsChain,
  MixerNode,
  VolumeControl,
  type AudioEngineConfig,
  type AudioContextState,
  type AudioMetrics,
  type AudioSampler,
  type AudioNodeWrapper,
  type EffectsConfig,
  type BrowserInfo,
  type ToneModule,
  type ChannelStrip,
  type AuxBus,
  type VolumeScaling,
  type VolumeAutomationPoint,
  type EffectNode,
} from './audio-engine/index.js';

// Transport Module - Timeline and synchronization
// Export everything including MusicalPosition
export * from './transport/index.js';

// Instruments Module - Instrument plugins and samplers
// Export everything including SamplerConfig
export * from './instruments/index.js';

// Tracks Module - Multi-track recording and mixing
export * from './tracks/index.js';

// Storage Module - Sample storage and caching
export * from './storage/index.js';

// Exercises Module - Exercise loading and MIDI processing
export * from './exercises/index.js';

// Explicitly export SyncEventType from transport to resolve ambiguity
export type { SyncEventType } from './transport/index.js';

// Lifecycle Module - Resource lifecycle management
// Note: Using named exports to avoid conflicts with InstrumentState and PerformanceMetrics
export {
  InstrumentLifecycleManager,
  createInstrumentLifecycleManager,
} from './lifecycle/index.js';
export type {
  // Lifecycle-specific types (avoiding conflicts)
  DegradationLevel,
  CleanupPriority,
  ThermalState,
  MemoryOptimizationConfig,
  DegradationThresholds,
  ResourcePool,
  ResourceHealth,
  DegradedResource,
  RecyclableResource,
  PoolHealth,
  MemoryOptimizationResult,
  CleanupResult,
  ThermalMonitoringResult,
  BatteryOptimizationResult,
  GracefulDegradationStrategy,
  DegradationAction,
  ResourceUsageStats,
} from './lifecycle/index.js';

// Musical expression and articulation
export * from './expression/index.js';

// Musical intelligence and prediction
export * from './intelligence/index.js';

// Performance optimization
export { InstrumentAssetOptimizer } from './optimization/InstrumentAssetOptimizer.js';
export * from './optimization/performance/index.js';

// Asset processing pipelines
export * from './pipelines/index.js';

// Error handling system
export * from './errors/index.js';
export { ErrorRecoveryRegistry } from './errors/ErrorRecoveryRegistry.js';
export { ErrorReportingService } from './errors/ErrorReportingService.js';
export {
  CircuitBreakerIntegration,
  CriticalPath,
} from './errors/CircuitBreakerIntegration.js';
export { useErrorReporting } from './errors/hooks/useErrorReporting.js';
export type {
  ErrorReport,
  ErrorReportingConfig,
  PrioritizedRecoveryStrategy,
  RecoveryRegistryConfig,
  ErrorHandlingOptions,
  UseErrorReportingReturn,
} from './errors/index.js';
