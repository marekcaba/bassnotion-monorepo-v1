/**
 * Instrument Lifecycle Manager - Re-export from modules
 *
 * @deprecated Use import from '@/domains/playback/modules/lifecycle' instead
 */

export {
  InstrumentLifecycleManager,
  createInstrumentLifecycleManager,
} from '../../modules/lifecycle/InstrumentLifecycleManager.js';
export type {
  InstrumentType,
  InstrumentState,
  DegradationLevel,
  CleanupPriority,
  ThermalState,
  MemoryOptimizationConfig,
  DegradationThresholds,
  InstrumentInstance,
  MemoryUsage,
  PerformanceMetrics,
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
} from '../../modules/lifecycle/InstrumentLifecycleManager.js';
