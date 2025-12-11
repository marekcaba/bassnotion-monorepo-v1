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
import { MusicalPositionManager } from '../position/MusicalPositionManager.js';
import { Service } from '../../../services/core/ServiceRegistry.js';
import { EventBus } from '../../../services/core/EventBus.js';
import { AudioEngine } from '../../../services/core/AudioEngine.js';
import { createStructuredLogger } from '../../shared/index.js';
import { musicalTruth } from '../../tempo/MusicalTruthAuthority.js';
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
  private positionManager: MusicalPositionManager;

  // Dependencies
  private eventBus: EventBus;
  private audioEngine: AudioEngine;

  // State
  private isInitialized = false;
  private state: TransportState = 'stopped';
  private config: TransportControllerConfig;
  private autoStopTimerId: ReturnType<typeof setTimeout> | null = null;

  // Phase 2: Event-driven position updates
  private lastPositionEmitTime = 0;
  private readonly positionUpdateInterval: number;
  private useClockOnTick = false;

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

    // Phase 2: Configure event-driven position updates
    const updateHz =
      typeof process !== 'undefined' &&
      process.env.NEXT_PUBLIC_POSITION_UPDATE_HZ
        ? parseInt(process.env.NEXT_PUBLIC_POSITION_UPDATE_HZ, 10)
        : 120;
    this.positionUpdateInterval = 1000 / updateHz; // Default: 8.3ms = 120 Hz
    this.useClockOnTick =
      typeof process !== 'undefined' &&
      process.env.NEXT_PUBLIC_USE_CLOCK_ONTICK === 'true';

    // Create modules
    this.transport = new Transport(config);
    this.positionManager = new MusicalPositionManager({
      tempo: config.tempo || 120,
      timeSignature: config.timeSignature || { numerator: 4, denominator: 4 },
    });

    this.setupEventListeners();

    // Phase 2: Setup Clock.onTick subscription if enabled
    if (this.useClockOnTick) {
      this.setupClockSubscription();
    }

    logger.info('TransportController created', {
      useModular: this.config.useModularArchitecture,
      legacyCompat: this.config.enableLegacyCompatibility,
      clockOnTick: this.useClockOnTick,
      updateHz: Math.round(1000 / this.positionUpdateInterval),
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
   * Set transport start time (called by PlaybackEngine before start())
   * This ensures audio scheduling and visual clock use the same time reference
   */
  setTransportStartTime(time: number): void {
    this.transport.setTransportStartTime(time);
    logger.info('TransportController: Transport start time set', {
      transportStartTime: time,
      source: 'PlaybackEngine',
    });
  }

  /**
   * Start playback
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // TEMPO FIX: Clear any existing auto-stop timer from previous playback
    // This prevents stale timers (calculated at old tempo) from stopping playback early
    if (this.autoStopTimerId !== null) {
      clearTimeout(this.autoStopTimerId);
      this.autoStopTimerId = null;
      logger.info('Cleared stale auto-stop timer from previous playback');
    }

    logger.info('Starting playback...');

    // FAANG FIX: ALWAYS reset Tone.Transport.position to 0 before starting playback
    // This prevents position accumulation bugs from previous stop() calls.
    // The position manager handles countdown offset display, so transport should
    // always start from absolute zero. Do NOT set to exercise start position here
    // as it creates a mismatch with the internal position manager.
    if (this.config.enableLegacyCompatibility) {
      Tone.Transport.position = 0;
      logger.info(
        'Reset Tone.Transport.position to 0 for clean playback start',
      );
    }

    // FAANG FIX: Reset position to timeline start (0:0:0) before starting
    // This ensures we always start from the beginning, including countdown
    // The position manager's getDisplayPosition() handles showing countdown as negative bars
    this.positionManager.resetToStart();

    // CRITICAL FIX: Set state to 'playing' BEFORE starting transport
    // This prevents race condition where Transport.start() immediately fires
    // position update callback, but TransportController state is still 'stopped',
    // causing the callback to filter out all position updates
    this.state = 'playing';
    console.log(
      '🎯 [CONTROLLER FIX] State set to playing BEFORE transport.start()',
    );

    // COUNTDOWN FIX: Set countdown offset before starting transport
    // Transport.start() will apply this offset right before starting position updates
    const countdownBeats = this.positionManager.getCountdownBeats();
    if (countdownBeats > 0) {
      // 🚨 BPM BUG FIX: Use Tone.Transport.bpm.value (source of truth) instead of this.transport.getTempo()
      // getTempo() returns stale config.tempo (defaults to 120), but Musical Truth sets Tone.Transport.bpm
      const bpm = Tone.Transport.bpm.value;
      const countdownDurationSeconds = (countdownBeats / bpm) * 60;

      // Set countdown offset - Transport will apply it at the right moment
      this.transport.setCountdownOffset(countdownDurationSeconds);

      console.log('🎯 [COUNTDOWN FIX] Set countdown offset on Transport', {
        countdownBeats,
        countdownDurationSeconds: countdownDurationSeconds.toFixed(3),
        bpm,
        explanation:
          'Transport will apply this offset when starting position updates',
      });
      logger.info('🎯 [COUNTDOWN FIX] Set countdown offset', {
        countdownBeats,
        countdownDurationSeconds: countdownDurationSeconds.toFixed(3),
        bpm,
      });
    }

    // Start transport
    this.transport.start();

    // Start Tone.Transport for legacy compatibility
    if (
      this.config.enableLegacyCompatibility &&
      Tone.Transport.state !== 'started'
    ) {
      logger.info('Starting Tone.Transport for legacy compatibility');
      Tone.Transport.start();
    }

    // Emit events
    this.eventBus.emit('transport:start', {
      position: this.positionManager.getPosition(),
      timestamp: Date.now(),
    });

    // Schedule auto-stop at exercise end (if exercise duration is set)
    const timeline = this.transport.getTimeline();
    const exerciseDurationSeconds = timeline.getExerciseDurationSeconds();
    if (exerciseDurationSeconds > 0) {
      const durationMs = exerciseDurationSeconds * 1000;

      logger.info('Scheduling auto-stop', {
        durationSeconds: exerciseDurationSeconds.toFixed(2),
        durationMs,
        durationBeats: timeline.getExerciseDurationBeats(),
      });

      this.autoStopTimerId = setTimeout(() => {
        // Only stop if still playing (user might have stopped manually)
        if (this.state === 'playing') {
          logger.info('Auto-stop triggered at exercise end');
          this.autoStopTimerId = null;
          // GRACEFUL STOP: Let one-shot samples (drums, metronome) finish naturally
          this.stop(true);
        } else {
          logger.debug('Auto-stop skipped - transport not playing', {
            currentState: this.state,
          });
          this.autoStopTimerId = null;
        }
      }, durationMs);
    } else {
      logger.debug(
        'No exercise duration set - playback will continue until manually stopped',
      );
    }
  }

  /**
   * Stop playback
   * @param graceful - If true, allow one-shot samples to finish naturally (auto-stop).
   *                   If false, force-stop all audio immediately (manual stop).
   */
  async stop(graceful = false): Promise<void> {
    // Clear auto-stop timer if present (user manually stopped before exercise end)
    if (this.autoStopTimerId !== null) {
      clearTimeout(this.autoStopTimerId);
      this.autoStopTimerId = null;
      logger.info('🎵 Cleared auto-stop timer (manual stop)');
    }

    // Idempotency check: prevent race conditions from duplicate stop calls
    if (this.state === 'stopped') {
      logger.warn('🎵 Transport already stopped, ignoring duplicate stop call');
      return;
    }

    logger.info('🎵 Stopping playback...', {
      previousState: this.state,
      graceful,
    });

    // Stop transport
    this.transport.stop();

    // NOTE: No longer clearing position update callback here
    // The callback needs to persist across start/stop cycles so position updates
    // work on second and subsequent playback rounds. The interval timer is cleared
    // in transport.stop() which is sufficient to stop position updates.

    // Stop Tone.Transport for legacy compatibility
    if (
      this.config.enableLegacyCompatibility &&
      Tone.Transport.state !== 'stopped'
    ) {
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
        logger.info('Reset Tone.Transport to exercise start', {
          position,
          countdownBeats,
        });
      } else {
        // No countdown - reset to absolute zero
        Tone.Transport.position = 0;
      }
    }

    // Reset position (positionManager.reset() now respects countdown offset)
    this.positionManager.reset();

    // CRITICAL: Update state to 'stopped' IMMEDIATELY
    // This blocks any pending position update interval callbacks
    this.state = 'stopped';
    logger.info('🎵 TransportController: State → stopped');

    // Emit stop event with graceful flag so audio components know how to stop
    this.eventBus.emit('transport:stop', {
      timestamp: Date.now(),
      graceful, // Let CoreServices know if this is auto-stop (graceful) or manual stop
    });

    // Emit final position update to ensure UI shows reset position
    const resetPosition = this.positionManager.getDisplayPosition();
    this.eventBus.emit('transport:position-updated', {
      position: resetPosition,
      seconds: 0,
      timestamp: Date.now(),
    });

    logger.info('🎵 Stop complete - position reset to start', {
      displayPosition: resetPosition,
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
    if (
      this.config.enableLegacyCompatibility &&
      Tone.Transport.state === 'started'
    ) {
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
   * Set tempo (for UI-initiated tempo changes)
   *
   * This method is called when the user changes tempo via the UI slider.
   * It updates the single source of truth (MusicalTruthAuthority) which
   * in turn synchronizes Tone.Transport.bpm.value.
   */
  async setTempo(bpm: number): Promise<void> {
    if (bpm < 20 || bpm > 999) {
      throw new Error(`Invalid tempo: ${bpm}`);
    }

    const previousBpm = Tone.Transport.bpm.value;

    logger.info('🎵 TransportController.setTempo START', {
      requestedBpm: bpm,
      previousBpm,
      transportState: this.state,
    });

    // FIX: Update the single source of truth
    // This updates both musicalTruth.bpm AND Tone.Transport.bpm.value
    musicalTruth.setBPM(bpm);

    logger.info(
      '🎵 TransportController.setTempo: musicalTruth.setBPM() called',
      {
        newBpm: bpm,
        toneBpmAfter: Tone.Transport.bpm.value,
        musicalTruthBpm: musicalTruth.getBPM(),
      },
    );

    // FAANG FIX: Recalculate loop end if loop is enabled
    // When tempo changes, the loop end time in seconds changes even though musical position stays same
    if (this.config.enableLegacyCompatibility && Tone.Transport.loop) {
      const loopRegion = this.positionManager.getLoop();
      if (loopRegion.enabled) {
        const startSeconds = this.positionManager.positionToSeconds(
          loopRegion.start,
        );
        const endSeconds = this.positionManager.positionToSeconds(
          loopRegion.end,
        );
        Tone.Transport.loopStart = startSeconds;
        Tone.Transport.loopEnd = endSeconds;
        logger.info(
          '🔁 TransportController: Recalculated loop points for new tempo',
          {
            bpm,
            loopStart: startSeconds,
            loopEnd: endSeconds,
            loopStartBars: loopRegion.start.bars,
            loopEndBars: loopRegion.end.bars,
          },
        );
      }
    }

    // Emit event (both 'tempo' and 'bpm' properties for compatibility with different listeners)
    this.eventBus.emit('transport:tempo-change', { tempo: bpm, bpm });
    logger.info('🎵 TransportController.setTempo COMPLETE', {
      bpm,
      previousBpm,
      toneBpmVerify: Tone.Transport.bpm.value,
    });
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
   * Set exercise duration for auto-stop functionality
   * @param totalBars - Total number of bars (including countdown)
   * @param beatsPerBar - Beats per bar from time signature
   */
  setExerciseDuration(totalBars: number, beatsPerBar: number): void {
    const timeline = this.transport.getTimeline();
    timeline.setExerciseDuration(totalBars, beatsPerBar);
    logger.info('Exercise duration configured for auto-stop', {
      totalBars,
      beatsPerBar,
      totalBeats: totalBars * beatsPerBar,
    });
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

    return {
      ...transportMetrics,
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
    // Listen to transport position updates from internal timing (sample-accurate)
    this.transport.onPositionUpdate((seconds) => {
      // POSITION RESET BUG FIX: Ignore position updates when not playing
      // This prevents stale callbacks from overwriting the reset position after stop()
      // Race condition: timing worker fires final update AFTER stop() resets position
      if (this.state !== 'playing') {
        return;
      }

      // DEBUG: Log source of position update
      console.log('[TRANSPORT DEBUG] Transport.onPositionUpdate', {
        source: 'internal-timing',
        seconds: seconds.toFixed(3),
      });

      // Update position using internal transport timing (AudioContext.currentTime)
      // This is sample-accurate and reliable, unlike Tone.Transport.position
      this.positionManager.updatePosition(seconds);

      // Get display position (adjusted for countdown using SIMPLIFIED logic)
      // The simplified getDisplayPosition() eliminates Math.floor() jumps
      const displayPosition = this.positionManager.getDisplayPosition();
      const rawPosition = this.positionManager.getPosition();

      // POSITION DEBUG: Log the transformation (reduced frequency)
      if (Math.random() < 0.1) {
        // 10% of updates
        console.log('🎵 [POSITION UPDATE] Internal timing', {
          seconds: seconds.toFixed(3),
          rawPosition: `${rawPosition.bars}:${rawPosition.beats}:${rawPosition.sixteenths}`,
          displayPosition: `${displayPosition.bars}:${displayPosition.beats}:${displayPosition.sixteenths}`,
          countdownBeats: this.positionManager.getCountdownBeats(),
          note: 'Sample-accurate timing + simplified countdown = smooth clock!',
        });
      }

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
   * Setup Clock.onTick subscription for event-driven position updates (Phase 2)
   *
   * This replaces the polling-based Transport.startPositionUpdates() with direct
   * AudioWorklet timing updates. The AudioWorklet sends updates at 374 Hz, which
   * we throttle to a configurable rate (default: 120 Hz) before emitting to EventBus.
   *
   * **Benefits**:
   * - Eliminates 50 Hz setInterval polling loop
   * - Uses high-frequency AudioWorklet timing more efficiently
   * - Reduces CPU overhead (no redundant clock reads)
   * - More responsive UI updates (120 Hz vs 50 Hz)
   *
   * **Throttling**: AudioWorklet produces 374 updates/sec, we emit at 120 Hz (configurable)
   * to balance smoothness vs performance.
   */
  private setupClockSubscription(): void {
    const clock = this.transport.getClock();

    // Subscribe to high-frequency AudioWorklet updates (374 Hz)
    clock.setOnTick((time: number) => {
      // Only process position updates when playing
      if (this.state !== 'playing') {
        return;
      }

      // Throttle to configured update rate (default: 120 Hz = 8.3ms)
      const now = performance.now();
      if (now - this.lastPositionEmitTime < this.positionUpdateInterval) {
        return; // Drop this update (throttling)
      }

      this.lastPositionEmitTime = now;

      // DEBUG: Log source of position update
      console.log('[TRANSPORT DEBUG] Clock.onTick', {
        source: 'audioworklet',
        time: time.toFixed(3),
      });

      // Update position using AudioWorklet timing
      this.positionManager.updatePosition(time);

      // Get display position (adjusted for countdown)
      const displayPosition = this.positionManager.getDisplayPosition();

      // DIAGNOSTIC: Log throttled update rate (10% sample)
      if (Math.random() < 0.1) {
        logger.debug('Clock.onTick position update', {
          time: time.toFixed(3),
          displayPosition: `${displayPosition.bars}:${displayPosition.beats}:${displayPosition.sixteenths}`,
          throttleMs: this.positionUpdateInterval.toFixed(2),
          note: 'Event-driven from AudioWorklet (Phase 2)',
        });
      }

      // Emit position update to EventBus
      this.eventBus.emit('transport:position-updated', {
        position: displayPosition,
        seconds: time,
        timestamp: now,
      });
    });

    logger.info('Clock.onTick subscription enabled', {
      updateHz: Math.round(1000 / this.positionUpdateInterval),
      intervalMs: this.positionUpdateInterval.toFixed(2),
      source: 'AudioWorklet (374 Hz throttled)',
    });
  }

  /**
   * Sync with Tone.js for legacy compatibility
   */
  private syncWithTone(): void {
    // ✅ NOTE: This reads from musicalTruth via positionManager
    // musicalTruth.setFromExercise() already synchronizes Tone.Transport.bpm,
    // but this provides additional sync for legacy compatibility mode
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
