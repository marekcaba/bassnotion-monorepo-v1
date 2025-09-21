/**
 * AdaptiveDriftCompensator - Integrates drift prediction with Clock timing
 *
 * This component bridges the DriftPredictor with the Clock system,
 * providing real-time drift compensation for professional audio timing.
 */

import {
  DriftPredictor,
  DriftPrediction,
  DriftMeasurement,
} from './DriftPredictor.js';
import { EventEmitter } from '../shared/index.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('AdaptiveDriftCompensator');

export interface CompensationConfig {
  // Drift compensation parameters
  maxCompensationMs?: number; // Maximum compensation allowed per update
  compensationSmoothingFactor?: number; // How smoothly to apply compensation (0-1)
  measurementIntervalMs?: number; // How often to measure drift

  // Adaptive behavior
  enableAdaptiveMode?: boolean; // Adjust compensation based on system conditions
  stressThreshold?: number; // CPU usage threshold for stress mode
  latencyThreshold?: number; // Network latency threshold

  // Prediction settings
  lookAheadMs?: number; // How far to predict into the future
  minConfidenceForPrediction?: number; // Minimum confidence to use predictions
}

export interface CompensationState {
  isActive: boolean;
  currentCompensationMs: number;
  predictedDriftMs: number;
  confidence: number;
  trend: 'stable' | 'increasing' | 'decreasing';
  adaptiveMode: 'normal' | 'stressed' | 'unstable';
}

export interface SystemConditions {
  cpuUsage?: number;
  memoryPressure?: number;
  networkLatency?: number;
  audioDropouts?: number;
  bufferUnderruns?: number;
}

export class AdaptiveDriftCompensator extends EventEmitter {
  private driftPredictor: DriftPredictor;
  private config: Required<CompensationConfig>;
  private state: CompensationState;

  // Timing tracking
  private referenceTime = 0;
  private lastMeasurementTime = 0;
  private compensationHistory: number[] = [];

  // Adaptive mode tracking
  private systemConditions: SystemConditions = {};
  private performanceMonitor?: PerformanceObserver;

  // Smoothing
  private targetCompensation = 0;
  private currentCompensation = 0;
  private compensationVelocity = 0;

  constructor(config: CompensationConfig = {}) {
    super();

    this.config = {
      maxCompensationMs: config.maxCompensationMs ?? 5.0,
      compensationSmoothingFactor: config.compensationSmoothingFactor ?? 0.1,
      measurementIntervalMs: config.measurementIntervalMs ?? 100,
      enableAdaptiveMode: config.enableAdaptiveMode ?? true,
      stressThreshold: config.stressThreshold ?? 0.8,
      latencyThreshold: config.latencyThreshold ?? 50,
      lookAheadMs: config.lookAheadMs ?? 100,
      minConfidenceForPrediction: config.minConfidenceForPrediction ?? 0.7,
    };

    this.state = {
      isActive: false,
      currentCompensationMs: 0,
      predictedDriftMs: 0,
      confidence: 0,
      trend: 'stable',
      adaptiveMode: 'normal',
    };

    this.driftPredictor = new DriftPredictor({
      driftThreshold: 0.5,
      measurementNoise: 0.01,
      processNoise: 0.00001,
    });

    logger.info('AdaptiveDriftCompensator initialized', this.config);

    if (this.config.enableAdaptiveMode) {
      this.setupPerformanceMonitoring();
    }
  }

  /**
   * Start drift compensation
   */
  start(referenceTime: number = performance.now()): void {
    if (this.state.isActive) {
      logger.warn('Drift compensator already active');
      return;
    }

    this.referenceTime = referenceTime;
    this.lastMeasurementTime = referenceTime;
    this.state.isActive = true;

    logger.info('Drift compensation started', {
      referenceTime,
      config: this.config,
    });

    this.emit('start', { referenceTime });
  }

  /**
   * Stop drift compensation
   */
  stop(): void {
    if (!this.state.isActive) {
      return;
    }

    this.state.isActive = false;
    this.currentCompensation = 0;
    this.targetCompensation = 0;
    this.compensationVelocity = 0;

    logger.info('Drift compensation stopped');
    this.emit('stop');
  }

  /**
   * Measure drift and update compensation
   */
  measureDrift(expectedTime: number, actualTime: number): number {
    if (!this.state.isActive) {
      return 0;
    }

    const now = performance.now();

    // Add measurement to predictor
    const drift = actualTime - expectedTime;
    const measurement: DriftMeasurement = {
      timestamp: now,
      expectedTime,
      actualTime,
      drift,
    };

    this.driftPredictor.addMeasurement(measurement);

    // Get prediction
    const prediction = this.driftPredictor.predict(this.config.lookAheadMs);

    // Update state
    this.state.predictedDriftMs = prediction.predictedDrift;
    this.state.confidence = prediction.confidence;
    this.state.trend = prediction.trend;

    // Calculate compensation
    let compensation = 0;

    if (prediction.confidence >= this.config.minConfidenceForPrediction) {
      // Use predictive compensation
      compensation = this.driftPredictor.getPredictiveCompensation(
        this.config.lookAheadMs,
      );
    } else {
      // Fall back to reactive compensation
      compensation = this.driftPredictor.getCompensation();
    }

    // Apply limits
    compensation = Math.max(
      -this.config.maxCompensationMs,
      Math.min(this.config.maxCompensationMs, compensation),
    );

    // Update target compensation
    this.targetCompensation = compensation;

    // Smooth compensation changes
    const compensationDelta = this.smoothCompensation(now);

    // Record in history
    this.compensationHistory.push(this.currentCompensation);
    if (this.compensationHistory.length > 100) {
      this.compensationHistory.shift();
    }

    this.lastMeasurementTime = now;

    // Emit update event
    this.emit('compensationUpdate', {
      drift,
      compensation: this.currentCompensation,
      prediction,
      state: this.state,
    });

    logger.debug('Drift measurement', {
      drift: drift.toFixed(3),
      compensation: this.currentCompensation.toFixed(3),
      confidence: prediction.confidence.toFixed(2),
      trend: prediction.trend,
    });

    return this.currentCompensation;
  }

  /**
   * Get current compensation value
   */
  getCompensation(): number {
    return this.state.isActive ? this.currentCompensation : 0;
  }

  /**
   * Get compensated time
   */
  getCompensatedTime(baseTime: number): number {
    return baseTime + this.getCompensation();
  }

  /**
   * Update system conditions for adaptive mode
   */
  updateSystemConditions(conditions: Partial<SystemConditions>): void {
    this.systemConditions = { ...this.systemConditions, ...conditions };

    if (this.config.enableAdaptiveMode) {
      this.updateAdaptiveMode();
    }
  }

  /**
   * Get current state
   */
  getState(): CompensationState {
    return { ...this.state, currentCompensationMs: this.currentCompensation };
  }

  /**
   * Get drift analysis
   */
  analyzeDrift() {
    return this.driftPredictor.analyzeDriftPattern();
  }

  /**
   * Reset compensator
   */
  reset(): void {
    this.driftPredictor.reset();
    this.currentCompensation = 0;
    this.targetCompensation = 0;
    this.compensationVelocity = 0;
    this.compensationHistory = [];

    this.state = {
      ...this.state,
      currentCompensationMs: 0,
      predictedDriftMs: 0,
      confidence: 0,
      trend: 'stable',
    };

    logger.info('Drift compensator reset');
    this.emit('reset');
  }

  /**
   * Destroy the compensator
   */
  destroy(): void {
    this.stop();

    if (this.performanceMonitor) {
      this.performanceMonitor.disconnect();
    }

    this.removeAllListeners();
    logger.info('Drift compensator destroyed');
  }

  /**
   * Smooth compensation changes to avoid jitter
   */
  private smoothCompensation(now: number): number {
    const timeDelta = (now - this.lastMeasurementTime) / 1000; // Convert to seconds

    if (timeDelta <= 0) {
      return 0;
    }

    // Calculate error
    const error = this.targetCompensation - this.currentCompensation;

    // Apply smoothing based on adaptive mode
    let smoothingFactor = this.config.compensationSmoothingFactor;

    if (this.state.adaptiveMode === 'stressed') {
      smoothingFactor *= 0.5; // More aggressive smoothing under stress
    } else if (this.state.adaptiveMode === 'unstable') {
      smoothingFactor *= 0.3; // Very conservative under unstable conditions
    }

    // Update compensation with smoothing
    const compensationDelta = error * smoothingFactor;
    this.currentCompensation += compensationDelta;

    // Track velocity for analysis
    this.compensationVelocity = compensationDelta / timeDelta;

    return compensationDelta;
  }

  /**
   * Update adaptive mode based on system conditions
   */
  private updateAdaptiveMode(): void {
    const {
      cpuUsage = 0,
      networkLatency = 0,
      audioDropouts = 0,
    } = this.systemConditions;

    let newMode: CompensationState['adaptiveMode'] = 'normal';

    if (
      audioDropouts > 0 ||
      networkLatency > this.config.latencyThreshold * 2
    ) {
      newMode = 'unstable';
    } else if (
      cpuUsage > this.config.stressThreshold ||
      networkLatency > this.config.latencyThreshold
    ) {
      newMode = 'stressed';
    }

    if (newMode !== this.state.adaptiveMode) {
      logger.info('Adaptive mode changed', {
        from: this.state.adaptiveMode,
        to: newMode,
        conditions: this.systemConditions,
      });

      this.state.adaptiveMode = newMode;

      // Adjust drift predictor parameters
      this.driftPredictor.adaptFilterParameters({
        highLatency: networkLatency > this.config.latencyThreshold,
        unstableNetwork: networkLatency > this.config.latencyThreshold * 2,
        cpuStress: cpuUsage > this.config.stressThreshold,
      });

      this.emit('adaptiveModeChange', {
        mode: newMode,
        conditions: this.systemConditions,
      });
    }
  }

  /**
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    if (typeof PerformanceObserver === 'undefined') {
      logger.warn('PerformanceObserver not available, adaptive mode limited');
      return;
    }

    try {
      // Monitor long tasks (potential CPU stress indicators)
      this.performanceMonitor = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const longTasks = entries.filter((entry) => entry.duration > 50);

        if (longTasks.length > 0) {
          // Estimate CPU stress based on long task frequency
          const cpuUsage = Math.min(1, longTasks.length / 10);
          this.updateSystemConditions({ cpuUsage });
        }
      });

      // Start observing
      this.performanceMonitor.observe({ entryTypes: ['longtask'] });

      logger.info('Performance monitoring setup complete');
    } catch (error) {
      logger.warn('Failed to setup performance monitoring', error);
    }
  }

  /**
   * Get compensation statistics
   */
  getStatistics() {
    const driftStats = this.driftPredictor.getStatistics();

    // Calculate compensation statistics
    const compensationStats = {
      mean: 0,
      max: 0,
      stability: 0,
    };

    if (this.compensationHistory.length > 0) {
      compensationStats.mean =
        this.compensationHistory.reduce((a, b) => a + b, 0) /
        this.compensationHistory.length;
      compensationStats.max = Math.max(
        ...this.compensationHistory.map(Math.abs),
      );

      // Calculate stability (inverse of variance)
      const variance =
        this.compensationHistory.reduce((sum, val) => {
          const diff = val - compensationStats.mean;
          return sum + diff * diff;
        }, 0) / this.compensationHistory.length;
      compensationStats.stability = 1 / (1 + variance);
    }

    return {
      drift: driftStats,
      compensation: compensationStats,
      state: this.getState(),
      adaptiveMode: this.state.adaptiveMode,
      systemConditions: this.systemConditions,
    };
  }
}
