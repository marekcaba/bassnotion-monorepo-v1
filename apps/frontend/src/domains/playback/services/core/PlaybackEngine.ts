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
import type { ResolvePendingBuffer } from './region-processing/scheduling-orchestrator/RegionScheduler.js';
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
import {
  audioInstrumentTypeToStemKey,
  isPitchShiftableStem,
} from '../../modules/tracks/management/TrackManagerProcessor.js';
import type { IAudioStemEngine } from './IAudioStemEngine.js';
import { AudioPlayerScheduler } from './region-processing/scheduling/AudioPlayerScheduler.js';
import {
  createPitchShiftAdapter,
  type PitchShiftAdapter,
} from './pitch-shift/PitchShiftAdapter.js';
import {
  createSoundTouchInsert,
  type SoundTouchInsert,
} from './pitch-shift/SoundTouchInsert.js';
import {
  SignalsmithBufferSource,
  DrumSliceSource,
} from './region-processing/scheduling-orchestrator/InfiniteAudioSource.js';
import { DrumBeatsPlayer } from './drum-slicer/DrumBeatsPlayer.js';

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
  /**
   * Number of times to repeat the pattern. Defaults to 1 (play once);
   * 2+ repeats finitely; 0 means infinite (only supported for audio-stem
   * tracks via LAUNCH-02.5b's `scheduleInfiniteAudioRegion`).
   */
  loopCount?: number;
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

  /**
   * Single master bus every instrument gain sums into before the destination
   * (instrumentGain → masterGain → destination). Its only job is the
   * click-free STOP: ramping ONE node to 0 over a short fade lets us tear down
   * all the per-stem sources (the signalsmith worklets that hold ~145ms of
   * residual, the drum slice player's many short AudioBufferSourceNodes) AFTER
   * the fade — i.e. in silence — so none of those teardowns can click,
   * regardless of their individual mechanics. Restored to 1 after teardown.
   */
  private masterGain: GainNode | null = null;

  /**
   * User-facing MASTER VOLUME, in series AFTER masterGain
   * (instrumentGain → masterGain → masterVolumeGain → destination). Kept
   * SEPARATE from masterGain so the start/stop click-free fades (which own
   * masterGain's 0↔1 automation) never fight the user's chosen level — the two
   * gains multiply. Defaults to 1 (full). */
  private masterVolumeGain: GainNode | null = null;
  /** The user's chosen master volume (0..1), preserved even before the node
   *  exists so a pre-play set applies when the graph is built. */
  private masterVolumeLevel = 1;

  // Current tempo tracking (for metrics collector sync)
  private currentTempo = 120; // Default tempo in BPM

  // LAUNCH-02.5b: audio-stem state. Buffers are populated by
  // setAudioStemBuffers(); the scheduler fires AudioBufferSources from them
  // when RegionScheduler tells EventRouter to play an 'audio-*' event.
  private audioPlayerScheduler: AudioPlayerScheduler | null = null;
  private audioStemBuffers = new Map<AudioInstrumentType, AudioBuffer>();

  /** True once the pitch-shift engine's worklet has been registered with
   *  this.audioContext.audioWorklet. Until this is true,
   *  getOrCreateStretchSource() returns null. */
  private pitchWorkletReady = false;

  /** Pitch-shift engine adapter (LAUNCH-02.5f). Constructed once at
   *  initialize(); hides the engine's register / createBufferStreamingNode /
   *  setRate / setSemitones / latency behind a common interface so a future
   *  engine swap stays a one-file change. */
  private pitchShiftAdapter: PitchShiftAdapter | null = null;

  /** Time-stretch (LAUNCH-06): per-stem signalsmith BUFFER-STREAMING nodes
   *  for bass/harmony. These nodes PLAY their own buffer and self-loop —
   *  they ARE the source (true pitch-independent time-stretch: rate ⟂
   *  semitones). Created in setAudioStemBuffers, registered with the
   *  RegionScheduler as self-looping sources, and disposed in stopAudioStems. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private instrumentStretchNodes = new Map<AudioInstrumentType, any>();

  /** Time-stretch (LAUNCH-06): per-stem DelayNode between each bass/harmony
   *  stretch node and its gain. Unused by the slice-player drum path (kept for
   *  the WSOLA fallback / if a residual offset ever needs trimming). */
  private stretchLatencyDelays = new Map<AudioInstrumentType, DelayNode>();

  /** The DRUM tempo engine: an Ableton "Beats"-style transient-preserving slicer.
   *  Slices the loop at every transient, re-grids each slice un-stretched (rate 1 —
   *  transients can never smear/pitch-bend), fills slow-tempo gaps by looping the quiet
   *  decay tail, and nudges smoothly via varispeed-during-drag + re-render-on-settle.
   *  It IS the drum source (registered with the scheduler as a self-looping source).
   *  Created in ensureDrumSlicePlayer(). */
  private drumBeats: DrumBeatsPlayer | null = null;

  /** Time-stretch (LAUNCH-06): the MUSICAL loop length (seconds) bass/harmony
   *  buffer-streaming nodes loop on — set by the groove card before
   *  registering stems. CRITICAL for cross-stem sync: the recorded stem
   *  buffers are each a slightly different length (encode padding etc.), so
   *  looping each on its own buffer.duration drifts them out of phase with
   *  the beat-locked drum loop. Looping all of them on the ONE musical length
   *  (lengthBars × 4 × 60 / originalBpm — the same grid drums use via
   *  region.duration) phase-locks them. 0 = fall back to each buffer's own
   *  duration (no card has set it). */
  private stemLoopDurationSeconds = 0;

  /** Time-stretch (LAUNCH-06): signalsmith's audible latency (input+output,
   *  ~175ms). bass/harmony play THROUGH signalsmith so their audio emerges
   *  this much AFTER their scheduled start; drums + click are on direct/near-
   *  zero-latency paths. To keep them aligned we delay drums + click by this
   *  amount (a DelayNode on each path). Read once (async) from the bass node
   *  after it resolves. 0 until known. EMPIRICAL: measured ~112–175ms via the
   *  drift sampler; node.latency() reports the precise value. */
  private stretchLatencySeconds = 0;
  /** The DelayNode on the drum path compensating for signalsmith latency, so
   *  drums (zero-latency) emerge at the same time as the latency-delayed
   *  bass/harmony. `drumSource → [soundtouch?] → drumDelay → drumGain`.
   *  Created when the stretch sources + latency are known; torn down on stop. */
  private drumLatencyDelayNode: DelayNode | null = null;

  /** Time-stretch (LAUNCH-06): WSOLA insert for the DRUM stem (SoundTouch).
   *  Drums keep the ABSN windowed path but stream THROUGH this insert so
   *  their pitch is preserved under tempo change. WSOLA keeps transients
   *  sharp where the phase-vocoder would smear them. */
  private soundTouchInsert: SoundTouchInsert | null = null;
  private soundTouchReady = false;
  /** The drum SoundTouch insert node, once created. drumSource → node → gain. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drumStretchInsertNode: any | null = null;

  // LAUNCH-02.5c key-shift: per-iteration buffer override. Threaded into
  // RegionScheduler.scheduleAll so the Groove Card hook can swap key sets
  // at loop boundaries. Owned by the currently-active card; cleared only
  // by the owner (see setPendingBufferResolver below) so a stale unmount
  // can't wipe an incoming card's freshly-installed resolver.
  private pendingBufferResolver: ResolvePendingBuffer | null = null;
  private pendingBufferResolverOwnerId: string | null = null;

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

      // LAUNCH-02.5f: construct the pitch-shift engine adapter (Signalsmith)
      // and register its worklet once per AudioContext, ahead of any stem
      // playback. Failures are non-fatal — the engine continues to boot and
      // getOrCreateStretchSource() returns null, which downstream code
      // treats as "no pitch shift available, play stem dry". Signalsmith
      // self-injects its worklet (no served processor file to host).
      try {
        this.pitchShiftAdapter = createPitchShiftAdapter({
          info: (msg, data) =>
            this.logger.info(msg, { instanceId: this.instanceId, data }),
          warn: (msg, data) =>
            this.logger.warn(msg, { instanceId: this.instanceId, data }),
          debug: (msg, data) =>
            this.logger.debug(msg, { instanceId: this.instanceId, data }),
        });
        const ok = await this.pitchShiftAdapter.register(audioContext);
        this.pitchWorkletReady = ok;
        this.logger.info('Pitch-shift engine registered', {
          instanceId: this.instanceId,
          library: this.pitchShiftAdapter.library,
          ready: ok,
        });
      } catch (err) {
        this.logger.warn(
          'Pitch-shift engine registration failed; pitch shifting disabled',
          { instanceId: this.instanceId, err },
        );
        // Stay un-ready; pitch shift methods will fall through to the
        // no-op path. Engine init continues normally.
      }

      // Time-stretch (LAUNCH-06): register the SoundTouch (WSOLA) worklet for
      // the drum-stem time-stretch insert. Separate engine from Signalsmith;
      // needs its served processor file (copied to /public/worklets). Failure
      // is non-fatal — drums fall back to un-stretched playback.
      try {
        this.soundTouchInsert = createSoundTouchInsert({
          info: (msg, data) =>
            this.logger.info(msg, { instanceId: this.instanceId, data }),
          warn: (msg, data) =>
            this.logger.warn(msg, { instanceId: this.instanceId, data }),
          debug: (msg, data) =>
            this.logger.debug(msg, { instanceId: this.instanceId, data }),
        });
        this.soundTouchReady =
          await this.soundTouchInsert.register(audioContext);
        this.logger.info('SoundTouch drum-stretch engine registered', {
          instanceId: this.instanceId,
          ready: this.soundTouchReady,
        });
      } catch (err) {
        this.logger.warn(
          'SoundTouch registration failed; drum time-stretch disabled',
          { instanceId: this.instanceId, err },
        );
      }

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
   * Audio-context time at which the current playback's first beat is
   * scheduled. Set inside start() as `audioContext.currentTime +
   * startupLookahead` and used internally for sample-accurate scheduling.
   * Exposed so visual systems (countdown numbers, waveform playhead) can
   * anchor to the same instant the audio actually fires — without it, the
   * UI runs ~`startupLookahead` (default 300ms) ahead of the sound.
   * Returns 0 before the first start() call.
   */
  getTransportStartTime(): number {
    return this.transportStartTime;
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
      // This prevents redundant updates while still allowing content changes.
      //
      // Audio-stem tracks (audio-bass / audio-drums / audio-harmony / audio-
      // click) are exempt: they never carry pattern.events (their content is
      // pre-rendered AudioBuffers, not per-note MIDI), so eventCount is
      // always 0 and the skip-update branch can NEVER detect a meaningful
      // change. That includes the Groove Card's loopSlice flips — the bar-
      // range selection lives on Region, not on pattern.events, so the
      // optimization would silently drop legitimate updates. For these
      // tracks we always apply the new track regardless of count parity.
      const isAudioStem = track.instrumentType?.startsWith('audio-') ?? false;
      if (
        !isAudioStem &&
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

    // Idempotent: drop any prior count-in before re-adding. Callers that
    // re-arm on every play (e.g. the Groove Card, which doesn't go through
    // switchExercise()) would otherwise stack duplicate countdown regions.
    metronomeTrack.regions = metronomeTrack.regions.filter(
      (r) => r.id !== countdownRegion.id,
    );
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
        // Dependency 17 (LAUNCH-02.5b): resolvePendingBuffer — captured by
        // RegionScheduler into per-iteration source.onended closures. The
        // active Groove Card installs its resolver via
        // setPendingBufferResolver before triggering schedule; iterations
        // armed during this pass close over the value we pass here.
        // Iterations armed later inside source.onended (the WINDOW=3
        // sliding refill) capture the SAME reference because the closure
        // is the one we pass right now — so a subsequent install does NOT
        // affect already-armed refill chains.
        this.pendingBufferResolver ?? undefined,
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
   * True when the engine has no usable AudioContext — either never initialized,
   * or the context it captured at initialize() has since been closed. Callers
   * (e.g. the GrooveCard play path) use this to decide whether to rebindContext
   * to the live context before arming stems.
   */
  needsContextRebind(_liveContext?: AudioContext | null): boolean {
    if (!this.isInitialized) return false; // never initialized → use initialize()
    if (!this.audioContext) return true;
    // Only rebind away from a DEAD (closed) context. A merely-different but
    // still-running live context is intentionally NOT a rebind trigger:
    // hot-swapping running contexts mid-session would strand context-bound
    // AudioBuffers in GlobalSampleCache (the cache is path-keyed, not
    // context-keyed). The liveContext arg is accepted for call-site symmetry
    // and possible future divergence policy, but unused today.
    return this.audioContext.state === 'closed';
  }

  /**
   * Re-point a LIVE (already-initialized) engine at a new AudioContext WITHOUT
   * a full dispose()/initialize() cycle.
   *
   * Why this exists: this.audioContext is captured once in initialize() and the
   * engine is a long-lived window-global. If that context is closed out from
   * under it (a hard reload / Fast Refresh / OS audio-device change disposing
   * the AudioEngine), every subsequently-built node — Signalsmith stretch
   * worklets, master/instrument gains — would be constructed against the dead
   * context and throw ("AudioWorkletNode cannot be created") or, worse, route
   * silently into a dead graph. A bare `this.audioContext = ctx` is NOT enough:
   * the cached gain/stretch/delay nodes survive bound to the old context and
   * produce SILENT output. This method tears those down and re-points the
   * schedulers so the next setAudioStemBuffers() rebuilds everything fresh.
   *
   * The caller MUST re-inject buffers after this (becomeActive() →
   * setAudioStemBuffers()), which rebuilds each scheduler's audioDestination
   * and the AudioPlayerScheduler stem gains against the new context.
   */
  async rebindContext(
    audioContext: AudioContext,
    audioDestination: AudioNode,
  ): Promise<void> {
    if (!this.isInitialized) {
      // Not initialized yet — the normal initialize() path is correct.
      await this.initialize(audioContext, audioDestination);
      return;
    }
    if (this.audioContext === audioContext) {
      return; // already on this context — nothing to do
    }

    this.logger.warn('PlaybackEngine: rebinding to a new AudioContext', {
      instanceId: this.instanceId,
      oldState: this.audioContext?.state,
      newState: audioContext.state,
    });

    // 1) Hard-stop and tear down everything bound to the OLD context. Hard cut
    //    (rampSeconds 0) — the old context is dead/dying, a fade is pointless
    //    and would touch dead nodes. stopAudioStems clears instrumentStretchNodes,
    //    drumSlicePlayer, drumLatencyDelayNode and the self-looping sources.
    try {
      this.stopAudioStems({ rampSeconds: 0 });
    } catch (err) {
      this.logger.debug('rebindContext: stopAudioStems failed (ignored)', {
        err,
      });
    }

    // 2) Disconnect + drop the cached context-bound graph nodes so the lazy
    //    getters rebuild them against the new context. stopAudioStems does NOT
    //    cover these (master/instrument gains persist for the engine's life,
    //    and stretchLatencyDelays is leaked even by stopAudioStems).
    const disconnect = (n: AudioNode | null | undefined) => {
      try {
        n?.disconnect();
      } catch {
        /* node may already be detached from the dead context */
      }
    };
    disconnect(this.masterGain);
    disconnect(this.masterVolumeGain);
    this.masterGain = null;
    this.masterVolumeGain = null;
    for (const g of this.instrumentGainNodes.values()) disconnect(g);
    this.instrumentGainNodes.clear();
    for (const d of this.stretchLatencyDelays.values()) disconnect(d);
    this.stretchLatencyDelays.clear();

    // 3) Adopt the new context everywhere.
    this.audioContext = audioContext;
    this.audioDestination = audioDestination;
    this.sampleRate = audioContext.sampleRate;
    this.scheduler.setAudioContext(audioContext);
    this.sustainPedalManager?.setAudioContext(audioContext);
    this.audioPlayerScheduler?.setAudioContext(audioContext);
    this.metronomeScheduler?.setAudioContext(audioContext);
    this.drumScheduler?.setAudioContext(audioContext);
    this.bassScheduler?.setAudioContext(audioContext);
    this.voiceCueScheduler?.setAudioContext(audioContext);
    this.harmonyScheduler?.setAudioContext(audioContext);
    this.metricsCollector?.setSampleRate(this.sampleRate);

    // 4) Re-register the per-context worklet engines (Signalsmith pitch-shift +
    //    SoundTouch). register() is per-context; the old registration is bound
    //    to the dead context. Reset the ready flags first so a failed
    //    re-register correctly falls back to dry playback.
    this.pitchWorkletReady = false;
    if (this.pitchShiftAdapter) {
      try {
        this.pitchWorkletReady =
          await this.pitchShiftAdapter.register(audioContext);
      } catch (err) {
        this.logger.warn('rebindContext: pitch-shift re-register failed', {
          instanceId: this.instanceId,
          err,
        });
      }
    }
    this.soundTouchReady = false;
    if (this.soundTouchInsert) {
      try {
        this.soundTouchReady =
          await this.soundTouchInsert.register(audioContext);
      } catch (err) {
        this.logger.warn('rebindContext: soundtouch re-register failed', {
          instanceId: this.instanceId,
          err,
        });
      }
    }

    // 5) Re-initialize the EventRouter against the new context (it caches the
    //    context at initialize-time).
    if (this.eventRouter && this.metronomeScheduler && this.drumScheduler) {
      try {
        this.eventRouter.initialize(
          audioContext,
          this.sampleRate,
          this.eventBus,
          this.metronomeScheduler,
          this.drumScheduler,
          this.harmonyScheduler!,
          this.bassScheduler!,
          this.voiceCueScheduler!,
          (frame: number, time: number) => {
            this.metricsCollector?.track(frame, time);
          },
          this.audioPlayerScheduler!,
        );
      } catch (err) {
        this.logger.warn('rebindContext: EventRouter re-init failed', {
          instanceId: this.instanceId,
          err,
        });
      }
    }

    this.logger.info('PlaybackEngine: context rebind complete', {
      instanceId: this.instanceId,
      pitchWorkletReady: this.pitchWorkletReady,
      soundTouchReady: this.soundTouchReady,
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
  /**
   * The master bus (lazily created). Every instrument gain routes through this
   * before the destination so a single fade can silence the whole engine for a
   * click-free stop. Returns null only if there's no AudioContext yet.
   */
  private getMasterGain(): GainNode | null {
    if (!this.audioContext) return null;
    if (!this.masterGain) {
      // Graph: masterGain (fade bus) → masterVolumeGain (user volume) → dest.
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 1;
      this.masterVolumeGain = this.audioContext.createGain();
      this.masterVolumeGain.gain.value = this.masterVolumeLevel;
      this.masterGain.connect(this.masterVolumeGain);
      this.masterVolumeGain.connect(this.audioContext.destination);
    }
    return this.masterGain;
  }

  /**
   * Set the MASTER VOLUME for the whole engine (all stems), 0..1. Scales the
   * dedicated masterVolumeGain in series after the fade bus, so it composes with
   * (never fights) the start/stop click-free fades. Stored even before the node
   * exists, applied when the graph is built. Smooth-ramped to avoid a click.
   */
  setMasterVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.masterVolumeLevel = clamped;
    // Ensure the graph (and thus masterVolumeGain) exists.
    this.getMasterGain();
    if (this.masterVolumeGain && this.audioContext) {
      try {
        this.masterVolumeGain.gain.setTargetAtTime(
          clamped,
          this.audioContext.currentTime,
          0.02,
        );
      } catch {
        this.masterVolumeGain.gain.value = clamped;
      }
    }
  }

  /** The current master volume (0..1). */
  getMasterVolume(): number {
    return this.masterVolumeLevel;
  }

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

    // Create new gain node and route it through the master bus (so a single
    // master fade can silence everything for a click-free stop). Fall back to
    // the destination directly if the master can't be created (no context —
    // shouldn't happen here since we checked above).
    const gainNode = this.audioContext.createGain();
    gainNode.connect(this.getMasterGain() ?? this.audioContext.destination);
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
    // Stamp the effective resting volume so the click-free stop helper can
    // restore to a KNOWN value instead of re-reading the live AudioParam
    // (which, read mid-fade, would ratchet the stem quieter across reps).
    (gainNode as GainNode & { __restingVolume?: number }).__restingVolume =
      effectiveVolume;

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
    // Keep the resting-volume stamp current so click-free stops restore to
    // this level rather than a live (possibly mid-ramp) AudioParam read.
    (gainNode as GainNode & { __restingVolume?: number }).__restingVolume =
      effectiveVolume;

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
    // Keep the resting-volume stamp current (muted ⇒ 0) so click-free stops
    // restore to this level rather than a live AudioParam read.
    (gainNode as GainNode & { __restingVolume?: number }).__restingVolume =
      effectiveVolume;

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
   * Time-stretch (LAUNCH-06): set the MUSICAL loop length (seconds) that
   * bass/harmony buffer-streaming sources loop on, so they stay phase-locked
   * with the beat-grid drum loop instead of drifting on their own
   * slightly-different buffer durations. Call BEFORE setAudioStemBuffers (the
   * value is read when the stretch nodes are constructed). Pass
   * lengthBars × 4 × 60 / originalBpm — the same musical length the drum
   * region loops on via its beat-based duration.
   */
  setStemLoopDuration(seconds: number): void {
    this.stemLoopDurationSeconds = seconds > 0 ? seconds : 0;
    // Forward to the scheduler so the DRUM stem loops on the same musical
    // length as a single native-loop source (beat-locked to bass/harmony).
    this.regionScheduler?.setStemLoopDuration(this.stemLoopDurationSeconds);
  }

  /**
   * Time-stretch (LAUNCH-06): the REAL audio playhead phase in [0, 1) — where
   * the bass stem's signalsmith worklet is ACTUALLY reading in its loop right
   * now. This is the single audio-truth clock the visual playhead reads, so it
   * stays glued to the sound: it advances at the OLD tempo until a pending
   * tempo change actually lands at the loop seam, then the NEW tempo — with no
   * BPM formula to desync. `node.inputTime` is the worklet read head (buffer
   * seconds), interpolated between its postMessage updates using the audio
   * clock so a 30 FPS playhead stays smooth. Returns null when unavailable
   * (node not resolved / not stretching) so the caller can fall back to its
   * own clock.
   */
  /**
   * The CONTINUOUS, never-stale bass read-head — the single source of truth for
   * both the visual playhead ({@link getStemPlayheadPhase}) and the key-change
   * loop-seam math ({@link getStemNextSeamTime}).
   *
   * `node.inputTime` is the worklet read-head (buffer seconds), but it's posted
   * only ~every 8ms (setUpdateInterval 1/120) and carries the WRAPPED value — so
   * reading it raw near the loop seam can land on the wrong side of the wrap (the
   * intermittent "key lands a full loop late" bug). We interpolate from the last
   * posted value using the audio clock (`stamp.inputTime + (now−atTime)×rate`),
   * which is monotonic-within-loop and never lies across the wrap. The stamp is
   * refreshed lazily on each call, so any caller polling on its own tick keeps it
   * fresh (don't rely on the 30fps, count-in-gated waveform RAF).
   *
   * Returns the RAW (pre-visual-latency) read-head: `phaseSeconds` (unwrapped
   * input seconds), the live `rate`, and `loopLen` = the buffer's actual wrap
   * length (`__bufferDuration`, which can be shorter than stemLoopDurationSeconds
   * if the PCM is shorter than the musical loop). Returns null when the node
   * isn't resolved / not stretching.
   */
  private getStemReadHead(): {
    phaseSeconds: number;
    rate: number;
    loopLen: number;
  } | null {
    if (!this.audioContext) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const relay = this.instrumentStretchNodes.get('audio-bass') as any;
    const sg = relay?.__signalsmith;
    if (!sg || typeof sg.inputTime !== 'number') return null;
    const loopLen =
      typeof relay.__bufferDuration === 'number' && relay.__bufferDuration > 0
        ? relay.__bufferDuration
        : this.stemLoopDurationSeconds;
    if (!(loopLen > 0)) return null;

    const now = this.audioContext.currentTime;
    // Interpolate from the last posted inputTime using elapsed audio time ×
    // the current rate (defaults to 1). We stamp {inputTime, atTime, rate} on
    // the relay each time inputTime changes so motion between posts is smooth.
    const stamp = relay.__phaseStamp as
      | { inputTime: number; atTime: number; rate: number }
      | undefined;
    let phaseSeconds: number;
    let rate =
      typeof relay.__currentRate === 'number' ? relay.__currentRate : 1;
    // The `stamp.rate === rate` guard prevents extrapolating across a rate change
    // (setRate re-anchors the stamp on a tempo change; this is belt-and-suspenders
    // so a racing reader never advances input at a stale rate). Same as
    // PitchShiftAdapter.nextSeamOutputTime.
    if (
      stamp &&
      stamp.inputTime === sg.inputTime &&
      stamp.rate === rate &&
      now >= stamp.atTime
    ) {
      // Same posted value + same rate → advance by elapsed × rate.
      phaseSeconds = stamp.inputTime + (now - stamp.atTime) * stamp.rate;
      rate = stamp.rate;
    } else {
      // New posted value / rate change / first read → re-stamp at this instant.
      relay.__phaseStamp = { inputTime: sg.inputTime, atTime: now, rate };
      phaseSeconds = sg.inputTime;
    }
    return { phaseSeconds, rate, loopLen };
  }

  getStemPlayheadPhase(): number | null {
    const loopLen = this.stemLoopDurationSeconds;
    if (loopLen <= 0 || !this.audioContext) return null;
    const readHead = this.getStemReadHead();
    if (!readHead) return null;
    // The visual playhead wraps on the MUSICAL loop length (stemLoopDurationSeconds),
    // not the buffer's __bufferDuration — keep the historic behaviour. The raw
    // continuous read-head + rate come from the shared helper.
    let phaseSeconds = readHead.phaseSeconds;
    const rate = readHead.rate;

    // VISUAL LATENCY COMPENSATION. `inputTime` is the worklet READ head — where
    // signalsmith reads FROM its buffer — which leads what the listener HEARS by
    // the phase-vocoder processing latency plus the AudioContext output latency.
    // Measured ~185ms ahead; uncompensated the playhead visibly runs in front of
    // the sound. (The bass/harmony/drums mix is internally coherent — all share
    // the same output path — so we only correct the VISUAL clock, never audio.)
    // Prefer the engine's measured stretch latency if it's been resolved;
    // otherwise fall back to signalsmith's nominal. Scale by `rate` because the
    // read head advances `rate` buffer-seconds per wall-second, so a fixed
    // output-time lag maps to `lag × rate` of read-head position.
    const VISUAL_STRETCH_LATENCY_FALLBACK = 0.16; // ~signalsmith nominal for these profiles
    const processingLatency =
      this.stretchLatencySeconds > 0
        ? this.stretchLatencySeconds
        : VISUAL_STRETCH_LATENCY_FALLBACK;
    const outputLatency =
      typeof this.audioContext.outputLatency === 'number'
        ? this.audioContext.outputLatency
        : (this.audioContext.baseLatency ?? 0);
    phaseSeconds -= (processingLatency + outputLatency) * rate;

    // The latency-compensated `phaseSeconds` is the TARGET the playhead should sit at.
    // But its rate-scaled latency term (×rate) STEPS whenever the tempo nudges, and the
    // read-head re-stamps discretely on a rate change — so reading the target raw makes
    // the playhead JUMP each nudge tick. To keep it smooth (only ever speed up / slow
    // down, never jump), we run a persistent VISUAL PHASE ACCUMULATOR that advances
    // continuously at `rate` and SLEWS toward the target rather than snapping to it.
    const targetWrapped = ((phaseSeconds % loopLen) + loopLen) % loopLen;
    const now2 = this.audioContext.currentTime;
    const vp = this.visualPhase;
    let phase: number;
    if (
      vp == null ||
      vp.loopLen !== loopLen ||
      now2 < vp.atTime ||
      now2 - vp.atTime > 0.5 // stale (>500ms gap: a stop/seek) → resync hard
    ) {
      // First read / loop length changed / long gap → snap to the target (no history).
      phase = targetWrapped;
    } else {
      // 1) Advance the accumulator continuously by elapsed × rate (in loop seconds).
      const dt = now2 - vp.atTime;
      let advanced = vp.phase + dt * rate;
      // 2) Wrap, tracking signed distance to the target across the loop seam so the
      //    slew goes the short way and a genuine loop wrap isn't fought.
      advanced = ((advanced % loopLen) + loopLen) % loopLen;
      let err = targetWrapped - advanced;
      if (err > loopLen / 2) err -= loopLen;
      else if (err < -loopLen / 2) err += loopLen;
      // 3) SLEW toward truth: correct a fraction of the error per second (time-constant
      //    ~120ms) so a step in the target (a nudge) is absorbed smoothly instead of
      //    jumping. Small steady-state errors converge; the playhead never snaps.
      const slewPerSec = 6; // ~1/0.16s — gentle but keeps up
      advanced += err * Math.min(1, slewPerSec * dt);
      phase = ((advanced % loopLen) + loopLen) % loopLen;
    }
    this.visualPhase = { phase, atTime: now2, loopLen };
    return phase / loopLen;
  }

  /** Smoothed visual-playhead phase accumulator (loop seconds) — keeps the playhead
   *  continuous across tempo nudges (slews toward the read-head target, never jumps). */
  private visualPhase: { phase: number; atTime: number; loopLen: number } | null = null;

  /**
   * Wall-clock audio-context time of the NEXT loop seam, read from the bass
   * stem's ACTUAL signalsmith read-head and scaled by the live stretch rate.
   *
   * This is the authoritative seam for quantising a deferred key change. Unlike
   * the React-state clock the Groove Card hook used to derive it from
   * (loopStartAudioTime + loopDurationSeconds), this stays correct across a
   * tempo change: the read-head wraps on a FIXED input-domain buffer length and
   * the output time it maps to is `inputUntilSeam / rate`, so a live rate change
   * is reflected immediately. (The hook's React anchor went ~750ms stale after a
   * tempo change, landing the key swap off the real wrap — old key heard past
   * the first beat. See PitchShiftAdapter.nextSeamOutputTime.)
   *
   * The read-head seam is NOT the visual-latency offset getStemPlayheadPhase()
   * bakes in. But the raw read-head seam still leads the AUDIBLE downbeat by the
   * AudioContext→speaker output latency (~100ms): signalsmith's schedule({output})
   * switches its segment at `currentTime + worklet outputLatency`, but the device
   * buffer between the worklet and the speaker is NOT accounted for there. So a
   * key change quantised to the raw read-head seam is HEARD ~outputLatency BEFORE
   * the downbeat (measured + confirmed by ear: "lands ~100ms before the first
   * beat"). We push the returned seam LATER by the output latency (× rate) so the
   * deferred key change emerges ON the audible downbeat. {@link keySeamOffsetOverride}
   * lets a dev dial the exact value by ear.
   *
   * Returns null when not stretching / the read-head isn't known yet (caller
   * falls back to its own boundary computation).
   */
  getStemNextSeamTime(): number | null {
    if (!this.audioContext || !this.pitchShiftAdapter) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const relay = this.instrumentStretchNodes.get('audio-bass') as any;
    if (!relay) return null;
    const rate =
      typeof relay.__currentRate === 'number' ? relay.__currentRate : 1;
    const readHeadSeam = this.pitchShiftAdapter.nextSeamOutputTime(
      relay as AudioNode,
      this.audioContext,
      rate,
    );
    if (readHeadSeam == null) return null;
    return readHeadSeam + this.getKeySeamAudibleOffset();
  }

  /**
   * The offset (seconds) added to the raw read-head loop seam so a deferred key
   * change is HEARD on the audible downbeat. SINGLE SOURCE OF TRUTH — both
   * getStemNextSeamTime (used by setKey to quantise the change) AND the
   * adapter's setRate re-thread (which re-quantises a PENDING change when tempo
   * changes) must use the SAME value, or a tempo change moves the pending key off
   * the seam (it was scheduled with this offset, re-quantised without it → flips
   * a beat early/immediately).
   *
   * Why this value (derived from docs/dev-tools/audio-audit/key-seam-sweep.js, a
   * 54-cell key×tempo sweep timing the audible pitch transition vs the drum kick):
   *  - The raw read-head seam (output-domain) leads the speaker by the
   *    AudioContext DEVICE output-buffer latency — downstream of all DSP, which
   *    signalsmith's schedule({output}) does NOT self-compensate (it only cancels
   *    its own block latency; it has no reference to audioContext.outputLatency).
   *  - RATE-INVARIANT: a constant number of wall-clock seconds (a prior `* rate`
   *    double-scaled it — the seam is already mapped to output via
   *    inputUntilSeam/rate — drifting ±65ms across ±40 BPM). Pitch-invariant too.
   *  - PER-DEVICE: read audioContext.outputLatency LIVE (varies 50–150ms across
   *    wired / Bluetooth / Safari). KEY_SEAM_RESIDUAL corrects the small fixed gap
   *    between outputLatency and the true audible offset (~−0.04s, measured).
   *  - setKeySeamOffsetOverride wins for ear-tuning / verification.
   */
  private getKeySeamAudibleOffset(): number {
    if (this.keySeamOffsetOverride != null) {
      return Math.max(0, this.keySeamOffsetOverride);
    }
    const KEY_SEAM_RESIDUAL = -0.04; // measured: outputLatency over-shoots ~40ms
    const outputLatency =
      this.audioContext && typeof this.audioContext.outputLatency === 'number'
        ? this.audioContext.outputLatency
        : (this.audioContext?.baseLatency ?? 0.1);
    return Math.max(0, outputLatency + KEY_SEAM_RESIDUAL);
  }

  /**
   * DEV ear-tuning: force the key-change seam's audible-downbeat offset (seconds)
   * instead of the measured signalsmith latency. Pass null to clear and return
   * to the measured value. Larger = key change LATER (closer to / past the
   * downbeat); smaller = earlier. Locked by ear at 0.176s (see getStemNextSeamTime).
   */
  keySeamOffsetOverride: number | null = null;
  setKeySeamOffsetOverride(seconds: number | null): void {
    this.keySeamOffsetOverride = seconds;
  }

  /**
   * [LAUNCH-06 DEBUG] GROUND-TRUTH audible drift between two stems, measured
   * from the ACTUAL rendered audio (not scheduled times / read-heads). Taps
   * each stem's gain with an AnalyserNode, records the |amplitude| envelope
   * for `seconds`, then cross-correlates the two envelopes to find the lag in
   * ms at which they best align (positive = `a` lags `b`). Resolves with the
   * lag + the correlation peak. This is what tells us if the stems are
   * audibly in sync, since it measures emitted sound.
   */
  async measureAudibleDrift(
    a: AudioInstrumentType = 'audio-bass',
    b: AudioInstrumentType = 'audio-drums',
    seconds = 4,
  ): Promise<{ lagMs: number; peak: number; samples: number } | null> {
    if (!this.audioContext) return null;
    const ctx = this.audioContext;
    const gainA = this.instrumentGainNodes.get(a);
    const gainB = this.instrumentGainNodes.get(b);
    if (!gainA || !gainB) return null;

    const makeTap = (g: GainNode) => {
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      g.connect(an); // tap (analyser has no output to destination — silent)
      return an;
    };
    const anA = makeTap(gainA);
    const anB = makeTap(gainB);
    const buf = new Float32Array(anA.fftSize);
    const rms = (an: AnalyserNode): number => {
      an.getFloatTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      return Math.sqrt(s / buf.length);
    };

    // Sample both envelopes at ~5ms intervals.
    const intervalMs = 5;
    const envA: number[] = [];
    const envB: number[] = [];
    await new Promise<void>((resolve) => {
      const id = window.setInterval(() => {
        envA.push(rms(anA));
        envB.push(rms(anB));
      }, intervalMs);
      window.setTimeout(() => {
        window.clearInterval(id);
        resolve();
      }, seconds * 1000);
    });

    try {
      gainA.disconnect(anA);
      gainB.disconnect(anB);
    } catch {
      /* ignore */
    }

    // Cross-correlate the onset envelopes (positive slope = where energy
    // rises). Using the rectified DERIVATIVE instead of raw RMS makes the
    // correlation lock onto shared ATTACK moments (both stems hit the beat
    // grid) rather than sustain shape — far more reliable for dissimilar
    // stems than raw-RMS correlation. `peak` near 0 ⇒ low confidence.
    const n = Math.min(envA.length, envB.length);
    const onsetEnv = (e: number[]): number[] => {
      const d = new Array(n).fill(0);
      for (let i = 1; i < n; i++) d[i] = Math.max(0, e[i] - e[i - 1]);
      const m = d.reduce((x, y) => x + y, 0) / n;
      return d.map((v) => v - m);
    };
    const ca = onsetEnv(envA);
    const cb = onsetEnv(envB);
    const energy = (e: number[]) => Math.sqrt(e.reduce((s, v) => s + v * v, 0));
    const denom = energy(ca) * energy(cb) || 1;
    const maxLagSamples = Math.floor(300 / intervalMs); // ±300ms
    let bestLag = 0;
    let bestCorr = -Infinity;
    for (let lag = -maxLagSamples; lag <= maxLagSamples; lag++) {
      let c = 0;
      for (let i = 0; i < n; i++) {
        const j = i + lag;
        if (j >= 0 && j < n) c += ca[i] * cb[j];
      }
      if (c > bestCorr) {
        bestCorr = c;
        bestLag = lag;
      }
    }
    // Positive lagMs = a's onsets align with LATER b onsets ⇒ a LAGS b.
    return { lagMs: bestLag * intervalMs, peak: bestCorr / denom, samples: n };
  }

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

    // Cancel any in-flight stop-fade on the master bus and snap it back to
    // unity. Arming stems means we're (re)starting playback; if the user hit
    // play DURING a 30ms stop fade, the master would still be ramping toward 0
    // and would silence the fresh audio until the deferred teardown restored
    // it. Resetting here makes a play-during-fade start at full level.
    const masterBus = this.getMasterGain();
    if (masterBus && this.audioContext) {
      try {
        masterBus.gain.cancelScheduledValues(this.audioContext.currentTime);
        masterBus.gain.setValueAtTime(1, this.audioContext.currentTime);
      } catch {
        /* best-effort */
      }
    }

    let registered = 0;
    for (const [key, buffer] of Object.entries(stems)) {
      if (!buffer) continue;
      const instrumentType = key as AudioInstrumentType;
      const stemKey: AudioStemKey =
        audioInstrumentTypeToStemKey(instrumentType);

      // Any in-flight sources are stopped by AudioPlayerScheduler.setStem
      // (which calls stopStem internally for a click-free swap) and by
      // regionScheduler.stopAllInfiniteAudio (called by stopAudioStems
      // before any re-register). No additional bookkeeping needed here.

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

      // Time-stretch (LAUNCH-06): pitch-shiftable stems (bass/harmony) play
      // through a signalsmith BUFFER-STREAMING node — the node IS the source
      // (plays its own PCM, self-loops) and does true pitch-independent
      // time-stretch. Construct it here and register it with the scheduler
      // as a self-looping source; the scheduler then arms it once at play
      // instead of spawning per-iteration AudioBufferSources. Drums keep the
      // ABSN path (the scheduler's windowed/loopSlice branches).
      if (isPitchShiftableStem(stemKey)) {
        this.getOrCreateStretchSource(instrumentType, buffer, gain);
      }
    }

    // Time-stretch (LAUNCH-06): build the transient-preserving DRUM slice
    // player (Ableton "Beats"-style). It detects the real onsets and plays
    // each slice bit-exact at rate 1, so drum transients are pristine at ANY
    // tempo (no WSOLA/phase-vocoder smearing) and the groove is preserved
    // (slices follow the actual hits, not a grid). It registers itself as a
    // self-looping source, so the scheduler arms it once at play and tempo
    // changes re-space the slices live.
    this.ensureDrumSlicePlayer();

    // NOTE: No drum latency-compensation delay. signalsmith self-compensates
    // its OUTPUT latency (it renders the segment scheduled at `when` AT `when`),
    // so bass/harmony emerge at the same T0 as the direct drums — they're
    // already aligned at rest. An earlier drum DelayNode (sized off a noisy
    // beat-ambiguous cross-correlation reading) actually CREATED a ~130ms
    // desync. Removed. If a real residual offset ever shows up by ear, trim it
    // here — but the default is zero compensation.

    this.logger.info('Audio-stem buffers registered', {
      registered,
      stemsTotal: this.audioStemBuffers.size,
      instanceId: this.instanceId,
    });
  }

  /**
   * Time-stretch (LAUNCH-06) — construct (or return the cached) signalsmith
   * BUFFER-STREAMING node for a pitch-shiftable stem and register it with the
   * RegionScheduler as a self-looping source.
   *
   * The node loads the stem PCM and PLAYS it itself, looping internally — so
   * it IS the source and does true pitch-independent time-stretch (rate ⟂
   * semitones). The scheduler arms it once per play; the engine owns its
   * disposal (stopAudioStems). Idempotent.
   *
   * Returns the node, or null if the engine isn't ready / construction fails
   * (the stem then plays dry).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getOrCreateStretchSource(
    instrumentType: AudioInstrumentType,
    buffer: AudioBuffer,
    gain: GainNode,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any | null {
    const stemKey = audioInstrumentTypeToStemKey(instrumentType);
    if (!isPitchShiftableStem(stemKey)) return null;

    const cached = this.instrumentStretchNodes.get(instrumentType);
    if (cached) return cached;

    if (
      !this.audioContext ||
      !this.pitchWorkletReady ||
      !this.pitchShiftAdapter
    ) {
      this.logger.debug(
        'getOrCreateStretchSource: engine not ready; deferring',
        {
          instrumentType,
          hasCtx: !!this.audioContext,
          workletReady: this.pitchWorkletReady,
        },
      );
      return null;
    }

    const stemProfile = stemKey === 'bass' ? 'bass' : 'harmony';
    const channelData: Float32Array[] = [];
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      channelData.push(buffer.getChannelData(ch));
    }

    // Loop on the MUSICAL length (beat grid) when the card set it, so
    // bass/harmony stay phase-locked with the drum loop instead of drifting
    // on their slightly-different raw buffer durations. Clamp to the buffer
    // so we never loop past the available PCM. Fall back to buffer.duration.
    const loopDuration =
      this.stemLoopDurationSeconds > 0
        ? Math.min(this.stemLoopDurationSeconds, buffer.duration)
        : buffer.duration;

    // Insert a DelayNode between the stretch node and the gain so we can delay
    // bass/harmony to match the DRUM's WSOLA-insert latency when stretching
    // (the insert is only in the drum path at R≠1; at R=1 this stays at 0 and
    // is transparent). signalsmith → delay → gain.
    let stretchDelay = this.stretchLatencyDelays.get(instrumentType);
    if (!stretchDelay) {
      stretchDelay = this.audioContext.createDelay(0.5);
      stretchDelay.delayTime.value = 0;
      stretchDelay.connect(gain);
      this.stretchLatencyDelays.set(instrumentType, stretchDelay);
    }

    const node = this.pitchShiftAdapter.createBufferStreamingNode(
      this.audioContext,
      stretchDelay,
      channelData,
      loopDuration,
      stemProfile,
    );
    if (!node) {
      this.logger.warn('getOrCreateStretchSource: adapter returned no node', {
        instrumentType,
      });
      return null;
    }

    this.instrumentStretchNodes.set(instrumentType, node);

    // Register the source with the scheduler so it arms it (one start at
    // play) instead of spawning per-iteration AudioBufferSources for this
    // stem. The wrapper drives start/stop and boundary-deferred rate/pitch.
    if (this.regionScheduler) {
      this.regionScheduler.setSelfLoopingSource(
        stemKey,
        new SignalsmithBufferSource(
          node as AudioNode,
          this.pitchShiftAdapter,
          this.audioContext,
        ),
      );
    }

    this.logger.info('Time-stretch buffer-streaming source created', {
      instrumentType,
      stemProfile,
      bufferDuration: buffer.duration,
      loopDuration,
    });

    // bass/harmony play THROUGH signalsmith so their audio emerges ~175ms
    // AFTER their scheduled start, while drums/click are near-zero latency —
    // the audible "stems out of sync" the drift sampler measured. The
    // scheduler pulls the bass/harmony START earlier by this latency so their
    // delayed output lands ON the drum grid (see scheduleInfiniteAudioRegion's
    // self-looping branch). SEED with the adapter's nominal latency NOW (sync)
    // so the FIRST play is already compensated, then refine with the exact
    // per-node value (async — remote latency()).
    //
    // This was previously dormant (refreshStretchLatency was never called and
    // there was no sync seed), so stretchLatencySeconds stayed 0 and the
    // scheduler pulled nothing — bass/harmony dragged the drum grid by the full
    // worklet latency. Seed once (value is ~equal per profile) and refine from
    // the bass node. A dev override (setStretchLatencyOverride) wins if set, so
    // the value can be tuned by ear.
    if (
      this.stretchLatencyOverride == null &&
      this.stretchLatencySeconds <= 0
    ) {
      const nominal = this.pitchShiftAdapter.latencySeconds(node as AudioNode);
      if (nominal > 0) this.setStretchLatencySeconds(nominal);
    }
    if (
      instrumentType === 'audio-bass' &&
      this.stretchLatencyOverride == null
    ) {
      this.refreshStretchLatency(node as AudioNode);
    }
    return node;
  }

  /**
   * Time-stretch latency used to pull bass/harmony starts earlier so they land
   * on the drum grid. Routed through one setter so the seed, the async refine,
   * and the dev ear-tuning override all funnel to the scheduler consistently.
   */
  private setStretchLatencySeconds(seconds: number): void {
    const v = this.stretchLatencyOverride ?? seconds;
    if (!(v > 0)) return;
    this.stretchLatencySeconds = v;
    this.regionScheduler?.setStretchLatency(v);
  }

  /**
   * DEV ear-tuning: force the stretch-latency compensation to a specific value
   * (seconds), overriding the measured/nominal one. Pass null to clear and
   * return to the measured value. Exposed on the engine so a dev slider can
   * nudge bass/harmony alignment live while listening. Re-applies immediately;
   * the next scheduled iteration uses the new value.
   */
  stretchLatencyOverride: number | null = null;
  setStretchLatencyOverride(seconds: number | null): void {
    this.stretchLatencyOverride = seconds;
    if (seconds != null && seconds >= 0) {
      this.stretchLatencySeconds = seconds;
      this.regionScheduler?.setStretchLatency(seconds);
    }
  }

  /**
   * Time-stretch (LAUNCH-06) — read signalsmith's audible latency from a
   * resolved bass node and stash it on both the engine and the scheduler, so
   * bass/harmony starts are pulled earlier to align their delayed output with
   * drums/click. The latency read is async (signalsmith's remote `latency()`
   * returns a promise); poll briefly until the node resolves.
   */
  private refreshStretchLatency(bassNode: AudioNode): void {
    const tryRead = (attempt: number) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sg = (bassNode as any).__signalsmith;
      if (!sg?.latency) {
        if (attempt < 20 && typeof window !== 'undefined') {
          window.setTimeout(() => tryRead(attempt + 1), 100);
        }
        return;
      }
      Promise.resolve(sg.latency())
        .then((lat: unknown) => {
          if (typeof lat === 'number' && lat > 0) {
            // Route through the setter so the dev override (ear-tuning) wins if
            // set. We compensate by pulling bass/harmony EARLIER (in the
            // scheduler), NOT by delaying drums — so do NOT also call
            // applyDrumLatencyDelay() here, or the two would double-correct.
            this.setStretchLatencySeconds(lat);
            this.logger.info('Stretch latency measured', {
              latencySeconds: lat,
              instanceId: this.instanceId,
            });
          }
        })
        .catch(() => {
          /* leave at 0 — drums just lead slightly; non-fatal */
        });
    };
    tryRead(0);
  }

  /**
   * Time-stretch (LAUNCH-06) — set the stretch ratio R (tempo; 1 = original
   * speed) on a stem's buffer-streaming node, independent of pitch, applied
   * at `applyAtAudioTime` (the next loop boundary). No-op for stems without a
   * stretch node. The scheduler is also told R so drum iterations arm at the
   * matching playbackRate.
   */
  setStemRate(
    instrumentType: AudioInstrumentType,
    ratio: number,
    applyAtAudioTime?: number,
    keyBoundaryOverride?: number,
  ): void {
    const node = this.instrumentStretchNodes.get(instrumentType);
    if (!node || !this.audioContext || !this.pitchShiftAdapter) return;
    this.pitchShiftAdapter.setRate(
      node as AudioNode,
      ratio,
      this.audioContext,
      applyAtAudioTime,
      // Pass the SAME audible-downbeat offset getStemNextSeamTime uses, so a
      // PENDING key change re-quantised here for the new tempo lands on the
      // identical seam it was originally scheduled at (not ~outputLatency early).
      this.getKeySeamAudibleOffset(),
      // The drum loop "one" (already + audible offset). When present, the
      // re-thread anchors the pending key to THIS instead of re-deriving its own
      // seam from the read-head — so the key lands exactly where the drums do,
      // stable across many incremental tempo clicks (the drift fix).
      keyBoundaryOverride,
    );
  }

  /**
   * Time-stretch (LAUNCH-06) — tell the RegionScheduler the current stretch
   * ratio so newly-armed drum iterations pick up the matching playbackRate,
   * and set the always-on drum WSOLA insert's rate to cancel the pitch shift.
   * (The insert is always in the drum path — see ensureDrumInsertRouting — so
   * this never reconnects the graph.)
   */
  setSchedulerTempoRatio(ratio: number, applyAtAudioTime?: number): void {
    this.regionScheduler?.setTempoRatio(ratio);
    // Drums use the transient-preserving slice player. Set its ratio here too
    // so EVERY caller (including becomeActive's pre-play tempo restore on
    // replay) updates drums — without this, stop→replay rebuilds the slice
    // player at ratio 1 and drums revert to original tempo while bass/harmony
    // keep the adjusted tempo. Pre-play (not yet started) this just stamps the
    // field the slice player reads when it arms; mid-play it re-spaces live.
    // CRITICAL: pass the SAME pivot time bass/harmony use so all three change
    // rate at one instant — otherwise drums pivot at a different time and a
    // per-change phase error accumulates (tempo-dependent desync).
    this.drumBeats?.setRatio(ratio, applyAtAudioTime);
  }

  /**
   * Time-stretch (LAUNCH-06) — apply a stretch ratio R to ALL stems at ONE
   * shared loop boundary so they never drift apart. This is the single entry
   * point the groove-card hook calls on a tempo change; it owns the cross-stem
   * sync that previously lived (incorrectly) in the hook:
   *
   *   1. Read the authoritative next loop seam from the DRUM region's armed
   *      iterations (the ABSN clock is the ground truth; bass/harmony loop the
   *      same musical length from the same T0, so it's their seam too).
   *   2. Set the scheduler ratio + splice/adjust the drum WSOLA insert.
   *   3. Re-arm the drum region so future drum iterations play at R, starting
   *      exactly at that seam.
   *   4. Schedule the bass/harmony buffer-streaming rate change at the SAME
   *      seam.
   *
   * `drumRegionId` is the drum region id (e.g. `${prefix}audio-drums-region`).
   * When not playing (no armed seam), all changes apply immediately so the
   * next play() picks them up.
   */
  /**
   * Time-stretch (LAUNCH-06, Model C): change tempo IMMEDIATELY mid-loop, with
   * NO rebuild — all three stems change rate LIVE at one shared audio time so
   * they stay phase-locked, and the nodes keep running (no teardown artifact /
   * no dip). bass/harmony: signalsmith `schedule({rate, output:T})`. drums: the
   * source's playbackRate + the always-on WSOLA insert's rate, both at T (the
   * insert cancels the pitch). The grid re-anchor (loop period / playhead) is
   * the caller's job — this returns nothing the engine clock cares about; the
   * playhead already tracks the real read-head.
   *
   * `applyAheadSeconds` schedules the change slightly in the future (default a
   * few ms) so all engines flip at the SAME sample-accurate instant rather
   * than at slightly different JS-execution times.
   */
  setStretchRatio(
    ratio: number,
    _drumRegionId: string,
    applyAheadSeconds = 0.02,
  ): void {
    const now = this.audioContext?.currentTime ?? 0;
    const T = now + applyAheadSeconds;

    // Scheduler ratio + drum slice player ratio (re-spaces the slices LIVE;
    // each slice still plays bit-exact at rate 1 — pristine transients). Pivot
    // at the SAME shared time T as bass/harmony so all three flip together.
    // MUST run BEFORE reading the drum downbeat below — it re-anchors the drum
    // loop grid at T, so getNextDownbeat reflects the NEW tempo.
    this.setSchedulerTempoRatio(ratio, T);

    // KEY-SEAM ANCHOR: if a key change is PENDING on bass/harmony, it must land on
    // the loop "one" — the SAME musical downbeat the drums land on. The drum loop
    // grid (loopStartTime) is a STATE re-anchored by exact phase algebra on every
    // tempo click, so it's stable across many incremental BPM steps. Re-deriving
    // the bass key's seam from the read-head each click instead made the key DRIFT
    // by the click pattern (measured). So we read the drum's next downbeat here
    // (after the re-anchor above) and pass it as the key boundary — the key then
    // lands exactly where the drums do, by construction. + the audible-downbeat
    // offset the key was originally deferred with. null when drums absent → setRate
    // falls back to its own read-head re-derivation.
    const drumDownbeat = this.drumBeats?.getNextDownbeat(now) ?? null;
    const keyBoundary =
      drumDownbeat != null
        ? drumDownbeat + this.getKeySeamAudibleOffset()
        : undefined;

    // bass/harmony rate change scheduled at the SAME T (immediate, not at a
    // loop seam) so all three flip together.
    this.setStemRate('audio-bass', ratio, T, keyBoundary);
    this.setStemRate('audio-harmony', ratio, T, keyBoundary);
  }

  /**
   * Time-stretch (LAUNCH-06): build the transient-preserving DRUM slice player
   * and register it with the scheduler as a self-looping source (so the drum
   * stem arms once at play and changes tempo live, like bass/harmony). Detects
   * onsets once from the drum buffer. Idempotent; no-op if the drum buffer
   * isn't registered yet or the context isn't ready. The slice player outputs
   * straight to the drum gain (zero added latency → aligned with bass/harmony).
   */
  private ensureDrumSlicePlayer(): void {
    if (!this.audioContext || this.drumBeats) return;
    const buffer = this.audioStemBuffers.get('audio-drums');
    if (!buffer) return;
    const gain = this.getOrCreateInstrumentGainNode('audio-drums');
    if (!gain) return;

    const loopDur =
      this.stemLoopDurationSeconds > 0
        ? this.stemLoopDurationSeconds
        : buffer.duration;

    // ABLETON-BEATS SLICER. Slices the loop at every transient, re-grids each slice
    // un-stretched (rate 1 — no smear, no pitch-bend), fills slow-tempo gaps by looping
    // the quiet decay tail, and nudges smoothly (varispeed-during-drag,
    // re-render-on-settle). No bed, no stretcher on drums → reliable by construction.
    // Provides the start/stop/setRatio surface the scheduler self-looping source needs.
    this.drumBeats = new DrumBeatsPlayer(this.audioContext, buffer, gain, {
      loopDurationSeconds: loopDur,
    });
    this.regionScheduler?.setSelfLoopingSource(
      'drums',
      new DrumSliceSource(this.drumBeats),
    );
    this.logger.info('Drum Beats slicer created (Ableton-style, no stretcher)', {
      slices: this.drumBeats.textureRegionCount(),
      loopDur,
      instanceId: this.instanceId,
    });
  }

  /** Live drum tempo-machine state for the dev A/B tool (beats-slicer.js). */
  getDrumTempoDebugState():
    | ReturnType<NonNullable<typeof this.drumBeats>['getDebugState']>
    | null {
    return this.drumBeats?.getDebugState() ?? null;
  }

  /** DIAGNOSTIC: solo loud vs quiet drum slices (dev panel) so the ear can localize an
   *  artifact — muteBed → keep only the big hits; muteOverlays → keep only the texture
   *  (hats/ghosts). No-op if no player. */
  setDrumDiagnosticSolo(opts: {
    muteBed?: boolean;
    muteOverlays?: boolean;
  }): void {
    this.drumBeats?.setDiagnosticSolo(opts);
  }

  /** BEATS SLICER tuning (dev panel): gap-fill mode + the per-slice "Transient
   *  Envelope" (0..1). LIVE — applies to future slices. No-op unless Beats active. */
  setDrumGapFillMode(mode: 'loop-pingpong' | 'loop-forward' | 'gate'): void {
    this.drumBeats?.setGapFillMode(mode);
  }
  setDrumTransientEnvelope(value: number): void {
    this.drumBeats?.setTransientEnvelope(value);
  }
  /** LIVE transient SENSITIVITY (Beats slicer): lower = more onsets/slices (catches
   *  hats), higher = only big hits. Re-detects + rebuilds slices. */
  setDrumOnsetSensitivity(sensitivity: number): void {
    this.drumBeats?.setOnsetSensitivity(sensitivity);
  }
  /** LIVE loop-seam crossfade length (Beats slicer), milliseconds. */
  setDrumLoopCrossfadeMs(ms: number): void {
    this.drumBeats?.setLoopCrossfadeMs(ms);
  }

  /**
   * Time-stretch (LAUNCH-06) — (re)create the drum latency DelayNode at the
   * measured signalsmith latency and route the drum chain through it so drums
   * (zero-latency) emerge at the same time as the latency-delayed bass/harmony.
   * Idempotent; safe to call whenever the latency or drum routing changes.
   */
  private applyDrumLatencyDelay(): void {
    if (
      !this.audioContext ||
      !this.audioPlayerScheduler ||
      this.stretchLatencySeconds <= 0
    ) {
      return;
    }
    const gain = this.getOrCreateInstrumentGainNode('audio-drums');
    const buffer = this.audioStemBuffers.get('audio-drums');
    if (!gain || !buffer) return;

    if (!this.drumLatencyDelayNode) {
      this.drumLatencyDelayNode = this.audioContext.createDelay(
        Math.max(1, this.stretchLatencySeconds + 0.5),
      );
      this.drumLatencyDelayNode.connect(gain);
    }
    this.drumLatencyDelayNode.delayTime.value = this.stretchLatencySeconds;

    // Route the drum chain through the delay. If a WSOLA insert is active,
    // feed it into the delay; otherwise the drum source connects straight to
    // the delay. The scheduler's next-armed drum source picks up this `input`.
    const insert = this.drumStretchInsertNode;
    if (insert) {
      try {
        (insert as AudioNode).disconnect();
      } catch {
        /* ignore */
      }
      (insert as AudioNode).connect(this.drumLatencyDelayNode);
      this.audioPlayerScheduler.setStem(
        audioInstrumentTypeToStemKey('audio-drums'),
        buffer,
        gain,
        insert,
        { stopInFlight: false },
      );
    } else {
      this.audioPlayerScheduler.setStem(
        audioInstrumentTypeToStemKey('audio-drums'),
        buffer,
        gain,
        this.drumLatencyDelayNode,
        { stopInFlight: false },
      );
    }
  }

  /**
   * Write a semitone offset onto the pitch-shift node for a stem. No-op
   * for stems that don't have a node (drums/click, or if construction
   * failed). Idempotent.
   *
   * Delegates to the adapter, which applies the offset (Signalsmith via
   * schedule()). The write honours applyAtAudioTime so the current
   * iteration finishes in the old key and the next plays the new key —
   * cleanly, unlike Tone.PitchShift's granular FFT, which we tried first
   * and which produced unacceptable downward-shift artifacts.
   */
  setInstrumentPitchShift(
    instrumentType: AudioInstrumentType,
    semitones: number,
    applyAtAudioTime?: number,
  ): void {
    if (!this.audioContext || !this.pitchShiftAdapter) return;
    // Time-stretch (LAUNCH-06): bass/harmony play through a
    // buffer-streaming node that handles BOTH pitch and tempo.
    const node = this.instrumentStretchNodes.get(instrumentType);
    if (!node) return;
    // The adapter owns how the semitone offset is applied (Signalsmith:
    // schedule({ semitones, formantCompensation, output })). It honours
    // applyAtAudioTime so the current loop finishes in the old key and the
    // next plays the new key. On a buffer-streaming node the rate (tempo)
    // set previously persists (omitted fields inherit), so a key change
    // never disturbs tempo.
    this.pitchShiftAdapter.setSemitones(
      node as AudioNode,
      semitones,
      this.audioContext,
      applyAtAudioTime,
    );
  }

  /**
   * Swap a stem's PCM in place ("Lines & Fills" bassline swap). Replaces the
   * buffer-streaming node's audio for `instrumentType` (only `audio-bass` today)
   * with `buffer`, touching NOTHING else — the read-head, loop schedule,
   * `__bufferDuration`, current key + tempo all persist, so the seam clock, the
   * visual playhead, and the drum phase-lock stay valid and the OTHER stems are
   * never touched. The caller MUST pass a buffer of the same sample length as the
   * current bass (enforced upstream) and SHOULD fire this just before the loop
   * seam (see {@link getStemNextSeamTime}) so the read-head re-enters the loop on
   * the new PCM. Returns a promise (the underlying drop/add is async port-RPC).
   *
   * Key/tempo persist via signalsmith field inheritance, but the caller re-asserts
   * them at the seam (it owns the live refs) for belt-and-suspenders.
   */
  async swapStemBuffer(
    instrumentType: AudioInstrumentType,
    buffer: AudioBuffer,
    lengthBars = 1,
  ): Promise<void> {
    if (!this.pitchShiftAdapter) return;
    const node = this.instrumentStretchNodes.get(instrumentType);
    if (!node) {
      this.logger.warn(
        `swapStemBuffer: no stretch node for ${instrumentType} — skipping`,
      );
      return;
    }
    const channelData: Float32Array[] = [];
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      channelData.push(buffer.getChannelData(ch));
    }
    // Keep the registered buffer reference current (used by getOrCreateStretchSource
    // on a later rebuild, e.g. after stop/replay).
    this.audioStemBuffers.set(instrumentType, buffer);
    // lengthBars → the worklet releases the swap at the next bar boundary in its
    // own read-head domain (the loop divided into bars; tail-immune).
    await this.pitchShiftAdapter.swapBuffers(
      node as AudioNode,
      channelData,
      lengthBars,
    );
  }

  /**
   * LAUNCH-02.5c key-shift — install (or clear) the per-iteration buffer
   * resolver. RegionScheduler calls this for every newly-armed iteration
   * inside its WINDOW=3 pre-arm window; returning null falls back to the
   * stem's registered buffer (the engine-level default).
   *
   * Ownership semantics mirror `useActiveGrooveCardStore.clearActiveCard`
   * (see [active-groove-card.store.ts:48-51]):
   *   - `setPendingBufferResolver(fn, ownerId)`: latest install wins.
   *     A new card always succeeds in claiming the resolver, even if a
   *     previous card hasn't unmounted yet.
   *   - `setPendingBufferResolver(null, ownerId)`: clears ONLY if
   *     `ownerId` matches the current owner. This makes the call safe
   *     to fire from an unmount effect that races a subsequent card's
   *     install — the stale clear is a no-op.
   *
   * The resolver itself is fed into scheduleAllRegions on the next
   * schedule pass; live regions already pre-armed retain whatever
   * resolver they captured at arm time (cf. RegionScheduler's WINDOW=3
   * pre-arm — the resolver is captured into the source.onended closure).
   */
  setPendingBufferResolver(
    resolver: ResolvePendingBuffer | null,
    ownerId: string,
  ): void {
    if (resolver === null) {
      if (this.pendingBufferResolverOwnerId !== ownerId) {
        // Stale clear from a previously-owning card — ignore so the
        // current owner's resolver is not wiped.
        return;
      }
      this.pendingBufferResolver = null;
      this.pendingBufferResolverOwnerId = null;
      return;
    }
    this.pendingBufferResolver = resolver;
    this.pendingBufferResolverOwnerId = ownerId;
  }

  /**
   * LAUNCH-02.5c key-shift — partial tear-down + re-arm of pre-armed
   * iterations for one or more regions. Thin wrapper around
   * RegionScheduler.rearmFutureIterations that supplies the engine-level
   * audioContext, audioStemAccess, and currently-installed resolver.
   *
   * Called by the Groove Card hook when the key changes: every musical
   * stem (bass/drums/harmony) has its own regionId, and they all need to
   * re-arm together so the swap is in lockstep. Returns the total number
   * of iterations re-armed across all regions (mostly diagnostic).
   *
   * No-op when the scheduler hasn't been initialised, when there's no
   * AudioContext, or when no resolver has been installed (without a
   * resolver the rearm would simply reproduce the current buffers,
   * making it pure cost).
   */
  /**
   * Currently-applied pre-roll on bass+harmony rearmed iterations.
   * Used to compute the DELTA when rearm pre-roll changes, so an
   * existing pre-roll of 0.14 stays at 0.14 (not compounded to 0.28)
   * when pitched→pitched transitions occur. Resets to 0 on stop.
   */
  private currentRearmPreRollSeconds = 0;

  rearmFutureIterationsForRegions(
    regionIds: readonly string[],
    options?: { preRollSeconds?: number },
  ): number {
    if (!this.regionScheduler) return 0;
    if (!this.audioContext) return 0;
    if (!this.pendingBufferResolver) return 0;
    if (!this.audioPlayerScheduler) return 0;

    // `preRollSeconds` in the public API is the TARGET pre-roll —
    // i.e. "from now on, rearmed iters should sit `target` seconds
    // earlier than their natural seam." We track the currently-applied
    // pre-roll and forward only the DELTA to the scheduler so a
    // pitched→pitched transition (target = 0.14 again) doesn't
    // compound to 0.28, and a pitched→default transition (target = 0)
    // correctly pushes existing entries 0.14 seconds LATER to land
    // on the natural seam.
    const targetPreRoll = options?.preRollSeconds ?? 0;
    const deltaPreRoll = targetPreRoll - this.currentRearmPreRollSeconds;
    this.currentRearmPreRollSeconds = targetPreRoll;
    // Inform RegionScheduler so future-armed iterations crossfade
    // over the same window. The crossfade is what makes two
    // overlapping sources at the pitch-shift node input sum to a
    // smooth equal-power transition instead of a discontinuous
    // sample-sum spike.
    this.regionScheduler.setInterIterCrossfadeSeconds(targetPreRoll);

    let total = 0;
    for (const regionId of regionIds) {
      total += this.regionScheduler.rearmFutureIterations(
        regionId,
        this.audioContext,
        this.audioPlayerScheduler,
        this.pendingBufferResolver,
        { preRollSeconds: deltaPreRoll },
      );
    }
    return total;
  }

  /**
   * Stop every active audio stem, click-free, via the MASTER BUS.
   *
   * The groove card mixes three stems with incompatible teardowns: the
   * signalsmith worklets (bass/harmony) hold ~145ms of residual that a gain
   * fade can't reach (you must disconnect the worklet), and the drum slice
   * player fires many short AudioBufferSourceNodes whose `stop()` HARD-
   * truncates the buffer (bypassing any gain). Fading each stem at its own
   * source could never cover all three cleanly (measured: residual leaks and
   * ~0.10 hard-cut clicks).
   *
   * The fix is one fade on the single node everything sums into:
   *   1. Ramp `masterGain` 1 → 0 over `rampSeconds`. The real audio keeps
   *      flowing and fades smoothly — no source is touched yet.
   *   2. Tell the sources to stop AT the fade end, so they play out under the
   *      fade (and any hard truncation lands while the master is already 0).
   *   3. After the fade (in SILENCE), run the messy teardown — worklet
   *      disconnect/dispose, slice-player stop, state clears — none of which
   *      can click because the bus is muted. Then restore `masterGain` to 1.
   *
   * A seamless tempo/key swap passes `rampSeconds ~0`: it skips the fade and
   * stops at `now` (the loop seam, click-safe), so the new loop re-arming into
   * the same graph isn't faded out.
   */
  stopAudioStems(options?: { rampSeconds?: number }): void {
    const rampSeconds = options?.rampSeconds ?? 0.03;
    const fadeStop = rampSeconds > 0.0005;
    const ctx = this.audioContext;
    const now = ctx?.currentTime ?? 0;

    // 1) Fade the master bus to 0 over rampSeconds (full stop only). The audio
    //    flowing through it fades smoothly; we restore to 1 after teardown.
    const master = fadeStop ? this.getMasterGain() : null;
    if (master && ctx) {
      try {
        const g = master.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(0, now + rampSeconds);
      } catch (err) {
        this.logger.debug('stopAudioStems: master fade failed', { err });
      }
    }

    // 2) Stop the source schedulers. They stop their sources at `sourceStopAt`
    //    so they ring out under the master fade (full stop) or cut at the seam
    //    (swap). stopAllInfiniteAudio already maps rampSeconds→source stop time.
    this.audioPlayerScheduler?.stopAll();
    this.regionScheduler?.stopAllInfiniteAudio(this.audioContext, rampSeconds);

    // The actual node teardown — worklet silence+dispose, slice stop, drum
    // delay, state clears, and the master restore. Runs AFTER the fade so it
    // all happens in silence (full stop), or immediately (swap).
    const stretchNodes =
      this.instrumentStretchNodes.size > 0
        ? Array.from(this.instrumentStretchNodes.values())
        : [];
    const adapter = this.pitchShiftAdapter;
    const beatsPlayer = this.drumBeats;
    const drumDelay = this.drumLatencyDelayNode;

    // Clear live STATE synchronously so a rapid re-play rebuilds fresh nodes
    // and nothing else targets these (the audio nodes themselves are still
    // alive and feeding the fading master until the deferred teardown).
    this.instrumentStretchNodes.clear();
    this.drumBeats = null;
    this.drumLatencyDelayNode = null;
    this.regionScheduler?.setSelfLoopingSource('bass', null);
    this.regionScheduler?.setSelfLoopingSource('harmony', null);
    this.regionScheduler?.setSelfLoopingSource('drums', null);
    this.regionScheduler?.setTempoRatio(1);

    const teardown = () => {
      // Stop the drum slicer's live source (hard-cut is fine now — the master is
      // at 0, so the truncation is silent).
      if (beatsPlayer) {
        try {
          beatsPlayer.stop(this.audioContext?.currentTime);
        } catch {
          /* best-effort */
        }
      }
      // Silence + dispose the signalsmith worklets. Disconnecting the worklet
      // output kills its ~145ms residual at the source.
      if (adapter && this.audioContext) {
        for (const node of stretchNodes) {
          try {
            adapter.silenceNode(node as AudioNode, this.audioContext);
          } catch {
            /* best-effort */
          }
        }
      }
      for (const node of stretchNodes) {
        try {
          adapter?.disposeNode(node as AudioNode);
        } catch {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (node as any).disconnect?.();
          } catch {
            /* ignore */
          }
        }
      }
      if (drumDelay) {
        try {
          drumDelay.disconnect();
        } catch {
          /* best-effort */
        }
      }
      // Restore the master bus to unity for the next play — but SCHEDULED a
      // short margin into the future, not at `now`. A source's `stop()` takes
      // up to a render quantum to actually go silent; restoring the master at
      // the same instant briefly re-opened it over that last quantum (measured:
      // an occasional ~0.07 blip ~15ms after teardown). Holding 0 until
      // now+50ms lets every source fully stop first. The idle gap is silent —
      // and setAudioStemBuffers snaps the master to 1 immediately on the next
      // play, so a play during this window isn't muted.
      if (master && this.audioContext) {
        try {
          const t = this.audioContext.currentTime;
          master.gain.cancelScheduledValues(t);
          master.gain.setValueAtTime(0, t);
          master.gain.setValueAtTime(1, t + 0.05);
        } catch {
          /* best-effort */
        }
      }
    };

    if (fadeStop && typeof window !== 'undefined' && window.setTimeout) {
      // After the fade completes (+ a small margin so the ramp has fully
      // reached 0 on the audio thread) tear down in silence.
      window.setTimeout(teardown, Math.ceil(rampSeconds * 1000) + 20);
    } else {
      teardown();
    }

    // Reset rearm pre-roll state on stop so the next play starts from 0
    // (default direct routing) and the first default→pitched transition
    // applies the full pre-roll.
    this.currentRearmPreRollSeconds = 0;
    this.regionScheduler?.setInterIterCrossfadeSeconds(0);

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
