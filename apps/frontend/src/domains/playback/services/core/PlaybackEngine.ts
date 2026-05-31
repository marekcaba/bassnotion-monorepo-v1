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
import { resolvePitchShiftLibrary } from './pitch-shift/pitchShiftConfig.js';
import { applyClickFreeStop } from './region-processing/utils/applyClickFreeStop.js';

// LAUNCH-02.5c key-shift: SoundTouchJS introduces an end-to-end
// processing delay on stems routed through it. We compensate by
// delaying the non-pitch-shifted stems (drums + click) by this amount
// whenever PitchShift is active.
//
// End-to-end latency = WSOLA input-buffer requirement before
// processOneWindow can run. From soundtouch-processor.js:1248:
//   sampleReq = max(intskip + overlapLength, seekWindowLength) + seekLength
// With our locked params (sequenceMs=110, seekWindowMs=23, overlapMs=8)
// at 48kHz: sampleReq = 6384 samples = ~133 ms. Add a small safety
// margin so the seam falls AFTER WSOLA has its first window ready,
// not exactly AT the moment it needs to be ready.
//
// Previously this was 0.120 — which is LESS than sampleReq. The
// result was that WSOLA hadn't yet hit its processing threshold at
// the seam, so the first audible output emerging at the seam was
// generated from a misaligned overlap position (new-key bass spliced
// against silent pre-warm context) → audible spike on the first
// default → pitched engagement.
//
// Tunable by ear via `window.__SOUNDTOUCH_LATENCY_OVERRIDE_SECONDS`
// (set in the browser console before pressing play; reads on each
// node creation) so we can binary-search the right value without
// rebuilds. If the user reports a residual offset:
//   - drums sound EARLY (drums first, then bass/harmony) →
//     INCREASE the value.
//   - drums sound LATE (bass/harmony first, then drums) →
//     DECREASE the value.
const SOUNDTOUCH_LATENCY_SECONDS = 0.14;

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

  // Current tempo tracking (for metrics collector sync)
  private currentTempo = 120; // Default tempo in BPM

  // LAUNCH-02.5b: audio-stem state. Buffers are populated by
  // setAudioStemBuffers(); the scheduler fires AudioBufferSources from them
  // when RegionScheduler tells EventRouter to play an 'audio-*' event.
  private audioPlayerScheduler: AudioPlayerScheduler | null = null;
  private audioStemBuffers = new Map<AudioInstrumentType, AudioBuffer>();

  // LAUNCH-02.5c key-shift: lazily-created SoundTouchNode (AudioWorklet)
  // per pitch-shiftable stem (bass + harmony only — see
  // PITCH_SHIFTABLE_STEMS in TrackManagerProcessor). One node per
  // instrument type, shared across cards (only one Groove Card is active
  // at a time per the active-card store contract). The node's lifetime
  // is the engine's: created on first enablePitchShiftForStem(...) call,
  // never reset by dispose() — the whole map is GC'd with the engine
  // instance.
  //
  // The processor module is registered ONCE per AudioContext during
  // initialize(); subsequent node constructions are synchronous. If
  // registration fails (e.g. processor file missing), the engine still
  // boots and pitch-shifting simply degrades to a no-op fallback (the
  // stem plays untouched). This was chosen over Tone.PitchShift after
  // the granular-FFT-based Tone implementation produced unacceptable
  // downward-shift artifacts; SoundTouchJS's WSOLA-based algorithm is
  // symmetric.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private instrumentPitchShiftNodes = new Map<AudioInstrumentType, any>();
  /** True once the active pitch-shift engine's worklet has been
   *  registered with this.audioContext.audioWorklet. Until this is true,
   *  getOrCreatePitchShiftNode() returns null. (Field name retained for
   *  back-compat with existing tests/logs; it now tracks whichever engine
   *  the A/B selected, not specifically SoundTouch.) */
  private soundTouchWorkletReady = false;

  /** Active pitch-shift engine adapter (LAUNCH-02.5f A/B). Picked once at
   *  initialize() from `?pitch=` / NEXT_PUBLIC_PITCH_LIB; hides the
   *  SoundTouch-vs-Signalsmith differences (register / createNode /
   *  setSemitones / latency) behind a common interface. */
  private pitchShiftAdapter: PitchShiftAdapter | null = null;

  /** Per-stem indefinitely-looping silent AudioBufferSourceNode that
   *  keeps the SoundTouchNode's WSOLA pipeline continuously fed (and
   *  thus warm) between the engine's first setAudioStemBuffers call
   *  and the real stem source actually arriving ~2.15 s later (after
   *  the count-in + startup-lookahead). Stopped + disposed alongside
   *  the SoundTouchNode in stopAudioStems. */
  private pitchShiftPrewarmSources = new Map<
    AudioInstrumentType,
    AudioBufferSourceNode
  >();

  /**
   * LAUNCH-02.5c key-shift — fixed DelayNodes inserted on the
   * NON-pitch-shifted stems (drums + click) to keep them in lockstep
   * with the SoundTouchJS-delayed bass + harmony. SoundTouchJS's
   * WSOLA algorithm holds ~one sequence-window of input before
   * producing output (~110ms at tempo=1.0 with default settings); a
   * matching pre-delay on drums/click compensates so the four stems
   * stay phase-locked.
   *
   * Toggled in lockstep with bass/harmony pitch-shift enablement via
   * setPitchShiftLatencyCompensation(). When pitch is bypassed (default
   * key), the delay is also bypassed so the stems play with zero
   * latency.
   */
  private instrumentDelayNodes = new Map<AudioInstrumentType, DelayNode>();

  /**
   * LAUNCH-02.5c key-shift — DelayNode spliced AFTER the metronome's
   * GainNode, before destination. Unlike the audio-stem delays which
   * sit before their gain (sources `setStem(...input)` route through
   * them), the metronome's gain is the connection point its scheduler
   * already uses internally — splicing AFTER it gives the same total
   * delay effect without touching the scheduler.
   *
   * Created lazily on first `setPitchShiftLatencyCompensation(true)`.
   * delayTime mutates between 0 (no compensation needed; default key)
   * and SOUNDTOUCH_LATENCY_SECONDS (any pitch shift active) so the
   * count-in clicks slide back to stay aligned with the
   * SoundTouchJS-delayed stems.
   */
  private metronomeOutputDelay: DelayNode | null = null;
  /** True when drums + click are currently routed through their
   *  compensating DelayNodes. Mirrors whether bass/harmony PitchShift
   *  is active. Tracked separately so setPitchShiftLatencyCompensation
   *  is idempotent. */
  private pitchShiftLatencyCompensationActive = false;

  /** Per-stem record of whether the stem is currently routed through
   *  its SoundTouchNode. Used by enablePitchShiftForStem to skip the
   *  setStem call when the routing already matches the request —
   *  setStem triggers a 5 ms click-free ramp that interrupts the
   *  currently-playing source, which is glitchy mid-loop. With this
   *  tracking, semitone-to-semitone changes (both states pitched, just
   *  different values) only write the AudioParam at the loop boundary
   *  via setInstrumentPitchShift; the source chain is left untouched. */
  private pitchShiftRoutingActive = new Map<AudioInstrumentType, boolean>();

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

      // LAUNCH-02.5c key-shift: register the SoundTouchJS worklet
      // processor once per AudioContext, ahead of any stem playback.
      // Failures are non-fatal — the engine continues to boot and
      // getOrCreatePitchShiftNode() returns null, which downstream code
      // treats as "no pitch shift available, play stem dry". The
      // processor file is served from /worklets/soundtouch-processor.js
      // (matches the existing TimingProcessor convention; see
      // public/worklets/timing-processor.js).
      // LAUNCH-02.5f A/B: pick the engine (?pitch= / NEXT_PUBLIC_PITCH_LIB,
      // default soundtouch) and register through the adapter. The adapter
      // owns the engine-specific register/createNode/setSemitones/latency
      // differences; everything downstream stays agnostic.
      try {
        const library = resolvePitchShiftLibrary();
        this.pitchShiftAdapter = createPitchShiftAdapter(library, {
          info: (msg, data) =>
            this.logger.info(msg, { instanceId: this.instanceId, library, data }),
          warn: (msg, data) =>
            this.logger.warn(msg, { instanceId: this.instanceId, library, data }),
          debug: (msg, data) =>
            this.logger.debug(msg, {
              instanceId: this.instanceId,
              library,
              data,
            }),
        });
        const ok = await this.pitchShiftAdapter.register(audioContext);
        this.soundTouchWorkletReady = ok;
        this.logger.info('Pitch-shift engine registered', {
          instanceId: this.instanceId,
          library,
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

      // LAUNCH-02.5c key-shift: eagerly construct the SoundTouchNode
      // for pitch-shiftable stems so its WSOLA pipeline pre-warms
      // during the count-in window (~2 s). Without this, the FIRST
      // mid-loop key tap triggers lazy node creation, and the user
      // hears ~1.6 s of silence while WSOLA fills its output buffer
      // from cold. The routing stays bypassed (source → gain) until
      // enablePitchShiftForStem(true) flips it; the node sits
      // pre-warmed but disconnected from the signal path.
      if (isPitchShiftableStem(stemKey)) {
        // Fire-and-forget; the method handles all its own failure
        // modes and is idempotent (returns the cached node if one
        // already exists from a previous play cycle).
        this.getOrCreatePitchShiftNode(instrumentType);
      }
    }

    this.logger.info('Audio-stem buffers registered', {
      registered,
      stemsTotal: this.audioStemBuffers.size,
      instanceId: this.instanceId,
    });
  }

  /**
   * LAUNCH-02.5c key-shift — lazily construct one SoundTouchNode per
   * pitch-shiftable stem. Returns null for non-shiftable stems (drums/
   * click), when the AudioContext isn't ready, or when the SoundTouch
   * worklet hasn't been successfully registered. Idempotent: subsequent
   * calls return the cached node.
   *
   * SoundTouchNode is a native AudioWorkletNode wrapper, so it plugs
   * directly into the existing native chain: source → SoundTouchNode →
   * gain. No Tone-context bridging or `_gainNode` unwrap required.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getOrCreatePitchShiftNode(
    instrumentType: AudioInstrumentType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any | null {
    const stemKey = audioInstrumentTypeToStemKey(instrumentType);
    if (!isPitchShiftableStem(stemKey)) return null;

    const cached = this.instrumentPitchShiftNodes.get(instrumentType);
    if (cached) return cached;

    if (!this.audioContext) {
      this.logger.debug(
        'getOrCreatePitchShiftNode: no audio context yet; deferring',
        { instrumentType },
      );
      return null;
    }

    if (!this.soundTouchWorkletReady) {
      this.logger.debug(
        'getOrCreatePitchShiftNode: SoundTouch worklet not yet registered; deferring',
        { instrumentType },
      );
      return null;
    }

    const gain = this.getOrCreateInstrumentGainNode(instrumentType);
    if (!gain) return null;

    // LAUNCH-02.5f A/B: delegate construction + stretch-param/formant
    // setup + (source-side) gain wiring to the active engine adapter.
    // The adapter returns a native AudioNode connected to `gain`
    // (source → node → gain); the engine-specific details (SoundTouch's
    // setStretchParameters vs Signalsmith's schedule/formant) live in the
    // adapter. Construction stays SYNC for SoundTouch; for Signalsmith the
    // adapter returns a passthrough relay immediately and splices its real
    // node in a few ms later (module already cached) — the pre-warm loop
    // below tolerates that because it feeds the relay, which forwards.
    const adapter = this.pitchShiftAdapter;
    if (!adapter) {
      this.logger.debug(
        'getOrCreatePitchShiftNode: no adapter; deferring',
        { instrumentType },
      );
      return null;
    }
    // Per-stem tuning profile. stemKey is 'bass' | 'harmony' here (the
    // only pitch-shiftable stems, guarded above); both match the
    // adapter's PitchStemProfile keys 1:1. Default to 'harmony' (the
    // general-purpose profile) for any future stem.
    const stemProfile = stemKey === 'bass' ? 'bass' : 'harmony';
    const node = adapter.createNode(this.audioContext, gain, stemProfile);
    if (!node) {
      this.logger.warn(
        'getOrCreatePitchShiftNode: adapter returned no node; playing dry',
        { instrumentType, library: adapter.library },
      );
      return null;
    }

    this.instrumentPitchShiftNodes.set(instrumentType, node);
    this.logger.info('Pitch-shift node created', {
      instrumentType,
      library: adapter.library,
    });

    // LAUNCH-02.5c key-shift: pre-warm the WSOLA pipeline by feeding
    // an indefinitely-looping silent buffer into the node from now.
    //
    // Why a LOOPING silent source instead of a fixed-duration one:
    // AudioWorklet processors only run their main DSP loop when they
    // have non-empty input (SoundTouch returns null from `process()`
    // when input is empty, line 1930 of soundtouch-processor.js).
    // A fixed 2 s pre-warm buffer would end ~150 ms before the real
    // stem source connects (count-in is 1.85 s + 0.3 s startup-
    // lookahead = ~2.15 s gap from setAudioStemBuffers to first stem
    // sample). During that 150 ms gap, WSOLA has no input, doesn't
    // process, output buffer drains — and then the real source hits
    // an empty pipeline, producing underruns and silence for the
    // first ~1.6 s of audible playback.
    //
    // A looping silent source runs forever, so WSOLA is continuously
    // fed and stays warm. When the real stem source connects in
    // parallel and starts, Web Audio sums the two inputs (silence + N
    // = N), the silent feed contributes nothing audible, and WSOLA's
    // output buffer is already at steady-state. The looping source
    // is disposed alongside the SoundTouchNode itself on
    // stopAudioStems (via the node.disconnect() cascade).
    //
    // Buffer length: 0.5 s — short enough to keep memory tiny, long
    // enough that AudioBufferSourceNode loop overhead is negligible
    // (Chrome native loop is sample-accurate and free at this size).
    try {
      const ctx = this.audioContext;
      const buf = ctx.createBuffer(
        2, // stereo, matching SoundTouchNode's 2-channel I/O
        Math.ceil(0.5 * ctx.sampleRate),
        ctx.sampleRate,
      );
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(node);
      src.start(ctx.currentTime + 0.005);
      // Track the pre-warm source so stopAudioStems can stop it when
      // the SoundTouchNode is disposed. Without this, the loop would
      // keep firing into a disconnected node — harmless but messy.
      this.pitchShiftPrewarmSources.set(instrumentType, src);
    } catch (err) {
      // Pre-warm is best-effort; if it fails the user just hears the
      // ~1.6 s glitchy start. Not fatal.
      this.logger.warn('SoundTouch pre-warm failed', {
        instrumentType,
        err,
      });
    }

    return node;
  }

  /**
   * Write a semitone offset onto the SoundTouchNode for a stem. No-op
   * for stems that don't have a node (drums/click, or if construction
   * failed). Idempotent.
   *
   * `pitchSemitones` is a real AudioParam — the write is sample-
   * accurate and SoundTouchJS's WSOLA-based algorithm handles real-time
   * changes cleanly (unlike Tone.PitchShift's granular FFT, which we
   * tried first and which produced unacceptable downward-shift
   * artifacts).
   */
  setInstrumentPitchShift(
    instrumentType: AudioInstrumentType,
    semitones: number,
    applyAtAudioTime?: number,
  ): void {
    const node = this.instrumentPitchShiftNodes.get(instrumentType);
    if (!node || !this.audioContext || !this.pitchShiftAdapter) return;
    // LAUNCH-02.5f A/B: the active adapter owns how the semitone offset is
    // applied — SoundTouch writes its `pitchSemitones` AudioParam (with
    // sample-accurate setValueAtTime scheduling at the loop boundary),
    // Signalsmith calls schedule({ semitones, formantCompensation, output }).
    // Both honour applyAtAudioTime so the current iteration finishes in the
    // old key and the next plays the new key.
    this.pitchShiftAdapter.setSemitones(
      node as AudioNode,
      semitones,
      this.audioContext,
      applyAtAudioTime,
    );
  }

  /**
   * Toggle whether a stem's signal chain routes through its
   * SoundTouchNode. When enabled, sources for this stem connect into
   * the SoundTouchNode and exit through the existing gain; when
   * disabled, sources connect straight to gain (the default behaviour).
   *
   * Bypass-on-disable preserves bit-exact playback for the default key
   * (offset 0). SoundTouchJS adds a small fixed latency (~1 processing
   * window, well under Tone.PitchShift's granular-FFT latency) and is
   * audibly transparent at semitones=0, but routing through it for the
   * common case still costs CPU and one extra AudioWorklet hop. Skip
   * it when nothing needs to shift.
   *
   * No-op when the stem buffer hasn't been registered yet (the
   * AudioPlayerScheduler has nothing to re-route) or when the node can't
   * be constructed (drums/click, worklet registration failed, no
   * AudioContext). The next setAudioStemBuffers() will pick up the
   * requested routing.
   */
  enablePitchShiftForStem(
    instrumentType: AudioInstrumentType,
    enabled: boolean,
    options?: { seamless?: boolean },
  ): void {
    if (!this.audioPlayerScheduler) return;
    const stemKey = audioInstrumentTypeToStemKey(instrumentType);
    if (!isPitchShiftableStem(stemKey)) return;

    const buffer = this.audioStemBuffers.get(instrumentType);
    if (!buffer) return; // setAudioStemBuffers hasn't run yet — nothing to swap
    const gain = this.getOrCreateInstrumentGainNode(instrumentType);
    if (!gain) return;

    // When `seamless` is true (LAUNCH-02.5c mid-loop key tap), don't
    // kill the currently-playing source — the routing change only
    // affects FUTURE sources that armInfiniteAudioIteration creates
    // for the next iter onwards. The current iter finishes at its
    // pre-change routing (default-key → gain direct), so the user
    // hears the old key complete the loop they're in.
    const setStemOptions = options?.seamless
      ? { stopInFlight: false }
      : undefined;

    // Idempotence: if the requested routing already matches the
    // current routing, skip setStem entirely. setStem triggers a 5 ms
    // click-free ramp that kills the playing source — fine for actual
    // transitions (default→pitched / pitched→default) but a glitch
    // mid-loop when only the pitch VALUE changed (pitched→pitched).
    // The semitone-to-semitone case is handled by the AudioParam
    // write in setInstrumentPitchShift; the signal chain stays put.
    const currentlyActive =
      this.pitchShiftRoutingActive.get(instrumentType) === true;
    if (currentlyActive === enabled) return;

    if (!enabled) {
      // Route source → gain directly (bypass PitchShift).
      this.audioPlayerScheduler.setStem(
        stemKey,
        buffer,
        gain,
        undefined,
        setStemOptions,
      );
      this.pitchShiftRoutingActive.set(instrumentType, false);
      return;
    }

    const node = this.getOrCreatePitchShiftNode(instrumentType);
    if (!node) {
      // PitchShift unavailable — fall through to the dry path so playback
      // continues, just without transposition. Already the default
      // behaviour; the warn was logged inside getOrCreatePitchShiftNode.
      this.audioPlayerScheduler.setStem(
        stemKey,
        buffer,
        gain,
        undefined,
        setStemOptions,
      );
      // Routing stays inactive since we couldn't construct the node.
      this.pitchShiftRoutingActive.set(instrumentType, false);
      return;
    }

    // Source → SoundTouchNode → (node.connect already established) →
    // gain. SoundTouchNode IS a native AudioWorkletNode, so it accepts
    // direct `source.connect(node)` without any wrapper unwrapping.
    // setStem stops in-flight sources with a 5ms click-free ramp when
    // seamless is false; when seamless is true the current source
    // finishes at its pre-change routing and only future sources arm
    // through SoundTouchNode.
    this.audioPlayerScheduler.setStem(
      stemKey,
      buffer,
      gain,
      node as AudioNode,
      setStemOptions,
    );
    this.pitchShiftRoutingActive.set(instrumentType, true);
  }

  /**
   * LAUNCH-02.5f A/B — the dry-stem (drums/click) compensation delay
   * must match whichever pitch engine is active. Resolution order:
   *   1. `window.__SOUNDTOUCH_LATENCY_OVERRIDE_SECONDS` — by-ear runtime
   *      tuning, wins for both engines (kept its historical name).
   *   2. The active adapter's reported latency — SoundTouch's fixed 0.14,
   *      Signalsmith's live `node.latency()` (reads the bass node if it
   *      exists, since both pitched stems share the same engine latency).
   *   3. SoundTouch's 0.14 baseline if no adapter yet.
   */
  private getPitchShiftLatencySeconds(): number {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const override = (window as any).__SOUNDTOUCH_LATENCY_OVERRIDE_SECONDS;
      if (typeof override === 'number') return override;
    }
    if (this.pitchShiftAdapter) {
      // Any pitched stem's node carries the engine latency; bass is the
      // one that always exists when compensation is on.
      const refNode =
        this.instrumentPitchShiftNodes.get('bass' as AudioInstrumentType) ??
        this.instrumentPitchShiftNodes.get(
          'harmony' as AudioInstrumentType,
        );
      return this.pitchShiftAdapter.latencySeconds(
        refNode as AudioNode | undefined,
      );
    }
    return SOUNDTOUCH_LATENCY_SECONDS;
  }

  /**
   * LAUNCH-02.5c key-shift — lazily construct one DelayNode per
   * non-pitch-shifted stem (drums + click), used to compensate for the
   * SoundTouchJS processing delay on bass + harmony. Returns null when
   * the AudioContext isn't ready. Idempotent.
   *
   * The delay is connected `delay → instrumentGainNode → destination`
   * at creation time; the `setStem` path connects the source to the
   * delay's input. Removing the routing (the user goes back to default
   * key) is done by reverting the source's `input` back to the gain via
   * setStem, leaving the delay in place — it's cheap to keep cached.
   */
  private getOrCreateDelayNode(
    instrumentType: AudioInstrumentType,
  ): DelayNode | null {
    if (!this.audioContext) return null;
    const cached = this.instrumentDelayNodes.get(instrumentType);
    if (cached) return cached;

    const gain = this.getOrCreateInstrumentGainNode(instrumentType);
    if (!gain) return null;

    let delay: DelayNode;
    try {
      // Resolve the active engine's latency (override → adapter → 0.14).
      // Set `window.__SOUNDTOUCH_LATENCY_OVERRIDE_SECONDS = 0.140` in the
      // console then re-tap the key stepper to tune by ear without a
      // rebuild — works for both SoundTouch and Signalsmith.
      const override = this.getPitchShiftLatencySeconds();
      // maxDelayTime must be >= the delayTime we set. Give 0.5s of
      // headroom so override values up to 500ms can be tested.
      delay = this.audioContext.createDelay(0.5);
      delay.delayTime.value = override;
      delay.connect(gain);
      this.logger.info('Latency-compensation DelayNode using', {
        instrumentType,
        delaySeconds: override,
        library: this.pitchShiftAdapter?.library,
      });
    } catch (err) {
      this.logger.warn('getOrCreateDelayNode: DelayNode construction failed', {
        instrumentType,
        err,
      });
      return null;
    }

    this.instrumentDelayNodes.set(instrumentType, delay);
    return delay;
  }

  /**
   * LAUNCH-02.5c key-shift — toggle latency compensation on drums +
   * click so they stay phase-locked with the SoundTouchJS-delayed bass
   * + harmony. Idempotent.
   *
   * Called by the Groove Card hook in lockstep with
   * enablePitchShiftForStem on bass + harmony: when ANY pitch shift is
   * active on the pitched stems, drums and click route through a
   * matching DelayNode. When no pitch shift is active (default key),
   * the delay is bypassed so the stems play in real-time.
   *
   * No-op for stems that haven't had setAudioStemBuffers run yet
   * (mirrors enablePitchShiftForStem's same guard).
   */
  setPitchShiftLatencyCompensation(
    enabled: boolean,
    options?: { seamless?: boolean },
  ): void {
    if (!this.audioPlayerScheduler) return;
    const wasActive = this.pitchShiftLatencyCompensationActive;
    // Early-return when the active state already matches the request.
    // CRITICAL: without this, calling the method repeatedly (which
    // happens on every key tap from setKey) re-fires setStem on
    // drums + click, and setStem's stopStem call kills every in-flight
    // and pre-armed source for those stems. The rearm path only
    // re-arms bass + harmony, so drums permanently die after the
    // first mid-loop tap. (We previously kept this method non-
    // idempotent so a runtime change to
    // window.__SOUNDTOUCH_LATENCY_OVERRIDE_SECONDS could pick up on
    // the next tap; that override is now a dev-only tuning knob and
    // is OK to pick up on the next Play instead of mid-loop.)
    if (wasActive === enabled) return;
    this.pitchShiftLatencyCompensationActive = enabled;

    // The non-pitch-shifted stems that need to be delayed. Anything
    // outside this list (currently: only the pitch-shiftable bass +
    // harmony) already accounts for its own latency via SoundTouchJS.
    const nonShiftedStems: AudioInstrumentType[] = [
      'audio-drums',
      'audio-click',
    ];

    // Read the runtime-tunable delay value ONCE per call so all stems
    // get the same value even if the override is changed concurrently.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const targetDelaySeconds = this.getPitchShiftLatencySeconds();

    // When `seamless` is true (LAUNCH-02.5c mid-loop key tap), don't
    // kill the currently-playing drum/click sources on the routing
    // change. The current iter finishes at its old routing (direct →
    // gain); future iters routed through the delay node pick up the
    // compensation. This is the SAME fix as enablePitchShiftForStem's
    // seamless option, applied to the non-pitch-shifted stems' delay
    // toggle so drums don't go silent mid-loop.
    const setStemOptions = options?.seamless
      ? { stopInFlight: false }
      : undefined;

    for (const instrumentType of nonShiftedStems) {
      const stemKey = audioInstrumentTypeToStemKey(instrumentType);
      const buffer = this.audioStemBuffers.get(instrumentType);
      if (!buffer) continue; // buffer not registered yet; skip silently
      const gain = this.getOrCreateInstrumentGainNode(instrumentType);
      if (!gain) continue;

      if (!enabled) {
        // Restore the direct routing: source → gain. setStem stops
        // in-flight sources with a 5ms click-free ramp unless
        // seamless is requested.
        this.audioPlayerScheduler.setStem(
          stemKey,
          buffer,
          gain,
          undefined,
          setStemOptions,
        );
        continue;
      }

      const delay = this.getOrCreateDelayNode(instrumentType);
      if (!delay) {
        // Couldn't build the delay; fall through to the dry path so
        // playback continues. There will be an audible offset between
        // pitched and non-pitched stems, but it's better than silence.
        this.audioPlayerScheduler.setStem(
          stemKey,
          buffer,
          gain,
          undefined,
          setStemOptions,
        );
        continue;
      }
      // Refresh the delay amount on every call so a runtime tweak via
      // window.__SOUNDTOUCH_LATENCY_OVERRIDE_SECONDS picks up on the
      // very next key tap without needing to dispose+rebuild the node.
      // setValueAtTime is sample-accurate (vs `.value =`), avoiding a
      // click when the delay changes while a source is feeding it.
      try {
        delay.delayTime.setValueAtTime(
          targetDelaySeconds,
          this.audioContext!.currentTime,
        );
      } catch {
        // Fall through to direct assignment if setValueAtTime rejects.
        delay.delayTime.value = targetDelaySeconds;
      }
      // Source → delay → gain. The delay's output is already wired to
      // gain at creation time (see getOrCreateDelayNode), so setStem
      // just needs to point the source at the delay's native input.
      this.audioPlayerScheduler.setStem(
        stemKey,
        buffer,
        gain,
        delay as unknown as AudioNode,
        setStemOptions,
      );
    }

    // Metronome: the count-in clicks come out of a SEPARATE signal
    // chain (gain node `getOrCreateInstrumentGainNode('metronome')`)
    // that's hard-wired straight to destination at gain creation time.
    // Drums/click are spliced BEFORE their gain via setStem; for the
    // metronome we splice AFTER its gain — the gain's downstream is
    // gain→delay→destination. Without this, the count-in clicks land
    // ON the natural BPM beats but the SoundTouch-delayed stems land
    // ~120 ms later, producing a perceived gap between count-in beat 4
    // and the start of the groove.
    this.applyMetronomeLatencyCompensation(enabled ? targetDelaySeconds : 0);

    this.logger.info('Pitch-shift latency compensation', {
      enabled,
      delaySeconds: enabled ? targetDelaySeconds : 0,
      library: this.pitchShiftAdapter?.library,
    });
  }

  /**
   * Splice (or refresh) a DelayNode AFTER the metronome's gain node so
   * count-in clicks stay aligned with SoundTouch-delayed stems. Called
   * from setPitchShiftLatencyCompensation; idempotent.
   *
   * On first call, lifts `metronomeGain.connect(destination)` to
   * `metronomeGain.connect(delay); delay.connect(destination)`. On
   * subsequent calls, only mutates `delay.delayTime.value`. When
   * `delaySeconds === 0`, the delay node is left in place but set to
   * zero — preserving the click-free invariant (no disconnect/reconnect
   * mid-play, no clicks).
   */
  private applyMetronomeLatencyCompensation(delaySeconds: number): void {
    if (!this.audioContext) return;

    // Lazy splice: only do the disconnect-reconnect once. After that,
    // we just mutate delayTime in-place.
    if (!this.metronomeOutputDelay) {
      const metronomeGain = this.getOrCreateInstrumentGainNode('metronome');
      if (!metronomeGain) return;

      try {
        const delay = this.audioContext.createDelay(0.5);
        delay.delayTime.value = delaySeconds;
        // Lift the gain's connection: it currently routes straight to
        // destination (PlaybackEngine.ts:2514). Disconnect, then route
        // through the new delay.
        metronomeGain.disconnect();
        metronomeGain.connect(delay);
        delay.connect(this.audioContext.destination);
        this.metronomeOutputDelay = delay;
        this.logger.info('Metronome output delay spliced', {
          delaySeconds,
        });
      } catch (err) {
        this.logger.warn('applyMetronomeLatencyCompensation: splice failed', {
          err,
        });
        // Reconnect the gain to destination so audio still flows.
        try {
          metronomeGain.connect(this.audioContext.destination);
        } catch {
          // ignore
        }
        return;
      }
      return;
    }

    // Subsequent calls: just retune the existing delay. Use
    // setValueAtTime for click-freeness.
    try {
      this.metronomeOutputDelay.delayTime.setValueAtTime(
        delaySeconds,
        this.audioContext.currentTime,
      );
    } catch {
      this.metronomeOutputDelay.delayTime.value = delaySeconds;
    }
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
    // overlapping sources at the SoundTouchNode input sum to a
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
   * Stop every active audio stem. Delegates to the two schedulers that
   * actually own stem sources — AudioPlayerScheduler for per-event audio
   * (one-shot stems) and RegionScheduler for infinite-loop iterations
   * (Groove Card). Both apply a click-free gain ramp via the shared
   * applyClickFreeStop helper so the cached gain nodes remain reusable for
   * the next playback.
   */
  stopAudioStems(): void {
    this.audioPlayerScheduler?.stopAll();
    this.regionScheduler?.stopAllInfiniteAudio(this.audioContext);

    // LAUNCH-02.5c key-shift: dispose any cached SoundTouchNodes so the
    // next play starts from a clean WSOLA state.
    //
    // Why: SoundTouchJS's processor keeps ~120 ms of audio in its
    // output buffer between input frames; when the source stops, that
    // residue stays in the buffer (the worklet just stops processing,
    // it doesn't drain). On the next play the residue gets pushed out
    // before the new source's output reaches the gain, audible as a
    // brief "previous key" spike before the count-in.
    //
    // Disposing forces getOrCreatePitchShiftNode to rebuild fresh nodes
    // on the next enablePitchShiftForStem(true), which automatically
    // triggers a fresh pre-warm. The pre-warm runs during the ~1.85 s
    // count-in window so the new nodes are at steady-state before the
    // first real stem buffer reaches them. Net cost: ~2 s of CPU per
    // play; net benefit: no spike, no key bleed between plays.
    //
    // DelayNodes on drums + click are NOT disposed because their state
    // is stateless from the next play's perspective (no residue past
    // the click-free gain ramp). Keeping them cached avoids
    // unnecessary node churn.
    if (this.instrumentPitchShiftNodes.size > 0) {
      // Stop the looping silent pre-warm sources FIRST so they don't
      // keep firing into the about-to-be-disposed SoundTouchNodes.
      for (const [, src] of this.pitchShiftPrewarmSources) {
        try {
          src.stop();
        } catch {
          // best-effort
        }
        try {
          src.disconnect();
        } catch {
          // best-effort
        }
      }
      this.pitchShiftPrewarmSources.clear();

      for (const [instrumentType, node] of this.instrumentPitchShiftNodes) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (node as any).disconnect?.();
        } catch {
          // best-effort; if the node is already disconnected, ignore
        }
        void instrumentType;
      }
      this.instrumentPitchShiftNodes.clear();
      // Routing tracking must reset alongside the node cache — on the
      // next play, fresh nodes are created and need their first
      // enablePitchShiftForStem call to actually wire setStem again.
      this.pitchShiftRoutingActive.clear();
      // Reset rearm pre-roll state alongside node disposal so the next
      // play starts from 0 (default direct routing) and the first
      // default→pitched transition applies the full 0.12s pre-roll.
      this.currentRearmPreRollSeconds = 0;
      // Crossfade duration tracks pre-roll — reset together.
      this.regionScheduler?.setInterIterCrossfadeSeconds(0);
      this.logger.info('PitchShift nodes disposed on stop', {
        instanceId: this.instanceId,
      });
    }

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
