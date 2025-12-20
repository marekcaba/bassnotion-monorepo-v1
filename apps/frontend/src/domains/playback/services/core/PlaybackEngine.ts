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

// Helper to get Tone from window (must be initialized before PlaybackEngine is used)
function getTone(): any {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = (window as any).Tone || (window as any).__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error('PlaybackEngine: Tone.js not loaded. Ensure AudioEngine is initialized first.');
}
import type { EventBus } from './EventBus.js';
import type { PluginManager } from './PluginManager.js';
import type { WamKeyboard } from '../../modules/instruments/adapters/wam/WamKeyboard.js';
import type { WamKeyboardPlugin } from '../../modules/instruments/adapters/wam/WamKeyboardPlugin.js';
import { RegionScheduler } from './region-processing/scheduling-orchestrator/RegionScheduler.js';
import { TimingMetricsCollector } from './region-processing/timing/TimingMetricsCollector.js';
import { EventRouter } from './region-processing/event-routing/EventRouter.js';
import {
  MusicalTimeConverter,
  ScheduleCache,
} from './region-processing/index.js';
import {
  VoiceCueScheduler,
  MetronomeScheduler,
  DrumScheduler,
  BassScheduler,
} from './region-processing/index.js';
import { HarmonySchedulerV2 } from './scheduling/HarmonySchedulerV2.js';
import { SustainPedalManager } from './region-processing/sustain/SustainPedalManager.js';
import { TrackInstrumentUtils } from './utils/TrackInstrumentUtils.js';
import { TRANSPORT_TIMING_CONFIG } from '../../config/transportTiming.js';
import { WindowRegistry } from '../WindowRegistry.js';
import { DiagnosticLogger } from './region-processing/diagnostics/DiagnosticLogger.js';
import { lifecycle } from '../../utils/InitializationLifecycleLogger.js';
import { Mixer } from '../../modules/tracks/mixing/Mixer.js';

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

  // Scheduling infrastructure (inlined from LifecycleCoordinator)
  private transportStartTime = 0;
  private positionCallbackCleanup: (() => void) | null = null;
  private isInitialScheduling = false;
  private scheduledIds = new Set<number>(); // Tone.Transport event IDs
  private scheduledEvents = new Map<string, Set<string>>(); // Track region IDs
  private isRunning = false;
  private sampleRate = 44100;

  // Scheduling modules (from region-processing)
  private regionScheduler: RegionScheduler | null = null;
  private metricsCollector: TimingMetricsCollector | null = null;
  private eventRouter: EventRouter | null = null;

  // Timing and conversion utilities
  private musicalTimeConverter: MusicalTimeConverter | null = null;
  private sustainPedalManager: SustainPedalManager | null = null;
  private scheduleCache: ScheduleCache | null = null;
  private diagnosticLogger: DiagnosticLogger | null = null;

  // Instrument schedulers
  private metronomeScheduler: MetronomeScheduler | null = null;
  private drumScheduler: DrumScheduler | null = null;
  private bassScheduler: BassScheduler | null = null;
  private voiceCueScheduler: VoiceCueScheduler | null = null;
  private harmonyScheduler: HarmonySchedulerV2 | null = null;

  // CC64 timeline state
  private currentCC64Timeline = new Map<number, boolean>();

  constructor(eventBus: EventBus, config: PlaybackEngineConfig = {}) {
    this.instanceId = Math.random().toString(36).substring(2, 11);
    this.logger = getLogger('PlaybackEngine');
    this.eventBus = eventBus;

    // Initialize scheduler
    this.scheduler = new Scheduler(this.instanceId, this.tracks);

    // Initialize instrument schedulers (will be fully configured in initialize())
    this.metronomeScheduler = new MetronomeScheduler(
      this.instanceId,
      this.tracks,
    );
    this.drumScheduler = new DrumScheduler(this.instanceId, this.tracks);
    this.bassScheduler = new BassScheduler(this.instanceId, this.tracks);
    this.voiceCueScheduler = new VoiceCueScheduler(
      this.instanceId,
      this.tracks,
    );
    // HarmonySchedulerV2 will be initialized in initialize() after cc64TimelineBuilder

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

    // Subscribe to tempo change events (Bug #6 fix: with debouncing)
    this.subscribeToTempoChanges();

    this.logger.info('PlaybackEngine initialized', {
      instanceId: this.instanceId,
      config,
    });
  }

  /**
   * Subscribe to tempo change events from transport
   * Bug #6 fix: Debouncing prevents excessive rescheduling during tempo slider drag
   */
  private subscribeToTempoChanges(): void {
    this.unsubscribeTempoChange = this.eventBus.on(
      'transport:tempo-change',
      (data: { tempo: number; bpm: number }) => {
        const newTempo = data.tempo || data.bpm;

        this.logger.info('🎵 PlaybackEngine: Received tempo-change event', {
          newTempo,
          isRunning: this.isRunning,
          state: this.state,
          instanceId: this.instanceId,
        });

        if (!this.isRunning) {
          this.logger.info(
            '⚠️ PlaybackEngine: Tempo changed while stopped - will apply on next play',
            {
              newTempo,
              instanceId: this.instanceId,
            },
          );
          return;
        }

        // Debounce rapid changes (e.g., user dragging tempo slider)
        if (this.tempoChangeDebounce) {
          clearTimeout(this.tempoChangeDebounce);
          this.logger.debug('🎵 PlaybackEngine: Debouncing tempo change', {
            newTempo,
          });
        }

        this.tempoChangeDebounce = window.setTimeout(() => {
          this.logger.info(
            '🎵 PlaybackEngine: Applying debounced tempo change',
            {
              newTempo,
              instanceId: this.instanceId,
            },
          );
          this.reschedulePendingEvents();
          this.tempoChangeDebounce = null;
        }, this.TEMPO_DEBOUNCE_MS);
      },
    );
  }

  /**
   * Reschedule pending events (called after tempo change)
   */
  private reschedulePendingEvents(): void {
    if (!this.isRunning || !this.regionScheduler) {
      return;
    }

    this.logger.info(
      '🔄 PlaybackEngine: Rescheduling pending events after tempo change',
    );

    // Clear existing scheduled events
    this.clearScheduledState();

    // Reschedule all tracks from current position
    const tracks = Array.from(this.tracks.values());
    if (tracks.length > 0) {
      // Use scheduleAll instead of scheduleRegions (matches PlaybackEngine architecture)
      this.scheduleAllRegions();
    }
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
      this.sampleRate = audioContext.sampleRate;

      // Initialize scheduler
      this.scheduler.setAudioContext(audioContext);

      // Initialize timing and conversion utilities (in dependency order)
      this.musicalTimeConverter = new MusicalTimeConverter();
      this.sustainPedalManager = new SustainPedalManager();
      this.scheduleCache = new ScheduleCache();

      // Configure SustainPedalManager with dependencies
      // CRITICAL: These must be set before buildTimeline() is called
      this.sustainPedalManager.setAudioContext(audioContext);
      this.sustainPedalManager.setTimeConverter(this.musicalTimeConverter);

      // Initialize diagnostic logger for CC64 debugging
      this.diagnosticLogger = new DiagnosticLogger(
        this.instanceId,
        this.currentCC64Timeline,
        this.musicalTimeConverter.parsePosition.bind(this.musicalTimeConverter),
        this.sustainPedalManager.findCC64DownDuringNote.bind(
          this.sustainPedalManager,
        ),
        this.sustainPedalManager.findNextCC64Up.bind(this.sustainPedalManager),
      );

      // Initialize harmony scheduler with CC64 support
      // SustainPedalManager acts as both CC64TimelineBuilder and SustainPedalAnalyzer
      this.harmonyScheduler = new HarmonySchedulerV2(
        this.instanceId,
        this.tracks, // Pass tracks map reference
        this.sustainPedalManager, // Acts as CC64TimelineBuilder
        this.sustainPedalManager, // Acts as SustainPedalAnalyzer
      );

      // Initialize scheduling modules
      this.regionScheduler = new RegionScheduler(this.instanceId);
      this.metricsCollector = new TimingMetricsCollector();
      this.eventRouter = new EventRouter(this.instanceId);

      // Set audio context for all instrument schedulers
      this.metronomeScheduler!.setAudioContext(audioContext);
      this.drumScheduler!.setAudioContext(audioContext);
      this.bassScheduler!.setAudioContext(audioContext);
      this.voiceCueScheduler!.setAudioContext(audioContext);
      this.harmonyScheduler.setAudioContext(audioContext);

      // Initialize EventRouter with instrument schedulers
      this.eventRouter.initialize(
        audioContext,
        this.sampleRate,
        this.eventBus,
        this.metronomeScheduler!,
        this.drumScheduler!,
        this.harmonyScheduler,
        this.bassScheduler!,
        this.voiceCueScheduler!,
        (frame: number, time: number) => {
          if (this.metricsCollector) {
            this.metricsCollector.track(frame, time);
          }
        },
      );

      this.isInitialized = true;
      this.setState('ready');

      this.logger.info('PlaybackEngine initialized successfully', {
        instanceId: this.instanceId,
        sampleRate: this.sampleRate,
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
   * Includes defensive check to prevent duplicate tracks of singleton instrument types
   */
  registerTrack(track: Track): void {
    // Singleton instrument types - only one track of these types should exist
    const singletonTypes = ['metronome', 'voice-cue'];

    if (track.instrumentType && singletonTypes.includes(track.instrumentType)) {
      // Check if a different track with the same instrumentType already exists
      const existingTrack = Array.from(this.tracks.values()).find(
        (t) => t.instrumentType === track.instrumentType && t.id !== track.id
      );

      if (existingTrack) {
        // Remove the old track to prevent duplicates
        this.logger.warn(
          `Removing existing ${track.instrumentType} track (${existingTrack.id}) before registering new one (${track.id})`,
        );
        this.tracks.delete(existingTrack.id);
      }
    }

    this.tracks.set(track.id, track);
    lifecycle.checkpoint('TRACK_REGISTERED', {
      trackId: track.id,
      instrumentType: track.instrumentType,
      regionsCount: track.regions.length,
      isPlaying: this.state === 'playing',
    });
    this.logger.info(`Track registered: ${track.id}`, {
      instrumentType: track.instrumentType,
      regionsCount: track.regions.length,
    });
  }

  /**
   * Register multiple tracks at once
   * Phase 3.3: Added for compatibility with GlobalControls and HarmonyWidget
   */
  registerTracks(
    tracks: Track[],
    metadata?: { harmonyInstrument?: string },
  ): void {
    // Store harmony instrument if provided
    if (metadata?.harmonyInstrument) {
      (this as any).currentHarmonyInstrument = metadata.harmonyInstrument;
    }

    tracks.forEach((track) => this.registerTrack(track));

    // If already running, reschedule all regions to include new tracks
    if (this.state === 'playing') {
      this.scheduleAllRegions();
    }
  }

  /**
   * Update tracks while playing
   * Phase 3.3: Added for compatibility with GlobalControls and HarmonyWidget
   */
  updateTracks(
    tracks: Track[],
    metadata?: { harmonyInstrument?: string },
  ): void {
    // Store harmony instrument if provided
    if (metadata?.harmonyInstrument) {
      (this as any).currentHarmonyInstrument = metadata.harmonyInstrument;
    }

    // Unregister old tracks and register new ones
    tracks.forEach((track) => {
      if (this.tracks.has(track.id)) {
        this.unregisterTrack(track.id);
      }
      this.registerTrack(track);
    });

    // If playing, reschedule all regions to include updated tracks
    if (this.state === 'playing') {
      this.scheduleAllRegions();
    }
  }

  /**
   * Unregister a track
   */
  unregisterTrack(trackId: string): void {
    this.tracks.delete(trackId);
    this.logger.info(`Track unregistered: ${trackId}`);
  }

  /**
   * Clear all drum tracks and stop any scheduled drum events
   * Call this before loading a new exercise to prevent old drum patterns from persisting
   */
  clearDrumTracks(): void {
    // 1. Stop all scheduled drum sources immediately (not graceful - force stop)
    if (this.drumScheduler) {
      this.drumScheduler.stopAll(false); // false = immediate stop with fadeout
      console.log('[PLAYBACK-ENGINE] Cleared drum scheduler sources');
    }

    // 2. Find and unregister all drum tracks
    const drumTrackIds: string[] = [];
    this.tracks.forEach((track, trackId) => {
      if (track.instrumentType === 'drums') {
        drumTrackIds.push(trackId);
      }
    });

    for (const trackId of drumTrackIds) {
      this.tracks.delete(trackId);
      console.log('[PLAYBACK-ENGINE] Unregistered drum track:', trackId);
    }

    // 3. Clear any scheduled drum events from the tracking sets
    // Events are keyed by region ID, remove any drum-related ones
    this.scheduledEvents.forEach((eventSet, regionId) => {
      if (regionId.includes('drum')) {
        this.scheduledEvents.delete(regionId);
      }
    });

    this.logger.info('Cleared all drum tracks and scheduled events', {
      unregisteredTracks: drumTrackIds.length,
      instanceId: this.instanceId,
    });
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
   * Enable countdown with time signature
   * Phase 3.3: Added for compatibility with GlobalControls
   */
  enableCountdown(timeSignature: {
    numerator: number;
    denominator: number;
  }): void {
    this.countdownBeats = timeSignature.numerator;
    this.countdownEnabled = true;
    this.logger.info('Countdown enabled', { beats: timeSignature.numerator });
  }

  /**
   * Add metronome countdown region (accent on beat 1, clicks on beats 2-4)
   */
  addCountdownRegion(timeSignature: {
    numerator: number;
    denominator: number;
  }): void {
    if (!this.countdownEnabled) {
      // eslint-disable-next-line no-console
      console.log(
        '[COUNTDOWN DIAGNOSTIC] Countdown disabled, skipping metronome countdown region',
      );
      return;
    }

    const countdownEvents: PatternEvent[] = [];
    for (let beat = 0; beat < timeSignature.numerator; beat++) {
      countdownEvents.push({
        position: `0:${beat}:0`,
        type: beat === 0 ? 'accent' : 'click',
        velocity: beat === 0 ? 0.9 : 0.7,
      });
    }

    // eslint-disable-next-line no-console
    console.log('[COUNTDOWN DIAGNOSTIC] Creating metronome countdown events:', {
      timeSignature,
      countdownBeats: this.countdownBeats,
      events: countdownEvents.map((e, i) => ({
        beat: i,
        position: e.position,
        type: e.type,
        velocity: e.velocity,
      })),
    });

    const countdownRegion: Region = {
      id: 'countdown-region',
      trackId: 'metronome',
      startTime: 0,
      duration: timeSignature.numerator,
      skipCountdownOffset: true,
      pattern: {
        id: 'countdown-pattern',
        name: 'Countdown',
        type: 'metronome',
        events: countdownEvents,
      },
    };

    let metronomeTrack = this.tracks.get('metronome');
    if (!metronomeTrack) {
      metronomeTrack = {
        id: 'metronome',
        name: 'Metronome',
        regions: [],
        instrumentType: 'metronome',
      };
      this.tracks.set('metronome', metronomeTrack);
      // eslint-disable-next-line no-console
      console.log('[COUNTDOWN DIAGNOSTIC] Created new metronome track');
    }

    metronomeTrack.regions.unshift(countdownRegion);
    // eslint-disable-next-line no-console
    console.log('[COUNTDOWN DIAGNOSTIC] Metronome countdown region added', {
      regionId: countdownRegion.id,
      startTime: countdownRegion.startTime,
      duration: countdownRegion.duration,
      skipCountdownOffset: countdownRegion.skipCountdownOffset,
      totalRegions: metronomeTrack.regions.length,
    });

    this.logger.info('Countdown region added', {
      beats: timeSignature.numerator,
      events: countdownEvents.length,
    });
  }

  /**
   * Add voice cue countdown region ("one", "two", "three", "four")
   */
  addVoiceCountdownRegion(timeSignature: {
    numerator: number;
    denominator: number;
  }): void {
    if (!this.countdownEnabled) {
      // eslint-disable-next-line no-console
      console.log(
        '[COUNTDOWN DIAGNOSTIC] Countdown disabled, skipping voice countdown region',
      );
      return;
    }

    const cueNames = [
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
    ];
    const voiceCueEvents: PatternEvent[] = [];

    for (let beat = 0; beat < timeSignature.numerator; beat++) {
      if (beat < cueNames.length) {
        voiceCueEvents.push({
          position: `0:${beat}:0`,
          type: 'voice-cue',
          velocity: 0.9,
          data: { cue: cueNames[beat] },
        });
      }
    }

    // eslint-disable-next-line no-console
    console.log('[COUNTDOWN DIAGNOSTIC] Creating voice countdown events:', {
      timeSignature,
      countdownBeats: this.countdownBeats,
      events: voiceCueEvents.map((e, i) => ({
        beat: i,
        position: e.position,
        cue: e.data?.cue,
        type: e.type,
      })),
    });

    const voiceCueRegion: Region = {
      id: 'voice-cue-countdown-region',
      trackId: 'voice-cue',
      startTime: 0,
      duration: timeSignature.numerator,
      skipCountdownOffset: true,
      pattern: {
        id: 'voice-cue-countdown-pattern',
        name: 'Voice Countdown',
        type: 'voice-cue',
        events: voiceCueEvents,
      },
    };

    let voiceCueTrack = this.tracks.get('voice-cue');
    if (!voiceCueTrack) {
      voiceCueTrack = {
        id: 'voice-cue',
        name: 'Voice Cues',
        regions: [],
        instrumentType: 'voice-cue',
      };
      this.tracks.set('voice-cue', voiceCueTrack);
      // eslint-disable-next-line no-console
      console.log('[COUNTDOWN DIAGNOSTIC] Created new voice-cue track');
    }

    voiceCueTrack.regions.unshift(voiceCueRegion);
    // eslint-disable-next-line no-console
    console.log('[COUNTDOWN DIAGNOSTIC] Voice countdown region added', {
      regionId: voiceCueRegion.id,
      startTime: voiceCueRegion.startTime,
      duration: voiceCueRegion.duration,
      skipCountdownOffset: voiceCueRegion.skipCountdownOffset,
      totalRegions: voiceCueTrack.regions.length,
    });

    this.logger.info('Voice countdown region added', {
      beats: timeSignature.numerator,
      cues: voiceCueEvents.length,
    });
  }

  /**
   * Start playback with 4-phase scheduling
   * Inlined from LifecycleCoordinator.start()
   */
  start(): void {
    lifecycle.checkpoint('PLAYBACK_START_REQUESTED', {
      tracksCount: this.tracks.size,
      trackIds: Array.from(this.tracks.keys()),
    });

    // DIAGNOSTIC: Log start() call and current state
    console.log('[PlaybackEngine.start() DIAGNOSTIC]', {
      currentState: this.state,
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      hasAudioContext: !!this.audioContext,
      hasRegionScheduler: !!this.regionScheduler,
      hasEventRouter: !!this.eventRouter,
      tracksCount: this.tracks.size,
    });

    if (this.state !== 'ready' && this.state !== 'stopped') {
      this.logger.warn(`Cannot start from state: ${this.state}`);
      console.error('[PlaybackEngine.start() BLOCKED]', {
        reason: 'Invalid state',
        currentState: this.state,
        expectedStates: ['ready', 'stopped'],
      });
      return;
    }

    if (this.isRunning) {
      this.logger.warn('Playback already running');
      console.error('[PlaybackEngine.start() BLOCKED]', {
        reason: 'Already running',
      });
      return;
    }

    // Get AudioContext from Tone.js if not set
    const Tone = getTone();
    if (!this.audioContext && Tone.context) {
      lifecycle.checkpoint('AUDIOCONTEXT_CREATING');
      this.logger.warn('Using Tone.context as fallback for AudioContext');
      this.audioContext = Tone.context as unknown as AudioContext;
      this.sampleRate = this.audioContext.sampleRate;
      lifecycle.checkpoint('AUDIOCONTEXT_RUNNING', {
        sampleRate: this.sampleRate,
        state: this.audioContext.state,
      });
    }

    if (!this.audioContext) {
      this.logger.error('Cannot start: No AudioContext available');
      this.setState('error');
      return;
    }

    // PHASE 1: State preparation - clear old events
    this.clearScheduledState();
    this.resetMetrics();
    this.startMetricsReporting();

    // Check BPM before scheduling
    const currentToneBpm = Tone.Transport.bpm.value;
    this.logger.info('🎵 Checking Tone.Transport BPM before scheduling', {
      toneBpm: currentToneBpm,
      instanceId: this.instanceId,
    });

    // Disable Tone.Transport.loop to prevent double playback
    if (Tone.Transport.loop) {
      this.logger.warn(
        '⚠️ Tone.Transport.loop was enabled - disabling to prevent double playback',
        {
          loopStart: Tone.Transport.loopStart,
          loopEnd: Tone.Transport.loopEnd,
        },
      );
      Tone.Transport.loop = false;
    }

    // PHASE 2: Capture transportStartTime BEFORE scheduling (for audio timing)
    const startupLookahead = TRANSPORT_TIMING_CONFIG.startupLookahead;
    this.transportStartTime = this.audioContext.currentTime + startupLookahead;
    this.syncTransportStartTime(this.transportStartTime);

    this.logger.info('🎯 Transport start anchor captured (BEFORE scheduling)', {
      transportStartTime: this.transportStartTime.toFixed(3),
      currentContextTime: this.audioContext.currentTime.toFixed(3),
      startupLookahead: `${startupLookahead * 1000}ms`,
    });

    // PHASE 2.5: Apply master fade-in to prevent audio spike on playback start
    // This ramps master gain from near-zero to full over 20ms, eliminating clicks
    try {
      const mixer = Mixer.getInstance();
      mixer.applyMasterFadeIn(this.transportStartTime);
    } catch (e) {
      // Mixer may not be initialized yet - continue without master fade
      this.logger.warn('Could not apply master fade-in (Mixer not ready)', { error: e });
    }

    // PHASE 3: Initial scheduling
    this.isInitialScheduling = true;
    lifecycle.checkpoint('SCHEDULE_ALL_REGIONS_START', { tracksCount: this.tracks.size });
    this.scheduleAllRegions();
    lifecycle.checkpoint('SCHEDULE_ALL_REGIONS_COMPLETE', { tracksCount: this.tracks.size });
    this.isInitialScheduling = false;

    // PHASE 4: Subscribe to Transport position updates via EventBus (FIGHTING CLOCKS FIX)
    // Instead of polling with setInterval, subscribe to 'transport:position-updated' events
    // emitted by TransportController from the master Transport clock (requestAnimationFrame)
    const positionUpdateHandler = () => {
      if (
        this.isRunning &&
        Tone.Transport.state === 'started' &&
        !this.isInitialScheduling
      ) {
        this.processCurrentPosition();
      }
    };

    // Subscribe to EventBus position updates (returns unsubscribe function)
    const unsubscribe = this.eventBus.on(
      'transport:position-updated',
      positionUpdateHandler,
    );

    // Store cleanup function to unsubscribe
    this.positionCallbackCleanup = () => {
      unsubscribe();
      this.logger.debug('Unsubscribed from Transport position updates');
    };

    this.logger.info(
      '✅ Subscribed to Transport position updates via EventBus (event-driven)',
      {
        instanceId: this.instanceId,
      },
    );

    // Update state
    this.isRunning = true;
    this.setState('playing');
    lifecycle.checkpoint('TRANSPORT_STARTED', {
      instanceId: this.instanceId,
      tracksCount: this.tracks.size,
    });

    this.logger.info('✅ Playback started with 4-phase scheduling', {
      instanceId: this.instanceId,
      tracksCount: this.tracks.size,
    });

    // Emit playback start event
    this.eventBus.emit('playback:start', { instanceId: this.instanceId });
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
   * Sync transport start time to all modules
   * Inlined from LifecycleCoordinator
   */
  private syncTransportStartTime(time: number): void {
    // Set Tone.Transport time offset to align with transport start time
    // This ensures all Tone.Transport.schedule() calls use the correct time reference
    const Tone = getTone();
    if (this.audioContext) {
      Tone.Transport.seconds = 0;
      this.logger.debug('Synced transport start time', {
        transportStartTime: time.toFixed(3),
        transportSeconds: Tone.Transport.seconds,
      });
    }

    // CRITICAL: Sync transportStartTime to SustainPedalManager
    // This ensures CC64 timeline keys match note audioTime values
    if (this.sustainPedalManager) {
      this.sustainPedalManager.setTransportStartTime(time);
      this.sustainPedalManager.setCountdownConfig(
        this.countdownBeats,
        this.countdownEnabled,
      );
      this.logger.debug('Synced SustainPedalManager timing', {
        transportStartTime: time.toFixed(3),
        countdownBeats: this.countdownBeats,
        countdownEnabled: this.countdownEnabled,
      });
    }
  }

  /**
   * Sync CC64 timeline to harmony scheduler
   * Called by RegionScheduler after building CC64 timeline
   */
  private syncCC64Timeline(timeline: Map<number, boolean>): void {
    this.currentCC64Timeline = timeline;
    if (this.harmonyScheduler) {
      this.harmonyScheduler.setCurrentCC64Timeline(timeline);
    }
  }

  /**
   * Clear scheduled state from previous playback
   * Inlined from LifecycleCoordinator
   */
  private clearScheduledState(): void {
    // Clear Tone.Transport scheduled events
    const Tone = getTone();
    this.scheduledIds.forEach((toneId) => {
      try {
        Tone.Transport.clear(toneId);
      } catch (e) {
        // Ignore errors when clearing
      }
    });
    this.scheduledIds.clear();
    this.scheduledEvents.clear();
  }

  /**
   * Reset timing metrics
   * Inlined from LifecycleCoordinator
   */
  private resetMetrics(): void {
    if (this.metricsCollector) {
      this.metricsCollector.reset();
    }
  }

  /**
   * Start metrics reporting
   * Inlined from LifecycleCoordinator
   */
  private startMetricsReporting(): void {
    if (this.metricsCollector) {
      this.metricsCollector.startReporting();
    }
  }

  /**
   * Schedule all regions upfront
   * Integrated with region-processing modules (RegionScheduler, EventRouter, instrument schedulers)
   */
  private scheduleAllRegions(): void {
    if (!this.audioContext || !this.regionScheduler || !this.eventRouter) {
      this.logger.error('Cannot schedule regions: Missing dependencies', {
        hasAudioContext: !!this.audioContext,
        hasRegionScheduler: !!this.regionScheduler,
        hasEventRouter: !!this.eventRouter,
      });
      return;
    }

    if (
      !this.musicalTimeConverter ||
      !this.sustainPedalManager ||
      !this.scheduleCache
    ) {
      this.logger.error('Cannot schedule regions: Missing utility modules', {
        hasMusicalTimeConverter: !!this.musicalTimeConverter,
        hasSustainPedalManager: !!this.sustainPedalManager,
        hasScheduleCache: !!this.scheduleCache,
      });
      return;
    }

    try {
      // Call RegionScheduler.scheduleAll() with all required dependencies
      const result = this.regionScheduler.scheduleAll(
        this.tracks,
        this.scheduledEvents,
        this.countdownEnabled,
        this.countdownBeats,
        this.transportStartTime,
        this.audioContext,
        // Dependency 7: getInstrumentType
        (track: any) => TrackInstrumentUtils.getInstrumentType(track),
        // Dependency 8: parsePositionToObject
        this.musicalTimeConverter.parsePositionToObject.bind(
          this.musicalTimeConverter,
        ),
        // Dependency 9: parsePosition
        this.musicalTimeConverter.parsePosition.bind(this.musicalTimeConverter),
        // Dependency 10: buildCC64Timeline
        this.sustainPedalManager.buildTimeline.bind(this.sustainPedalManager),
        // Dependency 11: logCC64DiagnosticTable (no-op for now, RegionScheduler handles it)
        () => {}, // CC64 diagnostic logging handled by RegionScheduler internally
        // Dependency 12: getCachedSchedule
        this.scheduleCache.get.bind(this.scheduleCache),
        // Dependency 13: setCachedSchedule
        this.scheduleCache.set.bind(this.scheduleCache),
        // Dependency 14: emitEvent
        this.eventRouter.emitEvent.bind(this.eventRouter),
        // Dependency 15: setCurrentCC64Timeline
        this.syncCC64Timeline.bind(this),
        // Dependency 16: calculateExerciseDuration
        () => {
          // RegionScheduler handles this internally via calculateDuration() method
          this.regionScheduler!.calculateDuration(
            Array.from(this.tracks.values()),
            this.countdownEnabled,
            this.countdownBeats,
          );
        },
      );

      this.logger.info('✅ All regions scheduled via RegionScheduler', {
        tracksCount: this.tracks.size,
        totalEvents: result.totalEvents,
        batchCount: result.batchCount,
        countdownEnabled: this.countdownEnabled,
      });
    } catch (error) {
      this.logger.error('❌ Failed to schedule regions', error);
      throw error;
    }
  }

  /**
   * Process current transport position for dynamic scheduling
   * Backup scheduling for events not scheduled upfront (defense-in-depth)
   */
  private processCurrentPosition(): void {
    if (
      !this.isRunning ||
      !this.audioContext ||
      !this.regionScheduler ||
      !this.eventRouter
    ) {
      return;
    }

    if (!this.musicalTimeConverter) {
      return;
    }

    try {
      // Call RegionScheduler.processPosition() for backup scheduling
      this.regionScheduler.processPosition(
        this.isRunning,
        Array.from(this.tracks.values()),
        this.scheduledEvents,
        this.scheduledIds,
        this.countdownEnabled,
        this.countdownBeats,
        this.musicalTimeConverter.parsePosition.bind(this.musicalTimeConverter),
        (track: any) => TrackInstrumentUtils.getInstrumentType(track),
        this.eventRouter.emitEvent.bind(this.eventRouter),
      );
    } catch (error) {
      this.logger.error('Error processing current position', error);
    }
  }

  /**
   * Stop playback and cancel all scheduled audio events
   * This stops all active audio sources immediately without disposing the engine
   * @param graceful - If true, allows notes to ring out (not yet implemented, always immediate stop)
   */
  stop(graceful = false): void {
    console.log('[PLAYBACK-ENGINE STOP] Stopping all audio sources', {
      state: this.state,
      instanceId: this.instanceId,
      graceful,
    });

    // Stop all instrument schedulers - this cancels their active audio sources
    // Pass graceful flag to all schedulers:
    // - graceful=true (auto-stop at exercise end): Apply smooth fadeout for natural finish
    // - graceful=false (manual stop): Quick fadeout to avoid clicks
    if (this.metronomeScheduler) {
      this.metronomeScheduler.stopAll(graceful);
      console.log('[PLAYBACK-ENGINE STOP] Metronome stopped', { graceful });
    }
    if (this.drumScheduler) {
      this.drumScheduler.stopAll(graceful);
      console.log('[PLAYBACK-ENGINE STOP] Drums stopped', { graceful });
    }
    if (this.bassScheduler) {
      this.bassScheduler.stopAll(graceful);
      console.log('[PLAYBACK-ENGINE STOP] Bass stopped', { graceful });
    }
    if (this.voiceCueScheduler) {
      this.voiceCueScheduler.stopAll(graceful);
      console.log('[PLAYBACK-ENGINE STOP] Voice cue stopped', { graceful });
    }
    if (this.harmonyScheduler) {
      // Harmony has longer ring-out time (4 seconds for sustained notes)
      this.harmonyScheduler.stopAll(graceful);
      console.log('[PLAYBACK-ENGINE STOP] Harmony stopped', { graceful });
    }

    // Unsubscribe from Transport position updates (FIGHTING CLOCKS FIX)
    if (this.positionCallbackCleanup) {
      this.positionCallbackCleanup();
      this.positionCallbackCleanup = null;
    }

    // 🔧 SECOND PLAYBACK FIX: Reset timing and state for clean restart
    // This mirrors the Transport.stop() cleanup pattern to ensure
    // second playback cycle works correctly without clock corruption
    this.transportStartTime = 0;
    console.log('[PLAYBACK-ENGINE STOP] Reset transportStartTime to 0');

    // Reset running state (critical for second playback to schedule regions)
    this.isRunning = false;
    console.log('[PLAYBACK-ENGINE STOP] Reset isRunning to false');

    // Clear scheduled event tracking (prevent memory leaks)
    this.scheduledEvents.clear();
    this.scheduledIds.clear();
    console.log('[PLAYBACK-ENGINE STOP] Cleared scheduled events tracking', {
      scheduledEventsCleared: this.scheduledEvents.size === 0,
      scheduledIdsCleared: this.scheduledIds.size === 0,
    });

    // Reset scheduling flag (prevent edge case if stopped during initial scheduling)
    this.isInitialScheduling = false;

    // Update state
    this.state = 'stopped';
    lifecycle.checkpoint('PLAYBACK_STOPPED', {
      instanceId: this.instanceId,
    });

    this.logger.info('PlaybackEngine stopped - all audio sources cancelled', {
      instanceId: this.instanceId,
    });
  }

  /**
   * Dispose of the playback engine and clean up resources (Bug #7 fix preserved)
   */
  dispose(): void {
    this.logger.info('Disposing PlaybackEngine', {
      instanceId: this.instanceId,
    });

    // Stop playback (this will also unsubscribe from position updates)
    if (this.state === 'playing' || this.state === 'paused') {
      this.stop();
    }

    // Ensure position callback cleanup (defensive)
    if (this.positionCallbackCleanup) {
      this.positionCallbackCleanup();
      this.positionCallbackCleanup = null;
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

    // Stop all instrument schedulers
    if (this.metronomeScheduler) {
      this.metronomeScheduler.stopAll();
    }
    if (this.drumScheduler) {
      this.drumScheduler.stopAll();
    }
    if (this.bassScheduler) {
      this.bassScheduler.stopAll();
    }
    if (this.voiceCueScheduler) {
      this.voiceCueScheduler.stopAll();
    }
    if (this.harmonyScheduler) {
      this.harmonyScheduler.stopAll();
    }

    // Clear scheduling state
    this.clearScheduledState();

    // Clear CC64 timeline
    this.currentCC64Timeline.clear();

    // Clear tracks
    this.tracks.clear();

    // Clear references
    this.audioContext = null;
    this.audioDestination = null;
    this.pluginManager = null;
    this.regionScheduler = null;
    this.metricsCollector = null;
    this.eventRouter = null;
    this.musicalTimeConverter = null;
    this.sustainPedalManager = null;
    this.scheduleCache = null;
    this.diagnosticLogger = null;
    this.metronomeScheduler = null;
    this.drumScheduler = null;
    this.bassScheduler = null;
    this.voiceCueScheduler = null;
    this.harmonyScheduler = null;

    // Reset state (force transition to idle, bypassing validation)
    this.isInitialized = false;
    this.isRunning = false;
    this.setState('idle', true);

    this.logger.info('PlaybackEngine disposed', {
      instanceId: this.instanceId,
    });
  }

  /**
   * Set harmony buffers and instrument type (for harmony instrument scheduling)
   * This is a wrapper for Scheduler.setBuffers() + Scheduler.setHarmonyInstrument()
   *
   * Note: HarmonyWidget passes a flat Map<string, AudioBuffer> with keys like 'v3-Cs4'
   */
  setHarmonyBuffers(
    buffers: Map<string, AudioBuffer> | Map<string, Map<string, AudioBuffer>>,
    destination: AudioNode,
    perNoteVelocityRanges?: any,
    instrumentName?: string,
  ): void {
    // DIAGNOSTIC: Log when harmony buffers are set
    console.log('🎹 [BUFFER-SWITCH-DEBUG] PlaybackEngine.setHarmonyBuffers called:', {
      instrumentName,
      bufferCount: buffers.size,
      hasDestination: !!destination,
      hasAudioContext: !!this.audioContext,
      sampleBufferKeys: Array.from(buffers.keys()).slice(0, 5), // First 5 keys for brevity
    });

    if (!this.audioContext || !destination) {
      this.logger.warn(
        'Cannot set harmony buffers: audio context or destination not ready',
      );
      return;
    }

    // Convert Map to flat Record for Scheduler
    const flatBuffers: Record<string, AudioBuffer> = {};

    // Check if it's a flat Map or nested Map
    const firstValue = buffers.values().next().value;
    const isNestedMap = firstValue instanceof Map;

    if (isNestedMap) {
      // Nested Map<string, Map<string, AudioBuffer>>
      (buffers as Map<string, Map<string, AudioBuffer>>).forEach(
        (velocityLayers, noteName) => {
          velocityLayers.forEach((buffer, layer) => {
            const key = `${noteName}_${layer}`;
            flatBuffers[key] = buffer;
          });
        },
      );
    } else {
      // Flat Map<string, AudioBuffer> (HarmonyWidget format)
      (buffers as Map<string, AudioBuffer>).forEach((buffer, key) => {
        flatBuffers[key] = buffer;
      });
    }

    // Set buffers in scheduler (legacy path)
    this.scheduler.setBuffers(flatBuffers, destination);

    // Set harmony instrument type if provided
    if (instrumentName) {
      const instrument = instrumentName as any; // 'wurlitzer' | 'grandpiano' | 'rhodes' | 'nicekeysrhodes'
      this.scheduler.setHarmonyInstrument(instrument, perNoteVelocityRanges);
      this.logger.info('Harmony instrument set', {
        instrument: instrumentName,
        bufferCount: Object.keys(flatBuffers).length,
      });
    }

    // CRITICAL FIX: Also set buffers on HarmonySchedulerV2
    if (this.harmonyScheduler) {
      // HarmonySchedulerV2 expects Map<string, Map<string, AudioBuffer>> (nested structure)
      // Convert flat buffers back to nested structure
      const nestedBuffers = new Map<string, Map<string, AudioBuffer>>();

      if (isNestedMap) {
        // Already nested, use as-is
        (buffers as Map<string, Map<string, AudioBuffer>>).forEach(
          (velocityLayers, noteName) => {
            nestedBuffers.set(noteName, velocityLayers);
          },
        );
      } else {
        // Flat structure from HarmonyWidget - convert to nested
        (buffers as Map<string, AudioBuffer>).forEach((buffer, key) => {
          // Keys are like "v3-Cs4" or "C4"
          // Extract layer and note name
          const parts = key.split('-');
          let layer: string;
          let noteName: string;

          if (parts.length === 2) {
            // Format: "v3-Cs4"
            layer = parts[0];
            noteName = parts[1];
          } else {
            // Format: "Cs4" (single layer)
            layer = 'v1';
            noteName = key;
          }

          if (!nestedBuffers.has(layer)) {
            nestedBuffers.set(layer, new Map());
          }
          nestedBuffers.get(layer)!.set(noteName, buffer);
        });
      }

      const instrument = (instrumentName || 'wurlitzer') as
        | 'grandpiano'
        | 'wurlitzer'
        | 'rhodes'
        | 'nicekeysrhodes';
      this.harmonyScheduler.setBuffers(
        nestedBuffers,
        destination,
        perNoteVelocityRanges,
        instrument,
      );

      this.logger.info('HarmonySchedulerV2 buffers set', {
        layerCount: nestedBuffers.size,
        instrument,
      });
    }

    this.logger.info('Harmony buffers set', {
      bufferCount: Object.keys(flatBuffers).length,
      instanceId: this.instanceId,
    });
  }

  /**
   * Set metronome buffers for direct audio scheduling
   * This configures the MetronomeScheduler to play metronome clicks
   */
  setMetronomeBuffers(
    accent: AudioBuffer,
    click: AudioBuffer,
    destination: AudioNode,
  ): void {
    if (!this.audioContext || !destination) {
      this.logger.warn(
        'Cannot set metronome buffers: audio context or destination not ready',
      );
      return;
    }

    // Set audio context on scheduler
    this.metronomeScheduler.setAudioContext(this.audioContext);

    // Set buffers with destination
    this.metronomeScheduler.setBuffers({ accent, click }, destination);

    this.logger.info('Metronome buffers set', {
      hasAccent: !!accent,
      hasClick: !!click,
      hasDestination: !!destination,
      instanceId: this.instanceId,
    });
  }

  /**
   * Set voice cue buffers for countdown
   * This configures the VoiceCueScheduler to play "one, two, three, four"
   */
  setVoiceCueBuffers(
    buffers: Record<string, AudioBuffer>,
    destination: AudioNode,
  ): void {
    if (!this.audioContext || !destination) {
      this.logger.warn(
        'Cannot set voice cue buffers: audio context or destination not ready',
      );
      return;
    }

    // Set audio context on scheduler
    this.voiceCueScheduler.setAudioContext(this.audioContext);

    // Set buffers with destination
    this.voiceCueScheduler.setBuffers(buffers, destination);

    this.logger.info('Voice cue buffers set', {
      bufferCount: Object.keys(buffers).length,
      hasDestination: !!destination,
      instanceId: this.instanceId,
    });
  }

  /**
   * Set drum buffers for direct audio scheduling
   * This configures the DrumScheduler to play drum samples
   *
   * @param buffers - Record mapping drum types to AudioBuffers
   *                  Keys should match DrumScheduler's eventTypeToBufferKey:
   *                  'kick', 'snare', 'hihat', 'openhat', 'crash', 'ride', 'tom1', 'tom2', 'tom3'
   * @param destination - AudioNode to connect drum output to
   */
  setDrumBuffers(
    buffers: Record<string, AudioBuffer>,
    destination: AudioNode,
  ): void {
    if (!this.audioContext || !destination) {
      this.logger.warn(
        'Cannot set drum buffers: audio context or destination not ready',
      );
      return;
    }

    if (!this.drumScheduler) {
      this.logger.warn('Cannot set drum buffers: drumScheduler not initialized');
      return;
    }

    // Set audio context on scheduler (may already be set, but safe to call again)
    this.drumScheduler.setAudioContext(this.audioContext);

    // Set buffers with destination
    this.drumScheduler.setBuffers(buffers, destination);

    this.logger.info('Drum buffers set', {
      bufferCount: Object.keys(buffers).length,
      bufferKeys: Object.keys(buffers),
      hasDestination: !!destination,
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
