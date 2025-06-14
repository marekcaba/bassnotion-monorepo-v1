/**
 * Performance Tuner & Mobile Optimizer
 *
 * Provides performance tuning and mobile-specific optimizations for the BassNotion asset pipeline
 * Part of Story 2.2: Task 7, Subtask 7.5
 */

import { AssetManager } from '../AssetManager.js';
import { N8nAssetPipelineProcessor } from './N8nAssetPipelineProcessor.js';
import { InstrumentAssetOptimizer } from './InstrumentAssetOptimizer.js';
import { MusicalContextAnalyzer } from './MusicalContextAnalyzer.js';

interface PerformanceProfile {
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'lowend';
  networkSpeed: 'slow' | 'medium' | 'fast';
  batteryLevel?: number;
  thermalState?: 'nominal' | 'fair' | 'serious' | 'critical';
  memoryPressure?: 'low' | 'medium' | 'high';
}

interface OptimizationStrategy {
  id: string;
  name: string;
  targetDevices: string[];
  networkRequirements: string[];
  assetReductions: {
    quality: number; // 0.1 to 1.0
    compression: number; // 0.1 to 1.0
    cacheAggression: number; // 0.1 to 1.0
    prefetchLimit: number; // Max assets to prefetch
  };
  instrumentOptimizations: {
    samplePoolSize: number;
    voicePolyphony: number;
    effectsQuality: 'minimal' | 'standard' | 'premium';
    bufferSize: number;
  };
}

interface PerformanceMetrics {
  frameRate: number;
  audioLatency: number;
  memoryUsage: number;
  networkUtilization: number;
  batteryDrain: number;
  thermalLoad: number;
}

export class PerformanceTunerOptimizer {
  private assetManager: AssetManager;
  private pipelineProcessor: N8nAssetPipelineProcessor;
  private assetOptimizer: InstrumentAssetOptimizer;
  private musicalAnalyzer: MusicalContextAnalyzer;

  private currentProfile: PerformanceProfile;
  private activeStrategy: OptimizationStrategy;
  private performanceMetrics: PerformanceMetrics;
  private optimizationHistory: any[] = [];
  private performanceRecommendations: string[] = [];

  private strategies: OptimizationStrategy[] = [
    {
      id: 'mobile-aggressive',
      name: 'Mobile Battery Saver',
      targetDevices: ['mobile', 'lowend'],
      networkRequirements: ['slow', 'medium'],
      assetReductions: {
        quality: 0.4,
        compression: 0.8,
        cacheAggression: 0.9,
        prefetchLimit: 3,
      },
      instrumentOptimizations: {
        samplePoolSize: 8,
        voicePolyphony: 4,
        effectsQuality: 'minimal',
        bufferSize: 2048,
      },
    },
    {
      id: 'mobile-balanced',
      name: 'Mobile Balanced',
      targetDevices: ['mobile', 'tablet'],
      networkRequirements: ['medium', 'fast'],
      assetReductions: {
        quality: 0.7,
        compression: 0.6,
        cacheAggression: 0.7,
        prefetchLimit: 8,
      },
      instrumentOptimizations: {
        samplePoolSize: 16,
        voicePolyphony: 8,
        effectsQuality: 'standard',
        bufferSize: 1024,
      },
    },
    {
      id: 'desktop-performance',
      name: 'Desktop Performance',
      targetDevices: ['desktop'],
      networkRequirements: ['medium', 'fast'],
      assetReductions: {
        quality: 1.0,
        compression: 0.3,
        cacheAggression: 0.5,
        prefetchLimit: 20,
      },
      instrumentOptimizations: {
        samplePoolSize: 32,
        voicePolyphony: 16,
        effectsQuality: 'premium',
        bufferSize: 256,
      },
    },
    {
      id: 'emergency-thermal',
      name: 'Thermal Protection',
      targetDevices: ['mobile', 'tablet', 'desktop'],
      networkRequirements: ['slow', 'medium', 'fast'],
      assetReductions: {
        quality: 0.2,
        compression: 0.9,
        cacheAggression: 0.95,
        prefetchLimit: 1,
      },
      instrumentOptimizations: {
        samplePoolSize: 4,
        voicePolyphony: 2,
        effectsQuality: 'minimal',
        bufferSize: 4096,
      },
    },
  ];

  constructor(
    assetManager: AssetManager,
    pipelineProcessor: N8nAssetPipelineProcessor,
    assetOptimizer: InstrumentAssetOptimizer,
    musicalAnalyzer: MusicalContextAnalyzer,
  ) {
    this.assetManager = assetManager;
    this.pipelineProcessor = pipelineProcessor;
    this.assetOptimizer = assetOptimizer;
    this.musicalAnalyzer = musicalAnalyzer;

    this.currentProfile = this.detectPerformanceProfile();
    this.activeStrategy = this.selectOptimalStrategy();
    this.performanceMetrics = this.initializeMetrics();

    console.log('🚀 Performance Tuner & Mobile Optimizer initialized:', {
      profile: this.currentProfile,
      strategy: this.activeStrategy.name,
    });

    this.startPerformanceMonitoring();
  }

  /**
   * Detect current device and network performance profile
   */
  private detectPerformanceProfile(): PerformanceProfile {
    const userAgent = navigator.userAgent.toLowerCase();
    const connection = (navigator as any).connection;
    const _battery = (navigator as any).getBattery?.();

    // Device detection
    let deviceType: PerformanceProfile['deviceType'] = 'desktop';
    if (userAgent.includes('mobile')) deviceType = 'mobile';
    else if (userAgent.includes('tablet') || userAgent.includes('ipad'))
      deviceType = 'tablet';

    // Low-end device detection
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as any).deviceMemory || 4;
    if (cores <= 2 || memory <= 2) deviceType = 'lowend';

    // Enhanced network speed detection with more conservative defaults
    let networkSpeed: PerformanceProfile['networkSpeed'] = 'medium'; // Default to medium instead of fast
    if (connection) {
      const effectiveType = connection.effectiveType;
      if (effectiveType === 'slow-2g' || effectiveType === '2g')
        networkSpeed = 'slow';
      else if (effectiveType === '4g' && connection.downlink > 15)
        networkSpeed = 'fast'; // Higher threshold for fast
      // Otherwise keep medium as default
    }

    return {
      deviceType,
      networkSpeed,
      batteryLevel: 1.0, // Will be updated if battery API is available
      thermalState: 'nominal',
      memoryPressure: 'low',
    };
  }

  /**
   * Select optimal optimization strategy based on current profile
   */
  private selectOptimalStrategy(): OptimizationStrategy {
    // Emergency thermal protection - highest priority
    if (
      this.currentProfile.thermalState === 'serious' ||
      this.currentProfile.thermalState === 'critical'
    ) {
      return this.strategies.find((s) => s.id === 'emergency-thermal')!;
    }

    // Low battery on mobile - second priority
    if (
      this.currentProfile.deviceType === 'mobile' &&
      this.currentProfile.batteryLevel &&
      this.currentProfile.batteryLevel < 0.2
    ) {
      return this.strategies.find((s) => s.id === 'mobile-aggressive')!;
    }

    // Select by device type and network
    const candidates = this.strategies.filter(
      (strategy) =>
        strategy.targetDevices.includes(this.currentProfile.deviceType) &&
        strategy.networkRequirements.includes(this.currentProfile.networkSpeed),
    );

    return candidates[0] || this.strategies[1]!; // Default to mobile-balanced
  }

  /**
   * Initialize performance metrics monitoring
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      frameRate: 60,
      audioLatency: 20,
      memoryUsage: 0,
      networkUtilization: 0,
      batteryDrain: 0,
      thermalLoad: 0,
    };
  }

  /**
   * Start continuous performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Monitor frame rate
    let lastFrame = performance.now();
    const frameMonitor = () => {
      const now = performance.now();
      const frameDuration = now - lastFrame;
      this.performanceMetrics.frameRate = Math.round(1000 / frameDuration);
      lastFrame = now;
      requestAnimationFrame(frameMonitor);
    };
    requestAnimationFrame(frameMonitor);

    // Monitor memory usage
    if ((performance as any).memory) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.performanceMetrics.memoryUsage =
          memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      }, 5000);
    }

    // Check for performance degradation
    setInterval(() => {
      this.checkPerformanceDegradation();
    }, 10000);
  }

  /**
   * Check for performance degradation and adapt accordingly
   */
  private checkPerformanceDegradation(): void {
    const issues: string[] = [];
    this.performanceRecommendations = []; // Reset recommendations

    if (this.performanceMetrics.frameRate < 30) {
      issues.push('low-framerate');
      this.performanceRecommendations.push('Reduce visual effects quality');
      this.performanceRecommendations.push(
        'Enable aggressive asset compression',
      );
    }

    if (this.performanceMetrics.memoryUsage > 0.8) {
      issues.push('high-memory');
      this.performanceRecommendations.push('Clear unused asset cache');
      this.performanceRecommendations.push('Reduce sample pool size');
    }

    if (this.performanceMetrics.audioLatency > 100) {
      issues.push('high-latency');
      this.performanceRecommendations.push('Increase audio buffer size');
      this.performanceRecommendations.push('Reduce voice polyphony');
    }

    if (issues.length > 0) {
      console.warn('⚠️ Performance degradation detected:', issues);
      this.adaptToPerformanceIssues(issues);
    }
  }

  /**
   * Adapt optimization strategy to address performance issues
   */
  private adaptToPerformanceIssues(issues: string[]): void {
    let needsAggressiveOptimization = false;

    if (issues.includes('low-framerate') || issues.includes('high-memory')) {
      needsAggressiveOptimization = true;
    }

    if (needsAggressiveOptimization) {
      // Switch to more aggressive strategy
      const aggressiveStrategy = this.strategies.find(
        (s) => s.id === 'mobile-aggressive',
      );
      if (
        aggressiveStrategy &&
        this.activeStrategy.id !== 'mobile-aggressive'
      ) {
        console.log(
          '🔧 Switching to aggressive optimization due to performance issues',
        );
        this.applyOptimizationStrategy(aggressiveStrategy);
      }
    }
  }

  /**
   * Apply optimization strategy to all connected systems
   */
  public applyOptimizationStrategy(strategy?: OptimizationStrategy): void {
    const targetStrategy = strategy || this.activeStrategy;
    this.activeStrategy = targetStrategy;

    console.log(`🎯 Applying optimization strategy: ${targetStrategy.name}`);

    // Configure asset pipeline
    const pipelineConfig = {
      enableLoadBalancing: targetStrategy.assetReductions.cacheAggression > 0.5,
      enableAssetPreprocessing: targetStrategy.assetReductions.quality < 1.0,
      enableFailoverRouting: true,
      maxRetries: targetStrategy.assetReductions.prefetchLimit < 5 ? 1 : 3,
      timeoutMs:
        targetStrategy.instrumentOptimizations.bufferSize > 1024 ? 10000 : 5000,
    };

    // Configure asset optimizer
    const optimizerConfig = {
      deviceCapabilityTier: this.getDeviceCapabilityTier(targetStrategy),
      networkCondition: this.currentProfile.networkSpeed,
      compressionLevel: targetStrategy.assetReductions.compression,
      qualityLevel: targetStrategy.assetReductions.quality,
      cacheStrategy:
        targetStrategy.assetReductions.cacheAggression > 0.7
          ? 'aggressive'
          : 'conservative',
      prefetchLimit: targetStrategy.assetReductions.prefetchLimit,
    };

    // Configure instruments
    const instrumentConfig = {
      samplePoolSize: targetStrategy.instrumentOptimizations.samplePoolSize,
      voicePolyphony: targetStrategy.instrumentOptimizations.voicePolyphony,
      effectsQuality: targetStrategy.instrumentOptimizations.effectsQuality,
      bufferSize: targetStrategy.instrumentOptimizations.bufferSize,
    };

    // UPGRADE: Actually call updateConfiguration on all Task 7 components
    try {
      if (
        this.pipelineProcessor &&
        typeof (this.pipelineProcessor as any).updateConfiguration ===
          'function'
      ) {
        (this.pipelineProcessor as any).updateConfiguration(pipelineConfig);
      }
      if (
        this.assetOptimizer &&
        typeof (this.assetOptimizer as any).updateConfiguration === 'function'
      ) {
        (this.assetOptimizer as any).updateConfiguration(optimizerConfig);
      }
      if (
        this.musicalAnalyzer &&
        typeof (this.musicalAnalyzer as any).updateConfiguration === 'function'
      ) {
        (this.musicalAnalyzer as any).updateConfiguration(instrumentConfig);
      }
    } catch (error) {
      console.warn(
        '⚠️ Some components may not support updateConfiguration:',
        error,
      );
    }

    // Record optimization change
    this.optimizationHistory.push({
      timestamp: Date.now(),
      strategy: targetStrategy.name,
      reason: 'Performance adaptation',
      performanceMetrics: { ...this.performanceMetrics },
      profile: { ...this.currentProfile },
    });

    console.log('✅ Optimization strategy applied:', {
      pipeline: pipelineConfig,
      optimizer: optimizerConfig,
      instruments: instrumentConfig,
    });
  }

  /**
   * Get device capability tier for optimization
   */
  private getDeviceCapabilityTier(strategy: OptimizationStrategy): string {
    if (strategy.instrumentOptimizations.samplePoolSize >= 32) return 'premium';
    if (strategy.instrumentOptimizations.samplePoolSize >= 16)
      return 'standard';
    return 'basic';
  }

  /**
   * Optimize for mobile-specific constraints
   */
  public optimizeForMobile(): void {
    console.log('📱 Applying mobile-specific optimizations...');

    // Touch-optimized asset loading
    const mobileOptimizations = {
      touchLatencyReduction: true,
      backgroundProcessingLimit: true,
      memoryPressureHandling: true,
      batteryAwareLoading: this.currentProfile.batteryLevel
        ? this.currentProfile.batteryLevel < 0.3
        : false,
    };

    // Apply mobile strategy
    const mobileStrategy =
      this.currentProfile.batteryLevel && this.currentProfile.batteryLevel < 0.3
        ? this.strategies.find((s) => s.id === 'mobile-aggressive')
        : this.strategies.find((s) => s.id === 'mobile-balanced');

    if (mobileStrategy) {
      this.applyOptimizationStrategy(mobileStrategy);
    }

    console.log('✅ Mobile optimizations applied:', mobileOptimizations);
  }

  /**
   * Get current performance status and recommendations
   */
  public getPerformanceStatus(): any {
    const score = this.calculatePerformanceScore();
    const recommendations = this.generateRecommendations();

    return {
      score,
      status:
        score > 80
          ? 'excellent'
          : score > 60
            ? 'good'
            : score > 40
              ? 'fair'
              : 'poor',
      metrics: this.performanceMetrics,
      profile: this.currentProfile,
      activeStrategy: this.activeStrategy.name,
      recommendations,
      optimizationHistory: this.optimizationHistory.slice(-5), // Last 5 optimizations
    };
  }

  /**
   * Calculate overall performance score
   */
  private calculatePerformanceScore(): number {
    const frameRateScore = Math.min(
      100,
      (this.performanceMetrics.frameRate / 60) * 100,
    );
    const memoryScore = Math.max(
      0,
      (1 - this.performanceMetrics.memoryUsage) * 100,
    );
    const latencyScore = Math.max(
      0,
      ((200 - this.performanceMetrics.audioLatency) / 200) * 100,
    );

    return Math.round((frameRateScore + memoryScore + latencyScore) / 3);
  }

  /**
   * Generate performance improvement recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [...this.performanceRecommendations];

    if (this.performanceMetrics.frameRate < 45) {
      if (!recommendations.includes('Reduce visual effects quality')) {
        recommendations.push('Reduce visual effects quality');
      }
      if (!recommendations.includes('Enable aggressive asset compression')) {
        recommendations.push('Enable aggressive asset compression');
      }
    }

    if (this.performanceMetrics.memoryUsage > 0.7) {
      if (!recommendations.includes('Clear unused asset cache')) {
        recommendations.push('Clear unused asset cache');
      }
      if (!recommendations.includes('Reduce sample pool size')) {
        recommendations.push('Reduce sample pool size');
      }
    }

    if (this.performanceMetrics.audioLatency > 50) {
      if (!recommendations.includes('Increase audio buffer size')) {
        recommendations.push('Increase audio buffer size');
      }
      if (!recommendations.includes('Reduce voice polyphony')) {
        recommendations.push('Reduce voice polyphony');
      }
    }

    if (
      this.currentProfile.batteryLevel &&
      this.currentProfile.batteryLevel < 0.2
    ) {
      if (!recommendations.includes('Enable battery saver mode')) {
        recommendations.push('Enable battery saver mode');
      }
      if (!recommendations.includes('Reduce background processing')) {
        recommendations.push('Reduce background processing');
      }
    }

    return recommendations;
  }

  /**
   * Manually trigger performance degradation check (useful for testing)
   */
  public triggerPerformanceDegradationCheck(): void {
    this.checkPerformanceDegradation();
  }

  /**
   * Force performance optimization based on current conditions
   */
  public forceOptimization(preserveManualProfile = false): void {
    console.log('🔧 Forcing performance optimization...');

    // Update performance profile (unless preserving manual settings for tests)
    const previousProfile = { ...this.currentProfile };
    if (!preserveManualProfile) {
      this.currentProfile = this.detectPerformanceProfile();
    }

    // Select new strategy based on updated profile
    const newStrategy = this.selectOptimalStrategy();

    // Apply if different from current OR if profile changed significantly
    const profileChanged =
      previousProfile.deviceType !== this.currentProfile.deviceType ||
      previousProfile.networkSpeed !== this.currentProfile.networkSpeed ||
      previousProfile.thermalState !== this.currentProfile.thermalState ||
      Math.abs(
        (previousProfile.batteryLevel || 1) -
          (this.currentProfile.batteryLevel || 1),
      ) > 0.1;

    if (newStrategy.id !== this.activeStrategy.id || profileChanged) {
      this.applyOptimizationStrategy(newStrategy);
    }

    console.log('✅ Performance optimization complete');
  }

  /**
   * Export complete performance configuration
   */
  public exportConfiguration(): any {
    return {
      performanceTuner: {
        currentProfile: this.currentProfile,
        activeStrategy: this.activeStrategy,
        performanceMetrics: this.performanceMetrics,
        availableStrategies: this.strategies.map((s) => ({
          id: s.id,
          name: s.name,
        })),
        optimizationHistory: this.optimizationHistory.length,
        performanceScore: this.calculatePerformanceScore(),
      },
      recommendations: this.generateRecommendations(),
      status: this.getPerformanceStatus(),
    };
  }
}

export default PerformanceTunerOptimizer;
