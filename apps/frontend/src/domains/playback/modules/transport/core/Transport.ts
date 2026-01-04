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
import { musicalTruth } from '../../tempo/MusicalTruthAuthority.js';

// Helper to get Tone from window (must be initialized before Transport is used)
function getTone(): any {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = (window as any).Tone || (window as any).__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error('Transport: Tone.js not loaded. Ensure AudioEngine is initialized first.');
}

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

  // ✅ DOUBLE COUNTDOWN FIX: Countdown offset for visual display
  // Set by TransportController before calling start() to adjust clock display
  private countdownOffsetSeconds: number = 0;

  // 🔧 COUNTDOWN TIME FIX: Track transport start time for elapsed time calculation
  // Captures audioContext.currentTime when transport starts to calculate relative elapsed time
  // This ensures position updates start from 0s (showing -1:4:0 countdown) instead of skipping ahead
  private transportStartTime: number = 0;
  // Flag to indicate if transportStartTime was set externally (by PlaybackEngine)
  // If true, start() will NOT override it with its own calculation
  private transportStartTimeSetExternally: boolean = false;

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
      driftCompensation: 'basic',
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

    // 🔧 FIX: DON'T call Tone.start() during initialization!
    // Tone.start() resumes the AudioContext, which requires a user gesture and will block for up to 5 seconds.
    // The AudioContext will be resumed later by AudioProvider's click handler.
    // Just configure Tone.js transport without starting it:
    // await Tone.start(); // ❌ REMOVED - blocks initialization

    // TEMPO FIX: Do NOT set Tone.Transport.bpm here!
    // MusicalTruthAuthority is the single source of truth for tempo.
    // Tone.Transport.bpm will be set when:
    // 1. An exercise is loaded via musicalTruth.setFromExercise()
    // 2. User adjusts tempo via musicalTruth.setBPM()
    // Setting a default here (e.g., 120) would cause the exercise tempo to be overwritten.
    // const Tone = getTone();
    // Tone.Transport.bpm.value = this.config.tempo; // ❌ REMOVED - bypasses MusicalTruthAuthority

    this.isInitialized = true;
    logger.info(
      'Transport initialized (AudioContext will be resumed on user gesture)',
    );
  }

  /**
   * ✅ DOUBLE COUNTDOWN FIX: Set countdown offset for visual display
   * Called by TransportController before start() to adjust clock display
   * @param seconds - Countdown duration in seconds (e.g., 3.478 for 4 beats at 69 BPM)
   */
  setCountdownOffset(seconds: number): void {
    this.countdownOffsetSeconds = seconds;
    logger.info('🎯 [COUNTDOWN FIX] Countdown offset set', {
      countdownOffsetSeconds: seconds,
    });
  }

  /**
   * 🔧 TIMING SYNC FIX: Set transportStartTime externally from PlaybackEngine
   * This ensures Transport uses the SAME transportStartTime as PlaybackEngine,
   * preventing visual-audio desync caused by Transport capturing its own value later.
   * @param time - The audioContext.currentTime when playback actually starts (from PlaybackEngine)
   */
  setTransportStartTime(time: number): void {
    this.transportStartTime = time;
    this.transportStartTimeSetExternally = true;
    console.log('🎯 [TIMING SYNC] Transport received transportStartTime from PlaybackEngine', {
      transportStartTime: time.toFixed(3) + 's',
      setExternally: true,
    });
    logger.info('🎯 [TIMING SYNC] Transport received transportStartTime from PlaybackEngine', {
      transportStartTime: time,
      setExternally: true,
    });
  }

  /**
   * Start transport playback
   */
  async start(): Promise<void> {
    const startDebug = {
      isInitialized: this.isInitialized,
      currentState: this.state,
      timestamp: Date.now(),
    };
    console.log('🚀 [TRANSPORT DEBUG] Transport.start() called', startDebug);
    logger.info('🚀 [TRANSPORT DEBUG] Transport.start() called', startDebug);

    if (!this.isInitialized) {
      throw new TransportError('Transport not initialized');
    }

    if (this.state === 'playing') {
      console.warn(
        '🚀 [TRANSPORT DEBUG] Transport already playing, early return!',
        {
          state: this.state,
        },
      );
      logger.warn(
        '🚀 [TRANSPORT DEBUG] Transport already playing, early return!',
        {
          state: this.state,
        },
      );
      return;
    }

    // Start Tone.js transport
    const Tone = getTone();
    Tone.Transport.start();

    // Start scheduler
    this.scheduler.start();

    console.log('🚀 [TRANSPORT DIAGNOSTIC] About to start clock', {
      audioWorkletActive: (this.clock as any).audioWorkletActive,
      timestamp: performance.now(),
    });

    // Start clock timing (for AudioWorklet mode)
    this.clock.start();

    console.log(
      '🚀 [TRANSPORT DIAGNOSTIC] Clock started, waiting for AudioWorklet first update',
      {
        timestamp: performance.now(),
        note: '🔧 RACE CONDITION FIX: Wait for AudioWorklet to send first timing update',
      },
    );

    // 🔧 RACE CONDITION FIX: Wait for AudioWorklet first update before capturing transportStartTime
    // Without this, transportStartTime may be captured as 0 while AudioContext.currentTime is ~32ms,
    // causing negative elapsed time calculations that corrupt the clock display.
    // This barrier ensures the AudioWorklet has sent its first timing update (~3ms delay).
    if (this.clock.isUsingAudioWorklet()) {
      const sampleAccurateClock = this.clock.getSampleAccurateClock();
      if (sampleAccurateClock) {
        try {
          await sampleAccurateClock.waitForFirstUpdate(100); // Wait max 100ms - allows AudioWorklet more time to start
          console.log(
            '🚀 [RACE CONDITION FIX] First AudioWorklet update received',
            {
              timestamp: performance.now(),
              updateCount: sampleAccurateClock.getUpdateCount(),
            },
          );
        } catch (error) {
          console.warn(
            '🚀 [RACE CONDITION FIX] Timeout waiting for first update, using AudioContext time',
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );
          logger.warn(
            'AudioWorklet first update timeout, using AudioContext time',
            error as Error,
          );
        }
      }
    }

    // 🔧 VISUAL TIMING FIX: ALWAYS capture transportStartTime from Clock for visual position
    // The external transportStartTime from PlaybackEngine is for audio scheduling (EventRouter),
    // NOT for visual position calculation. The Clock may use AudioWorklet which has its own
    // time reference (starts from 0 when playback begins), so we must capture from the same source.
    this.transportStartTime = this.clock.getAudioTime();
    console.log('🚀 [VISUAL TIMING] Captured transportStartTime from Clock for visual sync', {
      transportStartTime: this.transportStartTime.toFixed(6),
      clockSource: this.clock.isUsingAudioWorklet() ? 'AudioWorklet' : 'AudioContext',
      explanation: 'Visual position calculated relative to Clock time, not PlaybackEngine time',
    });
    logger.info('🚀 [VISUAL TIMING] Transport captured Clock-based transportStartTime', {
      transportStartTime: this.transportStartTime,
    });

    // Update state
    this.state = 'playing';
    console.log('🚀 [TRANSPORT DEBUG] Transport state set to playing', {
      state: this.state,
    });
    logger.info('🚀 [TRANSPORT DEBUG] Transport state set to playing', {
      state: this.state,
    });

    // Start position updates
    console.log('🚀 [TRANSPORT DEBUG] About to call startPositionUpdates()');
    logger.info('🚀 [TRANSPORT DEBUG] About to call startPositionUpdates()', {
      timestamp: Date.now(),
    });
    this.startPositionUpdates();

    console.log('🚀 [TRANSPORT DEBUG] Transport started', {
      audioWorkletMode: this.clock.isUsingAudioWorklet(),
      state: this.state,
    });
    logger.info('🚀 [TRANSPORT DEBUG] Transport started', {
      audioWorkletMode: this.clock.isUsingAudioWorklet(),
      state: this.state,
    });
  }

  /**
   * Stop transport playback
   */
  async stop(): Promise<void> {
    logger.info('Transport.stop() called', {
      currentState: this.state,
    });

    // CRITICAL FIX: Always stop position updates even if already stopped
    // This prevents position update interval leaks on redundant stop() calls
    // The stopPositionUpdates() method is idempotent and safe to call multiple times
    this.stopPositionUpdates();

    if (this.state === 'stopped') {
      return;
    }

    // Stop Tone.js transport
    const Tone = getTone();
    Tone.Transport.stop();

    // CRITICAL FIX: Cancel all scheduled events on Tone.Transport
    // Tone.Transport.stop() only pauses time advancement but does NOT cancel scheduled events
    // Without cancel(), events scheduled on the timeline will continue to fire
    try {
      Tone.Transport.cancel(0); // Cancel all events from time 0 onwards
      logger.info('🎵 Cancelled all Tone.Transport scheduled events');
    } catch (e) {
      logger.error('🎵 Failed to cancel Tone.Transport events', e);
    }

    // Stop scheduler
    this.scheduler.stop();

    // Stop clock timing (for AudioWorklet mode)
    this.clock.stop();

    // Reset timeline position (internal only)
    this.timeline.setPosition({
      bars: 0,
      beats: 0,
      sixteenths: 0,
      ticks: 0,
    });

    // 🔧 TIMING SYNC FIX: Reset transport start time and flag on stop
    // Ensures clean restart - next start() will wait for PlaybackEngine to sync
    this.transportStartTime = 0;
    this.transportStartTimeSetExternally = false;
    console.log('🛑 [TIMING SYNC] Reset transport start time and sync flag');
    logger.info('🛑 [TIMING SYNC] Transport start time and sync flag reset');

    // FAANG FIX: DO NOT reset Tone.Transport.position here!
    // TransportController.stop() handles this with countdown-aware logic.
    // Setting it to '0:0:0' here creates a race condition with TransportController's
    // reset to '0:4:0' (exercise start position), causing the clock to show '3:1:00'
    // on the 3rd playback when timing is unlucky.

    // Update state
    this.state = 'stopped';
    logger.info('Transport stopped', {
      state: this.state,
    });
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
    const Tone = getTone();
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
    const Tone = getTone();
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
    const Tone = getTone();
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
   *
   * IMPORTANT: This delegates to MusicalTruthAuthority which is the ONE source of truth
   * for tempo. MusicalTruthAuthority handles:
   * - Updating internal truth.bpm
   * - Syncing Tone.Transport.bpm.value
   * - Notifying all listeners
   */
  setTempo(bpm: number): void {
    const oldBpm = this.config.tempo;

    // 🎵 TEMPO FIX: Delegate to MusicalTruthAuthority instead of direct Tone.Transport write
    // This ensures ALL tempo changes go through the single source of truth
    musicalTruth.setBPM(bpm);

    // Update local config and timeline to stay in sync
    this.config.tempo = bpm;
    this.timeline.setTempo(bpm);

    logger.info('🎵 Transport.setTempo delegated to musicalTruth', {
      requestedBpm: bpm,
      oldBpm,
      newBpm: musicalTruth.getBPM(),
      source: 'Transport.setTempo -> musicalTruth.setBPM',
    });
  }

  /**
   * Get current state
   */
  getState(): TransportState {
    return this.state;
  }

  /**
   * Get current time in seconds
   */
  getCurrentTime(): number {
    // If we're using Tone.js in compatibility mode, use its time
    if (this.config.enableLegacyCompatibility) {
      try {
        const Tone = getTone();
        return Tone.Transport.seconds;
      } catch {
        // Tone not loaded yet, use clock
      }
    }
    // Otherwise use our clock
    return this.clock.getCurrentTime();
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
   * Get timeline instance
   */
  getTimeline(): Timeline {
    return this.timeline;
  }

  /**
   * Get current tempo
   * 🔧 FIX: Read from musicalTruth (single source of truth) instead of stale config.tempo
   * This fixes the bug where UI showed 120 BPM instead of exercise BPM
   */
  getTempo(): number {
    // musicalTruth is the source of truth for BPM
    // config.tempo may be stale (defaults to 120)
    return musicalTruth.getBPM();
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
    const Tone = getTone();
    Tone.Transport.loop = enabled;
  }

  /**
   * Set loop points
   */
  setLoopPoints(start: MusicalPosition, end: MusicalPosition): void {
    this.timeline.setLoopPoints(start, end);

    // Convert to Tone format
    const Tone = getTone();
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
   * Clear position update callback
   * RACE CONDITION FIX: Allows explicit cleanup of callback to prevent stale updates
   */
  clearPositionUpdateCallback(): void {
    this.positionUpdateCallback = undefined;
    logger.debug('Position update callback explicitly cleared');
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
    const debugInfo = {
      hasExistingInterval: this.positionUpdateInterval !== null,
      currentState: this.state,
      willCreateInterval: this.positionUpdateInterval === null,
      timestamp: Date.now(),
    };
    console.log('🔄 [POSITION DEBUG] startPositionUpdates() called', debugInfo);
    logger.info('🔄 [POSITION DEBUG] startPositionUpdates() called', debugInfo);

    if (this.positionUpdateInterval !== null) {
      console.warn(
        '🔄 [POSITION DEBUG] Interval already exists, early return!',
        {
          existingIntervalId: this.positionUpdateInterval,
        },
      );
      logger.warn(
        '🔄 [POSITION DEBUG] Interval already exists, early return!',
        {
          existingIntervalId: this.positionUpdateInterval,
        },
      );
      return;
    }

    const update = () => {
      if (this.state !== 'playing') {
        logger.debug(
          '🔄 [POSITION DEBUG] Update callback fired but state not playing',
          {
            state: this.state,
          },
        );
        return;
      }

      // 🔧 COUNTDOWN TIME FIX: Calculate ELAPSED time since transport started
      // This ensures position updates start from 0s (not 2.5s) so countdown displays correctly
      const absoluteTime = this.clock.getAudioTime();
      const elapsedTime = absoluteTime - this.transportStartTime;

      // 🎯 AUDIO-UI SYNC FIX: Compensate for startup lookahead
      //
      // Timing flow:
      // 1. Transport.start() captures transportStartTime = audioContext.currentTime (T)
      // 2. PlaybackEngine schedules audio to start at T + startupLookahead (T + 300ms)
      // 3. Visual updates calculate elapsedTime = currentTime - T
      //
      // Problem: At T + 400ms:
      //   - elapsedTime = 400ms (time since Transport started)
      //   - But audio has only been playing for 100ms (400ms - 300ms startupLookahead)
      //   - Visual would be 300ms AHEAD of audio!
      //
      // Fix: Delay visual by startupLookahead so visual matches when audio actually plays
      // The lookAheadTime (150ms) is for audio scheduling precision, NOT visual offset.
      // It ensures audio events are queued 150ms before they play, but doesn't affect
      // when the audio actually starts relative to transport start.
      //
      // Without this fix: Visual is 300ms ahead of audio
      // With this fix: Visual syncs precisely with audio playback
      const visualElapsedTime = Math.max(0, elapsedTime - TRANSPORT_TIMING_CONFIG.startupLookahead);

      // Only log occasionally to reduce console spam (every ~500ms)
      if (Math.floor(elapsedTime * 2) !== Math.floor((elapsedTime - 0.02) * 2)) {
        console.log('🔄 [VISUAL SYNC] Position update with lookahead compensation', {
          absoluteTime: absoluteTime.toFixed(3),
          transportStartTime: this.transportStartTime.toFixed(3),
          elapsedTime: elapsedTime.toFixed(3),
          startupLookahead: (TRANSPORT_TIMING_CONFIG.startupLookahead * 1000).toFixed(0) + 'ms',
          visualElapsedTime: visualElapsedTime.toFixed(3),
          explanation: 'Visual delayed by startupLookahead to match when audio actually plays',
        });
      }

      // ✅ DOUBLE COUNTDOWN FIX: Pass elapsed time (not absolute time)
      // MusicalPositionManager.getDisplayPosition() handles countdown offset exclusively
      // Using visualElapsedTime ensures UI syncs with actual audio playback
      // The startupLookahead compensation (300ms) delays visual to match audio playback moment
      this.timeline.updatePositionFromSeconds(visualElapsedTime);

      // Emit position update event (would integrate with EventBus)
      const position = this.timeline.getTransportPosition();
      logger.debug('Position update', { position, visualElapsedTime });

      // Call position update callback if registered with VISUAL COMPENSATED time
      // This ensures all downstream consumers (EventBus, widgets) get the same synced time
      if (this.positionUpdateCallback) {
        this.positionUpdateCallback(visualElapsedTime);
      }
    };

    // Initial update
    update();

    // Set up periodic updates
    this.positionUpdateInterval = window.setInterval(
      update,
      this.config.scheduleInterval * 1000,
    );

    const createdInfo = {
      intervalId: this.positionUpdateInterval,
      scheduleIntervalMs: this.config.scheduleInterval * 1000,
      timestamp: Date.now(),
    };
    console.log(
      '🔄 [POSITION DEBUG] Position update interval CREATED',
      createdInfo,
    );
    logger.info(
      '🔄 [POSITION DEBUG] Position update interval CREATED',
      createdInfo,
    );
  }

  /**
   * Stop position update loop
   */
  private stopPositionUpdates(): void {
    if (this.positionUpdateInterval !== null) {
      const intervalId = this.positionUpdateInterval;
      window.clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;

      const clearedInfo = {
        clearedIntervalId: intervalId,
        nowNull: this.positionUpdateInterval === null,
        timestamp: Date.now(),
      };
      console.log(
        '🛑 [POSITION DEBUG] Position update interval CLEARED',
        clearedInfo,
      );
      logger.info(
        '🛑 [POSITION DEBUG] Position update interval CLEARED',
        clearedInfo,
      );

      // NOTE: We don't clear positionUpdateCallback here anymore
      // The callback is registered once in TransportController constructor and should persist
      // across start/stop cycles. Clearing it breaks position updates on second playback.
      // Only the interval timer needs to be cleared to stop position updates.
      logger.debug(
        'Position update interval stopped (callback preserved for restart)',
      );
    } else {
      console.warn('🛑 [POSITION DEBUG] No interval to clear');
      logger.warn('🛑 [POSITION DEBUG] No interval to clear');
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
