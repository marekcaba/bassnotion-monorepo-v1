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
// Phase 2.2: AdaptiveDriftCompensator deprecated - AudioWorklet provides sample accuracy
// Only used when driftCompensation === 'adaptive' (default is 'basic')
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
  // hardwareClockOffset removed - Phase 2: Legacy timing cleanup
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
  // Phase 2.2: DEPRECATED - Only used when config.driftCompensation === 'adaptive' (default: 'basic')
  // AudioWorklet provides sample-accurate timing without drift compensation
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
      // FIGHTING CLOCKS FIX: Disable Web Worker timing loop
      // TimingWorker runs parallel setInterval that conflicts with Transport.startPositionUpdates()
      useWebWorker: config.useWebWorker ?? false,
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

    // 🔧 FIX: DON'T initialize AudioWorklet if AudioContext is suspended
    // AudioWorklet requires a running context, which needs user interaction
    // Defer AudioWorklet initialization until after user gesture resumes the context
    if (this.useAudioWorklet && audioContext.state === 'running') {
      try {
        await this.initializeAudioWorklet();
      } catch (error) {
        logger.warn(
          'Failed to initialize AudioWorklet, will try Web Worker',
          error as Error,
        );
        this.audioWorkletActive = false;
      }
    } else if (this.useAudioWorklet && audioContext.state !== 'running') {
      logger.info('AudioContext suspended - deferring AudioWorklet initialization until context resumes');
      // AudioWorklet will be initialized later when context is resumed
    }

    // Try Web Worker as fallback if AudioWorklet failed
    // 🔧 FIX: Also defer WebWorker if AudioContext is suspended (may need running context)
    if (!this.audioWorkletActive && this.useWebWorker && audioContext.state === 'running') {
      try {
        await this.initializeWebWorker();
      } catch (error) {
        logger.warn(
          'Failed to initialize Web Worker, falling back to basic clock',
          error as Error,
        );
        this.webWorkerActive = false;
      }
    } else if (!this.audioWorkletActive && this.useWebWorker && audioContext.state !== 'running') {
      logger.info('AudioContext suspended - deferring WebWorker initialization until context resumes');
      // WebWorker will be initialized later when context is resumed
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

    // FIGHTING CLOCKS FIX: Monitor AudioContext state changes and retry AudioWorklet initialization
    // when context resumes from suspended state (e.g., after user interaction)
    audioContext.addEventListener('statechange', async () => {
      logger.info('AudioContext state changed', {
        newState: audioContext.state,
        currentMode: this.audioWorkletActive
          ? 'AudioWorklet'
          : this.webWorkerActive
            ? 'WebWorker'
            : 'Basic',
      });

      // If context just became running and we're not using AudioWorklet yet, try to initialize it
      if (
        audioContext.state === 'running' &&
        !this.audioWorkletActive &&
        this.useAudioWorklet
      ) {
        logger.info('Attempting to initialize AudioWorklet now that context is running');
        try {
          await this.initializeAudioWorklet();
          logger.info('✅ Successfully upgraded to AudioWorklet mode', {
            previousMode: this.webWorkerActive ? 'WebWorker' : 'Basic',
          });
        } catch (error) {
          logger.warn('Failed to initialize AudioWorklet after context resume', error as Error);

          // Try WebWorker as fallback
          if (!this.webWorkerActive && this.useWebWorker) {
            try {
              await this.initializeWebWorker();
              logger.info('✅ Fallback to WebWorker mode successful');
            } catch (workerError) {
              logger.warn('WebWorker fallback also failed, staying in Basic mode', workerError as Error);
            }
          }
        }
      }
    });

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
      stateChangeListenerAdded: true,
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
    let timeSource: string;
    let fallbackTriggered = false;

    // Use AudioWorklet time if active AND providing updates
    if (this.audioWorkletActive && this.sampleAccurateClock) {
      const workletTime = this.sampleAccurateClock.getCurrentTime();
      const contextTime = this.audioContext.currentTime;
      const updateCount = this.sampleAccurateClock.getUpdateCount();
      const lastUpdateTime = this.sampleAccurateClock.getLastUpdateTime();
      const timeSinceLastUpdate = lastUpdateTime > 0 ? performance.now() - lastUpdateTime : 0;

      // 🔧 RACE CONDITION FIX: Distinguish between states
      // - Running + no updates yet: Trust 0 (just started, race condition fix)
      // - Not running + no updates: Fallback to hardware clock (not started)
      // - Running + has updates but stopped: Fallback to hardware clock (stuck)
      const isRunning = this.sampleAccurateClock.getState().isRunning;
      const isStuck =
        updateCount > 0 && // Has received updates before
        timeSinceLastUpdate > 100; // But hasn't updated in >100ms (stuck!)

      if (workletTime === 0 && contextTime > 0 && isStuck) {
        // AudioWorklet is STUCK - fallback to raw AudioContext time
        baseTime = contextTime;
        timeSource = 'AudioContext (FALLBACK - STUCK)';
        fallbackTriggered = true;
        console.warn('⚠️ [CLOCK] AudioWorklet stuck - falling back to AudioContext', {
          timeSinceLastUpdate: timeSinceLastUpdate.toFixed(0) + 'ms',
        });
      } else if (workletTime === 0 && contextTime > 0 && updateCount === 0 && !isRunning) {
        // AudioWorklet initialized but NOT started yet - fallback to AudioContext
        baseTime = contextTime;
        timeSource = 'AudioContext (FALLBACK - NOT STARTED)';
        fallbackTriggered = true;
      } else if (workletTime === 0 && contextTime > 0 && updateCount === 0 && isRunning) {
        // AudioWorklet IS running but no updates yet - trust 0 (race condition fix)
        baseTime = workletTime;
        timeSource = 'AudioWorklet (STARTUP - isRunning=true)';
      } else {
        // Normal case - AudioWorklet is running and providing updates
        baseTime = workletTime;
        timeSource = 'AudioWorklet';
      }
    }
    // Use Web Worker time if active
    else if (this.webWorkerActive && this.workerTimingManager) {
      baseTime = this.workerTimingManager.getCurrentTime();
      timeSource = 'WebWorker';
      console.log('🔄 [CLOCK DIAGNOSTIC] getAudioTime() from WebWorker', {
        returnedTime: baseTime.toFixed(6),
      });
    }
    // Fallback to raw AudioContext time
    else {
      baseTime = this.audioContext.currentTime;
      timeSource = 'AudioContext (fallback)';
      console.log('🔄 [CLOCK DIAGNOSTIC] getAudioTime() from AudioContext fallback', {
        returnedTime: baseTime.toFixed(6),
        reason: this.useHardwareClock ? 'useHardwareClock enabled but offset removed' : 'AudioWorklet/WebWorker not active',
      });
    }

    // Phase 2.2: Drift compensation deprecated - only applies when config === 'adaptive'
    // Default config is 'basic', so this code path is rarely (if ever) executed
    if (this.driftCompensator && this.config.driftCompensation === 'adaptive') {
      const compensation = this.driftCompensator.getCompensation();
      const finalTime = baseTime + compensation / 1000;
      console.warn('⚠️ [CLOCK] DEPRECATED: Using adaptive drift compensation', {
        baseTime: baseTime.toFixed(6),
        compensation: compensation.toFixed(3) + 'ms',
        finalTime: finalTime.toFixed(6),
        note: 'Consider using default (basic) mode - AudioWorklet provides sample accuracy',
      });
      return finalTime; // Convert ms to seconds
    }

    return baseTime;
  }

  /**
   * Get the current active timing source (for debugging/monitoring)
   * Phase 2.3: Diagnostic method to verify which timing source is being used
   */
  getCurrentTimeSource(): string {
    if (!this.audioContext) {
      return 'Not initialized';
    }

    if (this.audioWorkletActive && this.sampleAccurateClock) {
      const workletTime = this.sampleAccurateClock.getCurrentTime();
      const updateCount = this.sampleAccurateClock.getUpdateCount();
      const isRunning = this.sampleAccurateClock.getState().isRunning;

      if (workletTime === 0 && updateCount === 0 && isRunning) {
        return 'AudioWorklet (starting)';
      } else if (workletTime > 0 || updateCount > 0) {
        return 'AudioWorklet (active)';
      } else {
        return 'AudioWorklet (fallback to AudioContext)';
      }
    } else if (this.webWorkerActive && this.workerTimingManager) {
      return 'WebWorker';
    } else {
      return 'AudioContext (fallback)';
    }
  }

  /**
   * Get raw AudioContext time without hardware clock offset
   * Use this for transport timing to avoid hardware clock drift affecting position calculations
   */
  getRawAudioTime(): number {
    if (!this.audioContext) {
      throw new ClockSyncError('AudioContext not initialized');
    }

    return this.audioContext.currentTime;
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

      // hardwareClockOffset assignment removed - Phase 2: Legacy timing cleanup

      logger.debug('Clock synced (offset calculation disabled)', {
        offset: avgOffset,
        samples: this.clockSyncHistory.length,
        note: 'hardwareClockOffset removed - using raw AudioContext time',
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
    // hardwareClockOffset = 0 removed - Phase 2: Legacy timing cleanup
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
    // Fallback to raw AudioContext time
    else {
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
