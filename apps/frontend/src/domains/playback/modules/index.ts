/**
 * Playback Modules - Modular architecture for audio playback
 *
 * This is the main entry point for all playback modules.
 * Each module is responsible for a specific domain within
 * the playback architecture.
 */

// Audio Engine Module - Core audio processing
export * from './audio-engine/index.js';

// Transport Module - Timeline and synchronization
export * from './transport/index.js';

// Instruments Module - Instrument plugins and samplers
export * from './instruments/index.js';

// Tracks Module - Multi-track recording and mixing
export * from './tracks/index.js';

// Storage Module - Sample storage and caching
export * from './storage/index.js';

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
