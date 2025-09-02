/**
 * Lifecycle Management Module
 * 
 * Enterprise-grade resource lifecycle management for audio instruments
 * with automatic optimization, thermal monitoring, and graceful degradation.
 */

export { 
  InstrumentLifecycleManager,
  createInstrumentLifecycleManager 
} from './InstrumentLifecycleManager.js';

export type {
  InstrumentType,
  InstrumentState,
  DegradationLevel,
  CleanupPriority,
  ThermalState,
  InstrumentInstance,
  MemoryUsage,
  PerformanceMetrics,
  ResourcePool,
  ResourceHealth,
  DegradedResource,
  RecyclableResource,
  PoolHealth,
  MemoryOptimizationConfig,
  DegradationThresholds,
  MemoryOptimizationResult,
  CleanupResult,
  ThermalMonitoringResult,
  BatteryOptimizationResult,
  GracefulDegradationStrategy,
  DegradationAction,
  ResourceUsageStats,
} from './InstrumentLifecycleManager.js';