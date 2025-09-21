/**
 * Performance Optimization Module
 *
 * Comprehensive performance optimization system including device detection,
 * adaptive quality scaling, mobile optimizations, and production validation.
 */

export { PerformanceOptimizer } from './PerformanceOptimizer';
export { InstrumentAssetOptimizer } from './InstrumentAssetOptimizer';
export { DeviceCapabilityDetector } from './DeviceCapabilityDetector';
export { AdaptiveQualityScaler } from './AdaptiveQualityScaler';
export { QualityMonitor } from './QualityMonitor';
export { MobileOptimizer } from './MobileOptimizer';
export { BenchmarkSuite } from './BenchmarkSuite';
export { ValidationEngine } from './ValidationEngine';

export type {
  DeviceCapabilities,
  NetworkCapabilities,
  QualitySettings,
  InstrumentOptimizationConfig,
  BassOptimizationStrategy,
  DrumOptimizationStrategy,
  ChordOptimizationStrategy,
  MetronomeOptimizationStrategy,
  PerformanceMetrics,
  OptimizationMetrics,
  AssetCacheEntry,
  OptimizationResult,
  BenchmarkResult,
  ValidationResult,
  MobileOptimizationResult,
  IInstrumentAssetOptimizer,
  IPerformanceOptimizer,
  IAdaptiveQualityScaler,
  IMobileOptimizer,
  IQualityMonitor,
} from './types';
