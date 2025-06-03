/**
 * BatteryManager - Battery Usage Monitoring & Power Management
 *
 * Provides comprehensive battery monitoring, usage tracking, and user controls
 * for intelligent power management and optimization recommendations.
 *
 * Part of Story 2.1: Core Audio Engine Foundation - Task 7, Subtask 7.5
 */

import { MobileOptimizer } from './MobileOptimizer.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';
import type {
  BatteryStatus,
  PowerMode,
  UserOptimizationPreferences,
  PerformanceAlert,
  AudioPerformanceMetrics,
} from '../types/audio.js';

export interface BatteryUsageMetrics {
  // Current usage
  currentDrainRate: number; // mAh/hour
  audioSystemDrain: number; // mAh/hour attributed to audio
  estimatedTimeRemaining: number; // minutes

  // Historical data
  averageDrainRate: number; // mAh/hour over session
  totalAudioUsage: number; // mAh used by audio system
  sessionStartBattery: number; // Battery level when session started

  // Efficiency metrics
  audioEfficiency: number; // audio quality per mAh (0-1)
  optimizationSavings: number; // mAh saved through optimizations
  thermalImpact: number; // battery drain from thermal throttling

  // Real-time statistics
  instantaneousPower: number; // Current power draw in watts
  cpuPowerUsage: number; // CPU power usage in watts
  audioPowerUsage: number; // Audio subsystem power usage in watts
  displayPowerUsage: number; // Display power usage in watts

  // Predictive analytics
  projectedSessionTime: number; // minutes until battery depleted
  optimalQualityRecommendation: 'ultra' | 'high' | 'medium' | 'low' | 'minimal';
  suggestedOptimizations: BatteryOptimizationSuggestion[];
}

export interface BatteryOptimizationSuggestion {
  type:
    | 'quality_reduction'
    | 'feature_disable'
    | 'background_optimization'
    | 'thermal_management';
  impact: 'low' | 'medium' | 'high'; // Battery savings impact
  userExperience: 'minimal' | 'moderate' | 'significant'; // UX impact
  estimatedSavings: number; // minutes of battery life
  description: string;
  action: () => void;
}

export interface PowerManagementSettings {
  // Automatic optimization thresholds
  enableAutomaticOptimization: boolean;
  batteryThresholds: {
    enableBatterySaver: number; // Battery % to enable battery saver
    enableAggressiveMode: number; // Battery % for aggressive optimization
    emergencyMode: number; // Battery % for emergency power saving
    chargingOptimization: boolean; // Optimize when charging
  };

  // User preferences
  powerMode: 'performance' | 'balanced' | 'battery_saver' | 'custom';
  qualityVsBatteryPreference: number; // 0 (max battery) to 1 (max quality)
  backgroundOptimizationAllowed: boolean;
  thermalThrottlingEnabled: boolean;

  // Notification settings
  batteryWarningsEnabled: boolean;
  optimizationNotificationsEnabled: boolean;
  usageReportsEnabled: boolean;

  // Custom optimizations
  customOptimizations: {
    reducedPolyphony?: number;
    disableEffects?: boolean;
    lowerSampleRate?: boolean;
    backgroundSuspension?: boolean;
    displayDimming?: boolean;
  };
}

export interface BatteryHistoryEntry {
  timestamp: number;
  batteryLevel: number;
  drainRate: number;
  audioActive: boolean;
  qualityLevel: string;
  powerMode: PowerMode;
  thermalState: string;
  optimizationsActive: string[];
}

export class BatteryManager {
  private static instance: BatteryManager;

  // Core dependencies
  private mobileOptimizer: MobileOptimizer;
  private performanceMonitor: PerformanceMonitor;

  // State tracking
  private isInitialized = false;
  private isMonitoringActive = false;
  private batteryAPI?: any; // Battery API reference

  // Current metrics
  private currentMetrics: BatteryUsageMetrics = {
    currentDrainRate: 0,
    audioSystemDrain: 0,
    estimatedTimeRemaining: 0,
    averageDrainRate: 0,
    totalAudioUsage: 0,
    sessionStartBattery: 1.0,
    audioEfficiency: 1.0,
    optimizationSavings: 0,
    thermalImpact: 0,
    instantaneousPower: 0,
    cpuPowerUsage: 0,
    audioPowerUsage: 0,
    displayPowerUsage: 0,
    projectedSessionTime: 0,
    optimalQualityRecommendation: 'high',
    suggestedOptimizations: [],
  };

  // User settings
  private powerManagementSettings: PowerManagementSettings = {
    enableAutomaticOptimization: true,
    batteryThresholds: {
      enableBatterySaver: 20,
      enableAggressiveMode: 10,
      emergencyMode: 5,
      chargingOptimization: false,
    },
    powerMode: 'balanced',
    qualityVsBatteryPreference: 0.6, // Slightly favor quality
    backgroundOptimizationAllowed: true,
    thermalThrottlingEnabled: true,
    batteryWarningsEnabled: true,
    optimizationNotificationsEnabled: true,
    usageReportsEnabled: true,
    customOptimizations: {},
  };

  // User preferences cache (since MobileOptimizer doesn't expose getter)
  private currentUserPreferences: UserOptimizationPreferences = {
    prioritizeBatteryLife: false,
    prioritizeQuality: false,
    prioritizeStability: true,
    allowBackgroundOptimization: true,
    thermalManagementEnabled: true,
    automaticQualityScaling: true,
  };

  // Historical tracking
  private batteryHistory: BatteryHistoryEntry[] = [];
  private sessionStartTime = Date.now();
  private lastBatteryMeasurement?: { level: number; timestamp: number };

  // Monitoring intervals
  private monitoringInterval?: NodeJS.Timeout;
  private historyInterval?: NodeJS.Timeout;
  private notificationInterval?: NodeJS.Timeout;

  // Event handlers
  private eventHandlers: {
    onBatteryWarning?: (warning: PerformanceAlert) => void;
    onOptimizationRecommendation?: (
      suggestions: BatteryOptimizationSuggestion[],
    ) => void;
    onPowerModeChange?: (mode: PowerMode) => void;
    onUsageReport?: (report: BatteryUsageMetrics) => void;
  } = {};

  // Performance baseline tracking
  private baselinePowerUsage = {
    idle: 0, // Baseline power when audio is off
    minimal: 0, // Power with minimal audio
    typical: 0, // Power with typical settings
    maximum: 0, // Power with maximum quality
  };

  private constructor() {
    this.mobileOptimizer = MobileOptimizer.getInstance();
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.initializeBatteryManager();
  }

  public static getInstance(): BatteryManager {
    if (!BatteryManager.instance) {
      BatteryManager.instance = new BatteryManager();
    }
    return BatteryManager.instance;
  }

  /**
   * Initialize the battery manager
   */
  private async initializeBatteryManager(): Promise<void> {
    try {
      // Initialize Battery API if available
      await this.initializeBatteryAPI();

      // Set session start metrics
      const batteryStatus = await this.mobileOptimizer.getBatteryStatus();
      this.currentMetrics.sessionStartBattery = batteryStatus.level;
      this.sessionStartTime = Date.now();

      // Calculate baseline power usage
      await this.establishPowerBaselines();

      // Start monitoring
      this.startBatteryMonitoring();

      this.isInitialized = true;
      console.log('BatteryManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize BatteryManager:', error);
      // Continue with degraded functionality
      this.isInitialized = true;
    }
  }

  /**
   * Initialize Battery API
   */
  private async initializeBatteryAPI(): Promise<void> {
    try {
      if ('getBattery' in navigator) {
        this.batteryAPI = await (navigator as any).getBattery();

        // Set up battery event listeners
        this.batteryAPI.addEventListener('chargingchange', () => {
          this.handleBatteryChange();
        });

        this.batteryAPI.addEventListener('levelchange', () => {
          this.handleBatteryLevelChange();
        });

        this.batteryAPI.addEventListener('chargingtimechange', () => {
          this.handleBatteryChange();
        });

        this.batteryAPI.addEventListener('dischargingtimechange', () => {
          this.handleBatteryChange();
        });

        console.log('Battery API initialized');
      } else {
        console.warn('Battery API not available - using fallback monitoring');
      }
    } catch (error) {
      console.warn('Battery API initialization failed:', error);
    }
  }

  /**
   * Establish power consumption baselines
   */
  private async establishPowerBaselines(): Promise<void> {
    // This would ideally run calibration tests
    // For now, use estimated values based on device class
    const deviceCapabilities =
      await this.mobileOptimizer.getDeviceCapabilities();

    switch (deviceCapabilities.deviceClass) {
      case 'low-end':
        this.baselinePowerUsage = {
          idle: 0.5, // 0.5W idle
          minimal: 1.0, // 1W minimal audio
          typical: 1.8, // 1.8W typical
          maximum: 2.5, // 2.5W maximum
        };
        break;
      case 'mid-range':
        this.baselinePowerUsage = {
          idle: 0.8,
          minimal: 1.5,
          typical: 2.5,
          maximum: 3.5,
        };
        break;
      case 'high-end':
        this.baselinePowerUsage = {
          idle: 1.0,
          minimal: 2.0,
          typical: 3.0,
          maximum: 4.5,
        };
        break;
      case 'premium':
        this.baselinePowerUsage = {
          idle: 1.2,
          minimal: 2.5,
          typical: 3.8,
          maximum: 5.5,
        };
        break;
    }
  }

  /**
   * Start battery monitoring
   */
  public startBatteryMonitoring(): void {
    if (this.isMonitoringActive) return;

    this.isMonitoringActive = true;

    // Real-time monitoring (every 10 seconds)
    this.monitoringInterval = setInterval(() => {
      this.updateBatteryMetrics();
    }, 10000);

    // History tracking (every minute)
    this.historyInterval = setInterval(() => {
      this.recordBatteryHistory();
    }, 60000);

    // Notification checking (every 30 seconds)
    this.notificationInterval = setInterval(() => {
      this.checkBatteryWarnings();
    }, 30000);

    console.log('Battery monitoring started');
  }

  /**
   * Stop battery monitoring
   */
  public stopBatteryMonitoring(): void {
    if (!this.isMonitoringActive) return;

    this.isMonitoringActive = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.historyInterval) {
      clearInterval(this.historyInterval);
      this.historyInterval = undefined;
    }

    if (this.notificationInterval) {
      clearInterval(this.notificationInterval);
      this.notificationInterval = undefined;
    }

    console.log('Battery monitoring stopped');
  }

  /**
   * Update battery metrics
   */
  private async updateBatteryMetrics(): Promise<void> {
    try {
      const batteryStatus = await this.mobileOptimizer.getBatteryStatus();
      const performanceMetrics = this.performanceMonitor.getMetrics();
      const currentTime = Date.now();

      // Calculate drain rate
      if (this.lastBatteryMeasurement) {
        const timeDelta =
          (currentTime - this.lastBatteryMeasurement.timestamp) / 1000 / 3600; // hours
        const levelDelta =
          this.lastBatteryMeasurement.level - batteryStatus.level;

        if (timeDelta > 0 && levelDelta >= 0) {
          this.currentMetrics.currentDrainRate = (levelDelta / timeDelta) * 100; // %/hour
        }
      }

      // Calculate audio system impact
      this.currentMetrics.audioSystemDrain =
        this.calculateAudioSystemDrain(performanceMetrics);

      // Calculate power usage breakdown
      this.updatePowerUsageBreakdown(performanceMetrics);

      // Update time estimates
      this.updateTimeEstimates(batteryStatus);

      // Generate optimization recommendations
      this.generateOptimizationSuggestions(batteryStatus, performanceMetrics);

      // Store current measurement
      this.lastBatteryMeasurement = {
        level: batteryStatus.level,
        timestamp: currentTime,
      };

      // Trigger automatic optimizations if enabled
      if (this.powerManagementSettings.enableAutomaticOptimization) {
        await this.applyAutomaticOptimizations(batteryStatus);
      }
    } catch (error) {
      console.error('Failed to update battery metrics:', error);
    }
  }

  /**
   * Calculate audio system battery drain
   */
  private calculateAudioSystemDrain(
    performanceMetrics: AudioPerformanceMetrics,
  ): number {
    // Estimate based on CPU usage and quality settings
    const cpuPowerFactor = performanceMetrics.cpuUsage / 100;
    const qualityConfig = this.mobileOptimizer.getCurrentQualityConfig();

    let estimatedDrain = this.baselinePowerUsage.idle;

    // Add CPU-based power usage
    estimatedDrain +=
      cpuPowerFactor *
      (this.baselinePowerUsage.maximum - this.baselinePowerUsage.idle);

    // Quality-based adjustments
    switch (qualityConfig.qualityLevel) {
      case 'ultra':
        estimatedDrain *= 1.2;
        break;
      case 'high':
        estimatedDrain *= 1.0;
        break;
      case 'medium':
        estimatedDrain *= 0.8;
        break;
      case 'low':
        estimatedDrain *= 0.6;
        break;
      case 'minimal':
        estimatedDrain *= 0.4;
        break;
    }

    // Effects and processing adjustments
    if (qualityConfig.enableEffects) estimatedDrain *= 1.1;
    if (qualityConfig.enableVisualization) estimatedDrain *= 1.05;
    if (qualityConfig.backgroundProcessing) estimatedDrain *= 1.08;

    return estimatedDrain;
  }

  /**
   * Update power usage breakdown
   */
  private updatePowerUsageBreakdown(
    _performanceMetrics: AudioPerformanceMetrics,
  ): void {
    const totalPower = this.currentMetrics.audioSystemDrain;

    // Estimate breakdown (these would be more accurate with actual hardware monitoring)
    this.currentMetrics.cpuPowerUsage = totalPower * 0.6; // CPU typically 60% of audio power
    this.currentMetrics.audioPowerUsage = totalPower * 0.25; // Audio hardware 25%
    this.currentMetrics.displayPowerUsage = totalPower * 0.15; // Display updates 15%
    this.currentMetrics.instantaneousPower = totalPower;
  }

  /**
   * Update time estimates
   */
  private updateTimeEstimates(batteryStatus: BatteryStatus): void {
    if (this.currentMetrics.currentDrainRate > 0) {
      this.currentMetrics.estimatedTimeRemaining =
        ((batteryStatus.level * 100) / this.currentMetrics.currentDrainRate) *
        60; // minutes

      this.currentMetrics.projectedSessionTime =
        this.currentMetrics.estimatedTimeRemaining -
        (this.currentMetrics.audioSystemDrain /
          this.currentMetrics.currentDrainRate) *
          60;
    }
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(
    batteryStatus: BatteryStatus,
    performanceMetrics: AudioPerformanceMetrics,
  ): void {
    const suggestions: BatteryOptimizationSuggestion[] = [];
    const qualityConfig = this.mobileOptimizer.getCurrentQualityConfig();

    // Quality reduction suggestions
    if (batteryStatus.level < 0.3 && qualityConfig.qualityLevel !== 'minimal') {
      suggestions.push({
        type: 'quality_reduction',
        impact: 'high',
        userExperience: 'moderate',
        estimatedSavings: 30,
        description:
          'Reduce audio quality to extend battery life by ~30 minutes',
        action: () => this.applyQualityReduction(),
      });
    }

    // Effects disable suggestions
    if (batteryStatus.level < 0.2 && qualityConfig.enableEffects) {
      suggestions.push({
        type: 'feature_disable',
        impact: 'medium',
        userExperience: 'minimal',
        estimatedSavings: 15,
        description: 'Disable audio effects to save battery (~15 minutes)',
        action: () => this.disableEffects(),
      });
    }

    // Background optimization
    if (batteryStatus.level < 0.15 && !qualityConfig.aggressiveBatteryMode) {
      suggestions.push({
        type: 'background_optimization',
        impact: 'high',
        userExperience: 'minimal',
        estimatedSavings: 45,
        description: 'Enable aggressive battery mode for maximum efficiency',
        action: () => this.enableAggressiveBatteryMode(),
      });
    }

    // Thermal management
    if (performanceMetrics && performanceMetrics.cpuUsage > 80) {
      suggestions.push({
        type: 'thermal_management',
        impact: 'medium',
        userExperience: 'minimal',
        estimatedSavings: 20,
        description:
          'Enable thermal throttling to reduce heat and power consumption',
        action: () => this.enableThermalThrottling(),
      });
    }

    this.currentMetrics.suggestedOptimizations = suggestions;

    // Notify if suggestions changed significantly
    if (
      suggestions.length > 0 &&
      this.eventHandlers.onOptimizationRecommendation
    ) {
      this.eventHandlers.onOptimizationRecommendation(suggestions);
    }
  }

  /**
   * Apply automatic optimizations based on battery level
   */
  private async applyAutomaticOptimizations(
    batteryStatus: BatteryStatus,
  ): Promise<void> {
    const thresholds = this.powerManagementSettings.batteryThresholds;
    const batteryPercent = batteryStatus.level * 100;

    // Emergency mode
    if (batteryPercent <= thresholds.emergencyMode) {
      await this.enableEmergencyMode();
    }
    // Aggressive mode
    else if (batteryPercent <= thresholds.enableAggressiveMode) {
      await this.enableAggressiveBatteryMode();
    }
    // Battery saver mode
    else if (batteryPercent <= thresholds.enableBatterySaver) {
      await this.enableBatterySaverMode();
    }

    // Charging optimizations
    if (batteryStatus.charging && thresholds.chargingOptimization) {
      await this.enableChargingOptimizations();
    }
  }

  /**
   * Record battery history entry
   */
  private async recordBatteryHistory(): Promise<void> {
    try {
      const batteryStatus = await this.mobileOptimizer.getBatteryStatus();
      const qualityConfig = this.mobileOptimizer.getCurrentQualityConfig();
      const performanceMetrics = this.performanceMonitor.getMetrics();

      const entry: BatteryHistoryEntry = {
        timestamp: Date.now(),
        batteryLevel: batteryStatus.level,
        drainRate: this.currentMetrics.currentDrainRate,
        audioActive: performanceMetrics.cpuUsage > 10,
        qualityLevel: qualityConfig.qualityLevel,
        powerMode: batteryStatus.powerMode,
        thermalState: 'nominal', // Would get from thermal monitor
        optimizationsActive: this.getActiveOptimizations(),
      };

      this.batteryHistory.push(entry);

      // Keep only last 24 hours of history
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      this.batteryHistory = this.batteryHistory.filter(
        (e) => e.timestamp > oneDayAgo,
      );
    } catch (error) {
      console.error('Failed to record battery history:', error);
    }
  }

  /**
   * Check for battery warnings
   */
  private async checkBatteryWarnings(): Promise<void> {
    if (!this.powerManagementSettings.batteryWarningsEnabled) return;

    try {
      const batteryStatus = await this.mobileOptimizer.getBatteryStatus();
      const batteryPercent = batteryStatus.level * 100;

      // Critical battery warning
      if (batteryPercent <= 5 && !batteryStatus.charging) {
        const alert: PerformanceAlert = {
          type: 'memory', // Using closest available type
          severity: 'critical',
          message: `Critical battery level: ${batteryPercent.toFixed(1)}%. Consider charging immediately.`,
          metrics: {},
          timestamp: Date.now(),
        };

        if (this.eventHandlers.onBatteryWarning) {
          this.eventHandlers.onBatteryWarning(alert);
        }
      }
      // Low battery warning
      else if (batteryPercent <= 15 && !batteryStatus.charging) {
        const alert: PerformanceAlert = {
          type: 'memory',
          severity: 'warning',
          message: `Low battery: ${batteryPercent.toFixed(1)}%. Consider enabling battery optimizations.`,
          metrics: {},
          timestamp: Date.now(),
        };

        if (this.eventHandlers.onBatteryWarning) {
          this.eventHandlers.onBatteryWarning(alert);
        }
      }
    } catch (error) {
      console.error('Failed to check battery warnings:', error);
    }
  }

  /**
   * Handle battery change events
   */
  private handleBatteryChange(): void {
    // Trigger immediate metrics update
    this.updateBatteryMetrics();
  }

  /**
   * Handle battery level change events
   */
  private handleBatteryLevelChange(): void {
    // Trigger immediate metrics update and check warnings
    this.updateBatteryMetrics();
    this.checkBatteryWarnings();
  }

  /**
   * Get active optimizations
   */
  private getActiveOptimizations(): string[] {
    const optimizations: string[] = [];
    const qualityConfig = this.mobileOptimizer.getCurrentQualityConfig();

    if (qualityConfig.aggressiveBatteryMode)
      optimizations.push('aggressive_battery');
    if (qualityConfig.thermalManagement)
      optimizations.push('thermal_management');
    if (qualityConfig.backgroundAudioReduction)
      optimizations.push('background_reduction');
    if (!qualityConfig.enableEffects) optimizations.push('effects_disabled');
    if (!qualityConfig.enableVisualization)
      optimizations.push('visualization_disabled');

    return optimizations;
  }

  // User control methods

  /**
   * Apply quality reduction
   */
  private async applyQualityReduction(): Promise<void> {
    this.currentUserPreferences.prioritizeBatteryLife = true;
    this.currentUserPreferences.prioritizeQuality = false;
    this.mobileOptimizer.setUserPreferences(this.currentUserPreferences);
    await this.mobileOptimizer.optimizeForCurrentConditions();
  }

  /**
   * Disable effects
   */
  private async disableEffects(): Promise<void> {
    // This would integrate with the audio engine to disable effects
    console.log('Disabling audio effects for battery savings');
  }

  /**
   * Enable aggressive battery mode
   */
  private async enableAggressiveBatteryMode(): Promise<void> {
    this.currentUserPreferences.prioritizeBatteryLife = true;
    this.currentUserPreferences.prioritizeQuality = false;
    this.currentUserPreferences.prioritizeStability = false;
    this.mobileOptimizer.setUserPreferences(this.currentUserPreferences);
    await this.mobileOptimizer.optimizeForCurrentConditions();
  }

  /**
   * Enable battery saver mode
   */
  private async enableBatterySaverMode(): Promise<void> {
    this.powerManagementSettings.powerMode = 'battery_saver';
    await this.enableAggressiveBatteryMode();
  }

  /**
   * Enable emergency mode
   */
  private async enableEmergencyMode(): Promise<void> {
    this.powerManagementSettings.powerMode = 'battery_saver';
    this.powerManagementSettings.customOptimizations = {
      reducedPolyphony: 2,
      disableEffects: true,
      lowerSampleRate: true,
      backgroundSuspension: true,
      displayDimming: true,
    };
    await this.enableAggressiveBatteryMode();
  }

  /**
   * Enable thermal throttling
   */
  private async enableThermalThrottling(): Promise<void> {
    this.currentUserPreferences.thermalManagementEnabled = true;
    this.mobileOptimizer.setUserPreferences(this.currentUserPreferences);
    await this.mobileOptimizer.optimizeForCurrentConditions();
  }

  /**
   * Enable charging optimizations
   */
  private async enableChargingOptimizations(): Promise<void> {
    // When charging, we can be less aggressive with optimizations
    this.currentUserPreferences.prioritizeBatteryLife = false;
    this.currentUserPreferences.prioritizeQuality = true;
    this.mobileOptimizer.setUserPreferences(this.currentUserPreferences);
    await this.mobileOptimizer.optimizeForCurrentConditions();
  }

  // Public API methods

  /**
   * Get current battery metrics
   */
  public getBatteryMetrics(): BatteryUsageMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Get power management settings
   */
  public getPowerManagementSettings(): PowerManagementSettings {
    return { ...this.powerManagementSettings };
  }

  /**
   * Update power management settings
   */
  public updatePowerManagementSettings(
    settings: Partial<PowerManagementSettings>,
  ): void {
    this.powerManagementSettings = {
      ...this.powerManagementSettings,
      ...settings,
    };

    // Apply immediate changes if needed
    if (
      settings.powerMode &&
      settings.powerMode !== this.powerManagementSettings.powerMode
    ) {
      this.applyPowerMode(settings.powerMode);
    }
  }

  /**
   * Update user preferences (for external use)
   */
  public updateUserPreferences(
    preferences: Partial<UserOptimizationPreferences>,
  ): void {
    this.currentUserPreferences = {
      ...this.currentUserPreferences,
      ...preferences,
    };
    this.mobileOptimizer.setUserPreferences(this.currentUserPreferences);
  }

  /**
   * Get current user preferences
   */
  public getUserPreferences(): UserOptimizationPreferences {
    return { ...this.currentUserPreferences };
  }

  /**
   * Apply power mode
   */
  private async applyPowerMode(
    mode: PowerManagementSettings['powerMode'],
  ): Promise<void> {
    switch (mode) {
      case 'performance':
        this.currentUserPreferences.prioritizeQuality = true;
        this.currentUserPreferences.prioritizeBatteryLife = false;
        this.currentUserPreferences.prioritizeStability = false;
        break;
      case 'balanced':
        this.currentUserPreferences.prioritizeQuality = false;
        this.currentUserPreferences.prioritizeBatteryLife = false;
        this.currentUserPreferences.prioritizeStability = true;
        break;
      case 'battery_saver':
        this.currentUserPreferences.prioritizeQuality = false;
        this.currentUserPreferences.prioritizeBatteryLife = true;
        this.currentUserPreferences.prioritizeStability = false;
        break;
      case 'custom':
        // Use current settings
        break;
    }

    this.mobileOptimizer.setUserPreferences(this.currentUserPreferences);
    await this.mobileOptimizer.optimizeForCurrentConditions();

    if (this.eventHandlers.onPowerModeChange) {
      this.eventHandlers.onPowerModeChange(mode as PowerMode);
    }
  }

  /**
   * Get battery history
   */
  public getBatteryHistory(hours = 6): BatteryHistoryEntry[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.batteryHistory.filter((entry) => entry.timestamp > cutoff);
  }

  /**
   * Generate usage report
   */
  public generateUsageReport(): {
    sessionDuration: number;
    totalBatteryUsed: number;
    averagePowerUsage: number;
    audioEfficiency: number;
    optimizationSavings: number;
    recommendations: string[];
  } {
    const sessionDuration = (Date.now() - this.sessionStartTime) / 1000 / 60; // minutes
    const totalBatteryUsed =
      (this.currentMetrics.sessionStartBattery -
        this.currentMetrics.estimatedTimeRemaining / 100) *
      100;

    const recommendations: string[] = [];

    // Generate recommendations based on usage patterns
    if (this.currentMetrics.audioEfficiency < 0.6) {
      recommendations.push(
        'Consider using lower quality settings for better battery efficiency',
      );
    }

    if (this.currentMetrics.thermalImpact > 0.3) {
      recommendations.push(
        'Enable thermal management to reduce heat-related battery drain',
      );
    }

    if (this.currentMetrics.currentDrainRate > 15) {
      // 15%/hour is high
      recommendations.push(
        'Current power usage is high - enable battery optimizations',
      );
    }

    return {
      sessionDuration,
      totalBatteryUsed,
      averagePowerUsage: this.currentMetrics.averageDrainRate,
      audioEfficiency: this.currentMetrics.audioEfficiency,
      optimizationSavings: this.currentMetrics.optimizationSavings,
      recommendations,
    };
  }

  /**
   * Set event handlers
   */
  public setEventHandlers(handlers: Partial<typeof this.eventHandlers>): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Force optimization application
   */
  public async applyOptimization(
    suggestion: BatteryOptimizationSuggestion,
  ): Promise<void> {
    try {
      suggestion.action();

      // Update savings estimate
      this.currentMetrics.optimizationSavings += suggestion.estimatedSavings;

      console.log(`Applied battery optimization: ${suggestion.description}`);
    } catch (error) {
      console.error('Failed to apply battery optimization:', error);
    }
  }

  /**
   * Reset to default power settings
   */
  public async resetPowerSettings(): Promise<void> {
    this.powerManagementSettings = {
      enableAutomaticOptimization: true,
      batteryThresholds: {
        enableBatterySaver: 20,
        enableAggressiveMode: 10,
        emergencyMode: 5,
        chargingOptimization: false,
      },
      powerMode: 'balanced',
      qualityVsBatteryPreference: 0.6,
      backgroundOptimizationAllowed: true,
      thermalThrottlingEnabled: true,
      batteryWarningsEnabled: true,
      optimizationNotificationsEnabled: true,
      usageReportsEnabled: true,
      customOptimizations: {},
    };

    await this.applyPowerMode('balanced');
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.stopBatteryMonitoring();

    // Remove battery API event listeners
    if (this.batteryAPI) {
      this.batteryAPI.removeEventListener(
        'chargingchange',
        this.handleBatteryChange,
      );
      this.batteryAPI.removeEventListener(
        'levelchange',
        this.handleBatteryLevelChange,
      );
      this.batteryAPI.removeEventListener(
        'chargingtimechange',
        this.handleBatteryChange,
      );
      this.batteryAPI.removeEventListener(
        'dischargingtimechange',
        this.handleBatteryChange,
      );
    }

    this.isInitialized = false;
    console.log('BatteryManager disposed');
  }
}
