/**
 * Clock - High-precision timing source for the transport system
 *
 * Responsibilities:
 * - AudioContext time management
 * - Hardware clock synchronization
 * - Clock drift compensation
 * - Time source abstraction
 * - AudioWorklet integration for sample-accurate timing
 */

import { ClockSyncData } from '../types/index.js';
import { ClockSyncError } from '../types/errors.js';
import { createStructuredLogger } from '../shared/index.js';
import { SampleAccurateClock } from '../sync/SampleAccurateClock.js';
import { AdaptiveDriftCompensator } from '../sync/AdaptiveDriftCompensator.js';
import { WorkerTimingManager } from '../sync/WorkerTimingManager.js';

const logger = createStructuredLogger('TransportClock');

export interface ClockConfig {
  useAudioWorklet?: boolean;
  useWebWorker?: boolean;
  useHardwareClock?: boolean;
  syncIntervalMs?: number;
  audioWorkletPath?: string;
  workerPath?: string;
  driftCompensation?: 'off' | 'basic' | 'adaptive';
}

export class Clock {
  private audioContext: AudioContext | null = null;
  private useHardwareClock = true;
  private hardwareClockOffset = 0;
  private clockSyncInterval: number | null = null;
  private clockSyncHistory: number[] = [];
  private readonly clockSyncHistorySize = 10;
  private isInitialized = false;
  private syncIntervalMs = 1000; // Sync every second

  // AudioWorklet support
  private useAudioWorklet = false;
  private sampleAccurateClock: SampleAccurateClock | null = null;
  private audioWorkletActive = false;

  // Web Worker support
  private useWebWorker = false;
  private workerTimingManager: WorkerTimingManager | null = null;
  private webWorkerActive = false;

  // Timing state
  private currentTime = 0;
  private currentFrame = 0;
  private lastUpdateTime = 0;

  // Drift compensation
  private driftCompensator: AdaptiveDriftCompensator | null = null;
  private driftMeasurementInterval: number | null = null;

  // Configuration
  private config: ClockConfig;

  // Callbacks
  private onTick?: (time: number) => void;

  constructor(config: ClockConfig = {}) {
    // Handle legacy config options
    const legacyConfig = config as any;
    if ('enableAudioWorklet' in legacyConfig) {
      config.useAudioWorklet = legacyConfig.enableAudioWorklet;
    }
    if ('enableWebWorker' in legacyConfig) {
      config.useWebWorker = legacyConfig.enableWebWorker;
    }
    if (legacyConfig.driftCompensation === 'none') {
      config.driftCompensation = 'off';
    }

    this.config = {
      useAudioWorklet: config.useAudioWorklet ?? true,
      useWebWorker: config.useWebWorker ?? true,
      useHardwareClock: config.useHardwareClock ?? true,
      syncIntervalMs: config.syncIntervalMs ?? 1000,
      audioWorkletPath: config.audioWorkletPath,
      workerPath: config.workerPath,
      driftCompensation: config.driftCompensation ?? 'basic',
    };

    this.useAudioWorklet = this.config.useAudioWorklet!;
    this.useWebWorker = this.config.useWebWorker!;
    this.useHardwareClock = this.config.useHardwareClock!;
    this.syncIntervalMs = this.config.syncIntervalMs!;

    logger.debug('Clock instance created', this.config);
  }

  /**
   * Initialize the clock with an audio context
   */
  async initialize(audioContext: AudioContext): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Clock already initialized');
      return;
    }

    this.audioContext = audioContext;

    // Try to initialize AudioWorklet if enabled
    if (this.useAudioWorklet) {
      try {
        await this.initializeAudioWorklet();
      } catch (error) {
        logger.warn(
          'Failed to initialize AudioWorklet, will try Web Worker',
          error as Error,
        );
        this.audioWorkletActive = false;
      }
    }

    // Try Web Worker as fallback if AudioWorklet failed
    if (!this.audioWorkletActive && this.useWebWorker) {
      try {
        await this.initializeWebWorker();
      } catch (error) {
        logger.warn(
          'Failed to initialize Web Worker, falling back to basic clock',
          error as Error,
        );
        this.webWorkerActive = false;
      }
    }

    // Initialize drift compensation if enabled
    if (this.config.driftCompensation === 'adaptive') {
      this.driftCompensator = new AdaptiveDriftCompensator({
        enableAdaptiveMode: true,
        measurementIntervalMs: 100,
        lookAheadMs: 100,
        maxCompensationMs: 5,
      });

      // Set up drift measurement
      this.driftCompensator.on('compensationUpdate', (data) => {
        logger.debug('Drift compensation update', {
          drift: data.drift.toFixed(3),
          compensation: data.compensation.toFixed(3),
          trend: data.prediction.trend,
        });
      });

      this.driftCompensator.start();
    }

    this.isInitialized = true;

    // Perform initial sync if not using AudioWorklet
    if (!this.audioWorkletActive) {
      this.syncWithHardware();
    }

    logger.info('Clock initialized', {
      sampleRate: audioContext.sampleRate,
      baseLatency: audioContext.baseLatency,
      outputLatency: audioContext.outputLatency,
      audioWorkletActive: this.audioWorkletActive,
      webWorkerActive: this.webWorkerActive,
      mode: this.audioWorkletActive
        ? 'AudioWorklet'
        : this.webWorkerActive
          ? 'WebWorker'
          : 'Basic',
      driftCompensation: this.config.driftCompensation,
    });
  }

  /**
   * Initialize AudioWorklet for sample-accurate timing
   */
  private async initializeAudioWorklet(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    logger.debug('Initializing AudioWorklet clock...');

    // Create SampleAccurateClock
    this.sampleAccurateClock = new SampleAccurateClock({
      updateInterval: 0.00267, // 128 samples @ 48kHz
      lookAheadTime: 0.2,
      driftThreshold: 1,
      workletPath: this.config.audioWorkletPath,
    });

    // Set up callbacks
    this.sampleAccurateClock.setOnTick((time, frame) => {
      this.currentTime = time;
      this.currentFrame = frame;
      this.lastUpdateTime = performance.now();
      this.onTick?.(time);
    });

    // Initialize with AudioContext
    await this.sampleAccurateClock.initialize(this.audioContext);
    this.audioWorkletActive = true;

    logger.info('AudioWorklet clock initialized successfully');
  }

  /**
   * Initialize Web Worker for isolated timing
   */
  private async initializeWebWorker(): Promise<void> {
    logger.debug('Initializing Web Worker clock...');

    // Create WorkerTimingManager
    this.workerTimingManager = new WorkerTimingManager({
      workerPath: this.config.workerPath,
      tempo: 120, // Default tempo
      updateInterval: 10, // 10ms updates
      useDriftCompensation: true,
    });

    // Set up callbacks
    this.workerTimingManager.setOnTick((time) => {
      this.currentTime = time;
      this.lastUpdateTime = performance.now();
      this.onTick?.(time);
    });

    // Initialize
    await this.workerTimingManager.initialize();
    this.webWorkerActive = true;

    logger.info('Web Worker clock initialized successfully');
  }

  /**
   * Start clock synchronization
   */
  startSync(): void {
    // AudioWorklet handles its own timing
    if (this.audioWorkletActive) {
      logger.debug('Clock sync not needed - AudioWorklet active');

      // But we still need drift measurement if adaptive compensation is enabled
      if (
        this.driftCompensator &&
        this.config.driftCompensation === 'adaptive'
      ) {
        this.startDriftMeasurement();
      }
      return;
    }

    if (this.clockSyncInterval) {
      logger.warn('Clock sync already started');
      return;
    }

    this.clockSyncInterval = window.setInterval(
      () => this.syncWithHardware(),
      this.syncIntervalMs,
    );

    // Start drift measurement if enabled
    if (this.driftCompensator && this.config.driftCompensation === 'adaptive') {
      this.startDriftMeasurement();
    }

    logger.debug('Clock sync started', { intervalMs: this.syncIntervalMs });
  }

  /**
   * Stop clock synchronization
   */
  stopSync(): void {
    if (this.clockSyncInterval) {
      clearInterval(this.clockSyncInterval);
      this.clockSyncInterval = null;
      logger.debug('Clock sync stopped');
    }

    this.stopDriftMeasurement();
  }

  /**
   * Start timing updates
   */
  start(): void {
    if (this.audioWorkletActive && this.sampleAccurateClock) {
      this.sampleAccurateClock.start();
    } else if (this.webWorkerActive && this.workerTimingManager) {
      this.workerTimingManager.start();
    }
  }

  /**
   * Stop timing updates
   */
  stop(): void {
    if (this.audioWorkletActive && this.sampleAccurateClock) {
      this.sampleAccurateClock.stop();
    } else if (this.webWorkerActive && this.workerTimingManager) {
      this.workerTimingManager.stop();
    }
  }

  /**
   * Pause timing updates
   */
  pause(): void {
    if (this.audioWorkletActive && this.sampleAccurateClock) {
      this.sampleAccurateClock.pause();
    } else if (this.webWorkerActive && this.workerTimingManager) {
      this.workerTimingManager.pause();
    }
  }

  /**
   * Resume timing updates
   */
  resume(): void {
    if (this.audioWorkletActive && this.sampleAccurateClock) {
      this.sampleAccurateClock.resume();
    } else if (this.webWorkerActive && this.workerTimingManager) {
      this.workerTimingManager.resume();
    }
  }

  /**
   * Seek to position
   */
  seek(seconds: number): void {
    if (this.audioWorkletActive && this.sampleAccurateClock) {
      this.sampleAccurateClock.seek(seconds);
      this.currentTime = seconds;
      this.currentFrame = Math.floor(seconds * this.audioContext!.sampleRate);
    } else if (this.webWorkerActive && this.workerTimingManager) {
      this.workerTimingManager.seek(seconds);
      this.currentTime = seconds;
      this.currentFrame = Math.floor(seconds * this.audioContext!.sampleRate);
    }
  }

  /**
   * Get the current audio time
   */
  getAudioTime(): number {
    if (!this.audioContext) {
      throw new ClockSyncError('AudioContext not initialized');
    }

    let baseTime: number;

    // Use AudioWorklet time if active
    if (this.audioWorkletActive && this.sampleAccurateClock) {
      baseTime = this.sampleAccurateClock.getCurrentTime();
    }
    // Use Web Worker time if active
    else if (this.webWorkerActive && this.workerTimingManager) {
      baseTime = this.workerTimingManager.getCurrentTime();
    }
    // Use hardware clock if enabled
    else if (this.useHardwareClock) {
      baseTime = this.audioContext.currentTime + this.hardwareClockOffset;
    } else {
      baseTime = this.audioContext.currentTime;
    }

    // Apply drift compensation if enabled
    if (this.driftCompensator && this.config.driftCompensation === 'adaptive') {
      const compensation = this.driftCompensator.getCompensation();
      return baseTime + compensation / 1000; // Convert ms to seconds
    }

    return baseTime;
  }

  /**
   * Get the hardware-synced time
   */
  getHardwareTime(): number {
    if (!this.audioContext) {
      throw new ClockSyncError('AudioContext not initialized');
    }

    return performance.now() / 1000;
  }

  /**
   * Synchronize with hardware clock
   */
  syncWithHardware(): void {
    if (!this.audioContext || this.audioWorkletActive) {
      return;
    }

    try {
      const audioTime = this.audioContext.currentTime;
      const hardwareTime = this.getHardwareTime();
      const offset = hardwareTime - audioTime;

      // Add to history
      this.clockSyncHistory.push(offset);
      if (this.clockSyncHistory.length > this.clockSyncHistorySize) {
        this.clockSyncHistory.shift();
      }

      // Calculate average offset
      const avgOffset =
        this.clockSyncHistory.reduce((sum, val) => sum + val, 0) /
        this.clockSyncHistory.length;

      this.hardwareClockOffset = avgOffset;

      logger.debug('Clock synced', {
        offset: avgOffset,
        samples: this.clockSyncHistory.length,
      });
    } catch (error) {
      logger.error('Clock sync failed', error as Error);
    }
  }

  /**
   * Calculate clock offset
   */
  calculateClockOffset(): number {
    if (this.clockSyncHistory.length === 0) {
      return 0;
    }

    return (
      this.clockSyncHistory.reduce((sum, val) => sum + val, 0) /
      this.clockSyncHistory.length
    );
  }

  /**
   * Get clock offset (alias for calculateClockOffset for backward compatibility)
   */
  getClockOffset(): number {
    return this.calculateClockOffset();
  }

  /**
   * Get clock sync data
   */
  getSyncData(): ClockSyncData {
    const avgOffset = this.calculateClockOffset();
    const maxDrift =
      this.clockSyncHistory.length > 0
        ? Math.max(...this.clockSyncHistory.map((o) => Math.abs(o - avgOffset)))
        : 0;

    const audioTime = this.audioContext ? this.audioContext.currentTime : 0;
    const systemTime = performance.now() / 1000;

    return {
      audioTime,
      systemTime,
      offset: avgOffset,
      confidence: maxDrift < 0.001 ? 1.0 : Math.max(0, 1.0 - maxDrift * 10),
    };
  }

  /**
   * Get timing metrics
   */
  getMetrics(): {
    mode: 'AudioWorklet' | 'WebWorker' | 'Basic';
    avgDrift: number;
    maxDrift: number;
    stability: number;
    sampleRate?: number;
  } {
    if (this.audioWorkletActive && this.sampleAccurateClock) {
      const metrics = this.sampleAccurateClock.getMetrics();
      return {
        mode: 'AudioWorklet',
        ...metrics,
        sampleRate: this.audioContext?.sampleRate,
      };
    }

    if (this.webWorkerActive && this.workerTimingManager) {
      const metrics = this.workerTimingManager.getMetrics();
      return {
        mode: 'WebWorker',
        ...metrics,
        sampleRate: this.audioContext?.sampleRate,
      };
    }

    const avgOffset = this.calculateClockOffset();
    const maxDrift =
      this.clockSyncHistory.length > 0
        ? Math.max(...this.clockSyncHistory.map((o) => Math.abs(o - avgOffset)))
        : 0;

    return {
      mode: 'Basic',
      avgDrift: maxDrift * 1000, // Convert to ms
      maxDrift: maxDrift * 1000,
      stability: maxDrift < 0.001 ? 100 : 90,
      sampleRate: this.audioContext?.sampleRate,
    };
  }

  /**
   * Set tick callback
   */
  setOnTick(callback: (time: number) => void): void {
    this.onTick = callback;
  }

  /**
   * Get initialization status
   */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current time
   */
  getCurrentTime(): number {
    if (!this.audioContext) {
      throw new ClockSyncError('AudioContext not initialized');
    }

    // If hardware clock is disabled, return performance time
    if (!this.useHardwareClock) {
      return performance.now() / 1000;
    }

    return this.getAudioTime();
  }

  /**
   * Get sample rate
   */
  getSampleRate(): number {
    if (!this.audioContext) {
      throw new ClockSyncError('AudioContext not initialized');
    }
    return this.audioContext.sampleRate;
  }

  /**
   * Set use hardware clock
   */
  setUseHardwareClock(useHardwareClock: boolean): void {
    this.useHardwareClock = useHardwareClock;
  }

  /**
   * Start periodic sync
   */
  startPeriodicSync(): void {
    if (this.clockSyncInterval !== null) {
      return; // Already syncing
    }

    this.clockSyncInterval = setInterval(() => {
      this.syncWithHardware();
    }, this.syncIntervalMs) as any;

    logger.info('Started periodic clock sync', {
      intervalMs: this.syncIntervalMs,
    });
  }

  /**
   * Reset clock state
   */
  reset(): void {
    this.clockSyncHistory = [];
    this.hardwareClockOffset = 0;
    this.currentTime = 0;
    this.currentFrame = 0;
    this.lastUpdateTime = 0;

    if (this.driftCompensator) {
      this.driftCompensator.reset();
    }

    logger.info('Clock reset');
  }

  /**
   * Get stability metric (0-1)
   */
  getStability(): number {
    if (this.clockSyncHistory.length < 2) {
      return 0;
    }

    const avgOffset = this.calculateClockOffset();
    const variance =
      this.clockSyncHistory.reduce((sum, offset) => {
        const diff = offset - avgOffset;
        return sum + diff * diff;
      }, 0) / this.clockSyncHistory.length;

    const stdDev = Math.sqrt(variance);

    // Stability is high when standard deviation is low
    // Consider < 1ms very stable, > 10ms unstable
    if (stdDev < 0.001) return 1.0;
    if (stdDev > 0.01) return 0.0;

    return 1.0 - (stdDev - 0.001) / 0.009;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stopSync();

    if (this.clockSyncInterval !== null) {
      clearInterval(this.clockSyncInterval);
      this.clockSyncInterval = null;
    }

    if (this.driftMeasurementInterval !== null) {
      clearInterval(this.driftMeasurementInterval);
      this.driftMeasurementInterval = null;
    }

    if (this.sampleAccurateClock) {
      this.sampleAccurateClock.dispose();
      this.sampleAccurateClock = null;
    }

    if (this.workerTimingManager) {
      this.workerTimingManager.dispose();
      this.workerTimingManager = null;
    }

    if (this.driftCompensator) {
      this.driftCompensator.dispose();
      this.driftCompensator = null;
    }

    this.audioContext = null;
    this.isInitialized = false;

    logger.info('Clock disposed');
  }

  /**
   * Check if using AudioWorklet
   */
  isUsingAudioWorklet(): boolean {
    return this.audioWorkletActive;
  }

  /**
   * Start drift measurement
   */
  private startDriftMeasurement(): void {
    if (this.driftMeasurementInterval || !this.driftCompensator) {
      return;
    }

    const measureInterval = 100; // Measure every 100ms
    let lastMeasureTime = performance.now();
    let lastAudioTime = this.getRawAudioTime(); // Use raw time without compensation

    this.driftMeasurementInterval = window.setInterval(() => {
      const now = performance.now();
      const currentAudioTime = this.getRawAudioTime(); // Use raw time without compensation

      // Calculate expected vs actual time delta
      const expectedDelta = (now - lastMeasureTime) / 1000; // Convert to seconds
      const actualDelta = currentAudioTime - lastAudioTime;

      // Feed measurement to drift compensator
      this.driftCompensator!.measureDrift(
        lastAudioTime + expectedDelta,
        currentAudioTime,
      );

      lastMeasureTime = now;
      lastAudioTime = currentAudioTime;
    }, measureInterval);

    logger.debug('Drift measurement started', { interval: measureInterval });
  }

  /**
   * Get raw audio time without drift compensation
   */
  private getRawAudioTime(): number {
    if (!this.audioContext) {
      throw new ClockSyncError('AudioContext not initialized');
    }

    // Use AudioWorklet time if active
    if (this.audioWorkletActive && this.sampleAccurateClock) {
      return this.sampleAccurateClock.getCurrentTime();
    }
    // Use Web Worker time if active
    else if (this.webWorkerActive && this.workerTimingManager) {
      return this.workerTimingManager.getCurrentTime();
    }
    // Use hardware clock if enabled
    else if (this.useHardwareClock) {
      return this.audioContext.currentTime + this.hardwareClockOffset;
    } else {
      return this.audioContext.currentTime;
    }
  }

  /**
   * Stop drift measurement
   */
  private stopDriftMeasurement(): void {
    if (this.driftMeasurementInterval) {
      clearInterval(this.driftMeasurementInterval);
      this.driftMeasurementInterval = null;
      logger.debug('Drift measurement stopped');
    }
  }

  /**
   * Get drift compensation statistics
   */
  getDriftStatistics() {
    if (!this.driftCompensator) {
      return null;
    }

    return this.driftCompensator.getStatistics();
  }

  /**
   * Update system conditions for adaptive drift compensation
   */
  updateSystemConditions(conditions: {
    cpuUsage?: number;
    memoryPressure?: number;
    networkLatency?: number;
    audioDropouts?: number;
    bufferUnderruns?: number;
  }): void {
    if (this.driftCompensator) {
      this.driftCompensator.updateSystemConditions(conditions);
    }
  }

  /**
   * Destroy the clock
   */
  destroy(): void {
    this.stopSync();

    if (this.sampleAccurateClock) {
      this.sampleAccurateClock.destroy();
      this.sampleAccurateClock = null;
    }

    if (this.workerTimingManager) {
      this.workerTimingManager.destroy();
      this.workerTimingManager = null;
    }

    if (this.driftCompensator) {
      this.driftCompensator.destroy();
      this.driftCompensator = null;
    }

    this.isInitialized = false;
    this.audioWorkletActive = false;
    this.webWorkerActive = false;

    logger.debug('Clock destroyed');
  }
}
