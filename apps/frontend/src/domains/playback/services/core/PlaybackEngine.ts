/**
 * PlaybackEngine.ts - Central Playback Coordinator
 *
 * Phase 1, Task 1.2: Core playback orchestration with state machine
 *
 * Responsibilities:
 * - State management (7-state machine: idle, loading, ready, playing, paused, stopped, error)
 * - Playback control (start, stop, pause)
 * - Tempo management with debouncing (Bug #6 fix preserved)
 * - Lifecycle management and cleanup (Bug #7 fix preserved)
 * - PluginManager integration (WAM keyboard support)
 * - Scheduler coordination
 *
 * Design Principles:
 * - No callback delegation (direct method calls)
 * - State machine for clear state transitions
 * - Inline configuration (no delegation to ConfigurationManager)
 * - Inline track registration (no delegation to TrackManager)
 */

import { getLogger } from '@/utils/logger.js';
import { Scheduler } from './Scheduler.js';
import type { EventBus } from './EventBus.js';
import type { PluginManager } from './PluginManager.js';
import type { WamKeyboard } from '../../modules/instruments/adapters/wam/WamKeyboard.js';
import type { WamKeyboardPlugin } from '../../modules/instruments/adapters/wam/WamKeyboardPlugin.js';

/**
 * Playback engine state machine
 */
export type PlaybackState =
  | 'idle' // Not initialized
  | 'loading' // Loading resources
  | 'ready' // Ready to play
  | 'playing' // Currently playing
  | 'paused' // Paused
  | 'stopped' // Stopped
  | 'error'; // Error state

/**
 * Track structure
 */
export interface Track {
  id: string;
  name: string;
  instrumentType: string;
  regions: Region[];
  exerciseId?: string;
}

/**
 * Region structure
 */
export interface Region {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  skipCountdownOffset?: boolean;
  pattern?: {
    id?: string;
    name?: string;
    type?: string;
    events?: PatternEvent[];
  };
}

/**
 * Pattern event structure
 */
export interface PatternEvent {
  position: string; // Musical time in Tone.js format
  type: string;
  velocity?: number;
  duration?: string;
  midiNote?: number;
  noteName?: string;
}

/**
 * Configuration options
 */
export interface PlaybackEngineConfig {
  countdownBeats?: number; // Number of beats for countdown (default: 4)
  countdownEnabled?: boolean; // Whether countdown is enabled
  lookAheadTime?: number; // Lookahead time in seconds (default: 0.1)
}

/**
 * PlaybackEngine - Central coordinator for audio playback
 */
export class PlaybackEngine {
  // State
  private state: PlaybackState = 'idle';
  private isInitialized = false;

  // Core services
  private scheduler: Scheduler;
  private eventBus: EventBus;
  private logger: ReturnType<typeof getLogger>;

  // Audio context
  private audioContext: AudioContext | null = null;
  private audioDestination: AudioNode | null = null;

  // Tracks and configuration (inlined from TrackManager and ConfigurationManager)
  private tracks = new Map<string, Track>();
  private countdownBeats = 4; // Default: 4 beats countdown
  private countdownEnabled = false;
  private lookAheadTime = 0.1; // 100ms lookahead

  // Current exercise
  private currentExercise: any = null;

  // Tempo management (Bug #6 fix: debouncing)
  private tempoChangeDebounce: number | null = null;
  private readonly TEMPO_DEBOUNCE_MS = 50;

  // PluginManager integration (from Task 0.6)
  private pluginManager: PluginManager | null = null;

  // Event listener cleanup (Bug #7 fix)
  private unsubscribeTempoChange: (() => void) | null = null;
  private eventListeners = new Map<string, (() => void)[]>();

  // Instance ID for debugging
  private instanceId: string;

  constructor(eventBus: EventBus, config: PlaybackEngineConfig = {}) {
    this.instanceId = Math.random().toString(36).substring(2, 11);
    this.logger = getLogger('PlaybackEngine');
    this.eventBus = eventBus;

    // Initialize scheduler
    this.scheduler = new Scheduler(this.instanceId, this.tracks);

    // Apply configuration
    if (config.countdownBeats !== undefined) {
      this.countdownBeats = config.countdownBeats;
    }
    if (config.countdownEnabled !== undefined) {
      this.countdownEnabled = config.countdownEnabled;
    }
    if (config.lookAheadTime !== undefined) {
      this.lookAheadTime = config.lookAheadTime;
    }

    this.logger.info('PlaybackEngine initialized', {
      instanceId: this.instanceId,
      config,
    });
  }

  /**
   * Initialize the playback engine
   */
  async initialize(
    audioContext: AudioContext,
    audioDestination: AudioNode,
  ): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('PlaybackEngine already initialized');
      return;
    }

    this.setState('loading');

    try {
      this.audioContext = audioContext;
      this.audioDestination = audioDestination;

      // Initialize scheduler
      this.scheduler.setAudioContext(audioContext);

      this.isInitialized = true;
      this.setState('ready');

      this.logger.info('PlaybackEngine initialized successfully', {
        instanceId: this.instanceId,
      });
    } catch (error) {
      this.logger.error('Failed to initialize PlaybackEngine', error);
      this.setState('error');
      throw error;
    }
  }

  /**
   * Set state with validation and logging
   */
  private setState(newState: PlaybackState, force = false): void {
    const oldState = this.state;

    // Validate state transitions (unless forced)
    if (!force) {
      const validTransitions: Record<PlaybackState, PlaybackState[]> = {
        idle: ['loading', 'error'],
        loading: ['ready', 'error'],
        ready: ['playing', 'loading', 'error'],
        playing: ['paused', 'stopped', 'error'],
        paused: ['playing', 'stopped', 'error'],
        stopped: ['ready', 'playing', 'error'],
        error: ['idle', 'loading'], // Can recover from error
      };

      if (!validTransitions[oldState].includes(newState)) {
        this.logger.warn(`Invalid state transition: ${oldState} → ${newState}`);
        return;
      }
    }

    this.state = newState;

    this.logger.info(`State transition: ${oldState} → ${newState}`, {
      instanceId: this.instanceId,
      forced: force,
    });

    // Emit state change event
    this.eventBus.emit('playback:state-change', {
      oldState,
      newState,
      instanceId: this.instanceId,
    });
  }

  /**
   * Get current state
   */
  getState(): PlaybackState {
    return this.state;
  }

  /**
   * Check if engine is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.state === 'ready';
  }

  /**
   * Register a track
   */
  registerTrack(track: Track): void {
    this.tracks.set(track.id, track);
    this.logger.info(`Track registered: ${track.id}`, {
      instrumentType: track.instrumentType,
      regionsCount: track.regions.length,
    });
  }

  /**
   * Unregister a track
   */
  unregisterTrack(trackId: string): void {
    this.tracks.delete(trackId);
    this.logger.info(`Track unregistered: ${trackId}`);
  }

  /**
   * Get all tracks
   */
  getTracks(): Map<string, Track> {
    return this.tracks;
  }

  /**
   * Set countdown configuration
   */
  setCountdownConfig(beats: number, enabled: boolean): void {
    this.countdownBeats = beats;
    this.countdownEnabled = enabled;
    this.logger.info('Countdown config updated', { beats, enabled });
  }

  /**
   * Start playback
   */
  start(): void {
    if (this.state !== 'ready' && this.state !== 'stopped') {
      this.logger.warn(`Cannot start from state: ${this.state}`);
      return;
    }

    this.setState('playing');
    this.logger.info('Playback started', { instanceId: this.instanceId });

    // Emit playback start event
    this.eventBus.emit('playback:start', { instanceId: this.instanceId });
  }

  /**
   * Stop playback
   */
  stop(graceful = false): void {
    if (this.state !== 'playing' && this.state !== 'paused') {
      this.logger.warn(`Cannot stop from state: ${this.state}`);
      return;
    }

    // Cancel all scheduled sources
    if (!graceful) {
      this.scheduler.cancelAllScheduled();
    }

    this.setState('stopped');
    this.logger.info('Playback stopped', {
      graceful,
      instanceId: this.instanceId,
    });

    // Emit playback stop event
    this.eventBus.emit('playback:stop', {
      graceful,
      instanceId: this.instanceId,
    });
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.state !== 'playing') {
      this.logger.warn(`Cannot pause from state: ${this.state}`);
      return;
    }

    this.setState('paused');
    this.logger.info('Playback paused', { instanceId: this.instanceId });

    // Emit playback pause event
    this.eventBus.emit('playback:pause', { instanceId: this.instanceId });
  }

  /**
   * Resume playback from pause
   */
  resume(): void {
    if (this.state !== 'paused') {
      this.logger.warn(`Cannot resume from state: ${this.state}`);
      return;
    }

    this.setState('playing');
    this.logger.info('Playback resumed', { instanceId: this.instanceId });

    // Emit playback resume event
    this.eventBus.emit('playback:resume', { instanceId: this.instanceId });
  }

  /**
   * Update tempo with debouncing (Bug #6 fix preserved)
   * Copied from RegionProcessor.ts:224-403
   */
  updateTempo(newBpm: number): void {
    // Clear existing debounce timer
    if (this.tempoChangeDebounce !== null) {
      clearTimeout(this.tempoChangeDebounce);
      this.tempoChangeDebounce = null;
    }

    // Debounce rapid tempo changes (50ms threshold)
    this.tempoChangeDebounce = window.setTimeout(() => {
      this.logger.info('Tempo changed (debounced)', {
        newBpm,
        instanceId: this.instanceId,
      });

      // Cancel and reschedule all events with new tempo
      this.scheduler.cancelAllScheduled();

      // Emit tempo change event
      this.eventBus.emit('playback:tempo-change', {
        bpm: newBpm,
        instanceId: this.instanceId,
      });

      this.tempoChangeDebounce = null;
    }, this.TEMPO_DEBOUNCE_MS);
  }

  /**
   * Set PluginManager (for WAM keyboard integration)
   * Copied from RegionProcessor.ts:594
   */
  setPluginManager(pluginManager: PluginManager): void {
    this.pluginManager = pluginManager;
    this.logger.info('PluginManager set', { instanceId: this.instanceId });
  }

  /**
   * Get WamKeyboard instance (two-step unwrapping)
   * Copied from RegionProcessor.ts:605-636
   *
   * Returns the WamKeyboard instance for CC64 event routing.
   * Uses two-step unwrapping: PluginManager → WamKeyboardPlugin → WamKeyboard
   */
  getWamKeyboard(): WamKeyboard | null {
    if (!this.pluginManager) {
      return null;
    }

    try {
      // Step 1: Get WamKeyboardPlugin from PluginManager
      const wamKeyboardPlugin =
        this.pluginManager.getPlugin<WamKeyboardPlugin>('wam-keyboard');

      if (!wamKeyboardPlugin) {
        return null;
      }

      // Step 2: Get WamKeyboard from WamKeyboardPlugin
      const wamKeyboard = wamKeyboardPlugin.getWamKeyboard();

      if (!wamKeyboard) {
        this.logger.warn(
          'WamKeyboardPlugin exists but no WamKeyboard instance',
        );
        return null;
      }

      return wamKeyboard;
    } catch (error) {
      this.logger.error('Error getting WamKeyboard', error);
      return null;
    }
  }

  /**
   * Dispose of the playback engine and clean up resources (Bug #7 fix preserved)
   */
  dispose(): void {
    this.logger.info('Disposing PlaybackEngine', {
      instanceId: this.instanceId,
    });

    // Stop playback
    if (this.state === 'playing' || this.state === 'paused') {
      this.stop();
    }

    // Clear tempo debounce timer (Bug #7 fix)
    if (this.tempoChangeDebounce !== null) {
      clearTimeout(this.tempoChangeDebounce);
      this.tempoChangeDebounce = null;
    }

    // Unsubscribe from tempo change events (Bug #7 fix)
    if (this.unsubscribeTempoChange) {
      this.unsubscribeTempoChange();
      this.unsubscribeTempoChange = null;
    }

    // Clean up all event listeners (Bug #7 fix)
    this.eventListeners.forEach((unsubscribes) => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    });
    this.eventListeners.clear();

    // Dispose scheduler
    this.scheduler.dispose();

    // Clear tracks
    this.tracks.clear();

    // Clear references
    this.audioContext = null;
    this.audioDestination = null;
    this.pluginManager = null;

    // Reset state (force transition to idle, bypassing validation)
    this.isInitialized = false;
    this.setState('idle', true);

    this.logger.info('PlaybackEngine disposed', {
      instanceId: this.instanceId,
    });
  }

  /**
   * Get statistics for monitoring
   */
  getStats() {
    return {
      state: this.state,
      isInitialized: this.isInitialized,
      tracksCount: this.tracks.size,
      schedulerStats: this.scheduler.getStats(),
      instanceId: this.instanceId,
      countdownEnabled: this.countdownEnabled,
      countdownBeats: this.countdownBeats,
    };
  }
}
