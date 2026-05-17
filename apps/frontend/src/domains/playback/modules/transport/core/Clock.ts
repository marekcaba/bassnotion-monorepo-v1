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
import { WorkerTimingManager } from '../sync/WorkerTimingManager.js';
import { TRANSPORT_TIMING_CONFIG } from '../../../config/transportTiming.js';

const logger = createStructuredLogger('TransportClock');

export interface ClockConfig {
  useAudioWorklet?: boolean;
  useWebWorker?: boolean;
  useHardwareClock?: boolean;
  syncIntervalMs?: number;
  audioWorkletPath?: string;
  workerPath?: string;
  driftCompensation?: 'off' | 'basic'; // 'adaptive' removed - AdaptiveDriftCompensator deprecated
}

/**
 * Legacy config interface for backward compatibility
 * Maps old property names to new ClockConfig properties
 */
interface LegacyClockConfig {
  enableAudioWorklet?: boolean; // Maps to useAudioWorklet
  enableWebWorker?: boolean; // Maps to useWebWorker
  driftCompensation?: 'none' | 'off' | 'basic'; // 'none' maps to 'off'
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

  // Configuration
  private config: ClockConfig;

  // Callbacks
  private onTick?: (time: number) => void;

  // CLEANUP FIX: Store listener reference for proper cleanup
  private stateChangeListener: (() => void) | null = null;

  // EVENT-DRIVEN FIX: Track if start() was called before AudioWorklet was ready
  // If true, we need to start SampleAccurateClock once AudioWorklet is initialized
  private pendingStart = false;

  constructor(config: ClockConfig = {}) {
    // Handle legacy config options with proper typing
    const legacyConfig = config as ClockConfig & LegacyClockConfig;
    if (
      'enableAudioWorklet' in legacyConfig &&
      legacyConfig.enableAudioWorklet !== undefined
    ) {
      config.useAudioWorklet = legacyConfig.enableAudioWorklet;
    }
    if (
      'enableWebWorker' in legacyConfig &&
      legacyConfig.enableWebWorker !== undefined
    ) {
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
      logger.info(
        'AudioContext suspended - deferring AudioWorklet initialization until context resumes',
      );
      // AudioWorklet will be initialized later when context is resumed
    }

    // Try Web Worker as fallback if AudioWorklet failed
    // 🔧 FIX: Also defer WebWorker if AudioContext is suspended (may need running context)
    if (
      !this.audioWorkletActive &&
      this.useWebWorker &&
      audioContext.state === 'running'
    ) {
      try {
        await this.initializeWebWorker();
      } catch (error) {
        logger.warn(
          'Failed to initialize Web Worker, falling back to basic clock',
          error as Error,
        );
        this.webWorkerActive = false;
      }
    } else if (
      !this.audioWorkletActive &&
      this.useWebWorker &&
      audioContext.state !== 'running'
    ) {
      logger.info(
        'AudioContext suspended - deferring WebWorker initialization until context resumes',
      );
      // WebWorker will be initialized later when context is resumed
    }

    this.isInitialized = true;

    // Perform initial sync if not using AudioWorklet
    if (!this.audioWorkletActive) {
      this.syncWithHardware();
    }

    // FIGHTING CLOCKS FIX: Monitor AudioContext state changes and retry AudioWorklet initialization
    // when context resumes from suspended state (e.g., after user interaction)
    // CLEANUP FIX: Store listener reference for proper removal in dispose()
    this.stateChangeListener = async () => {
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
        logger.info(
          'Attempting to initialize AudioWorklet now that context is running',
        );
        try {
          await this.initializeAudioWorklet();

          // TIMING JITTER FIX: Stop the 1-second sync interval when upgrading to AudioWorklet
          // AudioWorklet provides sample-accurate timing, so the sync interval is not needed
          // and can cause timing jitter interference with position updates
          if (this.clockSyncInterval !== null) {
            clearInterval(this.clockSyncInterval);
            this.clockSyncInterval = null;
            logger.info(
              'Stopped clock sync interval after AudioWorklet upgrade',
            );
          }

          logger.info('✅ Successfully upgraded to AudioWorklet mode', {
            previousMode: this.webWorkerActive ? 'WebWorker' : 'Basic',
          });

          // EVENT-DRIVEN FIX: If start() was called before AudioWorklet was ready,
          // start the SampleAccurateClock now that it's initialized
          if (this.pendingStart && this.sampleAccurateClock) {
            console.log(
              `📊 [CLOCK DEBUG] Processing pendingStart - starting SampleAccurateClock now`,
            );
            this.sampleAccurateClock.start();
            this.pendingStart = false;
          }
        } catch (error) {
          logger.warn(
            'Failed to initialize AudioWorklet after context resume',
            error as Error,
          );

          // Try WebWorker as fallback
          if (!this.webWorkerActive && this.useWebWorker) {
            try {
              await this.initializeWebWorker();
              logger.info('✅ Fallback to WebWorker mode successful');
            } catch (workerError) {
              logger.warn(
                'WebWorker fallback also failed, staying in Basic mode',
                workerError as Error,
              );
            }
          }
        }
      }
    };
    audioContext.addEventListener('statechange', this.stateChangeListener);

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
    // DRIFT FIX: Use TRANSPORT_TIMING_CONFIG.updateInterval (20ms) instead of 2.67ms
    // The mismatch between AudioWorklet (2.67ms) and Transport (20ms) intervals was causing drift
    // By aligning them, we reduce timing discrepancies that accumulate over time
    this.sampleAccurateClock = new SampleAccurateClock({
      updateInterval: TRANSPORT_TIMING_CONFIG.updateInterval, // 20ms - aligned with Transport scheduler
      lookAheadTime: TRANSPORT_TIMING_CONFIG.lookAheadTime, // 150ms - consistent with Transport
      driftThreshold: 1,
      workletPath: this.config.audioWorkletPath,
    });

    // Set up callbacks
    this.sampleAccurateClock.setOnTick((time, frame) => {
      this.currentTime = time;
      this.currentFrame = frame;
      this.lastUpdateTime = performance.now();
      // Debug: log first 3 ticks to verify callback chain
      if (frame <= 3) {
        console.log(`📊 [CLOCK DEBUG] sampleAccurateClock.onTick #${frame}`, {
          time: time.toFixed(3),
          hasOnTick: !!this.onTick,
        });
      }
      this.onTick?.(time);
    });

    // Initialize with AudioContext
    await this.sampleAccurateClock.initialize(this.audioContext);
    this.audioWorkletActive = true;

    console.log(`📊 [CLOCK DEBUG] initializeAudioWorklet() complete`, {
      audioWorkletActive: this.audioWorkletActive,
      hasExternalOnTick: !!this.onTick,
      note: 'External onTick should be true if TransportController.setupClockSubscription() was called before this',
    });

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
  }

  /**
   * Start timing updates
   */
  start(): void {
    console.log(`📊 [CLOCK DEBUG] Clock.start() called`, {
      audioWorkletActive: this.audioWorkletActive,
      hasSampleAccurateClock: !!this.sampleAccurateClock,
      webWorkerActive: this.webWorkerActive,
      useAudioWorklet: this.useAudioWorklet,
    });
    if (this.audioWorkletActive && this.sampleAccurateClock) {
      this.sampleAccurateClock.start();
      this.pendingStart = false;
    } else if (this.webWorkerActive && this.workerTimingManager) {
      this.workerTimingManager.start();
      this.pendingStart = false;
    } else if (this.useAudioWorklet && !this.audioWorkletActive) {
      // EVENT-DRIVEN FIX: AudioWorklet not ready yet, mark as pending
      // SampleAccurateClock will be started once AudioWorklet initializes
      this.pendingStart = true;
      console.log(
        `📊 [CLOCK DEBUG] AudioWorklet not ready, marking pendingStart=true`,
      );
    }
  }

  /**
   * Stop timing updates
   */
  stop(): void {
    // Clear pending start on stop
    this.pendingStart = false;

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
    let _timeSource: string; // Prefixed with _ to indicate intentionally unused (for debugging)
    let _fallbackTriggered = false; // Prefixed with _ to indicate intentionally unused (for debugging)

    // Use AudioWorklet time if active AND providing updates
    if (this.audioWorkletActive && this.sampleAccurateClock) {
      const workletTime = this.sampleAccurateClock.getCurrentTime();
      const contextTime = this.audioContext.currentTime;
      const updateCount = this.sampleAccurateClock.getUpdateCount();
      const lastUpdateTime = this.sampleAccurateClock.getLastUpdateTime();
      const timeSinceLastUpdate =
        lastUpdateTime > 0 ? performance.now() - lastUpdateTime : 0;

      // 🔧 RACE CONDITION DETECTION: Distinguish between AudioWorklet states
      // This provides a SECONDARY DEFENSE against race conditions.
      // PRIMARY FIX: Transport.start() now calls waitForFirstUpdate() before capturing transportStartTime.
      //
      // State machine:
      // 1. STUCK: Has received updates before but stopped updating (>100ms) → Fallback to AudioContext
      // 2. NOT STARTED: Initialized but not running, no updates → Fallback to AudioContext
      // 3. STARTUP RACE: Running but no updates yet → Trust 0 (should be rare with waitForFirstUpdate())
      // 4. NORMAL: Running and receiving updates → Use AudioWorklet time
      const isRunning = this.sampleAccurateClock.getState().isRunning;
      const isStuck =
        updateCount > 0 && // Has received updates before
        timeSinceLastUpdate > 100; // But hasn't updated in >100ms (stuck!)

      if (workletTime === 0 && contextTime > 0 && isStuck) {
        // STATE 1: AudioWorklet is STUCK - fallback to raw AudioContext time
        baseTime = contextTime;
        _timeSource = 'AudioContext (FALLBACK - STUCK)';
        _fallbackTriggered = true;
        logger.warn('AudioWorklet stuck, falling back to AudioContext', {
          timeSinceLastUpdate,
          updateCount,
        });
      } else if (
        workletTime === 0 &&
        contextTime > 0 &&
        updateCount === 0 &&
        !isRunning
      ) {
        // STATE 2: AudioWorklet initialized but NOT started yet - fallback to AudioContext
        baseTime = contextTime;
        _timeSource = 'AudioContext (FALLBACK - NOT STARTED)';
        _fallbackTriggered = true;
      } else if (
        workletTime === 0 &&
        contextTime > 0 &&
        updateCount === 0 &&
        isRunning
      ) {
        // STATE 3: AudioWorklet IS running but no updates yet (STARTUP RACE)
        // This should be RARE now that Transport.start() calls waitForFirstUpdate()
        // If we see this log frequently, it indicates waitForFirstUpdate() may be timing out
        baseTime = workletTime;
        _timeSource = 'AudioWorklet (STARTUP - NO UPDATES YET)';
        logger.debug('AudioWorklet startup race detected (secondary defense)', {
          note: 'This should be rare with waitForFirstUpdate() barrier',
          contextTime: contextTime.toFixed(6),
          workletTime: workletTime.toFixed(6),
        });
      } else {
        // STATE 4: Normal case - AudioWorklet is running and providing updates
        baseTime = workletTime;
        _timeSource = 'AudioWorklet';
      }
    }
    // Use Web Worker time if active
    else if (this.webWorkerActive && this.workerTimingManager) {
      baseTime = this.workerTimingManager.getCurrentTime();
      _timeSource = 'WebWorker';
      logger.debug('getAudioTime() from WebWorker', {
        returnedTime: baseTime.toFixed(6),
      });
    }
    // Fallback to raw AudioContext time
    else {
      baseTime = this.audioContext.currentTime;
      _timeSource = 'AudioContext (fallback)';
      logger.debug('getAudioTime() from AudioContext fallback', {
        returnedTime: baseTime.toFixed(6),
        reason: this.useHardwareClock
          ? 'useHardwareClock enabled but offset removed'
          : 'AudioWorklet/WebWorker not active',
      });
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
    console.log(`📊 [CLOCK DEBUG] setOnTick() called`, {
      hadPreviousCallback: !!this.onTick,
      isInitialized: this.isInitialized,
      audioWorkletActive: this.audioWorkletActive,
      hasSampleAccurateClock: !!this.sampleAccurateClock,
    });
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
   *
   * TIMING JITTER FIX: This method is only useful when AudioWorklet is NOT active.
   * When AudioWorklet is active, it provides sample-accurate timing and this
   * sync interval is not needed. Running both can cause timing jitter.
   */
  startPeriodicSync(): void {
    // TIMING JITTER FIX: Don't start sync if AudioWorklet is active
    // The 1-second sync interval can interfere with position updates,
    // causing a 19ms micro-jitter pattern every ~1 second
    if (this.audioWorkletActive) {
      logger.debug('Skipping periodic sync - AudioWorklet active');
      return;
    }

    if (this.clockSyncInterval !== null) {
      return; // Already syncing
    }

    this.clockSyncInterval = window.setInterval(() => {
      this.syncWithHardware();
    }, this.syncIntervalMs);

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

    // NOTE: driftMeasurementInterval was removed in Phase 2 cleanup
    // The adaptive drift compensation feature is deprecated

    // CLEANUP FIX: Remove AudioContext statechange listener to prevent memory leak
    if (this.stateChangeListener && this.audioContext) {
      this.audioContext.removeEventListener(
        'statechange',
        this.stateChangeListener,
      );
      this.stateChangeListener = null;
      logger.info('Removed AudioContext statechange listener');
    }

    if (this.sampleAccurateClock) {
      this.sampleAccurateClock.dispose();
      this.sampleAccurateClock = null;
    }

    if (this.workerTimingManager) {
      this.workerTimingManager.dispose();
      this.workerTimingManager = null;
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
   * Get the SampleAccurateClock instance (for advanced timing operations)
   *
   * @returns SampleAccurateClock instance if AudioWorklet is active, null otherwise
   */
  getSampleAccurateClock(): SampleAccurateClock | null {
    return this.sampleAccurateClock;
  }

  /**
   * Destroy the clock
   */
  destroy(): void {
    this.stopSync();

    // CLEANUP FIX: Remove AudioContext statechange listener to prevent memory leak
    if (this.stateChangeListener && this.audioContext) {
      this.audioContext.removeEventListener(
        'statechange',
        this.stateChangeListener,
      );
      this.stateChangeListener = null;
    }

    if (this.sampleAccurateClock) {
      this.sampleAccurateClock.destroy();
      this.sampleAccurateClock = null;
    }

    if (this.workerTimingManager) {
      this.workerTimingManager.destroy();
      this.workerTimingManager = null;
    }

    this.isInitialized = false;
    this.audioWorkletActive = false;
    this.webWorkerActive = false;

    logger.debug('Clock destroyed');
  }
}
