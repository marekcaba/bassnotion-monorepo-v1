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
    const tone = window.Tone || window.__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error(
    'PlaybackEngine: Tone.js not loaded. Ensure AudioEngine is initialized first.',
  );
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
import { musicalTruth } from '../../modules/tempo/MusicalTruthAuthority.js';
import { getAtomicPlaybackClock } from './AtomicPlaybackClock.js';
import type {
  MidiInstrumentType,
  AudioInstrumentType,
  AudioStemKey,
} from '../../modules/tracks/management/TrackManagerProcessor.js';
import { audioInstrumentTypeToStemKey } from '../../modules/tracks/management/TrackManagerProcessor.js';
import type { IAudioStemEngine } from './IAudioStemEngine.js';
import { AudioPlayerScheduler } from './region-processing/scheduling/AudioPlayerScheduler.js';

// Debug flag - enable in browser console: window.__DEBUG_PLAYBACK_ENGINE = true
const isPlaybackDebugEnabled = (): boolean => {
  return (
    typeof window !== 'undefined' && !!(window as any).__DEBUG_PLAYBACK_ENGINE
  );
};

// Conditional debug logging helper
const debugLog = (...args: any[]) => {
  if (isPlaybackDebugEnabled()) {
    console.log(...args);
  }
};

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
 *
 * FAANG FIX: Duration can be specified as:
 * 1. `durationTicks` (preferred) - Raw MIDI ticks, converted to seconds at playback using live BPM
 * 2. `duration` (legacy) - Pre-calculated duration in seconds or Tone.js format
 *
 * Using durationTicks ensures correct timing even when BPM changes between registration and playback.
 */
export interface PatternEvent {
  position: string; // Musical time in Tone.js format
  type: string;
  velocity?: number;
  duration?: string | number; // Legacy: pre-calculated duration (may use stale BPM)
  durationTicks?: number; // FAANG FIX: Raw MIDI ticks at 480 PPQ (preferred - converts at playback)
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
export class PlaybackEngine implements IAudioStemEngine {
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

  // Per-instrument volume control (gain nodes)
  private instrumentGainNodes = new Map<string, GainNode>();
  private instrumentMuteStates = new Map<string, boolean>();
  private instrumentVolumeLevels = new Map<string, number>(); // Store intended volume levels (0-1)

  // Current tempo tracking (for metrics collector sync)
  private currentTempo = 120; // Default tempo in BPM

  // LAUNCH-02.5b: audio-stem state. Buffers are populated by
  // setAudioStemBuffers(); the scheduler fires AudioBufferSources from them
  // when RegionScheduler tells EventRouter to play an 'audio-*' event.
  private audioPlayerScheduler: AudioPlayerScheduler | null = null;
  private audioStemBuffers = new Map<AudioInstrumentType, AudioBuffer>();
  private activeAudioStemSources = new Map<
    AudioInstrumentType,
    AudioBufferSourceNode
  >();

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

        // CRITICAL FIX: Always update currentTempo and sync to metrics collector
        // This ensures timing accuracy calculations use the correct BPM
        // regardless of whether playback is running
        this.currentTempo = newTempo;
        if (this.metricsCollector) {
          this.metricsCollector.setTempo(newTempo);
        }

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

      // LAUNCH-02.5b: audio-stem scheduler (single instance for all 4 stems)
      this.audioPlayerScheduler = new AudioPlayerScheduler(this.instanceId);
      this.audioPlayerScheduler.setAudioContext(audioContext);

      // CRITICAL FIX: Initialize TimingMetricsCollector with actual sample rate
      // Without this, the collector uses hardcoded 48000 Hz causing jitter miscalculation
      this.metricsCollector.setSampleRate(this.sampleRate);
      this.logger.debug('TimingMetricsCollector initialized with sample rate', {
        sampleRate: this.sampleRate,
      });

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
        this.audioPlayerScheduler,
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
   * Get a track by ID
   * Returns undefined if track doesn't exist
   */
  getTrack(trackId: string): Track | undefined {
    return this.tracks.get(trackId);
  }

  /**
   * Register a track
   * Always updates the track to ensure fresh region content is used.
   *
   * FAANG FIX: Previously compared region COUNT which caused bugs when:
   * - switchExercise() cleared regions (count=0)
   * - New exercise created regions (count=1)
   * - Both had same count but different events!
   *
   * Now we always update the track to ensure region CONTENT is fresh.
   */
  registerTrack(track: Track): void {
    // Check if this exact track ID is already registered
    const existingById = this.tracks.get(track.id);
    if (existingById) {
      // Calculate total event counts for comparison
      const existingEventCount = existingById.regions.reduce(
        (sum, r) => sum + (r.pattern?.events?.length || 0),
        0,
      );
      const newEventCount = track.regions.reduce(
        (sum, r) => sum + (r.pattern?.events?.length || 0),
        0,
      );

      // Skip ONLY if both region count AND event count are the same
      // This prevents redundant updates while still allowing content changes
      if (
        existingById.regions.length === track.regions.length &&
        existingEventCount === newEventCount
      ) {
        this.logger.debug(
          `Track ${track.id} already registered with same regions (${existingById.regions.length} regions, ${existingEventCount} events), skipping`,
        );
        return;
      }

      // Log the update
      this.logger.debug(
        `Track ${track.id} updating: ${existingById.regions.length} regions (${existingEventCount} events) -> ${track.regions.length} regions (${newEventCount} events)`,
      );
    }

    // Singleton instrument types - only one track of these types should exist
    const singletonTypes = ['metronome', 'voice-cue'];

    if (track.instrumentType && singletonTypes.includes(track.instrumentType)) {
      // Check if a different track with the same instrumentType already exists
      const existingTrack = Array.from(this.tracks.values()).find(
        (t) => t.instrumentType === track.instrumentType && t.id !== track.id,
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
      debugLog('[PLAYBACK-ENGINE] Cleared drum scheduler sources');
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
      debugLog('[PLAYBACK-ENGINE] Unregistered drum track:', trackId);
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
   * Clear all bass tracks and stop any scheduled bass events
   * Call this before loading a new exercise to prevent bass sample doubling
   * (bass regions accumulate without clearing, causing louder and louder bass)
   */
  clearBassTracks(): void {
    // 1. Stop all scheduled bass sources immediately (not graceful - force stop)
    if (this.bassScheduler) {
      this.bassScheduler.stopAll(false); // false = immediate stop with fadeout
      debugLog('[PLAYBACK-ENGINE] Cleared bass scheduler sources');
    }

    // 2. Find and unregister all bass tracks
    const bassTrackIds: string[] = [];
    this.tracks.forEach((track, trackId) => {
      if (track.instrumentType === 'bass') {
        bassTrackIds.push(trackId);
      }
    });

    for (const trackId of bassTrackIds) {
      this.tracks.delete(trackId);
      debugLog('[PLAYBACK-ENGINE] Unregistered bass track:', trackId);
    }

    // 3. Clear any scheduled bass events from the tracking sets
    // Events are keyed by region ID, remove any bass-related ones
    this.scheduledEvents.forEach((eventSet, regionId) => {
      if (regionId.includes('bass')) {
        this.scheduledEvents.delete(regionId);
      }
    });

    this.logger.info('Cleared all bass tracks and scheduled events', {
      unregisteredTracks: bassTrackIds.length,
      instanceId: this.instanceId,
    });
  }

  /**
   * Clear all harmony tracks and scheduled events.
   * Used when switching exercises to ensure old harmony data doesn't persist.
   */
  clearHarmonyTracks(): void {
    // 1. Stop all scheduled harmony sources immediately (not graceful - force stop)
    if (this.harmonyScheduler) {
      this.harmonyScheduler.stopAll(false); // false = immediate stop with fadeout
      debugLog('[PLAYBACK-ENGINE] Cleared harmony scheduler sources');

      // 🔧 FIX: Clear CC64 timeline to prevent stale pedal data on exercise switch
      // Without this, the old exercise's CC64 timeline persists in SustainPedalHandler
      // causing sustain pedal to behave incorrectly for the new exercise
      this.harmonyScheduler.clearCC64Timeline();
    }

    // 2. Find and unregister all harmony tracks
    const harmonyTrackIds: string[] = [];
    this.tracks.forEach((track, trackId) => {
      if (track.instrumentType === 'harmony') {
        harmonyTrackIds.push(trackId);
      }
    });

    for (const trackId of harmonyTrackIds) {
      this.tracks.delete(trackId);
      debugLog('[PLAYBACK-ENGINE] Unregistered harmony track:', trackId);
    }

    // 3. Clear cached schedule for the exercise being switched away from
    // This ensures fresh CC64 timeline on next playback
    if (this.scheduleCache) {
      this.scheduleCache.clearAll();
      debugLog('[PLAYBACK-ENGINE] Cleared schedule cache for exercise switch');
    }

    this.logger.info('Cleared all harmony tracks and scheduled events', {
      unregisteredTracks: harmonyTrackIds.length,
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
   * Get countdown configuration
   * Used by BeatEmitter to configure countdown for visual beat sync
   */
  getCountdownConfig(): { beats: number; enabled: boolean } {
    return {
      beats: this.countdownBeats,
      enabled: this.countdownEnabled,
    };
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
      debugLog(
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
    debugLog('[COUNTDOWN DIAGNOSTIC] Creating metronome countdown events:', {
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
      debugLog('[COUNTDOWN DIAGNOSTIC] Created new metronome track');
    }

    metronomeTrack.regions.unshift(countdownRegion);
    // eslint-disable-next-line no-console
    debugLog('[COUNTDOWN DIAGNOSTIC] Metronome countdown region added', {
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
      debugLog(
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
    debugLog('[COUNTDOWN DIAGNOSTIC] Creating voice countdown events:', {
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
      debugLog('[COUNTDOWN DIAGNOSTIC] Created new voice-cue track');
    }

    voiceCueTrack.regions.unshift(voiceCueRegion);
    // eslint-disable-next-line no-console
    debugLog('[COUNTDOWN DIAGNOSTIC] Voice countdown region added', {
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
    debugLog('[PlaybackEngine.start() DIAGNOSTIC]', {
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
    const currentToneBpm = Tone.getTransport().bpm.value;
    this.logger.info('🎵 Checking Tone.Transport BPM before scheduling', {
      toneBpm: currentToneBpm,
      instanceId: this.instanceId,
    });

    // Disable Tone.Transport.loop to prevent double playback
    if (Tone.getTransport().loop) {
      this.logger.warn(
        '⚠️ Tone.Transport.loop was enabled - disabling to prevent double playback',
        {
          loopStart: Tone.getTransport().loopStart,
          loopEnd: Tone.getTransport().loopEnd,
        },
      );
      Tone.getTransport().loop = false;
    }

    // PHASE 2: Capture transportStartTime BEFORE scheduling (for audio timing)
    const startupLookahead = TRANSPORT_TIMING_CONFIG.startupLookahead;
    this.transportStartTime = this.audioContext.currentTime + startupLookahead;
    this.syncTransportStartTime(this.transportStartTime);

    // 🚨 CRITICAL FIX: Clear schedule cache on every playback start
    // The CC64 timeline keys include transportStartTime which changes every playback.
    // Cached timeline from previous playback has stale keys (e.g., 19.3s instead of 56.3s)
    // causing pedal lookups to fail and notes to sustain forever.
    // Clearing cache ensures timeline is rebuilt with fresh transportStartTime.
    if (this.scheduleCache) {
      this.scheduleCache.clearAll();
      debugLog(
        '[PLAYBACK-ENGINE START] 🗑️ Cleared schedule cache for fresh CC64 timeline',
      );
    }

    // CRITICAL FIX: Set transport start time on metrics collector
    // Without this, jitter calculations use transportStartTime=0, causing 409ms+ jitter reports
    if (this.metricsCollector) {
      this.metricsCollector.setTransportStartTime(this.transportStartTime);

      // CRITICAL FIX: Sync tempo to metrics collector
      // Without this, the collector assumes 120 BPM which causes 3% accuracy
      // instead of 90%+ when the exercise uses a different tempo (e.g., 69 BPM)
      const actualTempo = currentToneBpm || this.currentTempo;
      this.currentTempo = actualTempo;
      this.metricsCollector.setTempo(actualTempo);
      this.logger.info('🎯 TimingMetricsCollector tempo synced', {
        bpm: actualTempo,
        source: currentToneBpm ? 'Tone.Transport' : 'currentTempo',
      });
    }

    // 🔧 CRITICAL FIX: Sync EventRouter's transportStartTime
    // Without this, EventRouter uses transportStartTime=0 and schedules audio
    // at transport-relative times (e.g., 3.478s) instead of AudioContext times
    // (e.g., 12.9s + 3.478s = 16.378s), causing audio to play in the past!
    this.eventRouter.setTransportStartTime(this.transportStartTime);
    debugLog(
      '[PLAYBACK-ENGINE START] 🔧 Synced EventRouter transportStartTime',
      {
        transportStartTime: this.transportStartTime.toFixed(3),
      },
    );

    // 🎯 ATOMIC CLOCK SYNC: Start the AtomicPlaybackClock with the SAME transportStartTime
    // This ensures visual beat indicators are perfectly synced with audio scheduling.
    // The AtomicPlaybackClock applies lookahead compensation so visuals show ACTUAL audio position.
    const atomicClock = getAtomicPlaybackClock();
    atomicClock.setAudioContext(this.audioContext);
    atomicClock.setTransportStartTime(this.transportStartTime);
    atomicClock.configure(4, musicalTruth.getCountdownBeats()); // 4/4 time signature
    atomicClock.start();
    debugLog('[PLAYBACK-ENGINE START] 🎯 AtomicPlaybackClock started', {
      transportStartTime: this.transportStartTime.toFixed(3),
      countdownBeats: musicalTruth.getCountdownBeats(),
    });

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
      this.logger.warn('Could not apply master fade-in (Mixer not ready)', {
        error: e,
      });
    }

    // 🎯 FLICKER FIX: Set state and emit event BEFORE blocking scheduling
    // This ensures widgets receive isPlaying=true with position=0 IMMEDIATELY,
    // before the 500-1000ms scheduleAllRegions() blocks the main thread.
    // Without this, widgets see isPlaying=true only AFTER scheduling completes,
    // at which point currentTime has already progressed to ~1500ms.
    this.isRunning = true;
    this.setState('playing');

    // Calculate countdown duration in milliseconds for visual beat indicators
    // This allows widgets to correctly offset their beat calculations
    const countdownBeats = musicalTruth.getCountdownBeats();
    const bpm = musicalTruth.getBPM();
    const countdownDurationMs = (countdownBeats / bpm) * 60 * 1000;

    // Emit playback:starting with position=0 for widgets to sync BEFORE scheduling
    // Include countdownDurationMs for useBeatIndicator to calculate correct beat positions
    // Include transportStartTime for BeatEmitter to sync visual events with audio
    this.eventBus.emit('playback:starting', {
      instanceId: this.instanceId,
      position: 0,
      timestamp: Date.now(),
      countdownDurationMs, // For jitter-free visual beat calculation
      transportStartTime: this.transportStartTime, // For BeatEmitter audio sync
    });

    lifecycle.checkpoint('PLAYBACK_STATE_SET', {
      state: 'playing',
      isRunning: true,
      emittedStartingEvent: true,
    });

    // PHASE 3: Initial scheduling
    this.isInitialScheduling = true;

    // 🔍 DIAGNOSTIC: Verify scheduledEvents was cleared before scheduling
    debugLog(
      '[PLAYBACK-ENGINE START] 🔍 PHASE 3: About to schedule all regions',
      {
        scheduledEventsSize: this.scheduledEvents.size,
        scheduledIdsSize: this.scheduledIds.size,
        tracksCount: this.tracks.size,
        shouldBothBeZero:
          this.scheduledEvents.size === 0 && this.scheduledIds.size === 0,
      },
    );

    lifecycle.checkpoint('SCHEDULE_ALL_REGIONS_START', {
      tracksCount: this.tracks.size,
    });
    this.scheduleAllRegions();
    lifecycle.checkpoint('SCHEDULE_ALL_REGIONS_COMPLETE', {
      tracksCount: this.tracks.size,
    });
    this.isInitialScheduling = false;

    // PHASE 4: Subscribe to Transport position updates via EventBus (FIGHTING CLOCKS FIX)
    // Instead of polling with setInterval, subscribe to 'transport:position-updated' events
    // emitted by TransportController from the master Transport clock (requestAnimationFrame)
    const positionUpdateHandler = () => {
      if (
        this.isRunning &&
        Tone.getTransport().state === 'started' &&
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

    // Note: State was already set to 'playing' BEFORE scheduling (FLICKER FIX)
    // to ensure widgets receive isPlaying=true with position=0 immediately
    lifecycle.checkpoint('TRANSPORT_STARTED', {
      instanceId: this.instanceId,
      tracksCount: this.tracks.size,
    });

    this.logger.info('✅ Playback started with 4-phase scheduling', {
      instanceId: this.instanceId,
      tracksCount: this.tracks.size,
    });

    // Emit playback:start for backwards compatibility (after scheduling complete)
    // Note: playback:starting was already emitted BEFORE scheduling with position=0
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
      Tone.getTransport().seconds = 0;
      this.logger.debug('Synced transport start time', {
        transportStartTime: time.toFixed(3),
        transportSeconds: Tone.getTransport().seconds,
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

    // 🔧 TIMING SYNC FIX: Publish transportStartTime via EventBus for Transport to sync
    // Transport will receive this BEFORE its start() is called, ensuring it uses
    // the SAME transportStartTime as PlaybackEngine (no visual-audio desync)
    this.eventBus.emit('playback:transportStartTime', {
      transportStartTime: time,
    });
    debugLog(
      '🎯 [TIMING SYNC] PlaybackEngine published transportStartTime via EventBus',
      {
        transportStartTime: time.toFixed(3) + 's',
      },
    );
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
    // 🔍 DIAGNOSTIC: Log before clearing
    debugLog('[PLAYBACK-ENGINE] 🧹 clearScheduledState() called', {
      scheduledEventsSize: this.scheduledEvents.size,
      scheduledIdsSize: this.scheduledIds.size,
    });

    // Clear Tone.Transport scheduled events
    const Tone = getTone();
    this.scheduledIds.forEach((toneId) => {
      try {
        Tone.getTransport().clear(toneId);
      } catch (e) {
        // Ignore errors when clearing
      }
    });
    this.scheduledIds.clear();
    this.scheduledEvents.clear();

    // 🔍 DIAGNOSTIC: Log after clearing
    debugLog('[PLAYBACK-ENGINE] 🧹 clearScheduledState() completed', {
      scheduledEventsSize: this.scheduledEvents.size,
      scheduledIdsSize: this.scheduledIds.size,
      bothAreZero:
        this.scheduledEvents.size === 0 && this.scheduledIds.size === 0,
    });
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
      // 🔧 FIX: Sync ScheduleCache countdown config BEFORE cache lookup
      // Without this, cache key uses countdownOffsetBeats=0 (default) for lookup
      // but stores with actual countdownBeats value, causing cache key mismatch
      this.scheduleCache.setCountdownOffsetBeats(this.countdownBeats);

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
        // Dependency 11: logCC64DiagnosticTable (RegionScheduler logs internally)
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        () => {},
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
          // RegionScheduler calculates exercise duration and last beat timing
          const { exerciseEndTime, lastBeatThreshold } =
            this.regionScheduler!.calculateDuration(
              Array.from(this.tracks.values()),
              this.countdownEnabled,
              this.countdownBeats,
            );

          // 🚨 CRITICAL FIX: Pass exercise timing to HarmonyScheduler → SustainPedalHandler
          // Without this, notes at the end of the exercise sustain forever because
          // SustainPedalHandler doesn't know when to cap the sustain duration.
          // This enables the "cap at exercise end + 3s" logic for last-beat notes.
          if (this.harmonyScheduler) {
            // Add transportStartTime to convert from transport-relative to audio time
            const audioExerciseEndTime =
              this.transportStartTime + exerciseEndTime;
            const audioLastBeatThreshold =
              this.transportStartTime + lastBeatThreshold;
            this.harmonyScheduler.setExerciseTiming(
              audioExerciseEndTime,
              audioLastBeatThreshold,
            );
            debugLog(
              '[PLAYBACK-ENGINE] Set exercise timing for sustain capping',
              {
                exerciseEndTime: audioExerciseEndTime.toFixed(3),
                lastBeatThreshold: audioLastBeatThreshold.toFixed(3),
                transportStartTime: this.transportStartTime.toFixed(3),
              },
            );
          }
        },
        // Dependency 17 (LAUNCH-02.5b): resolvePendingBuffer — left undefined.
        // The Groove Card hook (02.5c) will inject this for key-set swapping.
        undefined,
        // Dependency 18 (LAUNCH-02.5b): audioStemAccess for infinite-audio.
        this.audioPlayerScheduler ?? undefined,
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
    debugLog('[PLAYBACK-ENGINE STOP] Stopping all audio sources', {
      state: this.state,
      instanceId: this.instanceId,
      graceful,
    });

    // PHASE 0: Apply master fade-out FIRST to prevent audio spike
    // This ramps master gain to near-zero over 30ms before stopping sources
    try {
      const mixer = Mixer.getInstance();
      // Fire and forget - don't wait for fade to complete
      // The 30ms fade happens while we clean up below
      mixer.applyMasterFadeOut(0.03);
    } catch (e) {
      // Mixer may not be initialized - continue without master fade
      this.logger.warn('Could not apply master fade-out (Mixer not ready)', {
        error: e,
      });
    }

    // Stop all instrument schedulers - this cancels their active audio sources
    // Pass graceful flag to all schedulers:
    // - graceful=true (auto-stop at exercise end): Apply smooth fadeout for natural finish
    // - graceful=false (manual stop): Quick fadeout to avoid clicks
    if (this.metronomeScheduler) {
      this.metronomeScheduler.stopAll(graceful);
      debugLog('[PLAYBACK-ENGINE STOP] Metronome stopped', { graceful });
    }
    if (this.drumScheduler) {
      this.drumScheduler.stopAll(graceful);
      debugLog('[PLAYBACK-ENGINE STOP] Drums stopped', { graceful });
    }
    if (this.bassScheduler) {
      this.bassScheduler.stopAll(graceful);
      debugLog('[PLAYBACK-ENGINE STOP] Bass stopped', { graceful });
    }
    if (this.voiceCueScheduler) {
      this.voiceCueScheduler.stopAll(graceful);
      debugLog('[PLAYBACK-ENGINE STOP] Voice cue stopped', { graceful });
    }
    if (this.harmonyScheduler) {
      // Harmony has longer ring-out time (4 seconds for sustained notes)
      this.harmonyScheduler.stopAll(graceful);
      debugLog('[PLAYBACK-ENGINE STOP] Harmony stopped', { graceful });
    }

    // Unsubscribe from Transport position updates (FIGHTING CLOCKS FIX)
    if (this.positionCallbackCleanup) {
      this.positionCallbackCleanup();
      this.positionCallbackCleanup = null;
    }

    // 🔧 SECOND PLAYBACK FIX: Clear ALL Tone.Transport scheduled events
    // CRITICAL: Cancel all scheduled events on Tone.Transport BEFORE clearing tracking
    // Without this, events from previous playback may fire during next playback
    try {
      const Tone = getTone();
      // Method 1: Clear tracked event IDs (events we scheduled ourselves)
      let clearedCount = 0;
      this.scheduledIds.forEach((toneId) => {
        try {
          Tone.getTransport().clear(toneId);
          clearedCount++;
        } catch (e) {
          // Ignore errors when clearing (event may have already fired)
        }
      });
      // Method 2: Cancel ALL events as nuclear option (catches any untracked events)
      Tone.getTransport().cancel(0);
      debugLog('[PLAYBACK-ENGINE STOP] 🧹 Cleared ALL Tone.Transport events', {
        trackedIdsCancelled: clearedCount,
        nuclearCancelCalled: true,
      });
    } catch (e) {
      console.warn(
        '[PLAYBACK-ENGINE STOP] Could not clear Tone.Transport events',
        e,
      );
    }

    // Reset timing and state for clean restart
    this.transportStartTime = 0;
    debugLog('[PLAYBACK-ENGINE STOP] Reset transportStartTime to 0');

    // 🎯 ATOMIC CLOCK STOP: Stop the visual beat clock
    const atomicClock = getAtomicPlaybackClock();
    atomicClock.stop();
    debugLog('[PLAYBACK-ENGINE STOP] 🎯 AtomicPlaybackClock stopped');

    // Reset running state (critical for second playback to schedule regions)
    this.isRunning = false;
    debugLog('[PLAYBACK-ENGINE STOP] Reset isRunning to false');

    // Clear scheduled event tracking (prevent memory leaks)
    this.scheduledEvents.clear();
    this.scheduledIds.clear();
    debugLog('[PLAYBACK-ENGINE STOP] Cleared scheduled events tracking', {
      scheduledEventsCleared: this.scheduledEvents.size === 0,
      scheduledIdsCleared: this.scheduledIds.size === 0,
    });

    // Reset scheduling flag (prevent edge case if stopped during initial scheduling)
    this.isInitialScheduling = false;

    // Update state via setState so 'playback:state-change' is emitted
    // consistently with start/pause/resume. setState validates: 'ready'
    // → 'stopped' is NOT in the transitions table, so calling stop()
    // from the ready state correctly emits neither 'state-change' nor
    // 'playback:stop'. Only emit 'playback:stop' when setState
    // successfully transitioned us.
    const wasPlayingOrPaused =
      this.state === 'playing' || this.state === 'paused';
    if (wasPlayingOrPaused) {
      this.setState('stopped');
      this.eventBus.emit('playback:stop', {
        instanceId: this.instanceId,
        graceful,
      });
    }

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
    const allKeys = Array.from(buffers.keys());
    const v4Keys = allKeys.filter((k) => k.includes('v4'));
    const v5Keys = allKeys.filter((k) => k.includes('v5'));
    const uniqueLayersFromKeys = [
      ...new Set(allKeys.map((k) => k.split('-')[0])),
    ];
    debugLog(
      '🎹 [BUFFER-SWITCH-DEBUG] PlaybackEngine.setHarmonyBuffers called:',
      {
        instrumentName,
        bufferCount: buffers.size,
        hasDestination: !!destination,
        hasAudioContext: !!this.audioContext,
        // LOG ALL KEYS AS STRINGS to avoid console collapsing
        allKeysStr: allKeys.join(', '),
        v4KeysStr: v4Keys.join(', '),
        v5KeysStr: v5Keys.join(', '),
        uniqueLayersStr: uniqueLayersFromKeys.join(', '),
        uniqueLayerCount: uniqueLayersFromKeys.length,
      },
    );

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
        // Keys come in format "v3-Cs4" from HarmonyWidget (already stripped of instrument prefix)
        const parseResults: Array<{
          key: string;
          layer: string;
          note: string;
          parts: number;
        }> = [];

        (buffers as Map<string, AudioBuffer>).forEach((buffer, key) => {
          // Keys are like "v3-Cs4" or "C4"
          // Extract layer and note name
          const parts = key.split('-');
          let layer: string;
          let noteName: string;

          if (parts.length >= 2 && /^v\d+$/.test(parts[0])) {
            // Format: "v3-Cs4" or "v3-Gs4" etc
            // First part is velocity layer (v1, v2, v3, v4, v5)
            layer = parts[0];
            // Rest is note name (could be "Cs4" or "Gs4" etc)
            noteName = parts.slice(1).join('-');
          } else {
            // Format: "Cs4" (single layer without velocity prefix)
            layer = 'v1';
            noteName = key;
          }

          parseResults.push({
            key,
            layer,
            note: noteName,
            parts: parts.length,
          });

          if (!nestedBuffers.has(layer)) {
            nestedBuffers.set(layer, new Map());
          }
          nestedBuffers.get(layer)!.set(noteName, buffer);
        });

        // Diagnostic: Log ALL keys and their parsed layers/notes
        debugLog('🔍 [BUFFER-PARSE-DEBUG] All buffer keys parsed:', {
          totalKeys: parseResults.length,
          byLayer: Object.fromEntries(
            [...new Set(parseResults.map((r) => r.layer))].map((layer) => [
              layer,
              parseResults.filter((r) => r.layer === layer).map((r) => r.note),
            ]),
          ),
          firstFew: parseResults.slice(0, 5),
          problematic: parseResults.filter((r) => r.parts !== 2),
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
      this.logger.warn(
        'Cannot set drum buffers: drumScheduler not initialized',
      );
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
   * Set bass sample buffers for the bass scheduler
   *
   * Buffers are keyed by MIDI note number (as string), e.g., "40", "45"
   * for direct lookup from PatternEvent.data.midiNote
   *
   * @param buffers - Record of MIDI note numbers to AudioBuffers
   * @param destination - Audio destination node
   */
  setBassBuffers(
    buffers: Record<string, AudioBuffer>,
    destination: AudioNode,
  ): void {
    if (!this.audioContext || !destination) {
      this.logger.warn(
        'Cannot set bass buffers: audio context or destination not ready',
      );
      return;
    }

    if (!this.bassScheduler) {
      this.logger.warn(
        'Cannot set bass buffers: bassScheduler not initialized',
      );
      return;
    }

    // Set audio context on scheduler (may already be set, but safe to call again)
    this.bassScheduler.setAudioContext(this.audioContext);

    // CRITICAL: Clear existing buffers BEFORE setting new ones to prevent contamination
    // from previous exercise's buffers mixing with new exercise's buffers.
    // This was causing "corrupted bass" when switching tutorials because
    // SimpleInstrumentScheduler.setBuffers() merges instead of replaces.
    this.bassScheduler.clearBuffers();

    // Set buffers with destination
    this.bassScheduler.setBuffers(buffers, destination);

    this.logger.info('Bass buffers set', {
      bufferCount: Object.keys(buffers).length,
      bufferKeys: Object.keys(buffers).slice(0, 10), // Log first 10 keys
      midiNoteRange: this.getMidiNoteRange(Object.keys(buffers)),
      hasDestination: !!destination,
      instanceId: this.instanceId,
    });
  }

  /**
   * Helper to get MIDI note range from buffer keys
   */
  private getMidiNoteRange(keys: string[]): string {
    const midiNotes = keys.map((k) => parseInt(k, 10)).filter((n) => !isNaN(n));
    if (midiNotes.length === 0) return 'none';
    const min = Math.min(...midiNotes);
    const max = Math.max(...midiNotes);
    return `${min}-${max} (${midiNotes.length} notes)`;
  }

  /**
   * Clear all bass buffers from the bass scheduler
   * Call this when switching exercises to ensure the new exercise's bass samples
   * are loaded fresh without contamination from the previous exercise
   */
  clearBassBuffers(): void {
    if (!this.bassScheduler) {
      this.logger.warn(
        'Cannot clear bass buffers: bassScheduler not initialized',
      );
      return;
    }

    this.bassScheduler.clearBuffers();
    this.logger.info('Bass buffers cleared for exercise switch', {
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

  // ==========================================
  // Exercise Switching (Centralized Cleanup)
  // ==========================================

  /**
   * Switch to a new exercise - centralized cleanup for all instruments
   *
   * FAANG-Style Pattern: Single Point of Control
   *
   * This method orchestrates the entire cleanup when switching exercises:
   * 1. Stops playback
   * 2. Clears ALL instrument schedulers (buffers)
   * 3. Clears ALL track regions (keeps tracks, removes events)
   * 4. Resets WindowRegistry buffer-ready flags
   * 5. Emits event for widgets to reset their registration state
   *
   * This prevents the "corrupted bass" bug where old regions (MIDI notes)
   * remain in PlaybackEngine while new buffers are loaded for different notes.
   *
   * @param newExerciseId - The ID of the new exercise being loaded
   */
  switchExercise(newExerciseId: string): void {
    this.logger.info('🔄 Exercise switch initiated', {
      newExerciseId,
      previousExerciseId: this.currentExercise?.id,
      state: this.state,
      trackCount: this.tracks.size,
      instanceId: this.instanceId,
    });

    // 1. Stop playback if running
    if (this.state === 'playing') {
      this.stop();
    }

    // 2. Clear instrument scheduler buffers (exercise-specific only)
    // Note: Metronome buffers are PRESERVED - same click sounds across all tutorials
    if (this.bassScheduler) {
      this.bassScheduler.clearBuffers();
      this.bassScheduler.stopAll(false);
      debugLog('[PLAYBACK-ENGINE] switchExercise: Cleared bass scheduler');
    }
    if (this.drumScheduler) {
      // DON'T clear drum buffers - same kick/snare/hihat samples for all tutorials
      // Drums are loaded ONCE at page load by CoreServices.reinjectAllBuffers()
      // and there's no re-registration mechanism like bass has
      // Only stop scheduled events, buffers persist
      this.drumScheduler.stopAll(false);
      debugLog(
        '[PLAYBACK-ENGINE] switchExercise: Stopped drums (buffers preserved)',
      );
    }
    if (this.harmonyScheduler) {
      this.harmonyScheduler.stopAll(false);
      this.harmonyScheduler.clearCC64Timeline();
      debugLog('[PLAYBACK-ENGINE] switchExercise: Cleared harmony scheduler');
    }
    if (this.metronomeScheduler) {
      // DON'T clear metronome buffers - same click sounds for all tutorials
      // Only stop scheduled events, buffers persist
      this.metronomeScheduler.stopAll(false);
      debugLog(
        '[PLAYBACK-ENGINE] switchExercise: Stopped metronome (buffers preserved)',
      );
    }
    if (this.voiceCueScheduler) {
      // DON'T clear voice-cue buffers - same 1-2-3-4 count-in samples for
      // all tutorials. Clearing them leaves the next play with no buffers
      // (the widget only injects once at page load via InitialSamplePreloader,
      // there's no re-registration mechanism). Only stop scheduled events.
      this.voiceCueScheduler.stopAll(false);
      debugLog(
        '[PLAYBACK-ENGINE] switchExercise: Stopped voice cue (buffers preserved)',
      );
    }

    // 3. Clear ALL track regions (keeps track structure, removes MIDI events)
    // This is the KEY fix - prevents old regions from referencing wrong MIDI notes
    const trackRegionCounts: Record<string, number> = {};
    this.tracks.forEach((track, trackId) => {
      trackRegionCounts[trackId] = track.regions.length;
      track.regions = [];
    });
    debugLog(
      '[PLAYBACK-ENGINE] switchExercise: Cleared all track regions',
      trackRegionCounts,
    );

    // 4. Clear scheduled events from Tone.Transport
    this.clearScheduledState();

    // 5. Clear schedule cache for fresh CC64 timeline
    if (this.scheduleCache) {
      this.scheduleCache.clearAll();
    }

    // 6. Reset WindowRegistry buffer-ready flags
    // This tells widgets to re-register their buffers
    WindowRegistry.clearBassBuffersReady();
    // Note: Add clearDrumBuffersReady() if it exists

    // 7. Emit events for widgets to reset their registration tracking
    // Internal EventBus for services
    this.eventBus.emit('exercise:switched', { exerciseId: newExerciseId });
    // DOM CustomEvent for React components (they can't easily access EventBus)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('exercise:switched', {
          detail: { exerciseId: newExerciseId },
        }),
      );
    }

    // 8. Update current exercise reference
    this.currentExercise = { id: newExerciseId };

    this.logger.info('✅ Exercise switch complete', {
      newExerciseId,
      clearedTracks: Object.keys(trackRegionCounts).length,
      instanceId: this.instanceId,
    });
  }

  // ==========================================
  // Per-Instrument Volume Control
  // ==========================================

  /**
   * Get or create a gain node for an instrument type
   * This allows per-instrument volume and mute control.
   * When creating a new node, any previously stored volume/mute state is applied.
   */
  getOrCreateInstrumentGainNode(
    instrumentType: MidiInstrumentType | AudioInstrumentType,
  ): GainNode | null {
    if (!this.audioContext) {
      this.logger.debug('Cannot create instrument gain node: no audio context');
      return null;
    }

    // Return existing gain node if already created
    if (this.instrumentGainNodes.has(instrumentType)) {
      return this.instrumentGainNodes.get(instrumentType)!;
    }

    // Create new gain node and connect to destination
    const gainNode = this.audioContext.createGain();
    gainNode.connect(this.audioContext.destination);
    this.instrumentGainNodes.set(instrumentType, gainNode);

    // Use previously stored values if available, otherwise set defaults
    // This ensures volume/mute states set before gain node creation are preserved
    const storedVolume = this.instrumentVolumeLevels.get(instrumentType);
    const storedMute = this.instrumentMuteStates.get(instrumentType);

    const volume = storedVolume ?? 0.8; // Default volume 80%
    const isMuted = storedMute ?? false;

    // Store the values (either existing or defaults)
    if (storedVolume === undefined) {
      this.instrumentVolumeLevels.set(instrumentType, volume);
    }
    if (storedMute === undefined) {
      this.instrumentMuteStates.set(instrumentType, isMuted);
    }

    // Apply the initial gain value
    const effectiveVolume = isMuted ? 0 : volume;
    gainNode.gain.value = effectiveVolume;

    this.logger.info(
      `Created gain node for ${instrumentType} (volume: ${volume}, muted: ${isMuted})`,
    );
    return gainNode;
  }

  /**
   * Set volume for a specific instrument (0-1 range)
   * Note: Volume is always stored, even if gain node doesn't exist yet.
   * The volume will be applied when the gain node is created.
   */
  setInstrumentVolume(
    instrumentType: MidiInstrumentType | AudioInstrumentType,
    volume: number,
  ): void {
    // Always store the intended volume level first (before mute consideration)
    // This ensures the value is saved even if gain node doesn't exist yet
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.instrumentVolumeLevels.set(instrumentType, clampedVolume);

    // Try to get or create the gain node
    const gainNode = this.getOrCreateInstrumentGainNode(instrumentType);
    if (!gainNode) {
      // No audio context available yet - volume is stored and will be applied
      // when the gain node is created (getOrCreateInstrumentGainNode sets default from stored value)
      this.logger.debug(
        `Volume stored for ${instrumentType}: ${volume} (gain node will be created later)`,
      );
      return;
    }

    const isMuted = this.instrumentMuteStates.get(instrumentType) ?? false;
    const effectiveVolume = isMuted ? 0 : clampedVolume;

    // Smooth volume change to avoid clicks
    const currentTime = this.audioContext?.currentTime ?? 0;
    gainNode.gain.setTargetAtTime(effectiveVolume, currentTime, 0.02);

    this.logger.debug(
      `Volume set for ${instrumentType}: ${volume} (effective: ${effectiveVolume})`,
    );
  }

  /**
   * Set mute state for a specific instrument
   * Note: Mute state is always stored, even if gain node doesn't exist yet.
   * The mute state will be applied when the gain node is created.
   */
  setInstrumentMuted(
    instrumentType: MidiInstrumentType | AudioInstrumentType,
    muted: boolean,
  ): void {
    // Always store the mute state first
    // This ensures the value is saved even if gain node doesn't exist yet
    this.instrumentMuteStates.set(instrumentType, muted);

    // Try to get or create the gain node
    const gainNode = this.getOrCreateInstrumentGainNode(instrumentType);
    if (!gainNode) {
      // No audio context available yet - mute state is stored and will be applied
      // when the gain node is created
      this.logger.debug(
        `Mute state stored for ${instrumentType}: ${muted} (gain node will be created later)`,
      );
      return;
    }

    // When muted, set gain to 0; otherwise restore the stored volume level
    const storedVolume = this.instrumentVolumeLevels.get(instrumentType) ?? 0.8;
    const effectiveVolume = muted ? 0 : storedVolume;

    const currentTime = this.audioContext?.currentTime ?? 0;
    gainNode.gain.setTargetAtTime(effectiveVolume, currentTime, 0.01);

    this.logger.debug(
      `Mute set for ${instrumentType}: ${muted} (restored volume: ${storedVolume})`,
    );
  }

  /**
   * Get the current mute state for an instrument
   */
  isInstrumentMuted(
    instrumentType: MidiInstrumentType | AudioInstrumentType,
  ): boolean {
    return this.instrumentMuteStates.get(instrumentType) ?? false;
  }

  /**
   * Get the current volume level for an instrument (0-1 range)
   */
  getInstrumentVolume(
    instrumentType: MidiInstrumentType | AudioInstrumentType,
  ): number {
    return this.instrumentVolumeLevels.get(instrumentType) ?? 0.8;
  }

  // ==========================================
  // LAUNCH-02.5b: IAudioStemEngine implementation
  // ==========================================

  /**
   * Load decoded AudioBuffers for each audio stem. Idempotent — replacing
   * previous buffers stops any in-flight source for that stem, then
   * registers the new buffer + gain with AudioPlayerScheduler.
   *
   * Mirrors the wrapper shape of setDrumBuffers (validate context, store
   * buffer, allocate gain, register with scheduler), but does NOT delegate
   * per-event playback — audio stems are long pre-rendered loops driven by
   * RegionScheduler's infinite-loop branch.
   */
  setAudioStemBuffers(
    stems: Partial<Record<AudioInstrumentType, AudioBuffer>>,
  ): void {
    if (!this.audioContext) {
      this.logger.warn(
        'Cannot set audio-stem buffers: audio context not ready',
      );
      return;
    }
    if (!this.audioPlayerScheduler) {
      this.logger.warn(
        'Cannot set audio-stem buffers: audioPlayerScheduler not initialized',
      );
      return;
    }

    let registered = 0;
    for (const [key, buffer] of Object.entries(stems)) {
      if (!buffer) continue;
      const instrumentType = key as AudioInstrumentType;
      const stemKey: AudioStemKey =
        audioInstrumentTypeToStemKey(instrumentType);

      // Stop any in-flight source for this stem before swapping the buffer.
      const existing = this.activeAudioStemSources.get(instrumentType);
      if (existing) {
        try {
          existing.stop(this.audioContext.currentTime + 0.001);
        } catch {
          // already stopped — ignore
        }
        this.activeAudioStemSources.delete(instrumentType);
      }

      const gain = this.getOrCreateInstrumentGainNode(instrumentType);
      if (!gain) {
        this.logger.warn(
          `setAudioStemBuffers: gain node unavailable for ${instrumentType}`,
        );
        continue;
      }

      this.audioStemBuffers.set(instrumentType, buffer);
      this.audioPlayerScheduler.setStem(stemKey, buffer, gain);
      registered++;
    }

    this.logger.info('Audio-stem buffers registered', {
      registered,
      stemsTotal: this.audioStemBuffers.size,
      instanceId: this.instanceId,
    });
  }

  /**
   * Start every registered audio stem against the master transport time
   * (this.transportStartTime). Each stem plays from offset 0 of its
   * buffer; looping is owned by RegionScheduler when a region declares
   * loopCount: 0 — this method is the one-shot start used when callers
   * want a stem to begin immediately without a region wrapper.
   */
  startAudioStems(): void {
    if (!this.audioContext || !this.audioPlayerScheduler) {
      this.logger.warn(
        'Cannot start audio stems: audio context or scheduler not ready',
      );
      return;
    }
    const startAt = Math.max(
      this.audioContext.currentTime,
      this.transportStartTime,
    );

    for (const [instrumentType, buffer] of this.audioStemBuffers) {
      const gain = this.instrumentGainNodes.get(instrumentType);
      if (!gain) continue;
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.onended = () => {
        this.activeAudioStemSources.delete(instrumentType);
      };
      try {
        source.start(startAt, 0);
        this.activeAudioStemSources.set(instrumentType, source);
      } catch (err) {
        this.logger.warn(`startAudioStems: ${instrumentType} start failed`, {
          err,
        });
      }
    }

    this.logger.info('Audio stems started', {
      startAt,
      count: this.activeAudioStemSources.size,
      instanceId: this.instanceId,
    });
  }

  /**
   * Stop every active audio stem with a 5ms gain ramp-down (avoids the
   * click that a hard `source.stop()` produces). Also tells the scheduler
   * to drop any sources it spawned through schedule().
   */
  stopAudioStems(): void {
    if (!this.audioContext) {
      this.activeAudioStemSources.clear();
      return;
    }

    const now = this.audioContext.currentTime;
    const rampSeconds = 0.005;
    const stopAt = now + rampSeconds + 0.001;

    for (const [instrumentType, source] of this.activeAudioStemSources) {
      const gain = this.instrumentGainNodes.get(instrumentType);
      if (gain) {
        try {
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + rampSeconds);
        } catch (err) {
          this.logger.debug(`stopAudioStems: gain ramp failed`, {
            instrumentType,
            err,
          });
        }
      }
      try {
        source.stop(stopAt);
      } catch {
        // already stopped — ignore
      }
    }
    this.activeAudioStemSources.clear();

    // Also stop anything the AudioPlayerScheduler is tracking from
    // RegionScheduler-driven schedule() calls.
    this.audioPlayerScheduler?.stopAll();

    // LAUNCH-02.5b: tear down any infinite-loop iterations the
    // RegionScheduler armed via Tone.Transport.schedule().
    this.regionScheduler?.stopAllInfiniteAudio(this.audioContext);

    this.logger.info('Audio stems stopped', { instanceId: this.instanceId });
  }

  /**
   * Remove every track whose ID begins with the given prefix. Used by the
   * Groove Card (LAUNCH-02.5c) so two cards on one page can register tracks
   * under separate prefixes (e.g. "card-abc-") and clean themselves up
   * without disturbing siblings.
   */
  unregisterTracksByPrefix(prefix: string): void {
    const trackIds: string[] = [];
    for (const id of this.tracks.keys()) {
      if (id.startsWith(prefix)) {
        trackIds.push(id);
      }
    }
    for (const id of trackIds) {
      this.unregisterTrack(id);
    }
    this.logger.info('Tracks unregistered by prefix', {
      prefix,
      removed: trackIds.length,
      instanceId: this.instanceId,
    });
  }
}
