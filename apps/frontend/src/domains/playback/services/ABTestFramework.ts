/**
 * ABTestFramework - Performance Optimization A/B Testing Service
 *
 * Implements comprehensive A/B testing framework for audio performance optimization.
 * Enables testing different configurations, algorithms, and optimizations
 * with statistical analysis and automatic rollback capabilities.
 *
 * Part of Story 2.1: Core Audio Engine Foundation - Task 6, Subtask 6.5
 */

import { AudioPerformanceMetrics } from '../types/audio.js';

export type OptimizationCategory =
  | 'latency'
  | 'cpu_usage'
  | 'memory_usage'
  | 'battery_efficiency'
  | 'audio_quality'
  | 'stability';

export type ExperimentStatus =
  | 'draft'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export type ExperimentVariant =
  | 'control'
  | 'variant_a'
  | 'variant_b'
  | 'variant_c';

export interface ExperimentConfig {
  id: string;
  name: string;
  description: string;
  category: OptimizationCategory;
  hypothesis: string;

  // Experiment parameters
  variants: ExperimentVariantConfig[];
  trafficSplit: number[]; // Percentage split for each variant (should sum to 100)
  duration: number; // Duration in milliseconds
  minSampleSize: number; // Minimum samples per variant for statistical significance

  // Success criteria
  primaryMetric: keyof AudioPerformanceMetrics;
  secondaryMetrics: (keyof AudioPerformanceMetrics)[];
  successThreshold: number; // Minimum improvement percentage to consider success

  // Safety configurations
  rollbackConditions: RollbackCondition[];
  maxDegradationPercent: number; // Maximum allowed performance degradation

  // Targeting
  deviceTargeting?: DeviceTargeting;
  userTargeting?: UserTargeting;
}

export interface ExperimentVariantConfig {
  name: ExperimentVariant;
  description: string;
  configuration: AudioOptimizationConfig;
  weight: number; // Traffic allocation weight
}

export interface AudioOptimizationConfig {
  // Buffer optimization
  bufferSize?: number;
  lookAheadTime?: number;

  // Audio context settings
  sampleRate?: number;
  latencyHint?: 'interactive' | 'balanced' | 'playback';

  // Processing optimization
  enableWebAudioWorklets?: boolean;
  enableBackgroundProcessing?: boolean;
  maxPolyphony?: number;

  // Quality settings
  audioQuality?: 'low' | 'medium' | 'high';
  enableEffects?: boolean;
  enableVisualization?: boolean;

  // Mobile optimization
  batteryOptimization?: boolean;
  adaptiveQuality?: boolean;
  backgroundBehavior?: 'full' | 'reduced' | 'minimal';

  // Algorithm selection
  schedulingAlgorithm?: 'standard' | 'lookahead' | 'adaptive';
  latencyCompensation?: 'none' | 'basic' | 'advanced';

  // Custom parameters for specific experiments
  customParameters?: Record<string, any>;
}

export interface DeviceTargeting {
  platforms?: ('desktop' | 'mobile' | 'tablet')[];
  browsers?: ('chrome' | 'firefox' | 'safari' | 'edge')[];
  minCpuCores?: number;
  minMemoryGB?: number;
  excludeLowEndDevices?: boolean;
}

export interface UserTargeting {
  includeNewUsers?: boolean;
  includePowerUsers?: boolean;
  geographicRegions?: string[];
  userSegments?: string[];
  excludeSegments?: string[];
}

export interface ExperimentResult {
  experimentId: string;
  variant: ExperimentVariant;
  metrics: ExperimentMetrics;
  startTime: number;
  endTime?: number;
  sessionId: string;
  userId?: string;
  deviceInfo: DeviceInfo;
}

export interface ExperimentAnalysis {
  experimentId: string;
  status: ExperimentStatus;
  startTime: number;
  endTime?: number;

  // Statistical significance
  isStatisticallySignificant: boolean;
  confidenceLevel: number;
  pValue: number;

  // Results by variant
  variantResults: Map<ExperimentVariant, VariantAnalysis>;

  // Winner determination
  winningVariant?: ExperimentVariant;
  improvementPercent?: number;

  // Risk assessment
  riskAssessment: RiskAssessment;

  // Recommendations
  recommendations: ExperimentRecommendation[];
}

export interface VariantAnalysis {
  variant: ExperimentVariant;
  sampleSize: number;
  metrics: ExperimentMetrics;
  conversionRate: number;
  confidenceInterval: [number, number];
  performanceScore: number;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  riskFactors: string[];
  mitigationStrategies: string[];
  rollbackRecommended: boolean;
}

export interface ExperimentRecommendation {
  type: 'deploy' | 'iterate' | 'rollback' | 'extend';
  confidence: number;
  reasoning: string;
  nextSteps: string[];
}

export interface RollbackCondition {
  metric: keyof AudioPerformanceMetrics;
  threshold: number;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  duration: number; // How long condition must persist before rollback
}

export interface ExperimentMetrics {
  // Performance metrics
  latency: StatisticalMetrics;
  cpuUsage: StatisticalMetrics;
  memoryUsage: StatisticalMetrics;
  dropoutCount: StatisticalMetrics;

  // Quality metrics
  audioQuality: StatisticalMetrics;
  userSatisfaction?: StatisticalMetrics;

  // Stability metrics
  errorRate: StatisticalMetrics;
  crashRate: StatisticalMetrics;
  recoveryTime: StatisticalMetrics;

  // Battery metrics (mobile)
  batteryDrain?: StatisticalMetrics;
  thermalThrottling?: StatisticalMetrics;
}

export interface StatisticalMetrics {
  count: number;
  sum: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
}

export interface DeviceInfo {
  platform: string;
  browser: string;
  cpuCores: number;
  memoryGB: number;
  isLowEndDevice: boolean;
  supportedFeatures: string[];
}

export class ABTestFramework {
  private static instance: ABTestFramework;
  private experiments: Map<string, ExperimentConfig> = new Map();
  private activeExperiments: Map<string, ExperimentState> = new Map();
  private results: Map<string, ExperimentResult[]> = new Map();
  private userAssignments: Map<string, Map<string, ExperimentVariant>> =
    new Map();

  // Dependencies
  private performanceMonitor: any; // Will be injected
  private storageService: any; // Will be injected

  // Configuration
  private readonly DEFAULT_CONFIDENCE_LEVEL = 0.95;
  private readonly MIN_EFFECT_SIZE = 0.05; // 5% minimum detectable effect
  private readonly MAX_EXPERIMENT_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

  private constructor() {
    this.initializeFramework();
  }

  public static getInstance(): ABTestFramework {
    if (!ABTestFramework.instance) {
      ABTestFramework.instance = new ABTestFramework();
    }
    return ABTestFramework.instance;
  }

  /**
   * Initialize the A/B testing framework
   */
  private initializeFramework(): void {
    // Load existing experiments from storage
    this.loadExperimentsFromStorage();

    // Set up automatic data collection
    this.setupMetricsCollection();

    // Set up periodic analysis
    this.setupPeriodicAnalysis();
  }

  /**
   * Create a new performance optimization experiment
   */
  public createExperiment(config: ExperimentConfig): void {
    // Validate experiment configuration
    this.validateExperimentConfig(config);

    // Store experiment configuration
    this.experiments.set(config.id, config);

    // Initialize experiment state
    const state: ExperimentState = {
      config,
      status: 'draft',
      createdAt: Date.now(),
      startedAt: null,
      endedAt: null,
      participantCount: 0,
      currentResults: new Map(),
      rollbackTriggered: false,
      lastAnalysis: null,
    };

    this.activeExperiments.set(config.id, state);
    this.results.set(config.id, []);

    // Persist to storage
    this.saveExperimentToStorage(config.id);
  }

  /**
   * Start an experiment
   */
  public startExperiment(experimentId: string): void {
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    if (experiment.status !== 'draft' && experiment.status !== 'paused') {
      throw new Error(`Cannot start experiment in ${experiment.status} status`);
    }

    experiment.status = 'running';
    experiment.startedAt = Date.now();

    // Set up automatic experiment end
    setTimeout(() => {
      this.endExperiment(experimentId);
    }, experiment.config.duration);

    // Set up rollback monitoring
    this.setupRollbackMonitoring(experimentId);

    this.saveExperimentToStorage(experimentId);
  }

  /**
   * Get experiment variant for a user/session
   */
  public getVariantForUser(
    experimentId: string,
    userId: string,
  ): ExperimentVariant | null {
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') {
      return null;
    }

    // Check if user already has assignment
    const userExperiments = this.userAssignments.get(userId);
    if (userExperiments?.has(experimentId)) {
      const assignment = userExperiments.get(experimentId);
      if (assignment) {
        return assignment;
      }
    }

    // Check targeting criteria
    if (!this.isUserEligible(experiment.config, userId)) {
      return null;
    }

    // Assign variant based on traffic split
    const variant = this.assignVariant(experiment.config, userId);

    // Store assignment
    if (!this.userAssignments.has(userId)) {
      this.userAssignments.set(userId, new Map());
    }
    const userExperimentsMap = this.userAssignments.get(userId);
    if (userExperimentsMap) {
      userExperimentsMap.set(experimentId, variant);
    }

    experiment.participantCount++;

    return variant;
  }

  /**
   * Apply experiment configuration for a variant
   */
  public applyVariantConfig(
    variant: ExperimentVariant,
    experimentId: string,
  ): AudioOptimizationConfig {
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const variantConfig = experiment.config.variants.find(
      (v: ExperimentVariantConfig) => v.name === variant,
    );
    if (!variantConfig) {
      throw new Error(
        `Variant ${variant} not found in experiment ${experimentId}`,
      );
    }

    return variantConfig.configuration;
  }

  /**
   * Record experiment metrics
   */
  public recordMetrics(
    experimentId: string,
    variant: ExperimentVariant,
    metrics: AudioPerformanceMetrics,
    sessionId: string,
    userId?: string,
  ): void {
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') {
      return;
    }

    const result: ExperimentResult = {
      experimentId,
      variant,
      metrics: this.convertToExperimentMetrics(metrics),
      startTime: Date.now(),
      sessionId,
      userId,
      deviceInfo: this.getCurrentDeviceInfo(),
    };

    // Store result
    const results = this.results.get(experimentId) || [];
    results.push(result);
    this.results.set(experimentId, results);

    // Update current results for real-time monitoring
    if (!experiment.currentResults.has(variant)) {
      experiment.currentResults.set(variant, []);
    }
    const variantResults = experiment.currentResults.get(variant);
    if (variantResults) {
      variantResults.push(result);
    }

    // Check rollback conditions
    this.checkRollbackConditions(experimentId);

    // Persist to storage
    this.saveResultToStorage(experimentId, result);
  }

  /**
   * Analyze experiment results
   */
  public analyzeExperiment(experimentId: string): ExperimentAnalysis {
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    const results = this.results.get(experimentId) || [];

    // Group results by variant
    const variantResults: Map<ExperimentVariant, ExperimentResult[]> =
      new Map();
    for (const result of results) {
      if (!variantResults.has(result.variant)) {
        variantResults.set(result.variant, []);
      }
      const resultArray = variantResults.get(result.variant);
      if (resultArray) {
        resultArray.push(result);
      }
    }

    // Calculate statistics for each variant
    const variantAnalyses = new Map<ExperimentVariant, VariantAnalysis>();
    const variantResultEntries = Array.from(variantResults.entries());
    for (const [variant, resultsList] of variantResultEntries) {
      const analysis = this.analyzeVariant(
        variant,
        resultsList,
        experiment.config,
      );
      variantAnalyses.set(variant, analysis);
    }

    // Determine statistical significance
    const significance = this.calculateStatisticalSignificance(
      variantAnalyses,
      experiment.config,
    );

    // Determine winner
    const winner = this.determineWinner(variantAnalyses, experiment.config);

    // Risk assessment
    const riskAssessment = this.assessRisk(variantAnalyses, experiment.config);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      variantAnalyses,
      significance,
      winner,
      riskAssessment,
      experiment.config,
    );

    const analysis: ExperimentAnalysis = {
      experimentId,
      status: experiment.status,
      startTime: experiment.startedAt ?? experiment.createdAt,
      endTime: experiment.endedAt ?? undefined,
      isStatisticallySignificant: significance.isSignificant,
      confidenceLevel: this.DEFAULT_CONFIDENCE_LEVEL,
      pValue: significance.pValue,
      variantResults: variantAnalyses,
      winningVariant: winner?.variant,
      improvementPercent: winner?.improvementPercent,
      riskAssessment,
      recommendations,
    };

    experiment.lastAnalysis = analysis;
    return analysis;
  }

  /**
   * End an experiment
   */
  public endExperiment(experimentId: string): void {
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    experiment.status = 'completed';
    experiment.endedAt = Date.now();

    // Perform final analysis
    const finalAnalysis = this.analyzeExperiment(experimentId);

    // Auto-rollback if needed
    if (finalAnalysis.riskAssessment.rollbackRecommended) {
      this.rollbackExperiment(experimentId);
    }

    this.saveExperimentToStorage(experimentId);
  }

  /**
   * Rollback an experiment
   */
  public rollbackExperiment(experimentId: string): void {
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    experiment.status = 'rolled_back';
    experiment.rollbackTriggered = true;
    experiment.endedAt = Date.now();

    // Clear user assignments to prevent further exposure
    const userAssignmentEntries = Array.from(this.userAssignments.entries());
    for (const [_userId, userExperiments] of userAssignmentEntries) {
      userExperiments.delete(experimentId);
    }

    this.saveExperimentToStorage(experimentId);
  }

  /**
   * Get all active experiments
   */
  public getActiveExperiments(): ExperimentConfig[] {
    return Array.from(this.activeExperiments.values())
      .filter((exp) => exp.status === 'running')
      .map((exp) => exp.config);
  }

  /**
   * Get experiment status
   */
  public getExperimentStatus(experimentId: string): ExperimentStatus | null {
    const experiment = this.activeExperiments.get(experimentId);
    return experiment?.status || null;
  }

  // Private helper methods

  private validateExperimentConfig(config: ExperimentConfig): void {
    if (!config.id || !config.name) {
      throw new Error('Experiment must have id and name');
    }

    if (config.variants.length < 2) {
      throw new Error('Experiment must have at least 2 variants');
    }

    const totalSplit = config.trafficSplit.reduce(
      (sum: number, split: number) => sum + split,
      0,
    );
    if (Math.abs(totalSplit - 100) > 0.1) {
      throw new Error('Traffic split must sum to 100%');
    }

    if (config.duration > this.MAX_EXPERIMENT_DURATION) {
      throw new Error('Experiment duration exceeds maximum allowed');
    }
  }

  private isUserEligible(config: ExperimentConfig, _userId: string): boolean {
    // Check device targeting
    if (config.deviceTargeting) {
      const deviceInfo = this.getCurrentDeviceInfo();

      if (
        config.deviceTargeting.platforms &&
        !config.deviceTargeting.platforms.includes(deviceInfo.platform as any)
      ) {
        return false;
      }

      if (
        config.deviceTargeting.minCpuCores &&
        deviceInfo.cpuCores < config.deviceTargeting.minCpuCores
      ) {
        return false;
      }

      if (
        config.deviceTargeting.excludeLowEndDevices &&
        deviceInfo.isLowEndDevice
      ) {
        return false;
      }
    }

    // Add more targeting logic as needed
    return true;
  }

  private assignVariant(
    config: ExperimentConfig,
    userId: string,
  ): ExperimentVariant {
    // Use consistent hash-based assignment
    const hash = this.hashUserId(userId + config.id);
    const randomValue = hash % 100;

    let cumulative = 0;
    for (let i = 0; i < config.variants.length; i++) {
      const trafficSplit = config.trafficSplit[i];
      const variant = config.variants[i];

      // Ensure both array elements exist
      if (trafficSplit === undefined || variant === undefined) {
        continue;
      }

      cumulative += trafficSplit;
      if (randomValue < cumulative) {
        return variant.name;
      }
    }

    // Fallback to control
    return 'control';
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private convertToExperimentMetrics(
    metrics: AudioPerformanceMetrics,
  ): ExperimentMetrics {
    // Convert individual metrics to statistical format
    const createStatMetrics = (value: number): StatisticalMetrics => ({
      count: 1,
      sum: value,
      mean: value,
      median: value,
      stdDev: 0,
      min: value,
      max: value,
      p95: value,
      p99: value,
    });

    return {
      latency: createStatMetrics(metrics.latency),
      cpuUsage: createStatMetrics(metrics.cpuUsage),
      memoryUsage: createStatMetrics(metrics.memoryUsage),
      dropoutCount: createStatMetrics(metrics.dropoutCount),
      audioQuality: createStatMetrics(100), // Placeholder
      errorRate: createStatMetrics(0),
      crashRate: createStatMetrics(0),
      recoveryTime: createStatMetrics(0),
    };
  }

  private getCurrentDeviceInfo(): DeviceInfo {
    // Placeholder implementation - would be enhanced with real device detection
    return {
      platform: navigator.platform.toLowerCase().includes('mac')
        ? 'desktop'
        : 'desktop',
      browser: this.detectBrowser(),
      cpuCores: navigator.hardwareConcurrency || 4,
      memoryGB: (navigator as any).deviceMemory || 8,
      isLowEndDevice: false,
      supportedFeatures: [],
    };
  }

  private detectBrowser(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome')) return 'chrome';
    if (userAgent.includes('firefox')) return 'firefox';
    if (userAgent.includes('safari')) return 'safari';
    if (userAgent.includes('edge')) return 'edge';
    return 'unknown';
  }

  private setupMetricsCollection(): void {
    // Set up automatic metrics collection from PerformanceMonitor
    // This would be implemented when the framework is integrated
  }

  private setupPeriodicAnalysis(): void {
    // Set up periodic analysis of running experiments
    setInterval(() => {
      const experimentEntries = Array.from(this.activeExperiments.entries());
      for (const [experimentId, experiment] of experimentEntries) {
        if (experiment.status === 'running') {
          this.analyzeExperiment(experimentId);
        }
      }
    }, 60000); // Analyze every minute
  }

  private setupRollbackMonitoring(experimentId: string): void {
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment) return;

    // Monitor rollback conditions
    const checkInterval = setInterval(() => {
      if (experiment.status !== 'running') {
        clearInterval(checkInterval);
        return;
      }

      this.checkRollbackConditions(experimentId);
    }, 10000); // Check every 10 seconds
  }

  private checkRollbackConditions(experimentId: string): void {
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment || experiment.rollbackTriggered) return;

    const config = experiment.config;
    const results = this.results.get(experimentId) || [];

    // Check each rollback condition
    for (const condition of config.rollbackConditions) {
      if (this.isRollbackConditionMet(condition, results, config)) {
        console.warn(
          `Rollback condition met for experiment ${experimentId}: ${condition.metric} ${condition.operator} ${condition.threshold}`,
        );
        this.rollbackExperiment(experimentId);
        break;
      }
    }
  }

  private isRollbackConditionMet(
    condition: RollbackCondition,
    results: ExperimentResult[],
    _config: ExperimentConfig,
  ): boolean {
    // Get recent results within the condition duration
    const now = Date.now();
    const recentResults = results.filter(
      (r) => now - r.startTime <= condition.duration,
    );

    if (recentResults.length === 0) return false;

    // Calculate average of the metric
    const metricValues = recentResults.map((r) =>
      this.extractMetricValue(r, condition.metric),
    );
    const average =
      metricValues.reduce((sum, val) => sum + val, 0) / metricValues.length;

    // Check condition
    switch (condition.operator) {
      case '>':
        return average > condition.threshold;
      case '<':
        return average < condition.threshold;
      case '>=':
        return average >= condition.threshold;
      case '<=':
        return average <= condition.threshold;
      case '==':
        return Math.abs(average - condition.threshold) < 0.001;
      case '!=':
        return Math.abs(average - condition.threshold) >= 0.001;
      default:
        return false;
    }
  }

  private extractMetricValue(
    result: ExperimentResult,
    metric: keyof AudioPerformanceMetrics,
  ): number {
    // Extract the specific metric value from experiment result
    switch (metric) {
      case 'latency':
        return result.metrics.latency.mean;
      case 'cpuUsage':
        return result.metrics.cpuUsage.mean;
      case 'memoryUsage':
        return result.metrics.memoryUsage.mean;
      case 'dropoutCount':
        return result.metrics.dropoutCount.mean;
      default:
        return 0;
    }
  }

  private analyzeVariant(
    variant: ExperimentVariant,
    results: ExperimentResult[],
    config: ExperimentConfig,
  ): VariantAnalysis {
    if (results.length === 0) {
      throw new Error(`No results found for variant ${variant}`);
    }

    // Calculate aggregated metrics
    const metrics = this.aggregateMetrics(results);

    // Calculate performance score based on primary metric
    const primaryMetricValue = this.getMetricValue(
      metrics,
      config.primaryMetric,
    );
    const performanceScore = this.calculatePerformanceScore(
      primaryMetricValue,
      config,
    );

    return {
      variant,
      sampleSize: results.length,
      metrics,
      conversionRate: this.calculateConversionRate(results),
      confidenceInterval: this.calculateConfidenceInterval(results, config),
      performanceScore,
    };
  }

  private aggregateMetrics(results: ExperimentResult[]): ExperimentMetrics {
    // Aggregate all metrics across results
    const aggregated: ExperimentMetrics = {
      latency: this.aggregateStatMetrics(results.map((r) => r.metrics.latency)),
      cpuUsage: this.aggregateStatMetrics(
        results.map((r) => r.metrics.cpuUsage),
      ),
      memoryUsage: this.aggregateStatMetrics(
        results.map((r) => r.metrics.memoryUsage),
      ),
      dropoutCount: this.aggregateStatMetrics(
        results.map((r) => r.metrics.dropoutCount),
      ),
      audioQuality: this.aggregateStatMetrics(
        results.map((r) => r.metrics.audioQuality),
      ),
      errorRate: this.aggregateStatMetrics(
        results.map((r) => r.metrics.errorRate),
      ),
      crashRate: this.aggregateStatMetrics(
        results.map((r) => r.metrics.crashRate),
      ),
      recoveryTime: this.aggregateStatMetrics(
        results.map((r) => r.metrics.recoveryTime),
      ),
    };

    return aggregated;
  }

  private aggregateStatMetrics(
    metrics: StatisticalMetrics[],
  ): StatisticalMetrics {
    if (metrics.length === 0) {
      return {
        count: 0,
        sum: 0,
        mean: 0,
        median: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        p95: 0,
        p99: 0,
      };
    }

    const values = metrics.flatMap((m) => Array(m.count).fill(m.mean));
    values.sort((a, b) => a - b);

    const count = values.length;
    const sum = values.reduce((s, v) => s + v, 0);
    const mean = sum / count;

    const variance =
      values.reduce((v, val) => v + Math.pow(val - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    const p95Index = Math.floor(count * 0.95);
    const p99Index = Math.floor(count * 0.99);

    return {
      count,
      sum,
      mean,
      median: count > 0 ? (values[Math.floor(count / 2)] ?? 0) : 0,
      stdDev,
      min: count > 0 ? (values[0] ?? 0) : 0,
      max: count > 0 ? (values[count - 1] ?? 0) : 0,
      p95: count > 0 ? (values[p95Index] ?? 0) : 0,
      p99: count > 0 ? (values[p99Index] ?? 0) : 0,
    };
  }

  private getMetricValue(
    metrics: ExperimentMetrics,
    metricName: keyof AudioPerformanceMetrics,
  ): number {
    switch (metricName) {
      case 'latency':
        return metrics.latency.mean;
      case 'cpuUsage':
        return metrics.cpuUsage.mean;
      case 'memoryUsage':
        return metrics.memoryUsage.mean;
      case 'dropoutCount':
        return metrics.dropoutCount.mean;
      default:
        return 0;
    }
  }

  private calculatePerformanceScore(
    metricValue: number,
    config: ExperimentConfig,
  ): number {
    // Simple performance scoring based on metric improvement
    // Lower is better for latency, CPU, memory, dropouts
    const lowerIsBetter = [
      'latency',
      'cpuUsage',
      'memoryUsage',
      'dropoutCount',
    ];
    const isLowerBetter = lowerIsBetter.includes(config.primaryMetric);

    // Use realistic baseline values for different metrics
    let baselineValue: number;
    switch (config.primaryMetric) {
      case 'latency':
        baselineValue = 50; // 50ms baseline latency
        break;
      case 'cpuUsage':
        baselineValue = 60; // 60% baseline CPU usage
        break;
      case 'memoryUsage':
        baselineValue = 1024; // 1GB baseline memory usage
        break;
      case 'dropoutCount':
        baselineValue = 5; // 5 dropouts baseline
        break;
      default:
        baselineValue = 100; // Generic baseline
    }

    // Calculate improvement percentage
    const improvement = isLowerBetter
      ? ((baselineValue - metricValue) / baselineValue) * 100
      : ((metricValue - baselineValue) / baselineValue) * 100;

    // Convert to 0-100 performance score
    // 50 = baseline performance, above 50 = better than baseline
    const performanceScore = 50 + improvement;

    return Math.max(0, Math.min(100, performanceScore));
  }

  private calculateConversionRate(results: ExperimentResult[]): number {
    // Placeholder - would calculate based on success criteria
    return results.length > 0 ? 0.85 : 0;
  }

  private calculateConfidenceInterval(
    results: ExperimentResult[],
    config: ExperimentConfig,
  ): [number, number] {
    // Simplified confidence interval calculation
    if (results.length === 0) return [0, 0];

    const values = results.map((r) =>
      this.getMetricValue(r.metrics, config.primaryMetric),
    );
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((v, val) => v + Math.pow(val - mean, 2), 0) / values.length,
    );

    const marginOfError = 1.96 * (stdDev / Math.sqrt(values.length)); // 95% confidence

    return [mean - marginOfError, mean + marginOfError];
  }

  private calculateStatisticalSignificance(
    variants: Map<ExperimentVariant, VariantAnalysis>,
    config: ExperimentConfig,
  ): { isSignificant: boolean; pValue: number } {
    // Simplified significance testing - would use proper statistical tests
    const variantArray = Array.from(variants.values());
    if (variantArray.length < 2) {
      return { isSignificant: false, pValue: 1.0 };
    }

    // Check if sample sizes are sufficient
    const hasMinSampleSize = variantArray.every(
      (v) => v.sampleSize >= config.minSampleSize,
    );
    if (!hasMinSampleSize) {
      return { isSignificant: false, pValue: 1.0 };
    }

    // Simplified p-value calculation (placeholder)
    const pValue = 0.03; // Would calculate using proper statistical test

    return {
      isSignificant: pValue < 1 - this.DEFAULT_CONFIDENCE_LEVEL,
      pValue,
    };
  }

  private determineWinner(
    variants: Map<ExperimentVariant, VariantAnalysis>,
    config: ExperimentConfig,
  ): { variant: ExperimentVariant; improvementPercent: number } | null {
    const variantArray = Array.from(variants.values());
    if (variantArray.length < 2) return null;

    // Find control variant
    const control = variantArray.find((v) => v.variant === 'control');
    if (!control) return null;

    // Find best performing variant
    const controlScore = control.performanceScore;
    let bestVariant = control;
    let bestImprovement = 0;

    for (const variant of variantArray) {
      if (variant.variant !== 'control') {
        const improvement =
          ((variant.performanceScore - controlScore) / controlScore) * 100;
        if (
          improvement > bestImprovement &&
          improvement >= config.successThreshold
        ) {
          bestVariant = variant;
          bestImprovement = improvement;
        }
      }
    }

    return bestVariant.variant !== 'control'
      ? {
          variant: bestVariant.variant,
          improvementPercent: bestImprovement,
        }
      : null;
  }

  private assessRisk(
    variants: Map<ExperimentVariant, VariantAnalysis>,
    config: ExperimentConfig,
  ): RiskAssessment {
    const riskFactors: string[] = [];
    let overallRisk: 'low' | 'medium' | 'high' = 'low';

    // Check for performance degradation
    const control = Array.from(variants.values()).find(
      (v) => v.variant === 'control',
    );
    if (control) {
      const variantEntries = Array.from(variants.entries());
      for (const [variant, analysis] of variantEntries) {
        if (variant !== 'control') {
          const degradation =
            ((control.performanceScore - analysis.performanceScore) /
              control.performanceScore) *
            100;
          if (degradation > config.maxDegradationPercent) {
            riskFactors.push(
              `${variant} shows ${degradation.toFixed(1)}% performance degradation`,
            );
            overallRisk = 'high';
          }
        }
      }
    }

    // Check error rates
    const variantEntries = Array.from(variants.entries());
    for (const [variant, analysis] of variantEntries) {
      if (analysis.metrics.errorRate.mean > 0.05) {
        // 5% error rate threshold
        riskFactors.push(
          `${variant} has elevated error rate: ${(analysis.metrics.errorRate.mean * 100).toFixed(1)}%`,
        );
        overallRisk = overallRisk === 'high' ? 'high' : 'medium';
      }
    }

    return {
      overallRisk,
      riskFactors,
      mitigationStrategies: this.generateMitigationStrategies(riskFactors),
      rollbackRecommended: overallRisk === 'high',
    };
  }

  private generateMitigationStrategies(riskFactors: string[]): string[] {
    const strategies: string[] = [];

    if (riskFactors.some((f) => f.includes('degradation'))) {
      strategies.push('Implement gradual rollout with performance monitoring');
      strategies.push('Set up automatic rollback triggers');
    }

    if (riskFactors.some((f) => f.includes('error rate'))) {
      strategies.push('Enhanced error logging and alerting');
      strategies.push('Circuit breaker implementation');
    }

    return strategies;
  }

  private generateRecommendations(
    variants: Map<ExperimentVariant, VariantAnalysis>,
    significance: { isSignificant: boolean; pValue: number },
    winner: { variant: ExperimentVariant; improvementPercent: number } | null,
    riskAssessment: RiskAssessment,
    _config: ExperimentConfig,
  ): ExperimentRecommendation[] {
    const recommendations: ExperimentRecommendation[] = [];

    if (riskAssessment.rollbackRecommended) {
      recommendations.push({
        type: 'rollback',
        confidence: 0.9,
        reasoning:
          'High risk detected with significant performance degradation',
        nextSteps: [
          'Immediately rollback experiment',
          'Investigate root cause',
          'Redesign experiment with safety measures',
        ],
      });
    } else if (significance.isSignificant && winner) {
      recommendations.push({
        type: 'deploy',
        confidence: 0.85,
        reasoning: `${winner.variant} shows ${winner.improvementPercent.toFixed(1)}% improvement with statistical significance`,
        nextSteps: [
          'Gradual rollout to 100% traffic',
          'Monitor for 48 hours',
          'Document optimization for future use',
        ],
      });
    } else if (!significance.isSignificant) {
      recommendations.push({
        type: 'extend',
        confidence: 0.7,
        reasoning: 'Results not yet statistically significant, need more data',
        nextSteps: [
          'Continue experiment for longer duration',
          'Increase traffic allocation',
          'Review sample size calculations',
        ],
      });
    } else {
      recommendations.push({
        type: 'iterate',
        confidence: 0.6,
        reasoning:
          'No clear winner found, consider testing more extreme variations',
        nextSteps: [
          'Design follow-up experiment',
          'Test more aggressive optimizations',
          'Segment results by device type',
        ],
      });
    }

    return recommendations;
  }

  // Storage methods (would be implemented with real storage service)

  private loadExperimentsFromStorage(): void {
    // Load experiments from persistent storage
    // Placeholder implementation
  }

  private saveExperimentToStorage(_experimentId: string): void {
    // Save experiment to persistent storage
    // Placeholder implementation
  }

  private saveResultToStorage(
    _experimentId: string,
    _result: ExperimentResult,
  ): void {
    // Save result to persistent storage
    // Placeholder implementation
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    // Clear all intervals and clean up resources
    this.experiments.clear();
    this.activeExperiments.clear();
    this.results.clear();
    this.userAssignments.clear();
  }
}

// Internal interface for experiment state tracking
interface ExperimentState {
  config: ExperimentConfig;
  status: ExperimentStatus;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  participantCount: number;
  currentResults: Map<ExperimentVariant, ExperimentResult[]>;
  rollbackTriggered: boolean;
  lastAnalysis: ExperimentAnalysis | null;
}
