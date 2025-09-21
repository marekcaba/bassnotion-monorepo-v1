/**
 * Transport - Main transport coordinator
 *
 * Responsibilities:
 * - High-level transport control (play/pause/stop/seek)
 * - Component coordination (Clock, Timeline, Scheduler)
 * - State management
 * - Public API for transport operations
 */

import { Clock } from './Clock.js';
import { Timeline } from './Timeline.js';
import { Scheduler } from './Scheduler.js';
import {
  TransportState,
  TransportConfig,
  MusicalPosition,
  TimingMetrics,
  TransportPosition,
  TimingEvent,
  ScheduleOptions,
} from '../types/index.js';
import { TransportError } from '../types/errors.js';
import { createStructuredLogger } from '../../shared/index.js';
import { TRANSPORT_TIMING_CONFIG } from '../../../config/transportTiming.js';
import * as Tone from 'tone';

const logger = createStructuredLogger('Transport');

export class Transport {
  private clock: Clock;
  private timeline: Timeline;
  private scheduler: Scheduler;
  private state: TransportState = 'stopped';
  private config: TransportConfig;
  private isInitialized = false;

  // Position update callback
  private positionUpdateCallback?: (seconds: number) => void;

  // Metrics tracking
  private metrics: TimingMetrics = {
    stability: 100,
    avgDrift: 0,
    maxDrift: 0,
    jitter: 0,
    updateRate: 0,
    bufferHealth: 100,
    cpuLoad: 0,
    totalEvents: 0,
    missedEvents: 0,
  };

  constructor(config: Partial<TransportConfig> = {}) {
    // Use centralized timing configuration
    this.config = {
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      lookAheadTime: TRANSPORT_TIMING_CONFIG.lookAheadTime,
      scheduleInterval: TRANSPORT_TIMING_CONFIG.updateInterval,
      enableAudioWorklet: true,
      enableWebWorker: true,
      driftCompensation: 'adaptive',
      bufferStrategy: 'adaptive',
      ...config,
    };

    // Create components
    this.clock = new Clock({
      useAudioWorklet: this.config.enableAudioWorklet,
      driftCompensation: this.config.driftCompensation,
    });
    this.timeline = new Timeline();
    this.scheduler = new Scheduler({
      lookAheadTime: this.config.lookAheadTime,
      scheduleInterval: this.config.scheduleInterval,
    });

    logger.info('Transport initialized with timing config', {
      lookAheadTime: `${this.config.lookAheadTime * 1000}ms`,
      scheduleInterval: `${this.config.scheduleInterval * 1000}ms`,
    });

    // Set initial config
    this.timeline.setTempo(this.config.tempo);
    this.timeline.setTimeSignature(this.config.timeSignature);

    logger.info('Transport created', { config: this.config });
  }

  /**
   * Initialize transport with audio context
   */
  async initialize(audioContext: AudioContext): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Transport already initialized');
      return;
    }

    // Initialize components (clock may use AudioWorklet)
    await this.clock.initialize(audioContext);

    // Start clock sync (only for basic mode)
    this.clock.startSync();

    // Initialize Tone.js transport
    await Tone.start();
    Tone.Transport.bpm.value = this.config.tempo;

    this.isInitialized = true;
    logger.info('Transport initialized');
  }

  /**
   * Start transport playback
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new TransportError('Transport not initialized');
    }

    if (this.state === 'playing') {
      logger.warn('Transport already playing');
      return;
    }

    // Start Tone.js transport
    Tone.Transport.start();

    // Start scheduler
    this.scheduler.start();

    // Start clock timing (for AudioWorklet mode)
    this.clock.start();

    // Update state
    this.state = 'playing';

    // Start position updates
    this.startPositionUpdates();

    logger.info('Transport started', {
      audioWorkletMode: this.clock.isUsingAudioWorklet(),
    });
  }

  /**
   * Stop transport playback
   */
  async stop(): Promise<void> {
    if (this.state === 'stopped') {
      logger.warn('Transport already stopped');
      return;
    }

    // Stop Tone.js transport
    Tone.Transport.stop();

    // Stop scheduler
    this.scheduler.stop();

    // Stop clock timing (for AudioWorklet mode)
    this.clock.stop();

    // Reset timeline position
    this.timeline.setPosition({
      bars: 0,
      beats: 0,
      sixteenths: 0,
      ticks: 0,
    });

    // Reset Tone position
    Tone.Transport.position = '0:0:0';

    // Update state
    this.state = 'stopped';

    // Stop position updates
    this.stopPositionUpdates();

    logger.info('Transport stopped');
  }

  /**
   * Pause transport playback
   */
  async pause(): Promise<void> {
    if (this.state !== 'playing') {
      logger.warn('Transport not playing');
      return;
    }

    // Pause Tone.js transport
    Tone.Transport.pause();

    // Pause clock timing (for AudioWorklet mode)
    this.clock.pause();

    // Update state
    this.state = 'paused';

    // Stop position updates
    this.stopPositionUpdates();

    logger.info('Transport paused', { position: this.timeline.getPosition() });
  }

  /**
   * Resume transport playback
   */
  async resume(): Promise<void> {
    if (this.state !== 'paused') {
      logger.warn('Transport not paused');
      return;
    }

    // Resume Tone.js transport
    Tone.Transport.start();

    // Resume clock timing (for AudioWorklet mode)
    this.clock.resume();

    // Update state
    this.state = 'playing';

    // Resume position updates
    this.startPositionUpdates();

    logger.info('Transport resumed');
  }

  /**
   * Seek to position
   */
  async seek(position: MusicalPosition): Promise<void> {
    // Update timeline
    this.timeline.setPosition(position);

    // Update Tone.js position
    const tonePosition = this.timeline.positionToToneFormat(position);
    Tone.Transport.position = tonePosition;

    // Update clock position (for AudioWorklet mode)
    const seconds = this.timeline.positionToSeconds(position);
    this.clock.seek(seconds);

    // Clear and reschedule events if playing
    if (this.state === 'playing') {
      this.scheduler.clearAllScheduledEvents();
      // Events will be rescheduled on next update
    }

    logger.info('Transport seeked', { position });
  }

  /**
   * Set tempo
   */
  setTempo(bpm: number): void {
    this.config.tempo = bpm;
    this.timeline.setTempo(bpm);
    Tone.Transport.bpm.value = bpm;
    logger.info('Tempo set', { bpm });
  }

  /**
   * Get current state
   */
  getState(): TransportState {
    return this.state;
  }

  /**
   * Get current position
   */
  getPosition(): MusicalPosition {
    return this.timeline.getPosition();
  }

  /**
   * Get transport position with time info
   */
  getTransportPosition(): TransportPosition {
    return this.timeline.getTransportPosition();
  }

  /**
   * Get current tempo
   */
  getTempo(): number {
    return this.config.tempo;
  }

  /**
   * Get timing metrics
   */
  getMetrics(): TimingMetrics {
    // Get clock metrics
    const clockMetrics = this.clock.getMetrics();

    // Update metrics with current values
    this.metrics.stability = clockMetrics.stability;
    this.metrics.avgDrift = clockMetrics.avgDrift;
    this.metrics.maxDrift = clockMetrics.maxDrift;

    const stats = this.scheduler.getStats();
    this.metrics.totalEvents = stats.queueLength + stats.scheduledCount;

    return { ...this.metrics };
  }

  /**
   * Schedule an event
   */
  scheduleEvent(event: Omit<TimingEvent, 'id'>): string {
    return this.scheduler.scheduleEvent(event);
  }

  /**
   * Schedule a callback at specific time
   */
  schedule(
    callback: (time: number) => void,
    time: number,
    options?: ScheduleOptions,
  ): string {
    return this.scheduler.scheduleOnce(callback, time, options);
  }

  /**
   * Schedule repeating event
   */
  scheduleRepeat(
    callback: (time: number) => void,
    interval: string | number,
    startTime?: number,
  ): string {
    return this.scheduler.scheduleRepeat(callback, interval, startTime);
  }

  /**
   * Cancel scheduled event
   */
  cancelEvent(eventId: string): void {
    this.scheduler.cancelEvent(eventId);
  }

  /**
   * Set loop enabled
   */
  setLoopEnabled(enabled: boolean): void {
    this.timeline.setLoopEnabled(enabled);
    Tone.Transport.loop = enabled;
  }

  /**
   * Set loop points
   */
  setLoopPoints(start: MusicalPosition, end: MusicalPosition): void {
    this.timeline.setLoopPoints(start, end);

    // Convert to Tone format
    const startStr = this.timeline.positionToToneFormat(start);
    const endStr = this.timeline.positionToToneFormat(end);

    Tone.Transport.loopStart = startStr;
    Tone.Transport.loopEnd = endStr;
  }

  /**
   * Register position update callback
   */
  onPositionUpdate(callback: (seconds: number) => void): void {
    this.positionUpdateCallback = callback;
  }

  /**
   * Check if using AudioWorklet
   */
  isUsingAudioWorklet(): boolean {
    return this.config.enableAudioWorklet ?? true;
  }

  /**
   * Dispose transport
   */
  dispose(): void {
    this.stop();
    this.clock.destroy();
    this.scheduler.reset();
    this.timeline.reset();
    this.isInitialized = false;
    this.positionUpdateCallback = undefined;
    logger.info('Transport disposed');
  }

  /**
   * Alias for dispose (for compatibility)
   */
  destroy(): void {
    this.dispose();
  }

  // Private methods

  private positionUpdateInterval: number | null = null;

  /**
   * Start position update loop
   */
  private startPositionUpdates(): void {
    if (this.positionUpdateInterval !== null) {
      return;
    }

    const update = () => {
      if (this.state !== 'playing') {
        return;
      }

      // Update timeline from clock
      const currentTime = this.clock.getAudioTime();
      this.timeline.updatePositionFromSeconds(currentTime);

      // Emit position update event (would integrate with EventBus)
      const position = this.timeline.getTransportPosition();
      logger.debug('Position update', { position });

      // Call position update callback if registered
      if (this.positionUpdateCallback) {
        this.positionUpdateCallback(currentTime);
      }
    };

    // Initial update
    update();

    // Set up periodic updates
    this.positionUpdateInterval = window.setInterval(
      update,
      this.config.scheduleInterval * 1000,
    );
  }

  /**
   * Stop position update loop
   */
  private stopPositionUpdates(): void {
    if (this.positionUpdateInterval !== null) {
      window.clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TransportConfig>): void {
    this.config = { ...this.config, ...config };

    // Update components
    if (config.tempo !== undefined) {
      this.setTempo(config.tempo);
    }

    if (config.timeSignature !== undefined) {
      this.timeline.setTimeSignature(config.timeSignature);
    }

    if (
      config.lookAheadTime !== undefined ||
      config.scheduleInterval !== undefined
    ) {
      // Would need to recreate scheduler with new config
      logger.warn('Scheduler config changes require restart');
    }

    logger.info('Transport config updated', config);
  }

  /**
   * Get scheduler stats for debugging
   */
  getSchedulerStats() {
    return this.scheduler.getStats();
  }

  /**
   * Get clock sync data for debugging
   */
  getClockSyncData() {
    return this.clock.getSyncData();
  }
}
