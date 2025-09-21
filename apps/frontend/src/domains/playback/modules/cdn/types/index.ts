/**
 * CDN Module Types
 *
 * Re-export CDN-related types from contracts and define
 * module-specific types
 */

// Re-export types from contracts if they exist there
export type {
  CDNOptimizationConfig,
  EdgeLocation,
  ContentOptimizationConfig,
  AdaptiveStreamingConfig,
  CDNPerformanceMetrics,
  CDNHealthStatus,
  CDNOptimizationRecommendation,
  NetworkCondition,
  QualityLevel,
} from '@bassnotion/contracts';

// Module-specific types can be added here as needed
