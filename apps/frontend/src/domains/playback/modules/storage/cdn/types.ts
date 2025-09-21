/**
 * CDN Module Types
 *
 * Type definitions for CDN optimization functionality
 */

export interface CDNOptimizationConfig {
  enabled: boolean;
  edgeConfiguration: EdgeConfiguration;
  performanceMonitoring: PerformanceMonitoringConfig;
  contentOptimization?: ContentOptimizationConfig;
  adaptiveStreaming?: AdaptiveStreamingConfig;
  analytics?: AnalyticsConfig;
}

export interface EdgeConfiguration {
  edgeLocations: EdgeLocation[];
  routingStrategy: RoutingStrategy;
  failoverEnabled: boolean;
  healthCheckInterval: number;
}

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
  capacity: number;
  currentLoad: number;
  availability: number;
  latency: number;
  features: string[];
  status: 'operational' | 'degraded' | 'offline';
}

export interface RoutingStrategy {
  algorithm: 'latency_based' | 'geographic' | 'load_based' | 'hybrid';
  weights: {
    latency: number;
    load: number;
    availability: number;
    geographic?: number;
  };
  fallbackStrategy: 'nearest' | 'random' | 'fixed';
}

export interface PerformanceMonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  alertThresholds: {
    errorRate: number;
    latency: number;
    availability: number;
  };
}

export interface ContentOptimizationConfig {
  imageOptimization: {
    enabled: boolean;
    formats: string[];
    qualityLevels: QualityLevel[];
  };
  videoOptimization: {
    enabled: boolean;
    codecs: string[];
    bitrateSettings: BitrateSettings;
  };
  compression: {
    enabled: boolean;
    algorithms: string[];
    level: number;
  };
}

export interface AdaptiveStreamingConfig {
  enabled: boolean;
  protocols: string[];
  qualityLevels: QualityLevel[];
  bandwidthEstimation: {
    algorithm: string;
    updateInterval: number;
  };
}

export interface QualityLevel {
  name: string;
  resolution?: string;
  bitrate: number;
  priority: number;
}

export interface BitrateSettings {
  min: number;
  max: number;
  target: number;
  adaptive: boolean;
}

export interface AnalyticsConfig {
  enabled: boolean;
  collectMetrics: boolean;
  reportingInterval: number;
  customDimensions?: Record<string, any>;
}

export interface CDNPerformanceMetrics {
  timestamp: number;
  requestsTotal: number;
  requestsSuccessful: number;
  requestsFailed: number;
  averageLatency: number;
  p50Latency: number;
  p90Latency: number;
  p95Latency: number;
  p99Latency: number;
  bandwidthUsed: number;
  bandwidthSaved: number;
  cacheHitRate: number;
  originHitRate: number;
  errorRate: number;
  timeoutRate: number;
  errorsByType: Record<string, number>;
  edgePerformance: EdgePerformanceMetric[];
  geographicDistribution: GeographicDistribution[];
  compressionSavings: number;
  formatConversionSavings: number;
  costSavings: number;
  qualityMetrics: {
    videoQualityScore: number;
    audioQualityScore: number;
    imageQualityScore: number;
  };
}

export interface EdgePerformanceMetric {
  edgeId: string;
  latency: number;
  throughput: number;
  errorRate: number;
  availability: number;
}

export interface GeographicDistribution {
  region: string;
  country: string;
  requests: number;
  percentage: number;
}

export interface CDNHealthStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  score: number;
  components: ComponentHealth[];
  edgeLocations: EdgeHealth[];
  lastCheck: number;
  issues: HealthIssue[];
  recommendations: string[];
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'critical';
  latency: number;
  errorRate: number;
}

export interface EdgeHealth {
  edgeId: string;
  status: 'healthy' | 'degraded' | 'critical';
  availability: number;
  currentLoad: number;
  responseTime: number;
}

export interface HealthIssue {
  issueId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  description: string;
  startTime: number;
  endTime?: number;
}

export interface CDNOptimizationRecommendation {
  recommendationId: string;
  type: 'performance' | 'cost' | 'reliability' | 'configuration' | 'routing';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: {
    performance: number; // 0-100
    cost: number; // 0-100
    reliability: number; // 0-100
  };
  implementationDifficulty: 'low' | 'medium' | 'high';
  estimatedSavings: number;
  effort: 'low' | 'medium' | 'high';
  timeToImplement: number; // hours
  requiredResources: string[];
  risks: string[];
  steps: string[];
}

export interface NetworkCondition {
  bandwidth: number;
  latency: number;
  jitter: number;
  packetLoss: number;
  connectionType: 'wifi' | '4g' | '3g' | 'ethernet' | 'unknown';
}
