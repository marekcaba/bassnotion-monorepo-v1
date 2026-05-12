/**
 * Global CDN Optimization System Types
 * Story 2.4 Task 2: Global CDN Optimization System Interfaces
 *
 * @module storage/cdn-optimization
 */

import type { AlertCondition, AuthConfig } from './health-monitoring.types.js';

// ============================================================================
// CDN Provider and Edge Configuration
// ============================================================================

/**
 * CDN Optimization Configuration
 */
export interface CDNOptimizationConfig {
  enabled: boolean;
  provider: CDNProvider;
  edgeConfiguration: CDNEdgeConfig;
  contentOptimization: ContentOptimizationConfig;
  performanceMonitoring: CDNPerformanceMonitoringConfig;
  geographicDistribution: GeographicDistributionConfig;
  adaptiveStreaming: AdaptiveStreamingConfig;
  analytics: CDNAnalyticsConfig;
  fallbackStrategy: CDNFallbackStrategy;
}

/**
 * CDN Provider Configuration
 */
export interface CDNProvider {
  name: 'cloudflare' | 'amazon' | 'google' | 'azure' | 'custom';
  primaryEndpoint: string;
  backupEndpoints: string[];
  apiKey?: string;
  apiSecret?: string;
  zoneId?: string;
  customConfig?: Record<string, unknown>;
}

/**
 * CDN Edge Configuration
 */
export interface CDNEdgeConfig {
  enabled: boolean;
  edgeLocations: EdgeLocation[];
  routingStrategy: EdgeRoutingStrategy;
  loadBalancing: LoadBalancingConfig;
  healthChecking: EdgeHealthCheckConfig;
  failoverConfig: EdgeFailoverConfig;
  cachingStrategy: EdgeCachingStrategy;
}

/**
 * Edge Location Information
 */
export interface EdgeLocation {
  locationId: string;
  name: string;
  region: string;
  country: string;
  city: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  endpoint: string;
  capacity: number; // requests per second
  currentLoad: number; // 0-1
  latency: number; // ms
  availability: number; // 0-1
  features: EdgeFeature[];
  status: 'active' | 'maintenance' | 'offline';
  lastHealthCheck: number;
}

/**
 * Edge Features
 */
export type EdgeFeature =
  | 'compression'
  | 'image_optimization'
  | 'video_optimization'
  | 'audio_optimization'
  | 'format_conversion'
  | 'caching'
  | 'ssl_termination'
  | 'ddos_protection'
  | 'rate_limiting';

// ============================================================================
// Geographic Distribution
// ============================================================================

/**
 * Geographic Distribution Configuration
 */
export interface GeographicDistributionConfig {
  enabled: boolean;
  regions: string[];
  edgeSelection: EdgeSelectionStrategy;
  loadBalancing: GeographicLoadBalancingConfig;
  failoverStrategy: GeographicFailoverStrategy;
  latencyOptimization: boolean;
  geolocationEnabled: boolean;
}

/**
 * Edge Selection Strategy
 */
export interface EdgeSelectionStrategy {
  algorithm: 'nearest' | 'performance_based' | 'load_based' | 'hybrid';
  fallbackOrder: string[];
  selectionCriteria: EdgeSelectionCriteria;
}

/**
 * Edge Selection Criteria
 */
export interface EdgeSelectionCriteria {
  latencyWeight: number; // 0-1
  loadWeight: number; // 0-1
  availabilityWeight: number; // 0-1
  costWeight: number; // 0-1
}

/**
 * Geographic Load Balancing Configuration
 */
export interface GeographicLoadBalancingConfig {
  enabled: boolean;
  strategy: 'regional' | 'global' | 'hybrid';
  regionWeights: Record<string, number>;
  crossRegionFailover: boolean;
}

/**
 * Geographic Failover Strategy
 */
export interface GeographicFailoverStrategy {
  enabled: boolean;
  failoverOrder: string[]; // region order
  automaticFailover: boolean;
  failoverThreshold: number; // error rate percentage
  recoveryThreshold: number; // success rate percentage
}

// ============================================================================
// Edge Routing and Load Balancing
// ============================================================================

/**
 * Edge Routing Strategy
 */
export interface EdgeRoutingStrategy {
  algorithm:
    | 'latency_based'
    | 'geographic'
    | 'load_based'
    | 'hybrid'
    | 'custom';
  weights: RoutingWeights;
  fallbackOrder: string[]; // edge location IDs
  stickySession: boolean;
  sessionAffinityDuration: number; // ms
  customRoutingRules: RoutingRule[];
}

/**
 * Routing Weights
 */
export interface RoutingWeights {
  latency: number; // 0-1
  load: number; // 0-1
  geographic: number; // 0-1
  availability: number; // 0-1
  cost: number; // 0-1
  custom: Record<string, number>;
}

/**
 * Routing Rule
 */
export interface RoutingRule {
  ruleId: string;
  condition: string; // expression to evaluate
  targetEdge: string; // edge location ID
  priority: number;
  enabled: boolean;
}

/**
 * Load Balancing Configuration
 */
export interface LoadBalancingConfig {
  algorithm:
    | 'round_robin'
    | 'weighted'
    | 'least_connections'
    | 'ip_hash'
    | 'adaptive';
  healthCheckEnabled: boolean;
  healthCheckInterval: number; // ms
  maxConnections: number;
  connectionTimeout: number; // ms
  retryPolicy: LoadBalancingRetryPolicy;
}

/**
 * Load Balancing Retry Policy
 */
export interface LoadBalancingRetryPolicy {
  maxRetries: number;
  retryInterval: number; // ms
  backoffStrategy: 'linear' | 'exponential';
  retryOnStatusCodes: number[];
}

// ============================================================================
// Health Checking and Failover
// ============================================================================

/**
 * Edge Health Check Configuration
 */
export interface EdgeHealthCheckConfig {
  enabled: boolean;
  interval: number; // ms
  timeout: number; // ms
  healthyThreshold: number;
  unhealthyThreshold: number;
  checkPath: string;
  expectedStatus: number;
  customChecks: CustomEdgeHealthCheck[];
}

/**
 * Custom Edge Health Check
 */
export interface CustomEdgeHealthCheck {
  checkId: string;
  name: string;
  checkFunction: string; // function name or endpoint
  weight: number;
  timeout: number;
  parameters: Record<string, unknown>;
}

/**
 * Edge Failover Configuration
 */
export interface EdgeFailoverConfig {
  enabled: boolean;
  failoverThreshold: number; // error rate percentage
  failoverDelay: number; // ms
  recoveryThreshold: number; // success rate percentage
  recoveryDelay: number; // ms
  automaticFailback: boolean;
  notificationEnabled: boolean;
}

// ============================================================================
// Caching Strategy
// ============================================================================

/**
 * Edge Caching Strategy
 */
export interface EdgeCachingStrategy {
  enabled: boolean;
  defaultTtl: number; // seconds
  maxTtl: number; // seconds
  cacheRules: CacheRule[];
  compressionEnabled: boolean;
  compressionLevel: 'low' | 'medium' | 'high' | 'adaptive';
  purgeStrategy: CachePurgeStrategy;
}

/**
 * Cache Rule
 */
export interface CacheRule {
  ruleId: string;
  pattern: string; // URL pattern or regex
  ttl: number; // seconds
  cacheKey: string; // custom cache key pattern
  varyHeaders: string[];
  enabled: boolean;
  priority: number;
}

/**
 * Cache Purge Strategy
 */
export interface CachePurgeStrategy {
  enabled: boolean;
  purgeOnUpdate: boolean;
  purgePatterns: string[];
  batchPurging: boolean;
  purgeDelay: number; // ms
}

// ============================================================================
// Content Optimization
// ============================================================================

/**
 * Content Optimization Configuration
 */
export interface ContentOptimizationConfig {
  enabled: boolean;
  imageOptimization: ImageOptimizationConfig;
  audioOptimization: AudioOptimizationConfig;
  compressionConfig: CDNCompressionConfig;
  formatConversion: FormatConversionConfig;
  bandwidthAdaptation: BandwidthAdaptationConfig;
  qualityAdaptation: QualityAdaptationConfig;
}

/**
 * Image Optimization Configuration
 */
export interface ImageOptimizationConfig {
  enabled: boolean;
  formats: ('webp' | 'avif' | 'jpeg' | 'png')[];
  qualityLevels: QualityLevel[];
  resizing: boolean;
  compression: boolean;
  lazyLoading: boolean;
}

/**
 * Audio Optimization Configuration
 */
export interface AudioOptimizationConfig {
  enabled: boolean;
  formats: ('mp3' | 'aac' | 'ogg' | 'webm')[];
  qualityLevels: AudioQualityLevel[];
  compression: boolean;
  normalization: boolean;
  dynamicRange: boolean;
}

/**
 * Quality Level
 */
export interface QualityLevel {
  name: string;
  quality: number; // 0-100
  maxSize: number; // bytes
  targetBitrate?: number; // for audio/video
}

/**
 * Audio Quality Level
 */
export interface AudioQualityLevel {
  name: string;
  bitrate: number; // kbps
  sampleRate: number; // Hz
  channels: number;
  format: string;
}

/**
 * CDN Compression Configuration
 */
export interface CDNCompressionConfig {
  enabled: boolean;
  algorithms: ('gzip' | 'brotli' | 'deflate')[];
  level: number; // 1-9
  minSize: number; // bytes - minimum file size to compress
  contentTypes: string[]; // MIME types to compress
  adaptiveCompression: boolean;
}

/**
 * Format Conversion Configuration
 */
export interface FormatConversionConfig {
  enabled: boolean;
  imageConversion: ImageConversionRule[];
  audioConversion: AudioConversionRule[];
  automaticConversion: boolean;
  fallbackFormats: Record<string, string>;
}

/**
 * Image Conversion Rule
 */
export interface ImageConversionRule {
  ruleId: string;
  sourceFormat: string;
  targetFormat: string;
  condition: string; // when to apply conversion
  quality: number;
  enabled: boolean;
}

/**
 * Audio Conversion Rule
 */
export interface AudioConversionRule {
  ruleId: string;
  sourceFormat: string;
  targetFormat: string;
  condition: string; // when to apply conversion
  bitrate: number;
  sampleRate: number;
  enabled: boolean;
}

// ============================================================================
// Bandwidth and Quality Adaptation
// ============================================================================

/**
 * Bandwidth Adaptation Configuration
 */
export interface BandwidthAdaptationConfig {
  enabled: boolean;
  networkDetection: NetworkDetectionConfig;
  adaptationRules: BandwidthAdaptationRule[];
  fallbackStrategy: 'lower_quality' | 'progressive_loading' | 'compression';
  bufferManagement: BufferManagementConfig;
}

/**
 * Network Detection Configuration
 */
export interface NetworkDetectionConfig {
  enabled: boolean;
  detectionInterval: number; // ms
  speedTestEnabled: boolean;
  speedTestUrl?: string;
  connectionTypeDetection: boolean;
  latencyMeasurement: boolean;
}

/**
 * Bandwidth Adaptation Rule
 */
export interface BandwidthAdaptationRule {
  ruleId: string;
  networkCondition: CDNNetworkCondition;
  qualityLevel: string;
  compressionLevel: string;
  enabled: boolean;
  priority: number;
}

/**
 * CDN Network Condition
 */
export interface CDNNetworkCondition {
  minBandwidth?: number; // bytes/sec
  maxBandwidth?: number; // bytes/sec
  maxLatency?: number; // ms
  connectionType?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  connectionQuality?: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Buffer Management Configuration
 */
export interface BufferManagementConfig {
  enabled: boolean;
  bufferSize: number; // bytes
  preloadSize: number; // bytes
  adaptiveBuffering: boolean;
  bufferHealthThreshold: number; // 0-1
}

/**
 * Quality Adaptation Configuration
 */
export interface QualityAdaptationConfig {
  enabled: boolean;
  adaptationStrategy:
    | 'bandwidth_based'
    | 'device_based'
    | 'user_preference'
    | 'hybrid';
  deviceDetection: DeviceDetectionConfig;
  userPreferences: UserPreferenceConfig;
  adaptationRules: QualityAdaptationRule[];
}

/**
 * Device Detection Configuration
 */
export interface DeviceDetectionConfig {
  enabled: boolean;
  screenResolutionDetection: boolean;
  deviceTypeDetection: boolean;
  performanceDetection: boolean;
  batteryLevelDetection: boolean;
}

/**
 * User Preference Configuration
 */
export interface UserPreferenceConfig {
  enabled: boolean;
  allowUserOverride: boolean;
  persistPreferences: boolean;
  preferenceCategories: ('quality' | 'speed' | 'data_saving')[];
}

/**
 * Quality Adaptation Rule
 */
export interface QualityAdaptationRule {
  ruleId: string;
  condition: AdaptationCondition;
  targetQuality: string;
  enabled: boolean;
  priority: number;
}

/**
 * Adaptation Condition
 */
export interface AdaptationCondition {
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  screenResolution?: { width: number; height: number };
  networkCondition?: CDNNetworkCondition;
  batteryLevel?: number; // 0-100
  userPreference?: string;
  customCondition?: string;
}

// ============================================================================
// Adaptive Streaming
// ============================================================================

/**
 * Adaptive Streaming Configuration
 */
export interface AdaptiveStreamingConfig {
  enabled: boolean;
  streamingProtocol: 'hls' | 'dash' | 'progressive' | 'adaptive';
  qualityLevels: StreamingQualityLevel[];
  bitrateAdaptation: BitrateAdaptationConfig;
  bufferConfig: StreamingBufferConfig;
  fallbackConfig: StreamingFallbackConfig;
}

/**
 * Streaming Quality Level
 */
export interface StreamingQualityLevel {
  levelId: string;
  name: string;
  bitrate: number; // kbps
  resolution?: { width: number; height: number };
  framerate?: number;
  codec: string;
  enabled: boolean;
}

/**
 * Bitrate Adaptation Configuration
 */
export interface BitrateAdaptationConfig {
  enabled: boolean;
  adaptationAlgorithm: 'throughput_based' | 'buffer_based' | 'hybrid';
  switchingThreshold: number; // percentage
  stabilityPeriod: number; // ms
  maxSwitchesPerMinute: number;
}

/**
 * Streaming Buffer Configuration
 */
export interface StreamingBufferConfig {
  initialBuffer: number; // seconds
  maxBuffer: number; // seconds
  rebufferThreshold: number; // seconds
  seekBuffer: number; // seconds
}

/**
 * Streaming Fallback Configuration
 */
export interface StreamingFallbackConfig {
  enabled: boolean;
  fallbackProtocol: string;
  fallbackQuality: string;
  maxFallbackAttempts: number;
  fallbackDelay: number; // ms
}

// ============================================================================
// CDN Performance Monitoring
// ============================================================================

/**
 * CDN Performance Monitoring Configuration
 */
export interface CDNPerformanceMonitoringConfig {
  enabled: boolean;
  metricsCollection: CDNMetricsCollectionConfig;
  performanceThresholds: CDNPerformanceThresholds;
  alerting: CDNAlertingConfig;
  reporting: CDNReportingConfig;
  realTimeMonitoring: CDNRealTimeMonitoringConfig;
}

/**
 * CDN Metrics Collection Configuration
 */
export interface CDNMetricsCollectionConfig {
  enabled: boolean;
  collectionInterval: number; // ms
  metricsToCollect: CDNMetricType[];
  aggregationLevels: ('minute' | 'hour' | 'day')[];
  retentionPeriod: number; // days
  customMetrics: CustomCDNMetric[];
}

/**
 * CDN Metric Types
 */
export type CDNMetricType =
  | 'response_time'
  | 'throughput'
  | 'cache_hit_rate'
  | 'bandwidth_usage'
  | 'error_rate'
  | 'availability'
  | 'edge_performance'
  | 'geographic_performance'
  | 'content_optimization_savings'
  | 'user_experience_score';

/**
 * Custom CDN Metric
 */
export interface CustomCDNMetric {
  metricId: string;
  name: string;
  description: string;
  unit: string;
  collectionMethod: string;
  aggregationType: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

/**
 * CDN Performance Thresholds
 */
export interface CDNPerformanceThresholds {
  responseTime: {
    warning: number; // ms
    critical: number; // ms
  };
  cacheHitRate: {
    warning: number; // percentage
    critical: number; // percentage
  };
  errorRate: {
    warning: number; // percentage
    critical: number; // percentage
  };
  availability: {
    warning: number; // percentage
    critical: number; // percentage
  };
  customThresholds: Record<string, { warning: number; critical: number }>;
}

// ============================================================================
// CDN Alerting and Reporting
// ============================================================================

/**
 * CDN Alerting Configuration
 */
export interface CDNAlertingConfig {
  enabled: boolean;
  alertRules: CDNAlertRule[];
  notificationChannels: string[]; // channel IDs
  escalationEnabled: boolean;
  suppressionRules: CDNAlertSuppressionRule[];
}

/**
 * CDN Alert Rule
 */
export interface CDNAlertRule {
  ruleId: string;
  name: string;
  metricType: CDNMetricType;
  condition: AlertCondition;
  severity: 'warning' | 'critical';
  enabled: boolean;
  edgeLocationFilter?: string[];
  regionFilter?: string[];
}

/**
 * CDN Alert Suppression Rule
 */
export interface CDNAlertSuppressionRule {
  ruleId: string;
  condition: string;
  suppressionDuration: number; // ms
  reason: string;
  enabled: boolean;
}

/**
 * CDN Reporting Configuration
 */
export interface CDNReportingConfig {
  enabled: boolean;
  reportTypes: CDNReportType[];
  reportSchedule: ReportSchedule;
  recipients: string[];
  customReports: CustomCDNReport[];
}

/**
 * CDN Report Types
 */
export type CDNReportType =
  | 'performance_summary'
  | 'cache_efficiency'
  | 'geographic_analysis'
  | 'cost_analysis'
  | 'optimization_recommendations'
  | 'sla_compliance';

/**
 * Report Schedule
 */
export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM
  timezone: string;
  enabled: boolean;
}

/**
 * Custom CDN Report
 */
export interface CustomCDNReport {
  reportId: string;
  name: string;
  description: string;
  metrics: string[];
  filters: Record<string, unknown>;
  schedule: ReportSchedule;
}

/**
 * CDN Real-time Monitoring Configuration
 */
export interface CDNRealTimeMonitoringConfig {
  enabled: boolean;
  updateInterval: number; // ms
  dashboardEnabled: boolean;
  alertingEnabled: boolean;
  metricsStreaming: boolean;
  geographicVisualization: boolean;
}

// ============================================================================
// CDN Analytics
// ============================================================================

/**
 * CDN Analytics Configuration
 */
export interface CDNAnalyticsConfig {
  enabled: boolean;
  dataCollection: CDNDataCollectionConfig;
  analysis: CDNAnalysisConfig;
  optimization: CDNOptimizationAnalysisConfig;
  reporting: CDNAnalyticsReportingConfig;
  integration: CDNAnalyticsIntegrationConfig;
}

/**
 * CDN Data Collection Configuration
 */
export interface CDNDataCollectionConfig {
  enabled: boolean;
  userBehaviorTracking: boolean;
  performanceTracking: boolean;
  errorTracking: boolean;
  geographicTracking: boolean;
  deviceTracking: boolean;
  networkTracking: boolean;
  contentTracking: boolean;
  samplingRate: number; // 0-1
}

/**
 * CDN Analysis Configuration
 */
export interface CDNAnalysisConfig {
  enabled: boolean;
  trendAnalysis: boolean;
  anomalyDetection: boolean;
  performancePrediction: boolean;
  userSegmentation: boolean;
  geographicAnalysis: boolean;
  contentAnalysis: boolean;
  optimizationAnalysis: boolean;
}

/**
 * CDN Optimization Analysis Configuration
 */
export interface CDNOptimizationAnalysisConfig {
  enabled: boolean;
  cacheOptimization: boolean;
  routingOptimization: boolean;
  contentOptimization: boolean;
  performanceOptimization: boolean;
  costOptimization: boolean;
  automaticOptimization: boolean;
  optimizationRecommendations: boolean;
}

/**
 * CDN Analytics Reporting Configuration
 */
export interface CDNAnalyticsReportingConfig {
  enabled: boolean;
  dashboardEnabled: boolean;
  scheduledReports: boolean;
  realTimeReports: boolean;
  customReports: boolean;
  dataExport: boolean;
  apiAccess: boolean;
}

/**
 * CDN Analytics Integration Configuration
 */
export interface CDNAnalyticsIntegrationConfig {
  enabled: boolean;
  googleAnalytics?: GoogleAnalyticsIntegration;
  datadog?: DatadogIntegration;
  newRelic?: NewRelicIntegration;
  customIntegrations?: CustomAnalyticsIntegration[];
}

/**
 * Google Analytics Integration
 */
export interface GoogleAnalyticsIntegration {
  enabled: boolean;
  trackingId: string;
  customDimensions: Record<string, string>;
  eventTracking: boolean;
}

/**
 * Datadog Integration
 */
export interface DatadogIntegration {
  enabled: boolean;
  apiKey: string;
  tags: string[];
  customMetrics: boolean;
}

/**
 * New Relic Integration
 */
export interface NewRelicIntegration {
  enabled: boolean;
  licenseKey: string;
  appName: string;
  customAttributes: Record<string, string>;
}

/**
 * Custom Analytics Integration
 */
export interface CustomAnalyticsIntegration {
  integrationId: string;
  name: string;
  endpoint: string;
  authentication: AuthConfig;
  dataMapping: Record<string, string>;
  enabled: boolean;
}

// ============================================================================
// CDN Fallback Strategy
// ============================================================================

/**
 * CDN Fallback Strategy
 */
export interface CDNFallbackStrategy {
  enabled: boolean;
  fallbackOrder: CDNFallbackOption[];
  automaticFailover: boolean;
  failoverThreshold: number; // error rate percentage
  recoveryThreshold: number; // success rate percentage
  healthCheckInterval: number; // ms
  notificationEnabled: boolean;
}

/**
 * CDN Fallback Option
 */
export interface CDNFallbackOption {
  optionId: string;
  type: 'origin_server' | 'backup_cdn' | 'cache' | 'local_storage';
  priority: number;
  configuration: Record<string, unknown>;
  healthCheck?: () => Promise<boolean>;
  enabled: boolean;
}

// ============================================================================
// CDN Performance Metrics
// ============================================================================

/**
 * CDN Performance Metrics
 */
export interface CDNPerformanceMetrics {
  timestamp: number;

  // Response metrics
  averageResponseTime: number; // ms
  p50ResponseTime: number; // ms
  p95ResponseTime: number; // ms
  p99ResponseTime: number; // ms

  // Throughput metrics
  requestsPerSecond: number;
  bytesPerSecond: number;
  totalRequests: number;
  totalBytes: number;

  // Cache metrics
  cacheHitRate: number; // percentage
  cacheMissRate: number; // percentage
  cacheSize: number; // bytes
  cacheEvictions: number;

  // Error metrics
  errorRate: number; // percentage
  timeoutRate: number; // percentage
  errorsByType: Record<string, number>;

  // Geographic metrics
  edgePerformance: EdgePerformanceMetric[];
  geographicDistribution: GeographicMetric[];

  // Optimization metrics
  compressionSavings: number; // bytes
  formatConversionSavings: number; // bytes
  optimizationRatio: number; // 0-1

  // User experience metrics
  userExperienceScore: number; // 0-100
  loadTimePercentiles: Record<string, number>;

  // Custom metrics
  customMetrics: Record<string, number>;
}

/**
 * Edge Performance Metric
 */
export interface EdgePerformanceMetric {
  edgeLocationId: string;
  responseTime: number; // ms
  throughput: number; // requests/sec
  errorRate: number; // percentage
  cacheHitRate: number; // percentage
  load: number; // 0-1
  availability: number; // 0-1
}

/**
 * Geographic Metric
 */
export interface GeographicMetric {
  region: string;
  country: string;
  requestCount: number;
  averageResponseTime: number; // ms
  errorRate: number; // percentage
  userCount: number;
}

// ============================================================================
// CDN Optimization Recommendations
// ============================================================================

/**
 * CDN Optimization Recommendation
 */
export interface CDNOptimizationRecommendation {
  recommendationId: string;
  type:
    | 'cache_optimization'
    | 'routing_optimization'
    | 'content_optimization'
    | 'performance_optimization'
    | 'cost_optimization';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: OptimizationImpact;
  implementation: OptimizationImplementation;
  metrics: OptimizationMetrics;
  createdAt: number;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
}

/**
 * Optimization Impact
 */
export interface OptimizationImpact {
  performanceImprovement: number; // percentage
  costSavings: number; // currency amount
  userExperienceImprovement: number; // percentage
  bandwidthSavings: number; // bytes
  cacheEfficiencyImprovement: number; // percentage
}

/**
 * Optimization Implementation
 */
export interface OptimizationImplementation {
  effort: 'low' | 'medium' | 'high';
  timeToImplement: number; // hours
  requiredResources: string[];
  risks: string[];
  steps: string[];
  autoImplementable: boolean;
}

/**
 * Optimization Metrics
 */
export interface OptimizationMetrics {
  baselineMetrics: Record<string, number>;
  projectedMetrics: Record<string, number>;
  actualMetrics?: Record<string, number>;
  improvementPercentage: Record<string, number>;
}

// ============================================================================
// CDN Health Status
// ============================================================================

/**
 * CDN Health Status
 */
export interface CDNHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  score: number; // 0-100
  components: CDNComponentHealth[];
  edgeLocations: EdgeLocationHealth[];
  lastCheck: number;
  issues: CDNHealthIssue[];
  recommendations: string[];
}

/**
 * CDN Component Health
 */
export interface CDNComponentHealth {
  component:
    | 'routing'
    | 'caching'
    | 'optimization'
    | 'monitoring'
    | 'analytics';
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number; // 0-100
  metrics: Record<string, number>;
  lastCheck: number;
  issues: string[];
}

/**
 * Edge Location Health
 */
export interface EdgeLocationHealth {
  edgeLocationId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  score: number; // 0-100
  responseTime: number; // ms
  errorRate: number; // percentage
  load: number; // 0-1
  lastCheck: number;
}

/**
 * CDN Health Issue
 */
export interface CDNHealthIssue {
  issueId: string;
  type: 'performance' | 'availability' | 'configuration' | 'capacity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  description: string;
  detectedAt: number;
  resolved: boolean;
  resolvedAt?: number;
  impact: string;
  recommendedAction: string;
}
