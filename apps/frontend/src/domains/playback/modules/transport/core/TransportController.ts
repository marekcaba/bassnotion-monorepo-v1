/**
 * TransportController - Modern modular transport orchestrator
 *
 * Replaces the monolithic UnifiedTransport with a composition of
 * focused, testable modules. Coordinates timing, scheduling, and
 * position management for professional audio applications.
 *
 * This is the main entry point that applications should use instead
 * of UnifiedTransport.
 */

import { Transport } from './Transport.js';
import { Clock } from './Clock.js';
import { Timeline } from './Timeline.js';
import { Scheduler } from './Scheduler.js';
import { EventScheduler } from '../scheduling/EventScheduler.js';
import { MusicalPositionManager } from '../position/MusicalPositionManager.js';
import { Service } from '../../../services/core/ServiceRegistry.js';
import { EventBus } from '../../../services/core/EventBus.js';
import { AudioEngine } from '../../../services/core/AudioEngine.js';
import { createStructuredLogger } from '../../shared/index.js';
import type {
  TransportConfig,
  TransportState,
  MusicalPosition,
  TimingMetrics,
  TimeSignature,
} from '../types/index.js';
import * as Tone from 'tone';

const logger = createStructuredLogger('TransportController');

export interface TransportControllerConfig extends TransportConfig {
  useModularArchitecture?: boolean;
  enableLegacyCompatibility?: boolean;
}

/**
 * Modern transport controller that orchestrates all timing components
 */
export class TransportController implements Service {
  readonly name = 'TransportController';
  readonly type = 'core';

  // Core modules
  private transport: Transport;
  private eventScheduler: EventScheduler;
  private positionManager: MusicalPositionManager;

  // Dependencies
  private eventBus: EventBus;
  private audioEngine: AudioEngine;

  // State
  private isInitialized = false;
  private state: TransportState = 'stopped';
  private config: TransportControllerConfig;

  // Singleton
  private static instance: TransportController | null = null;

  private constructor(
    eventBus: EventBus,
    audioEngine: AudioEngine,
    config: TransportControllerConfig = {},
  ) {
    this.eventBus = eventBus;
    this.audioEngine = audioEngine;
    this.config = {
      ...config,
      useModularArchitecture: config.useModularArchitecture ?? true,
      enableLegacyCompatibility: config.enableLegacyCompatibility ?? true,
    };

    // Create modules
    this.transport = new Transport(config);
    this.eventScheduler = new EventScheduler({
      lookAheadTime: config.lookAheadTime || 0.1,
      scheduleInterval: 25,
    });
    this.positionManager = new MusicalPositionManager({
      tempo: config.tempo || 120,
      timeSignature: config.timeSignature || { numerator: 4, denominator: 4 },
    });

    this.setupEventListeners();

    logger.info('TransportController created', {
      useModular: this.config.useModularArchitecture,
      legacyCompat: this.config.enableLegacyCompatibility,
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    eventBus?: EventBus,
    audioEngine?: AudioEngine,
    config?: TransportControllerConfig,
  ): TransportController {
    if (!TransportController.instance) {
      if (!eventBus || !audioEngine) {
        throw new Error(
          'EventBus and AudioEngine required for first initialization',
        );
      }
      TransportController.instance = new TransportController(
        eventBus,
        audioEngine,
        config,
      );
    }
    return TransportController.instance;
  }

  /**
   * Initialize the transport system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Already initialized');
      return;
    }

    logger.info('Initializing TransportController...');

    try {
      // Initialize transport with audio context
      const audioContext = await this.audioEngine.getContext();
      await this.transport.initialize(audioContext);

      // Start event scheduler
      this.eventScheduler.start();

      // Sync with Tone.js if legacy compatibility enabled
      if (this.config.enableLegacyCompatibility) {
        this.syncWithTone();
      }

      this.isInitialized = true;

      // Emit ready event
      this.eventBus.emit('transport:ready', {
        modular: this.config.useModularArchitecture,
        features: this.getEnabledFeatures(),
      });

      logger.info('TransportController initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize', error as Error);
      throw error;
    }
  }

  /**
   * Start playback
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    logger.info('Starting playback...');

    // FAANG FIX: ALWAYS reset Tone.Transport.position to 0 before starting playback
    // This prevents position accumulation bugs from previous stop() calls.
    // The position manager handles countdown offset display, so transport should
    // always start from absolute zero. Do NOT set to exercise start position here
    // as it creates a mismatch with the internal position manager.
    if (this.config.enableLegacyCompatibility) {
      Tone.Transport.position = 0;
      logger.info('Reset Tone.Transport.position to 0 for clean playback start');
    }

    // FAANG FIX: Reset position to timeline start (0:0:0) before starting
    // This ensures we always start from the beginning, including countdown
    // The position manager's getDisplayPosition() handles showing countdown as negative bars
    this.positionManager.resetToStart();

    // Start transport
    this.transport.start();

    // Start Tone.Transport for legacy compatibility
    if (this.config.enableLegacyCompatibility && Tone.Transport.state !== 'started') {
      logger.info('Starting Tone.Transport for legacy compatibility');
      Tone.Transport.start();
    }

    // Update state
    this.state = 'playing';

    // Emit events
    this.eventBus.emit('transport:start', {
      position: this.positionManager.getPosition(),
      timestamp: Date.now(),
    });
  }

  /**
   * Stop playback
   */
  async stop(): Promise<void> {
    logger.info('Stopping playback...');

    // Stop transport
    this.transport.stop();

    // NOTE: No longer clearing position update callback here
    // The callback needs to persist across start/stop cycles so position updates
    // work on second and subsequent playback rounds. The interval timer is cleared
    // in transport.stop() which is sufficient to stop position updates.

    // Stop Tone.Transport for legacy compatibility
    if (this.config.enableLegacyCompatibility && Tone.Transport.state !== 'stopped') {
      logger.info('Stopping Tone.Transport for legacy compatibility');
      Tone.Transport.stop();
      // FAANG FIX: Reset to start of EXERCISE (after countdown), not start of countdown
      // This ensures the clock shows 1:0:00 (exercise start) instead of -1:4:00 (countdown start)
      const countdownBeats = this.positionManager.getCountdownBeats();
      if (countdownBeats > 0) {
        // Get time signature to format the position correctly
        const _beatsPerBar = this.config.timeSignature?.numerator || 4;
        const position = `0:${countdownBeats}:0`; // e.g., "0:4:0" for 4/4 time with 4-beat countdown
        Tone.Transport.position = position;
        logger.info('Reset Tone.Transport to exercise start', { position, countdownBeats });
      } else {
        // No countdown - reset to absolute zero
        Tone.Transport.position = 0;
      }
    }

    // Clear scheduled events
    this.eventScheduler.clearAllEvents();

    // Reset position (positionManager.reset() now respects countdown offset)
    this.positionManager.reset();

    // Update state
    this.state = 'stopped';

    // Emit stop event
    this.eventBus.emit('transport:stop', {
      timestamp: Date.now(),
    });


    // CRITICAL FIX: Force position update to prevent race condition
    // The position update interval may have queued a callback before we cleared it.
    // We emit the correct position FIRST, then after a microtask cycle,
    // we emit it AGAIN to ensure it's the last update the UI receives.
    const resetPosition = this.positionManager.getDisplayPosition();
    const positionPayload = {
      position: {
        bars: resetPosition.bars,
        beats: resetPosition.beats,
        sixteenths: resetPosition.sixteenths,
        ticks: resetPosition.ticks,
        seconds: 0,
      },
      timestamp: Date.now(),
    };

    // First emission
    this.eventBus.emit('transport:position-updated', positionPayload);
    logger.debug('Position reset after stop (first emission)', { displayPosition: resetPosition });

    // Schedule second emission after event loop clears to override any stale callbacks
    // This ensures that even if a stale interval callback fires, our correct position wins
    Promise.resolve().then(() => {
      // Check state again - if somehow we're playing again, don't override
      if (this.state === 'stopped') {
        this.eventBus.emit('transport:position-updated', {
          ...positionPayload,
          timestamp: Date.now(),
        });
        logger.debug('Position reset after stop (second emission - race condition guard)', {
          displayPosition: resetPosition,
        });
      }
    });
  }

  /**
   * Pause playback
   */
  async pause(): Promise<void> {
    logger.info('Pausing playback...');

    // Pause transport
    this.transport.pause();

    // Pause Tone.Transport for legacy compatibility
    if (this.config.enableLegacyCompatibility && Tone.Transport.state === 'started') {
      logger.info('Pausing Tone.Transport for legacy compatibility');
      Tone.Transport.pause();
    }

    // Update state
    this.state = 'paused';

    // Emit events
    this.eventBus.emit('transport:pause', {
      position: this.positionManager.getPosition(),
      timestamp: Date.now(),
    });
  }

  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    logger.info('Resuming playback...');

    // Resume transport
    this.transport.resume();

    // Update state
    this.state = 'playing';

    // Emit events
    this.eventBus.emit('transport:resume', {
      position: this.positionManager.getPosition(),
      timestamp: Date.now(),
    });
  }

  /**
   * Seek to position
   */
  async seek(position: MusicalPosition | number): Promise<void> {
    let musicalPosition: MusicalPosition;

    if (typeof position === 'number') {
      musicalPosition = this.positionManager.secondsToPosition(position);
    } else {
      musicalPosition = position;
    }

    const seconds = this.positionManager.positionToSeconds(musicalPosition);

    logger.info('Seeking to position', {
      position: musicalPosition,
      seconds,
    });

    // Seek transport
    this.transport.seek(seconds);

    // Update position
    this.positionManager.setPosition(musicalPosition);

    // Emit event
    this.eventBus.emit('transport:seek', {
      position: musicalPosition,
      seconds,
      timestamp: Date.now(),
    });
  }

  /**
   * Set tempo
   */
  async setTempo(bpm: number): Promise<void> {
    if (bpm < 20 || bpm > 999) {
      throw new Error(`Invalid tempo: ${bpm}`);
    }

    logger.info('🎵 TransportController.setTempo START', {
      bpm,
      currentToneBpm: Tone.Transport.bpm.value,
      transportState: this.state
    });

    // Update transport
    this.transport.setTempo(bpm);

    // Update position manager
    this.positionManager.setTempo(bpm);

    // Sync with Tone.js
    if (this.config.enableLegacyCompatibility) {
      Tone.Transport.bpm.value = bpm;
      logger.info('🎵 TransportController: Tone.js BPM updated', {
        newToneBpm: Tone.Transport.bpm.value,
        success: Tone.Transport.bpm.value === bpm
      });

      // FAANG FIX: Recalculate loop end if loop is enabled
      // When tempo changes, the loop end time in seconds changes even though musical position stays same
      if (Tone.Transport.loop) {
        const loopRegion = this.positionManager.getLoop();
        if (loopRegion.enabled) {
          const startSeconds = this.positionManager.positionToSeconds(loopRegion.start);
          const endSeconds = this.positionManager.positionToSeconds(loopRegion.end);
          Tone.Transport.loopStart = startSeconds;
          Tone.Transport.loopEnd = endSeconds;
          logger.info('🔁 TransportController: Recalculated loop points for new tempo', {
            bpm,
            loopStart: startSeconds,
            loopEnd: endSeconds,
            loopStartBars: loopRegion.start.bars,
            loopEndBars: loopRegion.end.bars
          });
        }
      }
    }

    // Emit event (both 'tempo' and 'bpm' properties for compatibility with different listeners)
    this.eventBus.emit('transport:tempo-change', { tempo: bpm, bpm });
    logger.info('🎵 TransportController: Event emitted', { event: 'transport:tempo-change', data: { tempo: bpm, bpm } });
  }

  /**
   * Set time signature
   */
  async setTimeSignature(timeSignature: TimeSignature): Promise<void> {
    logger.info('Setting time signature', timeSignature);

    // Update transport config - Transport doesn't have setTimeSignature method
    // The timeSignature is set during initialization and through updateConfig
    this.transport.updateConfig({ timeSignature });

    // Update position manager
    this.positionManager.setTimeSignature(timeSignature);

    // Sync with Tone.js
    if (this.config.enableLegacyCompatibility) {
      Tone.Transport.timeSignature = [
        timeSignature.numerator,
        timeSignature.denominator,
      ];
    }

    // Emit event
    this.eventBus.emit('transport:time-signature-change', timeSignature);
  }

  /**
   * Set loop
   */
  async setLoop(start: MusicalPosition, end: MusicalPosition): Promise<void> {
    logger.info('Setting loop', { start, end });

    // Update position manager
    this.positionManager.setLoop(start, end, true);

    // Sync with Tone.js
    if (this.config.enableLegacyCompatibility) {
      const startSeconds = this.positionManager.positionToSeconds(start);
      const endSeconds = this.positionManager.positionToSeconds(end);
      Tone.Transport.loop = true;
      Tone.Transport.loopStart = startSeconds;
      Tone.Transport.loopEnd = endSeconds;
    }

    // Emit event
    this.eventBus.emit('transport:loop-change', { start, end, enabled: true });
  }

  /**
   * Disable loop
   */
  async disableLoop(): Promise<void> {
    logger.info('Disabling loop');

    // Update position manager
    this.positionManager.setLoopEnabled(false);

    // Sync with Tone.js
    if (this.config.enableLegacyCompatibility) {
      Tone.Transport.loop = false;
    }

    // Emit event
    this.eventBus.emit('transport:loop-change', { enabled: false });
  }

  /**
   * Schedule an event
   */
  scheduleEvent(
    time: number | MusicalPosition,
    callback: () => void,
    priority: 'high' | 'normal' | 'low' = 'normal',
  ): string {
    let seconds: number;

    if (typeof time === 'number') {
      seconds = time;
    } else {
      seconds = this.positionManager.positionToSeconds(time);
    }

    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.eventScheduler.scheduleEvent({
      id: eventId,
      time: seconds,
      callback,
      priority,
    });

    return eventId;
  }

  /**
   * Cancel scheduled event
   */
  cancelEvent(eventId: string): void {
    this.eventScheduler.cancelEvent(eventId);
  }

  /**
   * Get current state
   */
  getState(): TransportState {
    return this.state;
  }

  /**
   * Get current position (raw, without countdown adjustment)
   */
  getPosition(): MusicalPosition {
    return this.positionManager.getPosition();
  }

  /**
   * Set countdown offset for display adjustment
   * @param beats Number of beats in countdown (e.g., 4 for one measure of 4/4)
   */
  setCountdownBeats(beats: number): void {
    this.positionManager.setCountdownBeats(beats);
  }

  /**
   * Get display position (adjusted for countdown offset)
   * This is what should be shown in the UI
   */
  getDisplayPosition(): MusicalPosition {
    return this.positionManager.getDisplayPosition();
  }

  /**
   * Get current time in seconds
   */
  getCurrentTime(): number {
    return this.transport.getCurrentTime();
  }

  /**
   * Get metrics
   */
  getMetrics(): TimingMetrics & { scheduler: any } {
    const transportMetrics = this.transport.getMetrics();
    const schedulerMetrics = this.eventScheduler.getMetrics();

    return {
      ...transportMetrics,
      scheduler: schedulerMetrics,
    };
  }

  /**
   * Dispose the transport
   */
  async dispose(): Promise<void> {
    logger.info('Disposing TransportController...');

    // Stop everything
    await this.stop();

    // Dispose modules
    this.transport.destroy();
    this.eventScheduler.destroy();
    this.positionManager.destroy();

    // Clear singleton
    if (TransportController.instance === this) {
      TransportController.instance = null;
    }

    this.isInitialized = false;

    logger.info('TransportController disposed');
  }

  /**
   * Get enabled features
   */
  private getEnabledFeatures(): string[] {
    const features: string[] = [];

    if (this.transport.isUsingAudioWorklet()) {
      features.push('AudioWorklet');
    }

    if (this.config.enableLegacyCompatibility) {
      features.push('ToneJsSync');
    }

    const clockConfig = (this.transport as any).config;
    if (clockConfig?.driftCompensation === 'adaptive') {
      features.push('AdaptiveDriftCompensation');
    }

    return features;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to transport position updates
    this.transport.onPositionUpdate((seconds) => {
      // POSITION RESET BUG FIX: Ignore position updates when not playing
      // This prevents stale callbacks from overwriting the reset position after stop()
      // Race condition: timing worker fires final update AFTER stop() resets position
      if (this.state !== 'playing') {
        logger.debug('Ignoring position update - transport not playing', {
          seconds,
          state: this.state,
        });
        return;
      }

      // Update the raw position internally
      this.positionManager.updatePosition(seconds);

      // CRITICAL: Emit DISPLAY position (adjusted for countdown) to UI
      // This ensures the clock shows -1:1:00 during countdown, 1:1:00 for exercise start
      const displayPosition = this.positionManager.getDisplayPosition();

      // Emit position update (using the correct event name that useTransport expects)
      this.eventBus.emit('transport:position-updated', {
        position: displayPosition,
        seconds,
        timestamp: performance.now(),
      });
    });

    // Listen to position manager events
    this.positionManager.on('loopChange', (loop) => {
      logger.debug('Loop changed', loop);
    });

    this.positionManager.on('tempoChange', ({ current }) => {
      logger.debug('Tempo changed via position manager', { bpm: current });
    });
  }

  /**
   * Sync with Tone.js for legacy compatibility
   */
  private syncWithTone(): void {
    // Sync initial state
    Tone.Transport.bpm.value = this.positionManager.getTempo();
    const timeSignature = this.positionManager.getTimeSignature();
    Tone.Transport.timeSignature = [
      timeSignature.numerator,
      timeSignature.denominator,
    ];

    // Setup bidirectional sync
    const toneSync = () => {
      if (this.state === 'playing' && Tone.Transport.state === 'started') {
        const toneSeconds = Tone.Transport.seconds;
        const ourSeconds = this.transport.getCurrentTime();
        const drift = Math.abs(toneSeconds - ourSeconds);

        // Sync if drift is significant
        if (drift > 0.01) {
          logger.debug('Syncing with Tone.js', { drift });
          Tone.Transport.seconds = ourSeconds;
        }
      }
    };

    // Sync periodically
    setInterval(toneSync, 100);

    logger.info('Tone.js sync enabled');
  }

  // Legacy compatibility methods
  async setBPM(bpm: number): Promise<void> {
    return this.setTempo(bpm);
  }

  async pauseAtQuantum(quantum: string): Promise<void> {
    const duration = this.positionManager.getQuantumDuration(quantum);
    setTimeout(() => this.pause(), duration * 1000);
  }

  async resumeAtQuantum(quantum: string): Promise<void> {
    const duration = this.positionManager.getQuantumDuration(quantum);
    setTimeout(() => this.resume(), duration * 1000);
  }
}
