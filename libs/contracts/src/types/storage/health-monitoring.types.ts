/**
 * Health Monitoring Types
 * Real-time health monitoring, performance analytics, alerting, and dashboards.
 * Story 2.4 Subtask 1.5
 *
 * @module storage/health-monitoring
 */

import type { CircuitBreakerState } from './base.types.js';

// ============================================================================
// Type Aliases
// ============================================================================

/**
 * Widget type for health dashboards
 */
export type WidgetType =
  | 'metric_chart'
  | 'status_indicator'
  | 'alert_list'
  | 'performance_graph'
  | 'health_score'
  | 'component_status'
  | 'trend_analysis'
  | 'anomaly_detection'
  | 'prediction_chart'
  | 'custom';

/**
 * Health webhook event types
 */
export type HealthWebhookEvent =
  | 'health_status_change'
  | 'alert_triggered'
  | 'alert_resolved'
  | 'anomaly_detected'
  | 'performance_degradation'
  | 'component_failure'
  | 'maintenance_window'
  | 'custom_event';

/**
 * Real-time event type
 */
export type RealTimeEventType =
  | 'metric_update'
  | 'health_change'
  | 'alert_triggered'
  | 'alert_resolved'
  | 'anomaly_detected'
  | 'performance_threshold_breach'
  | 'component_status_change'
  | 'error_occurred'
  | 'recovery_completed'
  | 'maintenance_started'
  | 'maintenance_completed'
  | 'custom_event';

// ============================================================================
// Monitoring Configuration
// ============================================================================

/**
 * Real-time monitoring configuration
 */
export interface RealTimeMonitoringConfig {
  enabled: boolean;
  connectionType: 'websocket' | 'eventsource' | 'polling';
  reconnectEnabled: boolean;
  reconnectInterval: number; // ms
  maxReconnectAttempts: number;
  heartbeatInterval: number; // ms
  bufferSize: number; // number of events to buffer
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  monitoringEndpoint?: string;
  authenticationRequired: boolean;
}

/**
 * Component monitoring configuration
 */
export interface ComponentMonitoringConfig {
  componentName: string;
  enabled: boolean;
  checkInterval: number; // ms
  healthCheckFunction?: string; // function name or endpoint
  criticalityLevel: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[]; // other component names
  customMetrics: string[];
}

/**
 * Health threshold configuration
 */
export interface HealthThresholdConfig {
  responseTimeThresholds: {
    warning: number; // ms
    critical: number; // ms
  };
  errorRateThresholds: {
    warning: number; // percentage
    critical: number; // percentage
  };
  resourceUtilizationThresholds: {
    memory: { warning: number; critical: number }; // percentage
    cpu: { warning: number; critical: number }; // percentage
    storage: { warning: number; critical: number }; // percentage
  };
  customThresholds: Record<string, { warning: number; critical: number }>;
}

/**
 * Advanced health monitoring configuration
 */
export interface HealthMonitoringConfig {
  enabled: boolean;
  monitoringInterval: number; // ms
  healthCheckTimeout: number; // ms
  componentMonitoring: ComponentMonitoringConfig[];
  thresholdConfig: HealthThresholdConfig;
  trendAnalysisEnabled: boolean;
  anomalyDetectionEnabled: boolean;
  predictiveAnalysisEnabled: boolean;
  historicalDataRetention: number; // days
}

/**
 * Performance analytics configuration
 */
export interface PerformanceAnalyticsConfig {
  enabled: boolean;
  metricsCollectionInterval: number; // ms
  trendAnalysisWindow: number; // ms
  anomalyDetectionSensitivity: 'low' | 'medium' | 'high';
  performancePredictionEnabled: boolean;
  benchmarkingEnabled: boolean;
  customMetricsEnabled: boolean;
  dataRetentionPeriod: number; // days
  aggregationLevels: ('minute' | 'hour' | 'day' | 'week' | 'month')[];
}

// ============================================================================
// Performance Metrics
// ============================================================================

/**
 * Extended performance metrics
 */
export interface PerformanceMetrics {
  // Basic metrics
  timestamp: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;

  // Advanced metrics
  throughput: number; // requests per second
  concurrentConnections: number;
  queueDepth: number;
  memoryUsage: number; // bytes
  cpuUsage: number; // percentage
  networkBandwidth: number; // bytes per second
  cacheHitRate: number;
  cacheSize: number; // bytes

  // Component-specific metrics
  circuitBreakerState: CircuitBreakerState;
  circuitBreakerFailures: number;
  retryAttempts: number;
  fallbackActivations: number;

  // Custom metrics
  customMetrics: Record<string, number>;
}

/**
 * Performance data point
 */
export interface PerformanceDataPoint {
  timestamp: number;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Seasonal pattern detection
 */
export interface SeasonalPattern {
  patternType: 'daily' | 'weekly' | 'monthly';
  strength: number; // 0-1
  peakTimes: number[]; // timestamps or hours
  description: string;
}

/**
 * Predicted value
 */
export interface PredictedValue {
  timestamp: number;
  value: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
}

/**
 * Prediction factor
 */
export interface PredictionFactor {
  factorName: string;
  importance: number; // 0-1
  description: string;
}

/**
 * Performance prediction
 */
export interface PerformancePrediction {
  predictionId: string;
  generatedAt: number;
  metricName: string;
  predictionHorizon: number; // ms into the future
  predictedValues: PredictedValue[];
  confidence: number; // 0-1
  methodology: 'linear_regression' | 'arima' | 'neural_network' | 'ensemble';
  factors: PredictionFactor[];
}

/**
 * Performance trend analysis
 */
export interface PerformanceTrend {
  metricName: string;
  timeWindow: {
    startTime: number;
    endTime: number;
    granularity: 'minute' | 'hour' | 'day';
  };
  dataPoints: PerformanceDataPoint[];
  trendDirection: 'improving' | 'stable' | 'degrading';
  changeRate: number; // percentage change
  volatility: number; // measure of variance
  seasonalPatterns: SeasonalPattern[];
  predictions: PerformancePrediction[];
}

/**
 * Anomaly context
 */
export interface AnomalyContext {
  correlatedMetrics: string[];
  possibleCauses: string[];
  impactAssessment: string;
  recommendedActions: string[];
  historicalOccurrences: number;
}

/**
 * Performance anomaly detection
 */
export interface PerformanceAnomaly {
  anomalyId: string;
  detectedAt: number;
  metricName: string;
  anomalyType: 'spike' | 'drop' | 'trend_change' | 'pattern_break';
  severity: 'low' | 'medium' | 'high' | 'critical';
  actualValue: number;
  expectedValue: number;
  deviation: number; // percentage
  confidence: number; // 0-1
  context: AnomalyContext;
  resolved: boolean;
  resolvedAt?: number;
}

// ============================================================================
// Alerting Configuration
// ============================================================================

/**
 * Alert condition
 */
export interface AlertCondition {
  conditionId: string;
  metricName: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains' | 'regex';
  threshold: number | string;
  aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count' | 'rate';
  timeWindow: number; // ms
  missingDataTreatment: 'ignore' | 'treat_as_zero' | 'treat_as_breach';
}

/**
 * Alert rule definition
 */
export interface AlertRule {
  ruleId: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  conditions: AlertCondition[];
  logicalOperator: 'AND' | 'OR';
  evaluationInterval: number; // ms
  evaluationWindow: number; // ms
  cooldownPeriod: number; // ms
  notificationChannels: string[]; // channel IDs
  escalationPolicy?: string; // policy ID
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Alert threshold configuration
 */
export interface AlertThreshold {
  thresholdId: string;
  name: string;
  metricName: string;
  warningThreshold: number;
  criticalThreshold: number;
  unit: string;
  direction: 'above' | 'below' | 'outside_range';
  hysteresis?: number; // prevent flapping
  adaptiveThreshold: boolean;
}

/**
 * Alert details
 */
export interface AlertDetails {
  metricName: string;
  currentValue: number;
  thresholdValue: number;
  duration: number; // how long the condition has been true
  affectedComponents: string[];
  possibleCauses: string[];
  recommendedActions: string[];
  runbookUrl?: string;
  dashboardUrl?: string;
}

/**
 * Alert acknowledgment
 */
export interface AlertAcknowledgment {
  acknowledgedBy: string;
  acknowledgedAt: number;
  comment?: string;
  autoAcknowledged: boolean;
}

/**
 * Alert notification
 */
export interface AlertNotification {
  notificationId: string;
  alertRuleId: string;
  alertId: string;
  timestamp: number;
  severity: 'warning' | 'critical';
  status: 'firing' | 'resolved';
  title: string;
  message: string;
  details: AlertDetails;
  channels: string[]; // channel IDs where sent
  acknowledgments: AlertAcknowledgment[];
  escalated: boolean;
  escalationLevel: number;
}

/**
 * Rate limiting for notifications
 */
export interface RateLimitConfig {
  enabled: boolean;
  maxNotificationsPerMinute: number;
  maxNotificationsPerHour: number;
  burstLimit: number;
  backoffStrategy: 'linear' | 'exponential';
}

/**
 * Notification retry policy
 */
export interface NotificationRetryPolicy {
  enabled: boolean;
  maxRetries: number;
  retryInterval: number; // ms
  backoffMultiplier: number;
  maxRetryInterval: number; // ms
}

/**
 * Alert filter rule
 */
export interface AlertFilterRule {
  ruleId: string;
  condition: string; // expression to evaluate
  action: 'include' | 'exclude' | 'modify';
  priority: number;
}

/**
 * Alert channel configuration
 */
export interface AlertChannelConfig {
  // Email configuration
  emailAddresses?: string[];
  emailTemplate?: string;

  // Webhook configuration
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;
  webhookPayloadTemplate?: string;

  // Slack configuration
  slackWebhookUrl?: string;
  slackChannel?: string;
  slackUsername?: string;

  // Teams configuration
  teamsWebhookUrl?: string;

  // PagerDuty configuration
  pagerDutyIntegrationKey?: string;
  pagerDutyServiceKey?: string;

  // SMS configuration
  phoneNumbers?: string[];
  smsProvider?: string;
  smsApiKey?: string;

  // Custom configuration
  customConfig?: Record<string, unknown>;
}

/**
 * Alert notification channel
 */
export interface AlertChannel {
  channelId: string;
  name: string;
  type: 'email' | 'webhook' | 'slack' | 'teams' | 'pagerduty' | 'sms';
  enabled: boolean;
  configuration: AlertChannelConfig;
  rateLimiting: RateLimitConfig;
  retryPolicy: NotificationRetryPolicy;
  filterRules: AlertFilterRule[];
}

/**
 * Escalation condition
 */
export interface EscalationCondition {
  type: 'time_based' | 'acknowledgment_based' | 'severity_based';
  parameters: Record<string, unknown>;
}

/**
 * Escalation level
 */
export interface EscalationLevel {
  level: number;
  delayMinutes: number;
  channels: string[]; // channel IDs
  conditions?: EscalationCondition[];
}

/**
 * Escalation policy
 */
export interface EscalationPolicy {
  policyId: string;
  name: string;
  description: string;
  enabled: boolean;
  escalationLevels: EscalationLevel[];
  repeatInterval?: number; // ms
  maxEscalations?: number;
}

/**
 * Alert grouping configuration
 */
export interface AlertGroupingConfig {
  enabled: boolean;
  groupingKeys: string[]; // fields to group by
  groupingWindow: number; // ms
  maxGroupSize: number;
  groupingStrategy: 'time_based' | 'similarity_based' | 'rule_based';
}

/**
 * Alert suppression rule
 */
export interface AlertSuppressionRule {
  ruleId: string;
  name: string;
  enabled: boolean;
  conditions: AlertCondition[];
  suppressionDuration: number; // ms
  reason: string;
}

/**
 * Recurrence pattern
 */
export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number; // every N days/weeks/months
  daysOfWeek?: number[]; // for weekly recurrence
  dayOfMonth?: number; // for monthly recurrence
  endDate?: number; // when recurrence ends
}

/**
 * Maintenance window
 */
export interface MaintenanceWindow {
  windowId: string;
  name: string;
  description: string;
  startTime: number;
  endTime: number;
  recurring: boolean;
  recurrencePattern?: RecurrencePattern;
  affectedComponents: string[];
  suppressAlerts: boolean;
  notifyBeforeStart: boolean;
  notificationLeadTime?: number; // ms
}

/**
 * Alerting system configuration
 */
export interface AlertingConfig {
  enabled: boolean;
  alertRules: AlertRule[];
  notificationChannels: AlertChannel[];
  escalationPolicies: EscalationPolicy[];
  alertGrouping: AlertGroupingConfig;
  suppressionRules: AlertSuppressionRule[];
  maintenanceWindows: MaintenanceWindow[];
}

// ============================================================================
// Dashboard Configuration
// ============================================================================

/**
 * Time range
 */
export interface TimeRange {
  type: 'relative' | 'absolute';
  // Relative time
  duration?: number; // ms
  // Absolute time
  startTime?: number;
  endTime?: number;
}

/**
 * Widget threshold
 */
export interface WidgetThreshold {
  value: number;
  color: string;
  label?: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte';
}

/**
 * Widget configuration
 */
export interface WidgetConfiguration {
  // Chart configuration
  chartType?: 'line' | 'bar' | 'pie' | 'gauge' | 'heatmap';
  timeRange?: TimeRange;
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count';

  // Display configuration
  showLegend?: boolean;
  showGrid?: boolean;
  colorScheme?: string;
  thresholds?: WidgetThreshold[];

  // Alert configuration
  alertSeverityFilter?: ('warning' | 'critical')[];
  maxAlerts?: number;

  // Custom configuration
  customConfig?: Record<string, unknown>;
}

/**
 * Widget size
 */
export interface WidgetSize {
  width: number;
  height: number;
  x: number;
  y: number;
}

/**
 * Widget position
 */
export interface WidgetPosition {
  x: number;
  y: number;
  z?: number; // layer order
}

/**
 * Widget data source
 */
export interface WidgetDataSource {
  type: 'metrics' | 'alerts' | 'health_status' | 'custom';
  query: string;
  parameters?: Record<string, unknown>;
  cacheEnabled?: boolean;
  cacheTtl?: number; // ms
}

/**
 * Widget permissions
 */
export interface WidgetPermissions {
  view: string[]; // user IDs or roles
  edit: string[];
  delete: string[];
}

/**
 * Health dashboard widget
 */
export interface HealthWidget {
  widgetId: string;
  type: WidgetType;
  title: string;
  description?: string;
  position: WidgetPosition;
  size: WidgetSize;
  configuration: WidgetConfiguration;
  dataSource: WidgetDataSource;
  refreshInterval?: number; // ms, overrides dashboard default
  visible: boolean;
  permissions?: WidgetPermissions;
}

/**
 * Layout breakpoint
 */
export interface LayoutBreakpoint {
  columns: number;
  rows: number;
  widgetSizes: Record<string, WidgetSize>;
}

/**
 * Dashboard layout
 */
export interface DashboardLayout {
  type: 'grid' | 'flex' | 'custom';
  columns: number;
  rows: number;
  responsive: boolean;
  breakpoints?: Record<string, LayoutBreakpoint>;
}

/**
 * Dashboard permissions
 */
export interface DashboardPermissions {
  view: string[]; // user IDs or roles
  edit: string[];
  delete: string[];
  share: string[];
}

/**
 * Filter option
 */
export interface FilterOption {
  label: string;
  value: unknown;
}

/**
 * Dashboard filter
 */
export interface DashboardFilter {
  filterId: string;
  name: string;
  type: 'dropdown' | 'text' | 'date_range' | 'multi_select';
  field: string;
  defaultValue?: unknown;
  options?: FilterOption[];
  required: boolean;
}

/**
 * Health dashboard configuration
 */
export interface HealthDashboard {
  dashboardId: string;
  name: string;
  description: string;
  isDefault: boolean;
  layout: DashboardLayout;
  widgets: HealthWidget[];
  refreshInterval: number; // ms
  autoRefresh: boolean;
  permissions: DashboardPermissions;
  filters: DashboardFilter[];
  createdAt: number;
  updatedAt: number;
  createdBy: string;
}

// ============================================================================
// Health Reports
// ============================================================================

/**
 * Overall health status
 */
export interface OverallHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical';
  score: number; // 0-100
  uptime: number; // percentage
  availability: number; // percentage
  reliability: number; // percentage
  performance: number; // percentage
  lastIncident?: number; // timestamp
}

/**
 * Component metrics
 */
export interface ComponentMetrics {
  requestCount: number;
  errorCount: number;
  averageLatency: number;
  p95Latency: number;
  throughput: number;
  memoryUsage?: number;
  cpuUsage?: number;
  customMetrics: Record<string, number>;
}

/**
 * Component issue
 */
export interface ComponentIssue {
  issueId: string;
  type: 'performance' | 'availability' | 'error' | 'configuration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: number;
  resolved: boolean;
  resolvedAt?: number;
  impact: string;
  recommendedAction: string;
}

/**
 * Component health report
 */
export interface ComponentHealthReport {
  componentName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number; // 0-100
  uptime: number; // percentage
  errorRate: number; // percentage
  averageResponseTime: number; // ms
  throughput: number; // requests per second
  lastCheck: number;
  issues: ComponentIssue[];
  metrics: ComponentMetrics;
}

/**
 * Performance trend summary
 */
export interface PerformanceTrendSummary {
  metricName: string;
  trend: 'improving' | 'stable' | 'degrading';
  changePercentage: number;
  significance: 'low' | 'medium' | 'high';
}

/**
 * Performance bottleneck
 */
export interface PerformanceBottleneck {
  component: string;
  operation: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
  recommendedAction: string;
}

/**
 * Performance summary
 */
export interface PerformanceSummary {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
  availability: number;
  performanceTrends: PerformanceTrendSummary[];
  bottlenecks: PerformanceBottleneck[];
}

/**
 * Top alert rule
 */
export interface TopAlertRule {
  ruleId: string;
  ruleName: string;
  alertCount: number;
  averageResolutionTime: number;
}

/**
 * Alert summary
 */
export interface AlertSummary {
  totalAlerts: number;
  activeAlerts: number;
  resolvedAlerts: number;
  alertsByseverity: Record<string, number>;
  alertsByComponent: Record<string, number>;
  averageResolutionTime: number; // ms
  topAlertRules: TopAlertRule[];
}

/**
 * Health recommendation
 */
export interface HealthRecommendation {
  recommendationId: string;
  type: 'performance' | 'reliability' | 'cost' | 'security' | 'maintenance';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  potentialImprovement: string;
  implementationSteps: string[];
  relatedComponents: string[];
  estimatedTimeToImplement: number; // hours
}

/**
 * Health trend summary
 */
export interface HealthTrendSummary {
  component: string;
  metric: string;
  trend: 'improving' | 'stable' | 'degrading';
  changeRate: number;
  timeframe: string;
  significance: 'low' | 'medium' | 'high';
}

/**
 * Incident summary
 */
export interface IncidentSummary {
  incidentId: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved';
  startTime: number;
  endTime?: number;
  duration?: number; // ms
  affectedComponents: string[];
  rootCause?: string;
  resolution?: string;
  impact: string;
}

/**
 * Chart configuration
 */
export interface ChartConfiguration {
  xAxisLabel?: string;
  yAxisLabel?: string;
  showLegend: boolean;
  colorScheme: string;
  thresholds?: WidgetThreshold[];
}

/**
 * Chart data point
 */
export interface ChartDataPoint {
  x: number | string;
  y: number;
  label?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Report chart
 */
export interface ReportChart {
  chartId: string;
  type: 'line' | 'bar' | 'pie' | 'gauge';
  title: string;
  data: ChartDataPoint[];
  configuration: ChartConfiguration;
}

/**
 * Custom report section
 */
export interface CustomReportSection {
  sectionId: string;
  title: string;
  content: string;
  data?: Record<string, unknown>;
  charts?: ReportChart[];
}

/**
 * Health report
 */
export interface HealthReport {
  reportId: string;
  generatedAt: number;
  reportType: 'summary' | 'detailed' | 'incident' | 'performance';
  timeRange: TimeRange;
  overallHealth: OverallHealthStatus;
  componentHealth: ComponentHealthReport[];
  performanceSummary: PerformanceSummary;
  alertSummary: AlertSummary;
  recommendations: HealthRecommendation[];
  trends: HealthTrendSummary[];
  incidents: IncidentSummary[];
  customSections?: CustomReportSection[];
}

/**
 * Insight evidence
 */
export interface InsightEvidence {
  type: 'metric' | 'alert' | 'trend' | 'correlation';
  description: string;
  data: Record<string, unknown>;
  confidence: number; // 0-1
}

/**
 * Health insight (AI-generated)
 */
export interface HealthInsight {
  insightId: string;
  generatedAt: number;
  type: 'pattern' | 'anomaly' | 'prediction' | 'optimization' | 'risk';
  confidence: number; // 0-1
  title: string;
  description: string;
  evidence: InsightEvidence[];
  recommendations: string[];
  impact: 'low' | 'medium' | 'high' | 'critical';
  timeframe: string;
  relatedComponents: string[];
  actionable: boolean;
}

// ============================================================================
// Monitoring Integration
// ============================================================================

/**
 * OAuth2 configuration
 */
export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scopes?: string[];
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  type: 'basic' | 'bearer' | 'api_key' | 'oauth2';
  username?: string;
  password?: string;
  token?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  oauthConfig?: OAuth2Config;
}

/**
 * Monitoring integration configuration
 */
export interface MonitoringIntegrationConfig {
  // Datadog configuration
  datadogApiKey?: string;
  datadogAppKey?: string;
  datadogSite?: string;

  // New Relic configuration
  newRelicApiKey?: string;
  newRelicAccountId?: string;

  // Prometheus configuration
  prometheusEndpoint?: string;
  prometheusAuth?: AuthConfig;

  // Grafana configuration
  grafanaUrl?: string;
  grafanaApiKey?: string;

  // Splunk configuration
  splunkUrl?: string;
  splunkToken?: string;
  splunkIndex?: string;

  // Elastic configuration
  elasticUrl?: string;
  elasticApiKey?: string;
  elasticIndex?: string;

  // Custom configuration
  customEndpoint?: string;
  customHeaders?: Record<string, string>;
  customAuth?: AuthConfig;
  customConfig?: Record<string, unknown>;
}

/**
 * Export retry policy
 */
export interface ExportRetryPolicy {
  enabled: boolean;
  maxRetries: number;
  retryInterval: number; // ms
  backoffStrategy: 'linear' | 'exponential';
  maxRetryInterval: number; // ms
}

/**
 * Metrics filter rule
 */
export interface MetricsFilterRule {
  ruleId: string;
  condition: string; // expression to evaluate
  action: 'include' | 'exclude';
  priority: number;
}

/**
 * Metrics transformation rule
 */
export interface MetricsTransformationRule {
  ruleId: string;
  sourceField: string;
  targetField: string;
  transformation: 'rename' | 'scale' | 'convert_unit' | 'aggregate' | 'custom';
  parameters?: Record<string, unknown>;
}

/**
 * Metrics export configuration
 */
export interface MetricsExportConfig {
  enabled: boolean;
  exportInterval: number; // ms
  batchSize: number;
  retryPolicy: ExportRetryPolicy;
  filterRules: MetricsFilterRule[];
  transformationRules: MetricsTransformationRule[];
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

/**
 * Webhook retry policy
 */
export interface WebhookRetryPolicy {
  enabled: boolean;
  maxRetries: number;
  retryInterval: number; // ms
  backoffStrategy: 'linear' | 'exponential';
  retryOnStatusCodes: number[];
}

/**
 * Health webhook configuration
 */
export interface HealthWebhook {
  webhookId: string;
  name: string;
  url: string;
  enabled: boolean;
  events: HealthWebhookEvent[];
  headers: Record<string, string>;
  authentication?: AuthConfig;
  retryPolicy: WebhookRetryPolicy;
  rateLimiting: RateLimitConfig;
  payloadTemplate?: string;
  signatureSecret?: string;
}

/**
 * Monitoring integration
 */
export interface MonitoringIntegration {
  integrationId: string;
  name: string;
  type:
    | 'datadog'
    | 'newrelic'
    | 'prometheus'
    | 'grafana'
    | 'splunk'
    | 'elastic'
    | 'custom';
  enabled: boolean;
  configuration: MonitoringIntegrationConfig;
  exportConfig: MetricsExportConfig;
  webhookConfig?: HealthWebhook;
  syncInterval: number; // ms
  lastSync?: number;
  status: 'active' | 'inactive' | 'error';
  errorMessage?: string;
}

// ============================================================================
// Real-time Monitoring
// ============================================================================

/**
 * Real-time monitoring event
 */
export interface RealTimeMonitoringEvent {
  eventId: string;
  timestamp: number;
  eventType: RealTimeEventType;
  source: string; // component or service name
  severity: 'info' | 'warning' | 'error' | 'critical';
  data: Record<string, unknown>;
  correlationId?: string;
  tags: string[];
}

/**
 * Session filter
 */
export interface SessionFilter {
  filterId: string;
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'regex' | 'gt' | 'lt';
  value: unknown;
  active: boolean;
}

/**
 * Monitoring subscription
 */
export interface MonitoringSubscription {
  subscriptionId: string;
  eventTypes: RealTimeEventType[];
  components: string[];
  severityFilter: ('info' | 'warning' | 'error' | 'critical')[];
  customFilters: Record<string, unknown>;
  bufferSize: number;
  compressionEnabled: boolean;
}

/**
 * Monitoring session
 */
export interface MonitoringSession {
  sessionId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  connectionType: 'websocket' | 'eventsource' | 'polling';
  subscriptions: MonitoringSubscription[];
  filters: SessionFilter[];
  status: 'active' | 'inactive' | 'error';
  lastActivity: number;
  eventCount: number;
}
