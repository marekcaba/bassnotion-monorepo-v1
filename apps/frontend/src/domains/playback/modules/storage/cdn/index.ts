/**
 * CDN Module
 *
 * Provides CDN optimization functionality including:
 * - Intelligent edge routing
 * - Geographic distribution
 * - Performance analytics
 * - Content optimization
 */

export { CDNOptimizer } from './CDNOptimizer.js';
export { GeographicDistributionManager } from './GeographicDistributionManager.js';
export { CDNAnalyticsManager } from './CDNAnalyticsManager.js';

export type {
  // Configuration types
  CDNOptimizationConfig,
  EdgeConfiguration,
  EdgeLocation,
  RoutingStrategy,
  PerformanceMonitoringConfig,
  ContentOptimizationConfig,
  AdaptiveStreamingConfig,
  AnalyticsConfig,

  // Metrics and monitoring types
  CDNPerformanceMetrics,
  EdgePerformanceMetric,
  GeographicDistribution,
  CDNHealthStatus,
  ComponentHealth,
  EdgeHealth,
  HealthIssue,

  // Recommendation types
  CDNOptimizationRecommendation,

  // Network and quality types
  NetworkCondition,
  QualityLevel,
  BitrateSettings,
} from './types.js';
