/**
 * QualityScaler - Real-time Adaptive Audio Quality Management
 *
 * Provides dynamic, real-time quality adaptation based on changing performance
 * conditions. Builds upon MobileOptimizer's static device configurations to
 * add temporal/adaptive behavior.
 *
 * Key Features:
 * - Real-time performance monitoring integration
 * - Predictive quality management based on trends
 * - Smooth quality transitions to prevent audio artifacts
 * - User preference integration within hardware constraints
 * - Battery-aware and thermal-aware optimization
 * - Emergency fallback mechanisms
 * - A/B testing integration for optimization experiments
 *
 * Part of Story 2.1 Task 12.3: QualityScaler implementation
 */

import {
  AdaptiveQualityConfig,
  QualityLevel,
  QualityAdaptationRules,
  QualityAdaptationStrategy as _QualityAdaptationStrategy,
  QualityAdaptationSpeed,
  QualityAdjustmentHistory,
  QualityAdjustmentTrigger,
  QualityScalingMetrics,
  QualityPredictionState,
  QualityScalerConfig,
  QualityScalerEvents,
  AudioPerformanceMetrics,
  BatteryStatus,
  ThermalState as _ThermalState,
  UserOptimizationPreferences,
} from '../types/audio.js';

import { PerformanceMonitor } from './PerformanceMonitor.js';
import { BatteryManager } from './BatteryManager.js';
import { MobileOptimizer } from './MobileOptimizer.js';
import { QualityTransitionManager } from './QualityTransitionManager.js';
import {
  NetworkLatencyMonitor,
  type NetworkLatencyMetrics,
  type NetworkCondition,
} from './NetworkLatencyMonitor.js';
import {
  CacheMetricsCollector,
  type CachePerformanceMetrics,
} from './CacheMetricsCollector.js';

export class QualityScaler {
  private static instance: QualityScaler;

  // Core dependencies
  private performanceMonitor: PerformanceMonitor;
  private batteryManager: BatteryManager;
  private mobileOptimizer: MobileOptimizer;
  private transitionManager: QualityTransitionManager;
  private networkLatencyMonitor: NetworkLatencyMonitor;
  private cacheMetricsCollector: CacheMetricsCollector;

  // Current quality state
  private currentQualityConfig: AdaptiveQualityConfig;
  private targetQualityConfig: AdaptiveQualityConfig;
  private qualityHistory: QualityAdjustmentHistory[] = [];
  private isInitialized = false;

  // Configuration
  private config: QualityScalerConfig = {
    enabled: true,
    monitoringInterval: 1000, // Check conditions every second
    performanceMonitoringEnabled: true,
    batteryMonitoringEnabled: true,
    thermalMonitoringEnabled: true,
    networkMonitoringEnabled: true,
    adaptationRules: this.createDefaultAdaptationRules(),
    enablePredictiveOptimization: true,
    enableEmergencyFallbacks: true,
    enableUserFeedbackIntegration: true,
    maxConcurrentTransitions: 1,
    transitionTimeoutMs: 5000,
    enableCrossfading: true,
    rollbackTimeoutMs: 2000,
    enableMetricsCollection: true,
    metricsRetentionPeriod: 300000, // 5 minutes
    enableDetailedLogging: false,
    performanceLogLevel: 'standard',
    enableABTesting: true,
    abTestingFrameworkEnabled: true,
    experimentalFeatures: [],
    emergencyModeThresholds: {
      batteryLevel: 0.05, // 5%
      cpuUsage: 0.95, // 95%
      memoryPressure: 0.9, // 90%
      thermalState: 'critical',
    },
  };

  // Real-time adaptation state
  private adaptationTimer: NodeJS.Timeout | null = null;
  private lastAdaptationTime = 0;
  private isEmergencyMode = false;
  private emergencyStartTime = 0;

  // Predictive state
  private predictionState: QualityPredictionState = {
    performanceTrend: 'stable',
    batteryTrend: 'stable',
    thermalTrend: 'stable',
    predictedQualityNeed: 'medium',
    predictionConfidence: 0.5,
    timeToAction: 0,
    performanceHistory: [],
    batteryHistory: [],
    latencyHistory: [],
    anticipatedEvents: [],
  };

  // Metrics collection
  private metrics: QualityScalingMetrics = {
    totalAdaptations: 0,
    successfulAdaptations: 0,
    failedAdaptations: 0,
    rollbackCount: 0,
    averageQualityLevel: 0,
    qualityStability: 1.0,
    qualityVariance: 0,
    timeInOptimalQuality: 0,
    averageLatencyImprovement: 0,
    averageDropoutReduction: 0,
    averageCpuSavings: 0,
    averageBatteryExtension: 0,
    userSatisfactionScore: 0.8,
    userManualOverrides: 0,
    userComplaintRate: 0,
    adaptationResponseTime: 200,
    predictionAccuracy: 0.7,
    emergencyActivations: 0,
    sessionDuration: 0,
    lastUpdated: Date.now(),
    deviceClass: 'mid-range',
  };

  // Event system
  private eventHandlers: Map<
    keyof QualityScalerEvents,
    Set<(...args: any[]) => void>
  > = new Map();

  private constructor() {
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.batteryManager = BatteryManager.getInstance();
    this.mobileOptimizer = MobileOptimizer.getInstance();
    this.transitionManager = QualityTransitionManager.getInstance();
    this.networkLatencyMonitor = NetworkLatencyMonitor.getInstance();
    this.cacheMetricsCollector = CacheMetricsCollector.getInstance();

    // Initialize with default quality configuration
    this.currentQualityConfig = this.createDefaultQualityConfig();
    this.targetQualityConfig = { ...this.currentQualityConfig };
  }

  public static getInstance(): QualityScaler {
    if (!QualityScaler.instance) {
      QualityScaler.instance = new QualityScaler();
    }
    return QualityScaler.instance;
  }

  /**
   * Initialize the quality scaler
   */
  public async initialize(
    config?: Partial<QualityScalerConfig>,
  ): Promise<void> {
    if (this.isInitialized) {
      console.warn('QualityScaler already initialized');
      return;
    }

    // Apply configuration overrides
    if (config) {
      this.config = { ...this.config, ...config };
    }

    try {
      // Get initial quality configuration from MobileOptimizer
      const deviceOptimization =
        await this.mobileOptimizer.optimizeForCurrentConditions();
      this.currentQualityConfig = deviceOptimization.qualityConfig;
      this.targetQualityConfig = { ...this.currentQualityConfig };

      // Set up event listeners
      this.setupEventListeners();

      // Start monitoring if enabled
      if (this.config.enabled) {
        this.startAdaptationLoop();
      }

      this.isInitialized = true;
      this.metrics.sessionDuration = Date.now();

      console.log('QualityScaler initialized successfully');
      this.emit('configurationChanged', this.config);
    } catch (error) {
      console.error('Failed to initialize QualityScaler:', error);
      throw error;
    }
  }

  /**
   * Get current quality configuration
   */
  public getCurrentQualityConfig(): AdaptiveQualityConfig {
    return { ...this.currentQualityConfig };
  }

  /**
   * Get current metrics
   */
  public getMetrics(): QualityScalingMetrics {
    return { ...this.metrics };
  }

  /**
   * Manually adjust quality level
   */
  public async adjustQuality(
    qualityLevel: QualityLevel,
    userPreferences?: Partial<UserOptimizationPreferences>,
  ): Promise<boolean> {
    try {
      const newConfig = this.createQualityConfigForLevel(
        qualityLevel,
        userPreferences,
      );
      const validatedConfig = this.validateConfigWithConstraints(newConfig);

      const success = await this.executeQualityTransition(
        this.currentQualityConfig,
        validatedConfig,
        'user_preference',
        'smooth',
      );

      if (success) {
        this.metrics.userManualOverrides++;
      }

      return success;
    } catch (error) {
      console.error('Failed to adjust quality:', error);
      return false;
    }
  }

  /**
   * Activate emergency mode for critical conditions
   */
  public async activateEmergencyMode(
    trigger: QualityAdjustmentTrigger,
  ): Promise<void> {
    if (this.isEmergencyMode) {
      console.warn('Emergency mode already active');
      return;
    }

    try {
      const emergencyConfig = this.createEmergencyQualityConfig();
      const success = await this.executeQualityTransition(
        this.currentQualityConfig,
        emergencyConfig,
        trigger,
        'immediate',
      );

      if (success) {
        this.isEmergencyMode = true;
        this.emergencyStartTime = Date.now();
        this.metrics.emergencyActivations++;

        this.emit('emergencyModeActivated', trigger, emergencyConfig);
        console.log(
          `Emergency mode activated due to: ${this.getTriggerReason(trigger)}`,
        );
      }
    } catch (error) {
      console.error('Failed to activate emergency mode:', error);
    }
  }

  /**
   * Deactivate emergency mode and return to normal operation
   */
  public async deactivateEmergencyMode(): Promise<void> {
    if (!this.isEmergencyMode) {
      console.warn('Emergency mode not currently active');
      return;
    }

    try {
      // Assess current conditions to determine recovery quality level
      const batteryStatus = await this.mobileOptimizer.getBatteryStatus();
      const performanceMetrics = this.performanceMonitor.getMetrics();
      const conditions = this.assessCurrentConditions(
        performanceMetrics,
        batteryStatus,
      );

      let recoveryQualityLevel: QualityLevel = 'medium';
      if (conditions.overallCondition === 'excellent') {
        recoveryQualityLevel = 'high';
      } else if (conditions.overallCondition === 'good') {
        recoveryQualityLevel = 'medium';
      } else {
        recoveryQualityLevel = 'low';
      }

      const recoveryConfig =
        this.createQualityConfigForLevel(recoveryQualityLevel);
      const success = await this.executeQualityTransition(
        this.currentQualityConfig,
        recoveryConfig,
        'emergency_fallback',
        'gradual',
      );

      if (success) {
        this.isEmergencyMode = false;
        this.emergencyStartTime = 0;

        this.emit('emergencyModeDeactivated', recoveryConfig);
        console.log(
          'Emergency mode deactivated, returning to normal operation',
        );
      }
    } catch (error) {
      console.error('Failed to deactivate emergency mode:', error);
    }
  }

  /**
   * Main adaptation cycle - runs periodically to assess and adapt quality
   */
  private async runAdaptationCycle(): Promise<void> {
    if (!this.isInitialized || !this.config.enabled) return;

    try {
      const now = Date.now();

      // Throttle adaptation frequency
      if (
        now - this.lastAdaptationTime <
        this.config.adaptationRules.stabilizationPeriod
      ) {
        return;
      }

      // Get current system conditions including network and cache metrics
      const performanceMetrics = this.performanceMonitor.getMetrics();
      const batteryStatus = await this.mobileOptimizer.getBatteryStatus();
      const networkMetrics = this.networkLatencyMonitor.getMetrics();
      const cacheMetrics = this.cacheMetricsCollector.getMetrics();
      const conditions = this.assessCurrentConditions(
        performanceMetrics,
        batteryStatus,
        networkMetrics,
        cacheMetrics,
      );

      // Update prediction state
      this.updatePredictionState(conditions);

      // Check for emergency conditions
      if (
        this.shouldActivateEmergencyMode(conditions) &&
        !this.isEmergencyMode
      ) {
        await this.activateEmergencyMode(this.determineTrigger(conditions));
        return;
      }

      // Calculate optimal quality configuration
      const optimalConfig = await this.assessOptimalQuality();

      // Check if adaptation is needed
      if (this.shouldAdaptQuality(this.currentQualityConfig, optimalConfig)) {
        const trigger = this.determineTrigger(conditions);
        const speed = this.selectAdaptationSpeed(trigger, conditions);

        const success = await this.executeQualityTransition(
          this.currentQualityConfig,
          optimalConfig,
          trigger,
          speed,
        );

        if (success) {
          this.lastAdaptationTime = now;
          this.metrics.successfulAdaptations++;
        } else {
          this.metrics.failedAdaptations++;
        }

        this.metrics.totalAdaptations++;
      }

      // Update metrics
      this.updateMetrics();
      this.updateSessionMetrics();
      this.cleanupHistoryIfNeeded();
    } catch (error) {
      console.error('Error in adaptation cycle:', error);
    }
  }

  /**
   * Assess optimal quality configuration based on current conditions
   */
  private async assessOptimalQuality(): Promise<AdaptiveQualityConfig> {
    const performanceMetrics = this.performanceMonitor.getMetrics();
    const batteryStatus = await this.mobileOptimizer.getBatteryStatus();
    const networkMetrics = this.networkLatencyMonitor.getMetrics();
    const cacheMetrics = this.cacheMetricsCollector.getMetrics();

    // Start with current configuration
    let optimalConfig = { ...this.currentQualityConfig };

    // Apply performance optimizations
    optimalConfig = this.applyPerformanceOptimizations(
      optimalConfig,
      performanceMetrics,
    );

    // Apply battery optimizations
    optimalConfig = this.applyBatteryOptimizations(
      optimalConfig,
      batteryStatus,
    );

    // Apply network-aware optimizations
    optimalConfig = this.applyNetworkOptimizations(
      optimalConfig,
      networkMetrics,
    );

    // Apply cache-aware optimizations
    optimalConfig = this.applyCacheOptimizations(optimalConfig, cacheMetrics);

    // Apply predictive optimizations
    optimalConfig = this.applyPredictiveOptimizations(optimalConfig);

    // Validate constraints
    optimalConfig = this.validateConfigWithConstraints(optimalConfig);

    return optimalConfig;
  }

  /**
   * Execute a quality transition
   */
  private async executeQualityTransition(
    fromConfig: AdaptiveQualityConfig,
    toConfig: AdaptiveQualityConfig,
    trigger: QualityAdjustmentTrigger,
    speed: QualityAdaptationSpeed,
  ): Promise<boolean> {
    try {
      // Create quality adjustment history entry
      const transitionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const adjustmentHistory: QualityAdjustmentHistory = {
        id: transitionId,
        timestamp: Date.now(),
        fromQuality: fromConfig.qualityLevel,
        toQuality: toConfig.qualityLevel,
        fromConfig,
        toConfig,
        trigger,
        triggerReason: this.getTriggerReason(trigger),
        triggerMetrics: this.performanceMonitor.getMetrics(),
        transitionDuration: 0, // Will be updated after transition
        transitionSuccess: false, // Will be updated after transition
        transitionMethod: 'crossfade',
        performanceImprovement: this.calculatePerformanceImprovement(
          fromConfig,
          toConfig,
        ),
        stabilityImprovement: 0, // Simplified for now
        batteryImpact: this.calculateBatteryImpact(fromConfig, toConfig),
        deviceContext: {
          batteryLevel: (await this.mobileOptimizer.getBatteryStatus()).level,
          thermalState: 'nominal',
          networkQuality: 'good',
          userActivity: 'active',
        },
        rollbackReason: undefined,
        rollbackTime: undefined,
      };

      // Record start time
      const startTime = Date.now();

      // Start the transition
      const transitionState = await this.transitionManager.startTransition(
        fromConfig,
        toConfig,
        speed,
        this.getTriggerReason(trigger),
      );

      // Wait for transition completion with timeout
      const transitionPromise = new Promise<boolean>((resolve) => {
        const checkCompletion = () => {
          if (!transitionState.inTransition) {
            resolve(true);
          } else if (Date.now() - startTime > this.config.transitionTimeoutMs) {
            resolve(false);
          } else {
            setTimeout(checkCompletion, 100);
          }
        };
        checkCompletion();
      });

      const success = await transitionPromise;

      // Update history entry
      adjustmentHistory.transitionDuration = Date.now() - startTime;
      adjustmentHistory.transitionSuccess = success;

      if (success) {
        // Update current configuration
        this.currentQualityConfig = { ...toConfig };
        this.targetQualityConfig = { ...toConfig };

        // Emit events
        this.emit(
          'qualityChanged',
          fromConfig,
          toConfig,
          trigger,
          adjustmentHistory,
        );
        this.emit('transitionCompleted', transitionState, true);

        console.log(
          `Quality transition completed: ${fromConfig.qualityLevel} → ${toConfig.qualityLevel}`,
        );
      } else {
        // Handle failed transition
        this.metrics.rollbackCount++;
        adjustmentHistory.rollbackReason = 'Transition timeout';
        adjustmentHistory.rollbackTime = Date.now();

        this.emit(
          'transitionFailed',
          new Error('Transition timeout'),
          fromConfig,
        );
        console.warn('Quality transition failed, rolling back');
      }

      // Add to history
      this.qualityHistory.push(adjustmentHistory);

      return success;
    } catch (error) {
      console.error('Error executing quality transition:', error);
      this.emit('adaptationFailed', error as Error, toConfig, fromConfig);
      return false;
    }
  }

  /**
   * Assess current system conditions for adaptation decisions
   */
  private assessCurrentConditions(
    performanceMetrics: AudioPerformanceMetrics,
    batteryStatus: BatteryStatus,
    networkMetrics?: NetworkLatencyMetrics,
    cacheMetrics?: CachePerformanceMetrics,
  ): {
    performanceScore: number;
    batteryScore: number;
    thermalScore: number;
    networkScore: number;
    cacheScore: number;
    overallCondition: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    shouldAdapt: boolean;
    networkCondition?: NetworkCondition;
  } {
    const rules = this.config.adaptationRules;

    // Performance assessment (0-1, higher is better)
    let performanceScore = 1.0;
    if (
      performanceMetrics.cpuUsage > rules.performanceThresholds.cpuUsageCritical
    ) {
      performanceScore = 0.1;
    } else if (
      performanceMetrics.cpuUsage > rules.performanceThresholds.cpuUsageHigh
    ) {
      performanceScore = 0.3;
    } else if (
      performanceMetrics.cpuUsage > rules.performanceThresholds.cpuUsageLow
    ) {
      performanceScore = 0.7;
    }

    // Battery assessment (0-1, higher is better)
    let batteryScore = batteryStatus.level;
    if (batteryStatus.charging) {
      batteryScore = Math.min(1.0, batteryScore * 1.2); // Boost score when charging
    }

    // Thermal assessment (simplified - would integrate with thermal monitor)
    const thermalScore = performanceMetrics.cpuUsage < 0.8 ? 1.0 : 0.5;

    // Network assessment (0-1, higher is better)
    let networkScore = 0.8; // Default good network
    let networkCondition: NetworkCondition = 'good';
    if (networkMetrics) {
      networkCondition = networkMetrics.networkCondition;
      switch (networkCondition) {
        case 'excellent':
          networkScore = 1.0;
          break;
        case 'good':
          networkScore = 0.8;
          break;
        case 'fair':
          networkScore = 0.6;
          break;
        case 'poor':
          networkScore = 0.4;
          break;
        case 'critical':
          networkScore = 0.2;
          break;
      }
    }

    // Cache assessment (0-1, higher is better)
    let cacheScore = 0.8; // Default good cache performance
    if (cacheMetrics) {
      // Base score on hit rate and memory usage
      const hitRateScore = cacheMetrics.hitRate;
      const memoryPressure = Math.min(
        1.0,
        cacheMetrics.memoryUsage / (100 * 1024 * 1024),
      ); // Assume 100MB max
      const memoryScore = 1.0 - memoryPressure;
      cacheScore = hitRateScore * 0.7 + memoryScore * 0.3;
    }

    // Overall condition assessment (include network and cache in calculation)
    const averageScore =
      (performanceScore +
        batteryScore +
        thermalScore +
        networkScore +
        cacheScore) /
      5;
    let overallCondition: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

    if (averageScore > 0.8) overallCondition = 'excellent';
    else if (averageScore > 0.6) overallCondition = 'good';
    else if (averageScore > 0.4) overallCondition = 'fair';
    else if (averageScore > 0.2) overallCondition = 'poor';
    else overallCondition = 'critical';

    const shouldAdapt =
      averageScore < 0.6 ||
      performanceMetrics.cpuUsage > rules.performanceThresholds.cpuUsageHigh ||
      networkScore < 0.6 ||
      cacheScore < 0.6;

    return {
      performanceScore,
      batteryScore,
      thermalScore,
      networkScore,
      cacheScore,
      overallCondition,
      shouldAdapt,
      networkCondition,
    };
  }

  /**
   * Update prediction state based on current conditions
   */
  private updatePredictionState(conditions: any): void {
    const now = Date.now();

    // Update performance trend
    this.predictionState.performanceHistory.push(conditions.performanceScore);

    // Update battery trend
    this.predictionState.batteryHistory.push(conditions.batteryScore);

    // Update latency history
    this.predictionState.latencyHistory.push(50 / conditions.performanceScore);

    // Keep only recent history (last 5 minutes) to prevent memory leaks
    const _fiveMinutesAgo = now - 300000; // Time-based cleanup reference

    // Size-based cleanup - prevent unbounded memory growth
    // Keep last 300 entries (5 minutes at 1-second intervals)
    this.cleanupPredictionHistoryData();

    // Calculate trends
    this.predictionState.performanceTrend = this.calculateTrend(
      this.predictionState.performanceHistory,
    );
    this.predictionState.batteryTrend = this.calculateTrend(
      this.predictionState.batteryHistory,
    );

    // Update prediction confidence based on data quality
    const dataPoints = Math.min(
      this.predictionState.performanceHistory.length,
      10,
    );
    this.predictionState.predictionConfidence = Math.min(0.9, dataPoints * 0.1);

    // Predict optimal quality need
    if (
      conditions.overallCondition === 'critical' ||
      conditions.overallCondition === 'poor'
    ) {
      this.predictionState.predictedQualityNeed = 'low';
    } else if (conditions.overallCondition === 'fair') {
      this.predictionState.predictedQualityNeed = 'medium';
    } else {
      this.predictionState.predictedQualityNeed = 'high';
    }

    // Calculate time to action (when adaptation should occur)
    this.predictionState.timeToAction =
      this.predictionState.performanceTrend === 'degrading' ? 2000 : 5000;
  }

  /**
   * Clean up prediction history data to prevent memory leaks
   * Maintains bounded memory usage for long-running sessions
   */
  private cleanupPredictionHistoryData(): void {
    const maxEntries = 300; // 5 minutes at 1-second sampling

    if (this.predictionState.performanceHistory.length > maxEntries) {
      this.predictionState.performanceHistory =
        this.predictionState.performanceHistory.slice(-maxEntries);
    }
    if (this.predictionState.batteryHistory.length > maxEntries) {
      this.predictionState.batteryHistory =
        this.predictionState.batteryHistory.slice(-maxEntries);
    }
    if (this.predictionState.latencyHistory.length > maxEntries) {
      this.predictionState.latencyHistory =
        this.predictionState.latencyHistory.slice(-maxEntries);
    }
  }

  /**
   * Calculate trend from a series of values
   */
  private calculateTrend(
    values: number[],
  ): 'improving' | 'stable' | 'degrading' {
    if (values.length < 3) return 'stable';

    const recent = values.slice(-3);
    const older = values.slice(-6, -3);

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    if (change > 0.05) return 'improving';
    else if (change < -0.05) return 'degrading';
    else return 'stable';
  }

  /**
   * Determine if emergency mode should be activated
   */
  private shouldActivateEmergencyMode(conditions: any): boolean {
    const thresholds = this.config.emergencyModeThresholds;

    return (
      conditions.batteryScore < thresholds.batteryLevel ||
      conditions.performanceScore < 1 - thresholds.cpuUsage ||
      conditions.overallCondition === 'critical'
    );
  }

  /**
   * Determine if quality adaptation is needed
   */
  private shouldAdaptQuality(
    current: AdaptiveQualityConfig,
    optimal: AdaptiveQualityConfig,
  ): boolean {
    // Check if significant difference exists
    const qualityLevelDifference =
      this.getQualityLevelValue(optimal.qualityLevel) -
      this.getQualityLevelValue(current.qualityLevel);
    const bufferSizeDifference =
      Math.abs(optimal.bufferSize - current.bufferSize) / current.bufferSize;
    const effectsDifference = current.enableEffects !== optimal.enableEffects;

    return (
      Math.abs(qualityLevelDifference) >= 1 ||
      bufferSizeDifference > 0.2 ||
      effectsDifference
    );
  }

  /**
   * Determine the trigger reason for adaptation
   */
  private determineTrigger(conditions: any): QualityAdjustmentTrigger {
    if (conditions.overallCondition === 'critical') {
      return 'emergency_fallback';
    } else if (conditions.batteryScore < 0.2) {
      return 'battery_low';
    } else if (conditions.performanceScore < 0.3) {
      return 'performance_degradation';
    } else if (this.predictionState.performanceTrend === 'degrading') {
      return 'predictive_optimization';
    } else {
      return 'periodic_optimization';
    }
  }

  /**
   * Select appropriate adaptation speed based on trigger and conditions
   */
  private selectAdaptationSpeed(
    trigger: QualityAdjustmentTrigger,
    conditions: any,
  ): QualityAdaptationSpeed {
    switch (trigger) {
      case 'emergency_fallback':
        return 'immediate';
      case 'battery_low':
      case 'performance_degradation':
        return 'gradual';
      case 'thermal_throttling':
        return 'immediate';
      case 'user_preference':
        return 'smooth';
      default:
        return conditions.overallCondition === 'poor' ? 'gradual' : 'smooth';
    }
  }

  /**
   * Apply performance-based optimizations to quality config
   */
  private applyPerformanceOptimizations(
    config: AdaptiveQualityConfig,
    metrics: AudioPerformanceMetrics,
  ): AdaptiveQualityConfig {
    const optimized = { ...config };
    const rules = this.config.adaptationRules;

    // CPU-based optimizations
    if (metrics.cpuUsage > rules.performanceThresholds.cpuUsageHigh) {
      optimized.cpuThrottling = Math.min(optimized.cpuThrottling * 1.2, 1.0);
      optimized.maxPolyphony = Math.max(
        Math.floor(optimized.maxPolyphony * 0.8),
        2,
      );

      if (metrics.cpuUsage > rules.performanceThresholds.cpuUsageCritical) {
        optimized.enableEffects = false;
        optimized.enableVisualization = false;
        optimized.qualityLevel = 'low';
      }
    }

    // Latency-based optimizations
    if (metrics.latency > rules.performanceThresholds.latencyHigh) {
      optimized.bufferSize = Math.min(optimized.bufferSize * 1.5, 2048);
    } else if (
      metrics.latency < rules.performanceThresholds.latencyLow &&
      optimized.bufferSize > 128
    ) {
      optimized.bufferSize = Math.max(optimized.bufferSize * 0.8, 128);
    }

    return optimized;
  }

  /**
   * Apply battery-focused optimizations to quality config
   */
  private applyBatteryOptimizations(
    config: AdaptiveQualityConfig,
    status: BatteryStatus,
  ): AdaptiveQualityConfig {
    const optimized = { ...config };
    const rules = this.config.adaptationRules;

    if (status.level < rules.performanceThresholds.batteryLow) {
      optimized.aggressiveBatteryMode = true;
      optimized.backgroundAudioReduction = true;
      optimized.displayOptimization = true;

      if (status.level < rules.performanceThresholds.batteryVeryLow) {
        optimized.enableEffects = false;
        optimized.enableVisualization = false;
        optimized.backgroundProcessing = false;
        optimized.qualityLevel = 'minimal';
      }
    } else if (status.charging) {
      // When charging, we can be less aggressive
      optimized.aggressiveBatteryMode = false;
    }

    return optimized;
  }

  /**
   * Apply network-aware optimizations based on latency and network conditions
   * This is the main integration point for NetworkLatencyMonitor
   */
  private applyNetworkOptimizations(
    config: AdaptiveQualityConfig,
    networkMetrics: NetworkLatencyMetrics,
  ): AdaptiveQualityConfig {
    const optimizedConfig = { ...config };
    const networkCondition: NetworkCondition = networkMetrics.networkCondition;

    // Apply quality reductions for poor network conditions
    switch (networkCondition) {
      case 'critical':
        // Critical network - minimal quality for connectivity
        optimizedConfig.sampleRate = Math.min(
          optimizedConfig.sampleRate,
          22050,
        );
        optimizedConfig.compressionRatio = Math.max(
          optimizedConfig.compressionRatio,
          0.7,
        );
        optimizedConfig.bufferSize = Math.max(optimizedConfig.bufferSize, 1024);
        optimizedConfig.maxPolyphony = Math.min(
          optimizedConfig.maxPolyphony,
          4,
        );
        optimizedConfig.enableVisualization = false;
        optimizedConfig.backgroundProcessing = false;
        break;

      case 'poor':
        // Poor network - significant reductions
        optimizedConfig.sampleRate = Math.min(
          optimizedConfig.sampleRate,
          44100,
        );
        optimizedConfig.compressionRatio = Math.max(
          optimizedConfig.compressionRatio,
          0.5,
        );
        optimizedConfig.bufferSize = Math.max(optimizedConfig.bufferSize, 512);
        optimizedConfig.maxPolyphony = Math.min(
          optimizedConfig.maxPolyphony,
          6,
        );
        optimizedConfig.enableVisualization = false;
        break;

      case 'fair':
        // Fair network - moderate reductions
        optimizedConfig.compressionRatio = Math.max(
          optimizedConfig.compressionRatio,
          0.3,
        );
        optimizedConfig.bufferSize = Math.max(optimizedConfig.bufferSize, 256);
        optimizedConfig.maxPolyphony = Math.min(
          optimizedConfig.maxPolyphony,
          8,
        );
        break;

      case 'good':
      case 'excellent':
        // Good/excellent network - allow higher quality
        optimizedConfig.sampleRate = Math.max(
          optimizedConfig.sampleRate,
          44100,
        );
        optimizedConfig.enableVisualization = true;
        optimizedConfig.backgroundProcessing = true;
        break;
    }

    // High latency optimizations
    if (networkMetrics.currentLatency > 300) {
      optimizedConfig.bufferSize = Math.max(optimizedConfig.bufferSize, 512);
    }

    return optimizedConfig;
  }

  /**
   * Apply cache-aware optimizations based on cache performance
   * This is the main integration point for CacheMetricsCollector
   */
  private applyCacheOptimizations(
    config: AdaptiveQualityConfig,
    cacheMetrics: CachePerformanceMetrics,
  ): AdaptiveQualityConfig {
    const optimizedConfig = { ...config };

    // Poor cache performance - reduce quality for better loading
    if (cacheMetrics.hitRate < 0.3) {
      // Very poor cache hit rate - aggressive optimization
      optimizedConfig.compressionRatio = Math.max(
        optimizedConfig.compressionRatio,
        0.6,
      );
      optimizedConfig.bufferSize = Math.max(optimizedConfig.bufferSize, 512);
      optimizedConfig.backgroundProcessing = false;
    } else if (cacheMetrics.hitRate < 0.6) {
      // Moderate cache hit rate - some optimization
      optimizedConfig.compressionRatio = Math.max(
        optimizedConfig.compressionRatio,
        0.4,
      );
      optimizedConfig.bufferSize = Math.max(optimizedConfig.bufferSize, 256);
    }

    // Memory pressure from cache usage
    const memoryPressure = cacheMetrics.memoryUsage / (1024 * 1024 * 100); // Assume 100MB max
    if (memoryPressure > 0.8) {
      optimizedConfig.maxPolyphony = Math.min(optimizedConfig.maxPolyphony, 6);
      optimizedConfig.enableVisualization = false;
    }

    return optimizedConfig;
  }

  /**
   * Apply predictive optimizations based on trends
   */
  private applyPredictiveOptimizations(
    config: AdaptiveQualityConfig,
  ): AdaptiveQualityConfig {
    if (!this.config.enablePredictiveOptimization) return config;

    const optimized = { ...config };

    // Preemptive optimization based on trends
    if (this.predictionState.performanceTrend === 'degrading') {
      optimized.cpuThrottling = Math.min(optimized.cpuThrottling * 1.1, 1.0);

      if (this.predictionState.predictionConfidence > 0.7) {
        optimized.bufferSize = Math.min(optimized.bufferSize * 1.2, 1024);
      }
    }

    if (this.predictionState.batteryTrend === 'degrading') {
      optimized.aggressiveBatteryMode = true;
    }

    return optimized;
  }

  /**
   * Create quality configuration for a specific quality level
   */
  private createQualityConfigForLevel(
    level: QualityLevel,
    prefs?: Partial<UserOptimizationPreferences>,
  ): AdaptiveQualityConfig {
    const baseConfig = this.mobileOptimizer.getCurrentQualityConfig();
    const deviceCapabilities = this.mobileOptimizer.getDeviceCapabilities();

    const levelConfigs = {
      minimal: {
        sampleRate: 22050,
        bufferSize: 1024,
        bitDepth: 16,
        compressionRatio: 0.4,
        maxPolyphony: 2,
        enableEffects: false,
        enableVisualization: false,
        backgroundProcessing: false,
        cpuThrottling: 0.3,
        aggressiveBatteryMode: true,
        estimatedBatteryImpact: 0.2,
        estimatedCpuUsage: 0.2,
      },
      low: {
        sampleRate: 44100,
        bufferSize: 512,
        bitDepth: 16,
        compressionRatio: 0.6,
        maxPolyphony: 4,
        enableEffects: false,
        enableVisualization: false,
        backgroundProcessing: true,
        cpuThrottling: 0.5,
        aggressiveBatteryMode: true,
        estimatedBatteryImpact: 0.3,
        estimatedCpuUsage: 0.3,
      },
      medium: {
        sampleRate: 44100,
        bufferSize: 256,
        bitDepth: 16,
        compressionRatio: 0.7,
        maxPolyphony: 8,
        enableEffects: true,
        enableVisualization: false,
        backgroundProcessing: true,
        cpuThrottling: 0.7,
        aggressiveBatteryMode: false,
        estimatedBatteryImpact: 0.5,
        estimatedCpuUsage: 0.5,
      },
      high: {
        sampleRate: 48000,
        bufferSize: 256,
        bitDepth: 24,
        compressionRatio: 0.8,
        maxPolyphony: 12,
        enableEffects: true,
        enableVisualization: true,
        backgroundProcessing: true,
        cpuThrottling: 0.8,
        aggressiveBatteryMode: false,
        estimatedBatteryImpact: 0.7,
        estimatedCpuUsage: 0.7,
      },
      ultra: {
        sampleRate: 48000,
        bufferSize: 128,
        bitDepth: 24,
        compressionRatio: 0.9,
        maxPolyphony: 16,
        enableEffects: true,
        enableVisualization: true,
        backgroundProcessing: true,
        cpuThrottling: 0.9,
        aggressiveBatteryMode: false,
        estimatedBatteryImpact: 0.9,
        estimatedCpuUsage: 0.9,
      },
    };

    const levelConfig = levelConfigs[level];

    return {
      ...baseConfig,
      ...levelConfig,
      qualityLevel: level,
      memoryLimit: Math.max(256, deviceCapabilities.memoryGB * 1024 * 0.3),
      thermalManagement: prefs?.thermalManagementEnabled ?? true,
      backgroundAudioReduction:
        prefs?.prioritizeBatteryLife ?? levelConfig.aggressiveBatteryMode,
      displayOptimization:
        prefs?.prioritizeBatteryLife ?? levelConfig.aggressiveBatteryMode,
    };
  }

  /**
   * Validate and constrain configuration within device limits
   */
  private validateConfigWithConstraints(
    config: AdaptiveQualityConfig,
  ): AdaptiveQualityConfig {
    const deviceCapabilities = this.mobileOptimizer.getDeviceCapabilities();
    const validated = { ...config };

    // Constrain memory usage
    validated.memoryLimit = Math.min(
      config.memoryLimit,
      deviceCapabilities.memoryGB * 1024,
    );

    // Constrain buffer size to reasonable limits
    validated.bufferSize = Math.max(128, Math.min(config.bufferSize, 2048));

    // Constrain polyphony based on device class
    const maxPolyphonyByClass = {
      'low-end': 4,
      'mid-range': 8,
      'high-end': 12,
      premium: 16,
    };
    const maxPolyphony =
      maxPolyphonyByClass[deviceCapabilities.deviceClass] || 8;
    validated.maxPolyphony = Math.min(config.maxPolyphony, maxPolyphony);

    // Constrain sample rate to supported values
    const supportedRates = [22050, 44100, 48000];
    validated.sampleRate = supportedRates.reduce((prev, curr) =>
      Math.abs(curr - config.sampleRate) < Math.abs(prev - config.sampleRate)
        ? curr
        : prev,
    );

    return validated;
  }

  /**
   * Create emergency quality configuration for crisis situations
   */
  private createEmergencyQualityConfig(): AdaptiveQualityConfig {
    return this.createQualityConfigForLevel('minimal', {
      prioritizeBatteryLife: true,
      prioritizeQuality: false,
      prioritizeStability: true,
      thermalManagementEnabled: true,
      automaticQualityScaling: true,
    });
  }

  /**
   * Get human-readable reason for quality adjustment trigger
   */
  private getTriggerReason(trigger: QualityAdjustmentTrigger): string {
    const reasons = {
      performance_degradation:
        'System performance degraded, reducing quality to maintain stability',
      battery_low: 'Low battery detected, optimizing for battery life',
      thermal_throttling: 'Device overheating, applying thermal management',
      network_slow: 'Network conditions degraded, adjusting for connectivity',
      user_preference: 'User requested quality adjustment',
      predictive_optimization:
        'Anticipating performance issues based on trends',
      emergency_fallback:
        'Emergency mode activated due to critical system conditions',
      periodic_optimization: 'Routine optimization based on current conditions',
    };

    return reasons[trigger] || 'Quality optimization requested';
  }

  /**
   * Calculate performance improvement from quality change
   */
  private calculatePerformanceImprovement(
    from: AdaptiveQualityConfig,
    to: AdaptiveQualityConfig,
  ): number {
    const fromScore =
      this.getQualityLevelValue(from.qualityLevel) * from.cpuThrottling;
    const toScore =
      this.getQualityLevelValue(to.qualityLevel) * to.cpuThrottling;

    return Math.max(0, (fromScore - toScore) / fromScore);
  }

  /**
   * Calculate battery impact from quality change
   */
  private calculateBatteryImpact(
    from: AdaptiveQualityConfig,
    to: AdaptiveQualityConfig,
  ): number {
    return to.estimatedBatteryImpact - from.estimatedBatteryImpact;
  }

  /**
   * Get numeric value for quality level comparison
   */
  private getQualityLevelValue(level: QualityLevel): number {
    const values = { minimal: 1, low: 2, medium: 3, high: 4, ultra: 5 };
    return values[level] || 3;
  }

  /**
   * Clean up old history entries to prevent memory bloat
   */
  private cleanupHistoryIfNeeded(): void {
    const maxHistoryEntries = 100;
    const retentionPeriod = this.config.metricsRetentionPeriod;
    const now = Date.now();

    // Clean up quality history
    this.qualityHistory = this.qualityHistory
      .filter((entry) => now - entry.timestamp <= retentionPeriod)
      .slice(-maxHistoryEntries);

    // Clean up prediction state history
    const historyAge = now - retentionPeriod;
    this.predictionState.performanceHistory =
      this.predictionState.performanceHistory.filter((h) => h > historyAge);
    this.predictionState.batteryHistory =
      this.predictionState.batteryHistory.filter((h) => h > historyAge);
    this.predictionState.latencyHistory =
      this.predictionState.latencyHistory.filter((h) => h > historyAge);
  }

  /**
   * Update internal metrics based on current state
   */
  private updateMetrics(): void {
    const now = Date.now();
    this.metrics.lastUpdated = now;

    // Update session duration
    this.metrics.sessionDuration = now - this.metrics.sessionDuration;

    // Calculate quality stability (lower variance = more stable)
    if (this.qualityHistory.length > 1) {
      const qualityValues = this.qualityHistory.map((h) =>
        this.getQualityLevelValue(h.toConfig.qualityLevel),
      );
      const avg =
        qualityValues.reduce((a, b) => a + b, 0) / qualityValues.length;
      const variance =
        qualityValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
        qualityValues.length;

      this.metrics.averageQualityLevel = avg;
      this.metrics.qualityVariance = variance;
      this.metrics.qualityStability = 1.0 - Math.min(variance / 4, 1.0); // Normalize variance
    }

    // Update adaptation response time
    if (this.qualityHistory.length > 0) {
      const recentTransitions = this.qualityHistory.slice(-10);
      const responseTimes = recentTransitions.map(
        (h) => h.transitionDuration || 200,
      );
      this.metrics.adaptationResponseTime =
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }

    // Update prediction accuracy (simplified)
    this.metrics.predictionAccuracy = this.predictionState.predictionConfidence;

    // Emit metrics update event
    this.emit('metricsUpdated', this.metrics);
  }

  /**
   * Update session-level metrics
   */
  private updateSessionMetrics(): void {
    const currentConfig = this.currentQualityConfig;
    const optimalLevel = this.getQualityLevelValue('high'); // Assume 'high' is optimal
    const currentLevel = this.getQualityLevelValue(currentConfig.qualityLevel);

    // Calculate time in optimal quality
    const isOptimalQuality = currentLevel >= optimalLevel * 0.8;
    const timeWindow = 60000; // 1 minute window

    if (isOptimalQuality) {
      this.metrics.timeInOptimalQuality = Math.min(
        100,
        this.metrics.timeInOptimalQuality +
          (timeWindow / this.metrics.sessionDuration) * 100,
      );
    }

    // Update user satisfaction based on quality stability and performance
    const stabilityScore = this.metrics.qualityStability;
    const qualityScore = currentLevel / 5; // Normalize to 0-1
    this.metrics.userSatisfactionScore =
      stabilityScore * 0.4 + qualityScore * 0.6;
  }

  /**
   * Handle performance alerts from PerformanceMonitor
   */
  private handlePerformanceAlert(alert: any): void {
    if (alert.severity === 'critical') {
      this.activateEmergencyMode('performance_degradation');
    } else if (alert.severity === 'warning') {
      // Trigger proactive optimization
      setTimeout(() => this.runAdaptationCycle(), 1000);
    }
  }

  /**
   * Update performance history for trend analysis
   */
  private updatePerformanceHistory(metrics: AudioPerformanceMetrics): void {
    const now = Date.now();

    this.predictionState.performanceHistory.push(metrics.cpuUsage);
    this.predictionState.batteryHistory.push(
      (metrics.cpuUsage + metrics.memoryUsage) / 2,
    );
    this.predictionState.latencyHistory.push(metrics.latency);

    // Keep only recent history
    const maxAge = now - 300000; // 5 minutes
    this.predictionState.performanceHistory =
      this.predictionState.performanceHistory.filter((h) => h > maxAge);
    this.predictionState.batteryHistory =
      this.predictionState.batteryHistory.filter((h) => h > maxAge);
    this.predictionState.latencyHistory =
      this.predictionState.latencyHistory.filter((h) => h > maxAge);
  }

  /**
   * Handle battery status changes
   */
  private handleBatteryStatusChange(status: BatteryStatus): void {
    // Trigger optimization on low battery or when charging status changes
    if (status.level < 0.3 || status.charging) {
      setTimeout(() => this.runAdaptationCycle(), 500);
    }

    // Update battery history
    this.predictionState.batteryHistory.push(status.level);
  }

  /**
   * Handle power mode changes
   */
  private handlePowerModeChange(powerMode: any): void {
    // Adjust adaptation rules based on power mode
    if (powerMode === 'battery_saver') {
      this.config.adaptationRules.performanceThresholds.batteryLow = 0.3;
      this.config.adaptationRules.adaptationStrategy = 'conservative';
    } else if (powerMode === 'performance') {
      this.config.adaptationRules.performanceThresholds.batteryLow = 0.1;
      this.config.adaptationRules.adaptationStrategy = 'aggressive';
    } else {
      // Balanced mode
      this.config.adaptationRules.performanceThresholds.batteryLow = 0.2;
      this.config.adaptationRules.adaptationStrategy = 'balanced';
    }

    // Trigger re-optimization with new rules
    setTimeout(() => this.runAdaptationCycle(), 100);
  }

  /**
   * Set up event listeners for performance and battery monitoring
   * Uses the correct subscription methods available on each component
   */
  private setupEventListeners(): void {
    // Performance monitoring using onAlert and onMetrics callbacks
    this.performanceMonitor.onAlert((alert: any) => {
      this.handlePerformanceAlert(alert);
    });

    this.performanceMonitor.onMetrics((metrics: AudioPerformanceMetrics) => {
      this.updatePerformanceHistory(metrics);
    });

    // Battery monitoring - TODO: implement when BatteryManager event system is ready
    // this.batteryManager.onStatusChange((status: BatteryStatus) => {
    //   this.handleBatteryStatusChange(status);
    // });
  }

  /**
   * Start the adaptation monitoring loop
   */
  private startAdaptationLoop(): void {
    if (this.adaptationTimer) {
      clearInterval(this.adaptationTimer);
    }

    this.adaptationTimer = setInterval(() => {
      this.runAdaptationCycle();
    }, this.config.monitoringInterval);
  }

  /**
   * Stop the adaptation monitoring loop
   */
  private stopAdaptationLoop(): void {
    if (this.adaptationTimer) {
      clearInterval(this.adaptationTimer);
      this.adaptationTimer = null;
    }
  }

  // Event system implementation
  public on<K extends keyof QualityScalerEvents>(
    event: K,
    handler: QualityScalerEvents[K],
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.add(handler);
    }

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  private emit<K extends keyof QualityScalerEvents>(
    event: K,
    ...args: Parameters<QualityScalerEvents[K]>
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          (handler as any)(...args);
        } catch (error) {
          console.error(
            `Error in QualityScaler event handler for ${event}:`,
            error,
          );
        }
      });
    }
  }

  /**
   * Dispose of resources and stop monitoring
   */
  public dispose(): void {
    this.stopAdaptationLoop();
    this.cleanupHistoryIfNeeded();
    this.eventHandlers.clear();
    this.isInitialized = false;
  }

  /**
   * Create default adaptation rules configuration
   */
  private createDefaultAdaptationRules(): QualityAdaptationRules {
    return {
      performanceThresholds: {
        cpuUsageHigh: 0.8,
        cpuUsageLow: 0.4,
        cpuUsageCritical: 0.95,
        latencyHigh: 100,
        latencyLow: 30,
        latencyCritical: 200,
        memoryPressureHigh: 0.8,
        memoryPressureLow: 0.4,
        memoryPressureCritical: 0.95,
        dropoutRateHigh: 5,
        dropoutRateLow: 1,
        dropoutRateCritical: 10,
        batteryLow: 0.3,
        batteryVeryLow: 0.15,
        batteryCritical: 0.05,
      },
      adaptationStrategy: 'balanced',
      adaptationSpeed: 'gradual',
      minQualityLevel: 'minimal',
      maxQualityLevel: 'ultra',
      allowTemporaryDegradation: true,
      evaluationInterval: 1000,
      stabilizationPeriod: 5000,
      emergencyResponseTime: 100,
      trendAnalysisWindow: 30000,
      performanceTrendWeight: 0.7,
      batteryTrendWeight: 0.8,
      respectUserPreferences: true,
      userPreferenceWeight: 0.6,
      allowUserOverrides: false,
    };
  }

  /**
   * Create default quality configuration
   */
  private createDefaultQualityConfig(): AdaptiveQualityConfig {
    return {
      sampleRate: 44100,
      bufferSize: 512,
      bitDepth: 16,
      compressionRatio: 0.8,
      maxPolyphony: 8,
      enableEffects: true,
      enableVisualization: true,
      backgroundProcessing: true,
      cpuThrottling: 0.7,
      memoryLimit: 512,
      thermalManagement: true,
      aggressiveBatteryMode: false,
      backgroundAudioReduction: false,
      displayOptimization: false,
      qualityLevel: 'medium',
      estimatedBatteryImpact: 0.5,
      estimatedCpuUsage: 0.6,
    };
  }
}
