/**
 * Clock - High-precision timing source for the transport system
 * 
 * Responsibilities:
 * - AudioContext time management
 * - Hardware clock synchronization
 * - Clock drift compensation
 * - Time source abstraction
 */

import { ClockSyncData } from '../types/index.js';
import { ClockSyncError } from '../types/errors.js';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('TransportClock');

export class Clock {
  private audioContext: AudioContext | null = null;
  private useHardwareClock = true;
  private hardwareClockOffset = 0;
  private clockSyncInterval: number | null = null;
  private clockSyncHistory: number[] = [];
  private readonly clockSyncHistorySize = 10;
  private isInitialized = false;
  private syncIntervalMs = 1000; // Sync every second

  constructor() {
    logger.debug('Clock instance created');
  }

  /**
   * Initialize the clock with an audio context
   */
  initialize(audioContext: AudioContext): void {
    if (this.isInitialized) {
      logger.warn('Clock already initialized');
      return;
    }

    this.audioContext = audioContext;
    this.isInitialized = true;
    
    // Perform initial sync
    this.syncWithHardware();
    
    logger.info('Clock initialized', {
      sampleRate: audioContext.sampleRate,
      baseLatency: audioContext.baseLatency,
      outputLatency: audioContext.outputLatency,
    });
  }

  /**
   * Get the current audio time in seconds
   */
  getCurrentTime(): number {
    if (!this.audioContext) {
      throw new ClockSyncError('Clock not initialized');
    }

    if (this.useHardwareClock) {
      // Use AudioContext time with offset compensation
      return this.audioContext.currentTime + this.hardwareClockOffset / 1000;
    }

    // Fallback to performance time
    return performance.now() / 1000;
  }

  /**
   * Get the audio context sample rate
   */
  getSampleRate(): number {
    if (!this.audioContext) {
      throw new ClockSyncError('Clock not initialized');
    }
    return this.audioContext.sampleRate;
  }

  /**
   * Sync with hardware clock
   */
  syncWithHardware(): void {
    if (!this.audioContext) {
      logger.warn('Cannot sync - no audio context');
      return;
    }

    // Get high-resolution timestamps
    const perfTime = performance.now();
    const audioTime = this.audioContext.currentTime * 1000; // Convert to ms
    const offset = perfTime - audioTime;

    // Add to history
    this.clockSyncHistory.push(offset);
    if (this.clockSyncHistory.length > this.clockSyncHistorySize) {
      this.clockSyncHistory.shift();
    }

    // Calculate average offset for stability
    const avgOffset = this.clockSyncHistory.reduce((a, b) => a + b, 0) / this.clockSyncHistory.length;
    const oldOffset = this.hardwareClockOffset;
    this.hardwareClockOffset = avgOffset;

    // Log significant changes
    const adjustment = avgOffset - oldOffset;
    if (Math.abs(adjustment) > 1 && this.clockSyncHistory.length > 1) {
      logger.verbose('Clock sync adjustment', {
        adjustment: adjustment.toFixed(2),
        offset: avgOffset.toFixed(2),
      });
    }
  }

  /**
   * Get clock sync data
   */
  getSyncData(): ClockSyncData {
    if (!this.audioContext) {
      throw new ClockSyncError('Clock not initialized');
    }

    const audioTime = this.audioContext.currentTime;
    const systemTime = performance.now() / 1000;
    const offset = this.hardwareClockOffset / 1000;
    
    // Calculate confidence based on sync history consistency
    let confidence = 0;
    if (this.clockSyncHistory.length >= 2) {
      const variance = this.calculateVariance(this.clockSyncHistory);
      // Lower variance = higher confidence
      confidence = Math.max(0, Math.min(1, 1 - (variance / 10)));
    }

    return {
      audioTime,
      systemTime,
      offset,
      confidence,
    };
  }

  /**
   * Get clock stability (0-1)
   */
  getStability(): number {
    if (this.clockSyncHistory.length < 2) {
      return 0;
    }

    const variance = this.calculateVariance(this.clockSyncHistory);
    // Convert variance to stability score
    return Math.max(0, Math.min(1, 1 - (variance / 50)));
  }

  /**
   * Start clock synchronization
   */
  startSync(): void {
    if (this.clockSyncInterval !== null) {
      logger.warn('Clock sync already running');
      return;
    }

    logger.info('Starting clock sync');
    
    // Initial sync
    this.syncWithHardware();
    
    // Set up periodic sync
    this.clockSyncInterval = window.setInterval(() => {
      this.syncWithHardware();
    }, this.syncIntervalMs);
  }

  /**
   * Stop clock synchronization
   */
  stopSync(): void {
    if (this.clockSyncInterval !== null) {
      window.clearInterval(this.clockSyncInterval);
      this.clockSyncInterval = null;
      logger.info('Clock sync stopped');
    }
  }

  /**
   * Reset clock state
   */
  reset(): void {
    this.hardwareClockOffset = 0;
    this.clockSyncHistory = [];
    this.stopSync();
    logger.info('Clock reset');
  }

  /**
   * Check if clock is initialized
   */
  isInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get clock offset for drift compensation
   */
  getClockOffset(): number {
    return this.hardwareClockOffset;
  }

  /**
   * Set whether to use hardware clock
   */
  setUseHardwareClock(use: boolean): void {
    this.useHardwareClock = use;
    logger.info('Hardware clock usage changed', { useHardwareClock: use });
  }

  /**
   * Dispose of clock resources
   */
  dispose(): void {
    this.stopSync();
    this.audioContext = null;
    this.isInitialized = false;
    this.reset();
    logger.info('Clock disposed');
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }
}