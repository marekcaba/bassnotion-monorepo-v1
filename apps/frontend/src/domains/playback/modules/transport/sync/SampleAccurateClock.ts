/**
 * SampleAccurateClock - High-precision clock using AudioWorklet
 *
 * Provides sample-accurate timing for professional audio applications
 * with sub-millisecond precision and drift compensation.
 */

import {
  AudioWorkletManager,
  TimingUpdate,
} from '../worklets/AudioWorkletManager.js';
import { createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('SampleAccurateClock');

export interface SampleAccurateClockConfig {
  updateInterval?: number; // seconds between updates (default: 0.00267 = 128/48000)
  lookAheadTime?: number; // seconds to look ahead (default: 0.2)
  driftThreshold?: number; // max acceptable drift in ms (default: 1)
  workletPath?: string; // path to timing-processor.js
}

export interface ClockState {
  isRunning: boolean;
  currentTime: number; // seconds
  currentFrame: number; // audio frames
  audioContextTime: number; // AudioContext.currentTime
  updateCount: number;
  lastUpdateTime: number; // performance.now()
}

export type ClockEventType =
  | 'start'
  | 'stop'
  | 'pause'
  | 'resume'
  | 'tick'
  | 'drift';

export interface ClockEvent {
  type: ClockEventType;
  time: number;
  frame?: number;
  drift?: number;
}

export class SampleAccurateClock {
  private workletManager: AudioWorkletManager;
  private audioContext: AudioContext | null = null;
  private state: ClockState = {
    isRunning: false,
    currentTime: 0,
    currentFrame: 0,
    audioContextTime: 0,
    updateCount: 0,
    lastUpdateTime: 0,
  };

  // Timing tracking
  private startTime = 0;
  private lastDriftWarnTime = 0;
  private pauseTime = 0;
  private elapsedBeforePause = 0;

  // Drift tracking
  private driftHistory: number[] = [];
  private readonly maxDriftHistorySize = 100;

  // Callbacks
  private onTick?: (time: number, frame: number) => void;
  private onDrift?: (drift: number) => void;

  constructor(private config: SampleAccurateClockConfig = {}) {
    this.config = {
      updateInterval: config.updateInterval || 0.00267,
      lookAheadTime: config.lookAheadTime || 0.2,
      driftThreshold: config.driftThreshold || 1,
      workletPath: config.workletPath,
    };

    // Create AudioWorkletManager
    this.workletManager = new AudioWorkletManager({
      updateInterval: this.config.updateInterval,
      lookAheadTime: this.config.lookAheadTime,
      workletPath: this.config.workletPath,
    });

    // Set up event listeners
    this.setupEventListeners();

    logger.info('SampleAccurateClock initialized', this.config);
  }

  /**
   * Initialize with AudioContext
   */
  async initialize(audioContext: AudioContext): Promise<void> {
    this.audioContext = audioContext;

    try {
      await this.workletManager.initialize(audioContext);
      logger.info('Clock initialized with AudioContext', {
        sampleRate: audioContext.sampleRate,
        state: audioContext.state,
      });
    } catch (error) {
      logger.error('Failed to initialize clock', error as Error);
      throw error;
    }
  }

  /**
   * Set up event listeners for the AudioWorkletManager
   */
  private setupEventListeners(): void {
    this.workletManager.on('timing-update', (update: TimingUpdate) => {
      this.handleTimingUpdate(update);
    });

    this.workletManager.on('timing-warning', (warning: any) => {
      logger.warn('Timing warning from AudioWorklet', warning);
    });

    this.workletManager.on('stats', (stats: any) => {
      logger.debug('AudioWorklet stats', stats);
    });
  }

  /**
   * Handle timing update from AudioWorklet
   */
  private handleTimingUpdate(update: TimingUpdate): void {
    const now = performance.now();

    // Update state
    this.state.currentTime = update.time;
    this.state.currentFrame = update.playbackFrame;
    this.state.audioContextTime = update.audioContextTime;
    this.state.updateCount = update.updateCount;

    // Calculate drift if we have a previous update
    if (this.state.lastUpdateTime > 0) {
      const actualInterval = (now - this.state.lastUpdateTime) / 1000;
      const expectedInterval = this.config.updateInterval!;
      const drift = Math.abs(actualInterval - expectedInterval) * 1000; // ms

      // Track drift history
      this.driftHistory.push(drift);
      if (this.driftHistory.length > this.maxDriftHistorySize) {
        this.driftHistory.shift();
      }

      // Only log high drift occasionally to reduce spam
      if (drift > this.config.driftThreshold!) {
        // Only log every 1000ms to reduce console spam
        if (
          !this.lastDriftWarnTime ||
          Date.now() - this.lastDriftWarnTime > 1000
        ) {
          logger.debug('Drift compensation active', {
            drift: drift.toFixed(2),
            threshold: this.config.driftThreshold,
          });
          this.lastDriftWarnTime = Date.now();
        }
        this.onDrift?.(drift);
      }
    }

    this.state.lastUpdateTime = now;

    // Call tick callback
    this.onTick?.(update.time, update.playbackFrame);
  }

  /**
   * Start the clock
   */
  start(): void {
    if (this.state.isRunning) {
      logger.warn('Clock already running');
      return;
    }

    this.startTime = performance.now();
    this.state.isRunning = true;

    // If we have paused time, resume from there
    const fromFrame =
      this.pauseTime > 0
        ? Math.floor(
            (this.elapsedBeforePause / 1000) * this.audioContext!.sampleRate,
          )
        : undefined;

    this.workletManager.start(fromFrame);
    logger.info('Clock started', { fromFrame });
  }

  /**
   * Stop the clock
   */
  stop(): void {
    if (!this.state.isRunning && this.pauseTime === 0) {
      logger.warn('Clock already stopped');
      return;
    }

    this.state.isRunning = false;
    this.startTime = 0;
    this.pauseTime = 0;
    this.elapsedBeforePause = 0;

    // Reset state
    this.state.currentTime = 0;
    this.state.currentFrame = 0;
    this.state.updateCount = 0;
    this.state.lastUpdateTime = 0;

    this.workletManager.stop();
    logger.info('Clock stopped');
  }

  /**
   * Pause the clock
   */
  pause(): void {
    if (!this.state.isRunning) {
      logger.warn('Clock not running');
      return;
    }

    this.pauseTime = performance.now();
    this.elapsedBeforePause += this.pauseTime - this.startTime;
    this.state.isRunning = false;

    this.workletManager.pause();
    logger.info('Clock paused', {
      elapsed: this.elapsedBeforePause / 1000,
      frame: this.state.currentFrame,
    });
  }

  /**
   * Resume from pause
   */
  resume(): void {
    if (this.state.isRunning) {
      logger.warn('Clock already running');
      return;
    }

    if (this.pauseTime === 0) {
      logger.warn('Clock not paused');
      return;
    }

    this.startTime = performance.now();
    this.state.isRunning = true;

    const fromFrame = Math.floor(
      (this.elapsedBeforePause / 1000) * this.audioContext!.sampleRate,
    );
    this.workletManager.start(fromFrame);

    logger.info('Clock resumed', {
      elapsed: this.elapsedBeforePause / 1000,
      fromFrame,
    });
  }

  /**
   * Wait for the first timing update from AudioWorklet
   *
   * This method resolves once the AudioWorklet has sent its first timing update,
   * ensuring that getCurrentTime() returns an accurate value instead of 0.
   *
   * **Critical for avoiding race conditions**: When starting playback, the Transport
   * captures `transportStartTime` immediately after calling start(). If this happens
   * before the AudioWorklet sends its first update (~3ms delay), the captured time
   * will be 0 while AudioContext.currentTime is already ~32ms, causing negative
   * elapsed time calculations.
   *
   * @param timeoutMs Maximum time to wait in milliseconds (default: 50ms)
   * @returns Promise that resolves when first update is received or rejects on timeout
   *
   * @example
   * ```typescript
   * clock.start();
   * await clock.waitForFirstUpdate(50); // Wait max 50ms
   * const startTime = clock.getCurrentTime(); // Now guaranteed to be accurate
   * ```
   */
  async waitForFirstUpdate(timeoutMs = 50): Promise<void> {
    // If we already have updates, no need to wait
    if (this.state.updateCount > 0) {
      logger.debug('waitForFirstUpdate: Already have updates', {
        updateCount: this.state.updateCount,
      });
      return;
    }

    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const checkInterval = 1; // Check every 1ms

      const intervalId = setInterval(() => {
        if (this.state.updateCount > 0) {
          clearInterval(intervalId);
          const elapsed = performance.now() - startTime;
          logger.info('waitForFirstUpdate: First update received', {
            elapsed: `${elapsed.toFixed(2)}ms`,
            updateCount: this.state.updateCount,
            currentTime: this.state.currentTime.toFixed(6),
          });
          resolve();
        } else if (performance.now() - startTime > timeoutMs) {
          clearInterval(intervalId);
          const error = new Error(
            `AudioWorklet first update timeout after ${timeoutMs}ms`,
          );
          logger.error('waitForFirstUpdate: Timeout', error);
          reject(error);
        }
      }, checkInterval);
    });
  }

  /**
   * Seek to a specific time
   */
  seek(seconds: number): void {
    this.elapsedBeforePause = seconds * 1000;
    this.workletManager.seek(seconds);

    logger.info('Clock seeked', { position: seconds });
  }

  /**
   * Get current time in seconds
   */
  getCurrentTime(): number {
    return this.state.currentTime;
  }

  /**
   * Get current frame
   */
  getCurrentFrame(): number {
    return this.state.currentFrame;
  }

  /**
   * Get update count (number of timing updates received from AudioWorklet)
   */
  getUpdateCount(): number {
    return this.state.updateCount;
  }

  /**
   * Get last update timestamp (performance.now() when last update received)
   */
  getLastUpdateTime(): number {
    return this.state.lastUpdateTime;
  }

  /**
   * Get current state
   */
  getState(): Readonly<ClockState> {
    return { ...this.state };
  }

  /**
   * Get average drift
   */
  getAverageDrift(): number {
    if (this.driftHistory.length === 0) return 0;

    const sum = this.driftHistory.reduce((acc, drift) => acc + drift, 0);
    return sum / this.driftHistory.length;
  }

  /**
   * Get max drift
   */
  getMaxDrift(): number {
    if (this.driftHistory.length === 0) return 0;
    return Math.max(...this.driftHistory);
  }

  /**
   * Set tick callback
   */
  setOnTick(callback: (time: number, frame: number) => void): void {
    this.onTick = callback;
  }

  /**
   * Set drift callback
   */
  setOnDrift(callback: (drift: number) => void): void {
    this.onDrift = callback;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SampleAccurateClockConfig>): void {
    Object.assign(this.config, config);

    this.workletManager.updateConfig({
      updateInterval: config.updateInterval,
      lookAheadTime: config.lookAheadTime,
    });

    logger.info('Clock config updated', config);
  }

  /**
   * Check if clock is active
   */
  isActive(): boolean {
    return this.workletManager.isActive();
  }

  /**
   * Get timing metrics
   */
  getMetrics(): {
    avgDrift: number;
    maxDrift: number;
    stability: number;
    updateRate: number;
  } {
    const avgDrift = this.getAverageDrift();
    const maxDrift = this.getMaxDrift();
    const stability =
      avgDrift < this.config.driftThreshold!
        ? 100
        : (this.config.driftThreshold! / avgDrift) * 100;
    const updateRate = 1 / this.config.updateInterval!;

    return {
      avgDrift,
      maxDrift,
      stability,
      updateRate,
    };
  }

  /**
   * Destroy the clock
   */
  destroy(): void {
    this.stop();
    this.workletManager.destroy();
    this.onTick = undefined;
    this.onDrift = undefined;

    logger.info('Clock destroyed');
  }

  /**
   * Dispose alias for destroy (for consistency)
   */
  dispose(): void {
    this.destroy();
  }
}
