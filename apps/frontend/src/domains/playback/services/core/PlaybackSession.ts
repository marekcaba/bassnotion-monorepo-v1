/**
 * PlaybackSession - Run-Lifetime State Container
 *
 * Part of the PlaybackSession architecture to solve the "Singleton Soup" problem.
 *
 * PROBLEM SOLVED:
 * Playback state (timers, scheduled events, audio sources) persisted across
 * playback runs because it was stored in long-lived singletons. This caused:
 * - Auto-stop timers from run #1 firing during run #3
 * - Scheduled events accumulating
 * - Memory leaks from unreleased audio sources
 *
 * SOLUTION:
 * PlaybackSession encapsulates ALL transient state for a single playback run.
 * When the session is disposed (on stop or new session), ALL state is cleaned up.
 *
 * LIFECYCLE:
 * 1. createSession() → New session with fresh state
 * 2. start() → Begin playback, schedule events/timers
 * 3. handleTempoChange() → Reschedule with new tempo
 * 4. stop() → Clear timers/events, stop audio
 * 5. dispose() → Clean up scopes, ready for garbage collection
 *
 * KEY INVARIANT:
 * Only ONE session active at a time. Creating a new session MUST dispose the old one.
 */

import { EventScope } from './EventScope.js';

// Helper to get Tone from window (must be initialized before PlaybackSession is used)
function getTone(): any {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = (window as any).Tone || (window as any).__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error('PlaybackSession: Tone.js not loaded. Ensure AudioEngine is initialized first.');
}
import { EventBus } from './EventBus.js';
import {
  musicalTruth,
  MusicalTruthScope,
  Exercise,
} from '../../modules/tempo/MusicalTruthAuthority.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('PlaybackSession');

export interface PlaybackSessionConfig {
  /** Unique identifier for the exercise */
  exerciseId: string;
  /** Exercise data */
  exercise: Exercise;
  /** Enable countdown before playback */
  countdownEnabled?: boolean;
  /** Number of beats in countdown */
  countdownBeats?: number;
}

export type SessionState = 'idle' | 'playing' | 'paused' | 'stopped';

export class PlaybackSession {
  // Identity
  readonly id: string;
  readonly exerciseId: string;
  readonly createdAt: number;

  // Scoped resources (auto-cleanup on dispose)
  private eventScope: EventScope;
  private truthScope: MusicalTruthScope;

  // Transient state (cleared on stop/dispose)
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private scheduledIds = new Set<number>();
  private activeSources = new Set<AudioBufferSourceNode>();
  private tracks = new Map<string, unknown>();

  // Playback state
  private state: SessionState = 'idle';
  private transportStartTime = 0;

  // Configuration
  private config: Required<PlaybackSessionConfig>;

  constructor(config: PlaybackSessionConfig, eventBus: EventBus) {
    this.id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.exerciseId = config.exerciseId;
    this.createdAt = Date.now();

    this.config = {
      countdownEnabled: true,
      countdownBeats: 4,
      ...config,
    };

    // Create scoped resources
    this.eventScope = new EventScope(eventBus, { name: `session-${this.id}` });
    this.truthScope = musicalTruth.createScope(`session-${this.id}`);

    // Set musical parameters from exercise
    musicalTruth.setFromExercise(config.exercise);

    // Subscribe to tempo changes through scoped subscription
    this.eventScope.on(
      'transport:tempo-change',
      this.handleTempoChange.bind(this),
    );

    logger.info(`PlaybackSession created`, {
      sessionId: this.id,
      exerciseId: this.exerciseId,
      bpm: config.exercise.bpm,
    });
  }

  /**
   * Start playback
   */
  start(): void {
    if (this.state === 'playing') {
      logger.warn(`Session ${this.id} already playing`);
      return;
    }

    logger.info(`Starting playback`, { sessionId: this.id });

    const Tone = getTone();
    this.transportStartTime = Tone.context.currentTime + 0.05;
    this.state = 'playing';

    // Schedule auto-stop timer (tracked in this session)
    this.scheduleAutoStop();

    // Emit start event
    this.eventScope.emit('session:start', {
      sessionId: this.id,
      exerciseId: this.exerciseId,
      transportStartTime: this.transportStartTime,
    });
  }

  /**
   * Stop playback
   */
  stop(graceful = false): void {
    if (this.state === 'stopped') {
      logger.debug(`Session ${this.id} already stopped`);
      return;
    }

    logger.info(`Stopping playback`, { sessionId: this.id, graceful });

    this.state = 'stopped';

    // Clear ALL timers from this session
    for (const timerId of this.timers) {
      clearTimeout(timerId);
    }
    this.timers.clear();

    // Clear ALL scheduled Tone.Transport events
    const Tone = getTone();
    for (const id of this.scheduledIds) {
      try {
        Tone.Transport.clear(id);
      } catch (e) {
        // Already cleared
      }
    }
    this.scheduledIds.clear();

    // Stop ALL audio sources
    for (const source of this.activeSources) {
      try {
        source.stop(0);
        source.disconnect();
      } catch (e) {
        // Already stopped or disconnected
      }
    }
    this.activeSources.clear();

    // Emit stop event
    this.eventScope.emit('session:stop', {
      sessionId: this.id,
      graceful,
    });
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.state !== 'playing') {
      logger.warn(`Cannot pause session ${this.id} in state ${this.state}`);
      return;
    }

    logger.info(`Pausing playback`, { sessionId: this.id });
    this.state = 'paused';

    // Note: Timers and scheduled events remain - they'll be resumed
    this.eventScope.emit('session:pause', { sessionId: this.id });
  }

  /**
   * Resume playback
   */
  resume(): void {
    if (this.state !== 'paused') {
      logger.warn(`Cannot resume session ${this.id} in state ${this.state}`);
      return;
    }

    logger.info(`Resuming playback`, { sessionId: this.id });
    this.state = 'playing';

    this.eventScope.emit('session:resume', { sessionId: this.id });
  }

  /**
   * Dispose this session completely.
   * Stops playback and cleans up all scoped resources.
   * After dispose, this session cannot be reused.
   */
  dispose(): void {
    logger.info(`Disposing session`, { sessionId: this.id });

    // Stop if still playing
    if (this.state === 'playing' || this.state === 'paused') {
      this.stop();
    }

    // Dispose scoped resources (removes ALL event handlers)
    this.eventScope.dispose();
    this.truthScope.dispose();

    // Clear track data
    this.tracks.clear();

    logger.info(`Session disposed`, {
      sessionId: this.id,
      lifetimeMs: Date.now() - this.createdAt,
    });
  }

  /**
   * Handle tempo change during playback.
   * Clears old timers/events and reschedules with new tempo.
   */
  private handleTempoChange(data: { tempo?: number; bpm?: number }): void {
    const newBpm = data.tempo || data.bpm;
    if (!newBpm) return;

    if (this.state !== 'playing') {
      logger.debug(`Ignoring tempo change in state ${this.state}`);
      return;
    }

    logger.info(`Handling tempo change`, { sessionId: this.id, newBpm });

    // Clear old timers
    for (const timerId of this.timers) {
      clearTimeout(timerId);
    }
    this.timers.clear();

    // Clear old scheduled events
    const ToneInTempo = getTone();
    for (const id of this.scheduledIds) {
      try {
        ToneInTempo.Transport.clear(id);
      } catch (e) {
        // Already cleared
      }
    }
    this.scheduledIds.clear();

    // Stop old audio sources (they're playing at wrong tempo)
    for (const source of this.activeSources) {
      try {
        source.stop(0);
        source.disconnect();
      } catch (e) {
        // Already stopped
      }
    }
    this.activeSources.clear();

    // Reschedule auto-stop with new tempo
    this.scheduleAutoStop();

    // Emit reschedule event for PlaybackEngine to reschedule regions
    this.eventScope.emit('session:reschedule', {
      sessionId: this.id,
      reason: 'tempo-change',
      newBpm,
    });
  }

  /**
   * Schedule auto-stop timer based on exercise duration
   */
  private scheduleAutoStop(): void {
    const totalBeats = musicalTruth.getTotalBeats();
    const durationSeconds = musicalTruth.beatsToSeconds(totalBeats);

    if (durationSeconds <= 0) {
      logger.debug(`No auto-stop scheduled (duration: ${durationSeconds}s)`);
      return;
    }

    const durationMs = durationSeconds * 1000;

    logger.info(`Scheduling auto-stop`, {
      sessionId: this.id,
      totalBeats,
      durationSeconds: durationSeconds.toFixed(2),
      durationMs,
    });

    const timerId = setTimeout(() => {
      if (this.state === 'playing') {
        logger.info(`Auto-stop triggered`, { sessionId: this.id });
        this.stop(true); // Graceful stop
      }
      this.timers.delete(timerId);
    }, durationMs);

    this.timers.add(timerId);
  }

  // ============================================================================
  // Public accessors for integration with existing systems
  // ============================================================================

  /**
   * Add a timer to be tracked by this session.
   * Will be automatically cleared on stop/dispose.
   */
  addTimer(timerId: ReturnType<typeof setTimeout>): void {
    this.timers.add(timerId);
  }

  /**
   * Add a Tone.Transport scheduled event ID to be tracked.
   * Will be automatically cleared on stop/dispose.
   */
  addScheduledId(id: number): void {
    this.scheduledIds.add(id);
  }

  /**
   * Add an AudioBufferSourceNode to be tracked.
   * Will be automatically stopped on stop/dispose.
   */
  addAudioSource(source: AudioBufferSourceNode): void {
    this.activeSources.add(source);
    // Auto-remove when ended naturally
    source.onended = () => {
      this.activeSources.delete(source);
    };
  }

  /**
   * Register a track with this session.
   */
  setTrack(trackId: string, track: unknown): void {
    this.tracks.set(trackId, track);
  }

  /**
   * Get a registered track.
   */
  getTrack<T = unknown>(trackId: string): T | undefined {
    return this.tracks.get(trackId) as T | undefined;
  }

  /**
   * Get all track IDs.
   */
  getTrackIds(): string[] {
    return Array.from(this.tracks.keys());
  }

  /**
   * Get current session state.
   */
  getState(): SessionState {
    return this.state;
  }

  /**
   * Get transport start time.
   */
  getTransportStartTime(): number {
    return this.transportStartTime;
  }

  /**
   * Get the event scope for this session.
   * Use this to subscribe to events that should be cleaned up with the session.
   */
  getEventScope(): EventScope {
    return this.eventScope;
  }

  /**
   * Get the musical truth scope for this session.
   */
  getTruthScope(): MusicalTruthScope {
    return this.truthScope;
  }

  /**
   * Get session metrics for debugging.
   */
  getMetrics(): {
    sessionId: string;
    state: SessionState;
    timerCount: number;
    scheduledCount: number;
    sourceCount: number;
    trackCount: number;
    lifetimeMs: number;
  } {
    return {
      sessionId: this.id,
      state: this.state,
      timerCount: this.timers.size,
      scheduledCount: this.scheduledIds.size,
      sourceCount: this.activeSources.size,
      trackCount: this.tracks.size,
      lifetimeMs: Date.now() - this.createdAt,
    };
  }
}
