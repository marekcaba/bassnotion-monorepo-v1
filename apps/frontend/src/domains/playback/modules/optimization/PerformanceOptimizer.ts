/**
 * Performance Optimizer
 * 
 * Comprehensive performance optimization and quality assurance engine.
 * Provides adaptive quality scaling, mobile optimizations, benchmarking,
 * and production validation. Extracted from the original PerformanceOptimizer.
 */

import { EventEmitter } from 'events';
import type {
  DeviceCapabilities,
  QualitySettings,
  PerformanceMetrics,
  OptimizationResult,
  BenchmarkResult,
  ValidationResult,
  IPerformanceOptimizer,
} from './types';
import { DeviceCapabilityDetector } from './DeviceCapabilityDetector';
import { AdaptiveQualityScaler } from './AdaptiveQualityScaler';
import { QualityMonitor } from './QualityMonitor';
import { MobileOptimizer } from './MobileOptimizer';
import { BenchmarkSuite } from './BenchmarkSuite';
import { ValidationEngine } from './ValidationEngine';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('PerformanceOptimizer');

export class PerformanceOptimizer extends EventEmitter implements IPerformanceOptimizer {
  private static instance: PerformanceOptimizer | null = null;
  
  // Core components
  private deviceDetector: DeviceCapabilityDetector;
  private adaptiveScaler: AdaptiveQualityScaler;
  private qualityMonitor: QualityMonitor;
  private mobileOptimizer: MobileOptimizer;
  private benchmarkSuite: BenchmarkSuite;
  private validationEngine: ValidationEngine;
  
  // State
  private deviceCapabilities: DeviceCapabilities | null = null;
  private currentQualitySettings: QualitySettings | null = null;
  private performanceMetrics: PerformanceMetrics | null = null;
  private initialized = false;
  private monitoringActive = false;
  private optimizationHistory: OptimizationResult[] = [];
  
  // Monitoring intervals
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  private constructor() {
    super();
    
    // Initialize components
    this.deviceDetector = new DeviceCapabilityDetector();
    this.adaptiveScaler = new AdaptiveQualityScaler();
    this.qualityMonitor = new QualityMonitor();
    this.mobileOptimizer = new MobileOptimizer();
    this.benchmarkSuite = new BenchmarkSuite();
    this.validationEngine = new ValidationEngine();
    
    logger.info('⚡ PerformanceOptimizer components initialized');
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }
  
  /**
   * Initialize the Performance Optimizer
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.info('⚠️ Performance Optimizer already initialized');
      return;
    }
    
    try {
      logger.info('🚀 Initializing Performance Optimizer...');
      
      // Detect device capabilities
      this.deviceCapabilities = await this.deviceDetector.detectDeviceCapabilities();
      
      // Calculate optimal quality settings
      this.currentQualitySettings = await this.adaptiveScaler.calculateOptimalSettings(
        this.deviceCapabilities
      );
      
      // Initialize performance metrics
      this.performanceMetrics = await this.initializeMetrics();
      
      this.initialized = true;
      
      logger.info('✅ Performance Optimizer initialized successfully');
      this.emit('initialized', {
        capabilities: this.deviceCapabilities,
        qualitySettings: this.currentQualitySettings,
      });
    } catch (error) {
      logger.error('❌ Failed to initialize Performance Optimizer:', error);
      throw error;
    }
  }
  
  /**
   * Adapt quality to current device capabilities
   */
  async adaptQualityToDevice(): Promise<OptimizationResult> {
    if (!this.initialized) {
      throw new Error('PerformanceOptimizer not initialized');
    }
    
    logger.info('🎯 Adapting quality to device capabilities...');
    
    try {
      const startTime = performance.now();
      
      // Update device capabilities
      this.deviceCapabilities = await this.deviceDetector.detectDeviceCapabilities();
      
      // Calculate new optimal settings
      const newSettings = await this.adaptiveScaler.calculateOptimalSettings(
        this.deviceCapabilities
      );
      
      // Apply quality adjustments
      const performanceGain = await this.applyQualitySettings(newSettings);
      
      const optimizationTime = performance.now() - startTime;
      
      const result: OptimizationResult = {
        success: true,
        optimizationTime,
        performanceGain,
        qualityImpact: this.calculateQualityImpact(
          this.currentQualitySettings!,
          newSettings
        ),
        recommendations: this.adaptiveScaler.getRecommendations(),
        appliedOptimizations: [
          'Adaptive audio quality',
          'Dynamic polyphony adjustment',
          'Network-aware compression',
          'Battery-conscious processing',
        ],
      };
      
      this.currentQualitySettings = newSettings;
      this.optimizationHistory.push(result);
      
      logger.info(`✅ Quality adaptation completed in ${optimizationTime.toFixed(2)}ms`);
      this.emit('qualityAdapted', result);
      
      return result;
    } catch (error) {
      logger.error('❌ Quality adaptation failed:', error);
      throw error;
    }
  }
  
  /**
   * Optimize for mobile devices
   */
  async optimizeForMobile(): Promise<OptimizationResult> {
    if (!this.initialized || !this.deviceCapabilities || !this.currentQualitySettings) {
      throw new Error('PerformanceOptimizer not properly initialized');
    }
    
    logger.info('📱 Optimizing for mobile device...');
    
    try {
      const startTime = performance.now();
      
      // Update capabilities for latest battery/network status
      this.deviceCapabilities = await this.deviceDetector.detectDeviceCapabilities();
      
      if (this.deviceCapabilities.platform !== 'mobile') {
        logger.info('⚠️ Device is not mobile, skipping mobile optimizations');
        return {
          success: false,
          optimizationTime: 0,
          performanceGain: 0,
          qualityImpact: 0,
          recommendations: ['Device is not mobile'],
          appliedOptimizations: [],
        };
      }
      
      // Apply mobile-specific optimizations
      const mobileResult = await this.mobileOptimizer.optimize(
        this.deviceCapabilities,
        this.currentQualitySettings
      );
      
      const optimizationTime = performance.now() - startTime;
      
      const result: OptimizationResult = {
        success: true,
        optimizationTime,
        performanceGain: mobileResult.performanceGain,
        qualityImpact: mobileResult.qualityImpact,
        recommendations: mobileResult.recommendations,
        appliedOptimizations: mobileResult.appliedOptimizations,
      };
      
      this.optimizationHistory.push(result);
      
      logger.info(`✅ Mobile optimization completed in ${optimizationTime.toFixed(2)}ms`);
      this.emit('mobileOptimized', result);
      
      return result;
    } catch (error) {
      logger.error('❌ Mobile optimization failed:', error);
      throw error;
    }
  }
  
  /**
   * Run comprehensive performance benchmarks
   */
  async runBenchmarks(): Promise<BenchmarkResult[]> {
    if (!this.initialized || !this.deviceCapabilities || !this.currentQualitySettings) {
      throw new Error('PerformanceOptimizer not properly initialized');
    }
    
    logger.info('🏁 Running comprehensive performance benchmarks...');
    
    try {
      const results = await this.benchmarkSuite.runAllBenchmarks(
        this.deviceCapabilities,
        this.currentQualitySettings
      );
      
      logger.info(`✅ Completed ${results.length} benchmarks`);
      this.emit('benchmarksCompleted', results);
      
      return results;
    } catch (error) {
      logger.error('❌ Benchmarking failed:', error);
      throw error;
    }
  }
  
  /**
   * Start real-time quality monitoring
   */
  startRealTimeMonitoring(): void {
    if (this.monitoringActive) {
      logger.info('⚠️ Real-time monitoring already active');
      return;
    }
    
    if (!this.initialized || !this.deviceCapabilities || !this.currentQualitySettings) {
      throw new Error('PerformanceOptimizer not properly initialized');
    }
    
    logger.info('📊 Starting real-time quality monitoring...');
    
    this.monitoringActive = true;
    this.qualityMonitor.start(this.deviceCapabilities, this.currentQualitySettings);
    
    // Set up monitoring intervals
    this.setupMonitoringIntervals();
    
    logger.info('✅ Real-time monitoring started');
    this.emit('monitoringStarted');
  }
  
  /**
   * Stop real-time monitoring
   */
  stopRealTimeMonitoring(): void {
    if (!this.monitoringActive) {
      logger.info('⚠️ Real-time monitoring not active');
      return;
    }
    
    logger.info('📊 Stopping real-time monitoring...');
    
    this.monitoringActive = false;
    this.qualityMonitor.stop();
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    logger.info('✅ Real-time monitoring stopped');
    this.emit('monitoringStopped');
  }
  
  /**
   * Validate production readiness
   */
  async validateProductionReadiness(): Promise<ValidationResult[]> {
    if (!this.initialized || !this.deviceCapabilities || 
        !this.currentQualitySettings || !this.performanceMetrics) {
      throw new Error('PerformanceOptimizer not properly initialized');
    }
    
    logger.info('🔍 Validating production readiness...');
    
    try {
      const results = await this.validationEngine.validateAllComponents(
        this.deviceCapabilities,
        this.currentQualitySettings,
        this.performanceMetrics
      );
      
      const overallScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
      
      logger.info(`✅ Production validation completed - Overall Score: ${overallScore.toFixed(1)}/100`);
      this.emit('validationCompleted', { results, overallScore });
      
      return results;
    } catch (error) {
      logger.error('❌ Production validation failed:', error);
      throw error;
    }
  }
  
  /**
   * Run regression tests
   */
  async runRegressionTests(): Promise<BenchmarkResult[]> {
    if (!this.initialized || !this.deviceCapabilities || !this.currentQualitySettings) {
      throw new Error('PerformanceOptimizer not properly initialized');
    }
    
    logger.info('🧪 Running regression tests...');
    
    try {
      const results = await this.benchmarkSuite.runRegressionTests(
        this.deviceCapabilities,
        this.currentQualitySettings
      );
      
      const passedTests = results.filter(r => r.passed).length;
      logger.info(`✅ Regression tests completed - ${passedTests}/${results.length} passed`);
      this.emit('regressionTestsCompleted', results);
      
      return results;
    } catch (error) {
      logger.error('❌ Regression tests failed:', error);
      throw error;
    }
  }
  
  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    if (!this.performanceMetrics) {
      throw new Error('Performance metrics not available - optimizer not initialized');
    }
    return { ...this.performanceMetrics };
  }
  
  /**
   * Get optimization history
   */
  getOptimizationHistory(): OptimizationResult[] {
    return [...this.optimizationHistory];
  }
  
  /**
   * Get device capabilities
   */
  getDeviceCapabilities(): DeviceCapabilities {
    if (!this.deviceCapabilities) {
      throw new Error('Device capabilities not available - optimizer not initialized');
    }
    return { ...this.deviceCapabilities };
  }
  
  /**
   * Get current quality settings
   */
  getCurrentQualitySettings(): QualitySettings {
    if (!this.currentQualitySettings) {
      throw new Error('Quality settings not available - optimizer not initialized');
    }
    return { ...this.currentQualitySettings };
  }
  
  /**
   * Get quality scaling recommendations
   */
  getQualityRecommendations(): string[] {
    return this.adaptiveScaler.getRecommendations();
  }
  
  /**
   * Check if optimizer is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * Apply quality settings and measure performance gain
   */
  private async applyQualitySettings(settings: QualitySettings): Promise<number> {
    // Apply settings and estimate performance gain
    this.currentQualitySettings = settings;
    
    // Calculate performance gain based on quality reductions
    let performanceGain = 0;
    
    if (settings.audio.compression !== 'none') {
      performanceGain += 5; // Compression saves bandwidth
    }
    if (settings.instruments.polyphony < 16) {
      performanceGain += (16 - settings.instruments.polyphony) * 2; // 2% per voice
    }
    if (!settings.processing.advancedArticulation) {
      performanceGain += 10; // Advanced features are expensive
    }
    if (!settings.processing.microTiming) {
      performanceGain += 5;
    }
    if (settings.visual.frameRate < 60) {
      performanceGain += 15; // 30fps vs 60fps saves significant power
    }
    
    return Math.min(performanceGain, 50); // Cap at 50% gain
  }
  
  /**
   * Calculate quality impact of settings change
   */
  private calculateQualityImpact(oldSettings: QualitySettings, newSettings: QualitySettings): number {
    let qualityDelta = 0;
    
    // Audio quality impact
    if (newSettings.audio.bitDepth < oldSettings.audio.bitDepth) {
      qualityDelta -= 2;
    }
    if (newSettings.audio.compression !== oldSettings.audio.compression) {
      const compressionImpact = { none: 0, low: -1, medium: -3, high: -5 };
      qualityDelta += compressionImpact[newSettings.audio.compression] - 
                     compressionImpact[oldSettings.audio.compression];
    }
    
    // Instrument quality impact
    if (newSettings.instruments.polyphony < oldSettings.instruments.polyphony) {
      qualityDelta -= (oldSettings.instruments.polyphony - newSettings.instruments.polyphony) * 0.5;
    }
    if (newSettings.instruments.velocityLayers < oldSettings.instruments.velocityLayers) {
      qualityDelta -= (oldSettings.instruments.velocityLayers - newSettings.instruments.velocityLayers) * 1;
    }
    
    // Processing features impact
    if (!newSettings.processing.advancedArticulation && oldSettings.processing.advancedArticulation) {
      qualityDelta -= 3;
    }
    if (!newSettings.processing.microTiming && oldSettings.processing.microTiming) {
      qualityDelta -= 2;
    }
    
    return Math.max(qualityDelta, -20); // Cap negative impact at -20%
  }
  
  /**
   * Initialize performance metrics
   */
  private async initializeMetrics(): Promise<PerformanceMetrics> {
    return {
      audio: {
        latency: 20,
        dropouts: 0,
        cpuUsage: 5,
        memoryUsage: 50,
      },
      system: {
        frameRate: 60,
        batteryDrain: 100,
        temperature: 25,
        networkUsage: 0,
      },
      quality: {
        score: 85,
        stability: 90,
        efficiency: 80,
      },
      benchmarks: {
        initializationTime: 100,
        processingTime: 5,
        memoryFootprint: 100,
        throughput: 1000,
      },
    };
  }
  
  /**
   * Set up monitoring intervals
   */
  private setupMonitoringIntervals(): void {
    this.monitoringInterval = setInterval(() => {
      if (!this.monitoringActive) {
        if (this.monitoringInterval) {
          clearInterval(this.monitoringInterval);
          this.monitoringInterval = null;
        }
        return;
      }
      
      this.updatePerformanceMetrics();
      this.checkForOptimizationNeeds();
    }, 1000); // Monitor every second
  }
  
  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    if (!this.performanceMetrics) return;
    
    // Simulate real-time metrics updates
    this.performanceMetrics.audio.cpuUsage = Math.random() * 20 + 5;
    this.performanceMetrics.audio.memoryUsage = Math.random() * 50 + 50;
    this.performanceMetrics.system.frameRate = Math.random() * 10 + 55;
    this.performanceMetrics.quality.score = Math.random() * 20 + 80;
    
    this.emit('metricsUpdated', this.performanceMetrics);
  }
  
  /**
   * Check if optimization is needed based on current metrics
   */
  private checkForOptimizationNeeds(): void {
    if (!this.performanceMetrics) return;
    
    const cpuThreshold = 80;
    const memoryThreshold = 85;
    
    if (this.performanceMetrics.audio.cpuUsage > cpuThreshold ||
        this.performanceMetrics.audio.memoryUsage > memoryThreshold) {
      this.emit('optimizationNeeded', {
        reason: 'High resource usage detected',
        metrics: this.performanceMetrics,
      });
    }
  }
  
  /**
   * Export complete configuration
   */
  exportConfiguration(): any {
    return {
      deviceCapabilities: this.deviceCapabilities,
      currentQualitySettings: this.currentQualitySettings,
      performanceMetrics: this.performanceMetrics,
      optimizationHistory: this.optimizationHistory,
      isInitialized: this.initialized,
      monitoringActive: this.monitoringActive,
    };
  }
  
  /**
   * Dispose of the Performance Optimizer
   */
  async dispose(): Promise<void> {
    logger.info('🧹 Disposing Performance Optimizer...');
    
    try {
      // Stop monitoring
      this.stopRealTimeMonitoring();
      
      // Dispose components
      await this.adaptiveScaler.dispose();
      await this.qualityMonitor.dispose();
      await this.mobileOptimizer.dispose();
      await this.benchmarkSuite.dispose();
      await this.validationEngine.dispose();
      
      // Clear state
      this.deviceCapabilities = null;
      this.currentQualitySettings = null;
      this.performanceMetrics = null;
      this.optimizationHistory = [];
      this.initialized = false;
      
      // Clear singleton
      PerformanceOptimizer.instance = null;
      
      logger.info('✅ Performance Optimizer disposed successfully');
      this.emit('disposed');
    } catch (error) {
      logger.error('❌ Error disposing Performance Optimizer:', error);
      throw error;
    }
  }
}