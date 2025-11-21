/**
 * RegionProcessor - Processes track regions and schedules audio events
 *
 * This service listens to transport position updates and triggers
 * audio events based on the patterns in track regions.
 */

import { EventBus } from './EventBus.js';
import { getLogger } from '@/utils/logger.js';
import { AudioDebugger } from './AudioDebugger.js';
import * as Tone from 'tone';
import type { PluginManager } from './PluginManager.js';
import type { WamKeyboard } from '../../modules/instruments/adapters/wam/WamKeyboard.js';
import type { WamKeyboardPlugin } from '../../modules/instruments/adapters/wam/WamKeyboardPlugin.js';

// Import extracted modules (Phase 1: Foundation)
import { CountdownManager } from './region-processing/countdown/CountdownManager.js';
import { BufferRegistry } from './region-processing/buffers/BufferRegistry.js';
import { MusicalTimeConverter } from './region-processing/timing/MusicalTimeConverter.js';

// Import extracted modules (Phase 2: Caching + Timing)
import { ScheduleCache } from './region-processing/cache/ScheduleCache.js';
import { TimingMetricsCollector } from './region-processing/timing/TimingMetricsCollector.js';

// Import extracted modules (Phase 3: CC64 Sustain System)
import { CC64TimelineBuilder } from './region-processing/sustain/CC64TimelineBuilder.js';
import { SustainPedalAnalyzer } from './region-processing/sustain/SustainPedalAnalyzer.js';

// Import extracted modules (Phase 4: Schedulers)
import { VoiceCueScheduler } from './region-processing/scheduling/VoiceCueScheduler.js';
import { MetronomeScheduler } from './region-processing/scheduling/MetronomeScheduler.js';
import { DrumScheduler } from './region-processing/scheduling/DrumScheduler.js';
import { BassScheduler } from './region-processing/scheduling/BassScheduler.js';
import { HarmonyScheduler } from './region-processing/scheduling/HarmonyScheduler.js';
import { GrandPianoKeyboardMapper } from './region-processing/scheduling/GrandPianoKeyboardMapper.js';

// Import extracted modules (Phase 5: Utilities + Routing)
import { DiagnosticLogger } from './region-processing/diagnostics/DiagnosticLogger.js';

const logger = getLogger('RegionProcessor');

interface PatternEvent {
  position: string; // MUSICAL TIME - Tone.js format: "bar:beat:sixteenth" - SINGLE SOURCE OF TRUTH
  type: string;
  velocity?: number;
  duration?: string;
  // NOTE: We deliberately do NOT cache absolute time here
  // Time is calculated on-demand via parsePosition() using current Tone.Transport.bpm
  // This ensures tempo changes work correctly
}

interface Region {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  skipCountdownOffset?: boolean; // If true, don't apply countdown offset to this region
  pattern?: {
    id?: string;
    name?: string;
    type?: string;
    events?: PatternEvent[];
  };
}

interface Track {
  id?: string;
  track?: { id?: string };
  name?: string;
  regions: Region[];
  instrumentType?: string;
  exerciseId?: string; // Optional: For caching event schedules per exercise
  audioNode?: any; // Optional: Reference to WAM plugin node
}

/**
 * Cached schedule data for an exercise
 * Contains pre-calculated CC64 timeline and event schedule
 * to avoid recalculating on every playback
 */
interface CachedSchedule {
  cc64Timeline: Map<number, boolean>; // Map of audioTime → pedalDown state
  calculatedEvents: Array<{
    absoluteTime: number;
    event: PatternEvent;
    instrumentType: string;
    eventKey: string;
    regionId: string;
  }>;
  cachedAt: number; // Timestamp when cached
  bpm: number; // BPM used for calculations
  countdownBeats: number; // Countdown setting used
}

export class RegionProcessor {
  private eventBus: EventBus;
  private isRunning = false;
  private tracks: Map<string, Track> = new Map();
  private lastProcessedPosition = -1;
  private scheduledEvents = new Map<string, Set<string>>(); // Track which events we've scheduled per track: Map<trackId, Set<eventKey>>
  private scheduledIds = new Set<number>(); // Track Tone.Transport IDs for clearing
  private lookAheadTime = 0.1; // 100ms lookahead
  private scheduleInterval: any = null;
  private debugger = AudioDebugger.getInstance();

  // CRITICAL: Transport start anchor - maps transport beats to AudioContext hardware time
  private transportStartTime: number = 0;
  private audioContext: AudioContext | null = null;
  private sampleRate: number = 48000; // Default, will be updated from context

  // FAANG SOLUTION: Direct audio scheduling - store audio sources for cleanup
  // Map sources to instrument type and stop status
  private scheduledAudioSources = new Map<
    AudioBufferSourceNode,
    { type: 'one-shot' | 'sustained'; hasStopScheduled: boolean }
  >();

  // Phase 1: Buffer management delegated to BufferRegistry
  private bufferRegistry!: BufferRegistry; // Initialized in constructor

  // Keep these for backward compatibility (synced from BufferRegistry)
  private harmonyBuffers = new Map<string, Map<string, AudioBuffer>>();
  private harmonyVelocityRanges: Record<string, any[]> | undefined;
  private currentHarmonyInstrument: string | null = null;
  private grandPianoKeyboardMap: Record<string, any> | null = null;
  private bassBuffers = new Map<string, Map<string, AudioBuffer>>();
  private voiceCueBuffers = new Map<string, AudioBuffer>();
  private audioDestination: AudioNode | null = null;

  // Active source tracking for polyphony and cleanup
  private activeHarmonySources = new Map<
    string,
    Array<{
      source: AudioBufferSourceNode;
      gain: GainNode;
      gainValue: number;
      noteEndTime: number;
    }>
  >();
  private activeBassSources = new Map<string, AudioBufferSourceNode>();

  // CC64 timeline for pre-calculated sustain durations (Map of audioTime -> pedalDown)
  private currentCC64Timeline = new Map<number, boolean>();

  // Phase 2: Schedule cache delegated to ScheduleCache
  private scheduleCache!: ScheduleCache; // Initialized in constructor

  // Phase 2: Timing metrics delegated to TimingMetricsCollector
  private timingMetricsCollector!: TimingMetricsCollector; // Initialized in constructor

  // Phase 3: CC64 sustain system delegated to CC64TimelineBuilder and SustainPedalAnalyzer
  private cc64TimelineBuilder!: CC64TimelineBuilder; // Initialized in constructor
  private sustainPedalAnalyzer!: SustainPedalAnalyzer; // Initialized in constructor

  // Phase 4: Schedulers delegated to specialized scheduler modules
  private voiceCueScheduler!: VoiceCueScheduler; // Initialized in constructor
  private metronomeScheduler!: MetronomeScheduler; // Initialized in constructor
  private drumScheduler!: DrumScheduler; // Initialized in constructor
  private bassScheduler!: BassScheduler; // Initialized in constructor
  private harmonyScheduler!: HarmonyScheduler; // Initialized in constructor
  private grandPianoKeyboardMapper!: GrandPianoKeyboardMapper; // Initialized in constructor

  // Phase 5: Diagnostic logging delegated to DiagnosticLogger
  private diagnosticLogger!: DiagnosticLogger; // Initialized in constructor

  // Diagnostic: Count logged notes
  private _noteLogCount = 0;

  // Instance tracking for debugging
  private _instanceId = Math.random().toString(36).substring(2, 11);

  // Phase 1: Countdown management delegated to CountdownManager
  private countdownManager!: CountdownManager; // Initialized in constructor
  // Keep countdownOffsetBeats for backward compatibility (synced from CountdownManager)
  private countdownOffsetBeats = 0; // Will be set to time signature numerator (e.g., 4 for 4/4)

  // Phase 1: Musical time conversion delegated to MusicalTimeConverter
  private musicalTimeConverter!: MusicalTimeConverter; // Initialized in constructor

  // AUDIO DOUBLING FIX: Guard flag to prevent backup scheduler during initial scheduling
  private isInitialScheduling = false;

  // TEMPO CHANGE FIX: Scheduling lock to prevent race conditions
  private isScheduling = false;

  // TEMPO CHANGE FIX: Debounce rapid tempo changes to prevent UI freezing
  private tempoChangeDebounce: number | null = null;
  private readonly TEMPO_DEBOUNCE_MS = 50;

  // LAST NOTE RING-OUT: Track exercise duration to detect last notes
  private exerciseEndTime: number = 0; // Total exercise duration in seconds
  private lastBeatThreshold: number = 0; // Start of LAST BEAT (time-signature aware)

  // Plugin manager for accessing WAM instruments (WamKeyboard for CC events)
  private pluginManager: PluginManager | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;

    // Phase 1: Instantiate foundation modules
    this.countdownManager = new CountdownManager(this._instanceId);
    this.bufferRegistry = new BufferRegistry(this._instanceId);
    this.musicalTimeConverter = new MusicalTimeConverter(this._instanceId);

    // Phase 2: Instantiate caching and timing modules
    this.scheduleCache = new ScheduleCache();
    this.timingMetricsCollector = new TimingMetricsCollector();

    // Phase 3: Instantiate CC64 sustain system modules
    this.cc64TimelineBuilder = new CC64TimelineBuilder();
    this.cc64TimelineBuilder.setTimeConverter(this.musicalTimeConverter); // Inject time converter
    this.sustainPedalAnalyzer = new SustainPedalAnalyzer();

    // Phase 4: Instantiate scheduler modules
    this.voiceCueScheduler = new VoiceCueScheduler(this._instanceId);
    this.metronomeScheduler = new MetronomeScheduler(this._instanceId, this.tracks);
    this.drumScheduler = new DrumScheduler(this._instanceId, this.tracks);
    this.bassScheduler = new BassScheduler(this._instanceId, this.tracks);
    this.grandPianoKeyboardMapper = new GrandPianoKeyboardMapper(this._instanceId);
    this.harmonyScheduler = new HarmonyScheduler(
      this._instanceId,
      this.tracks,
      this.grandPianoKeyboardMapper,
      this.cc64TimelineBuilder,
      this.sustainPedalAnalyzer,
    );

    // Phase 5: Instantiate diagnostic logger
    this.diagnosticLogger = new DiagnosticLogger(
      this._instanceId,
      this.currentCC64Timeline,
      this.parsePosition.bind(this),
      this.findCC64DownDuringNote.bind(this),
      this.findNextCC64Up.bind(this),
    );

    logger.info('🔧 RegionProcessor instance created', {
      instanceId: this._instanceId,
    });
    this.debugger.log('RegionProcessor', 'initialized');

    // Listen for tempo changes and reschedule events
    // TEMPO CHANGE FIX: Debounce rapid tempo changes to prevent UI freezing
    this.eventBus.on(
      'transport:tempo-change',
      (data: { tempo: number; bpm: number }) => {
        const newTempo = data.tempo || data.bpm;

        logger.info('🎵 RegionProcessor: Received tempo-change event', {
          newTempo,
          isRunning: this.isRunning,
          instanceId: this._instanceId,
        });

        if (!this.isRunning) {
          logger.info(
            '⚠️ RegionProcessor: Tempo changed while stopped - will apply on next play',
            {
              newTempo,
              instanceId: this._instanceId,
            },
          );
          return;
        }

        // Debounce rapid changes (e.g., user dragging tempo slider)
        if (this.tempoChangeDebounce) {
          clearTimeout(this.tempoChangeDebounce);
          logger.debug('🎵 RegionProcessor: Debouncing tempo change', {
            newTempo,
          });
        }

        this.tempoChangeDebounce = window.setTimeout(() => {
          logger.info('🎵 RegionProcessor: Applying debounced tempo change', {
            newTempo,
            instanceId: this._instanceId,
          });
          this.reschedulePendingEvents();
          this.tempoChangeDebounce = null;
        }, this.TEMPO_DEBOUNCE_MS);
      },
    );
  }

  /**
   * FAANG COUNTDOWN: Enable countdown pre-roll with time signature
   * All events will be offset by one measure (numerator beats)
   */
  enableCountdown(timeSignature: {
    numerator: number;
    denominator: number;
  }): void {
    this.countdownManager.enableCountdown(timeSignature);
    this.countdownOffsetBeats = this.countdownManager.getCountdownOffsetBeats(); // Sync for backward compat

    // Phase 2: Sync countdown offset to ScheduleCache for cache key generation
    this.scheduleCache.setCountdownOffsetBeats(this.countdownOffsetBeats);

    // Phase 3: Sync countdown configuration to CC64TimelineBuilder
    this.cc64TimelineBuilder.setCountdownConfig(this.countdownOffsetBeats, true);

    // Phase 4: Schedulers don't need countdown config - events are already offset
  }

  /**
   * Disable countdown pre-roll (all events start at beat 0)
   */
  disableCountdown(): void {
    this.countdownManager.disableCountdown();
    this.countdownOffsetBeats = 0; // Sync for backward compat

    // Phase 2: Sync countdown offset to ScheduleCache
    this.scheduleCache.setCountdownOffsetBeats(0);

    // Phase 3: Sync countdown configuration to CC64TimelineBuilder
    this.cc64TimelineBuilder.setCountdownConfig(0, false);

    // Phase 4: Schedulers don't need countdown config - events are already offset
  }

  /**
   * FAANG COUNTDOWN: Add countdown click events at beats 0, 1, 2, 3 (before offset)
   * This creates a synthetic metronome region with countdown clicks
   */
  addCountdownRegion(timeSignature: {
    numerator: number;
    denominator: number;
  }): void {
    this.countdownManager.addCountdownRegion(this.tracks, timeSignature);
  }

  /**
   * VOICE CUE COUNTDOWN: Add voice cue events ("one", "two", "three", "four") during countdown
   * This creates a synthetic voice-cue region that plays alongside metronome countdown
   */
  addVoiceCountdownRegion(timeSignature: {
    numerator: number;
    denominator: number;
  }): void {
    this.countdownManager.addVoiceCountdownRegion(this.tracks, timeSignature);
  }

  /**
   * Set AudioContext for sample-accurate timing
   * CRITICAL: Must be called before start() to enable proper time domain conversion
   */
  setAudioContext(context: AudioContext): void {
    this.audioContext = context;
    this.sampleRate = context.sampleRate;

    // Phase 2: Sync sample rate to TimingMetricsCollector
    this.timingMetricsCollector.setSampleRate(this.sampleRate);

    // Phase 3: Sync audio context to CC64TimelineBuilder
    this.cc64TimelineBuilder.setAudioContext(context);

    // Phase 4: Sync audio context to all schedulers
    this.voiceCueScheduler.setAudioContext(context);
    this.metronomeScheduler.setAudioContext(context);
    this.drumScheduler.setAudioContext(context);
    this.bassScheduler.setAudioContext(context);
    // HarmonyScheduler gets transportStartTime in setAudioContext (will be set in start())
    // GrandPianoKeyboardMapper doesn't need audio context

    logger.info('🔧 AudioContext set for RegionProcessor', {
      instanceId: this._instanceId,
      sampleRate: this.sampleRate,
    });
  }

  /**
   * FAANG SOLUTION: Inject audio buffers for direct scheduling
   * This bypasses the event bus and JavaScript callback timing
   */
  setMetronomeBuffers(
    accent: AudioBuffer,
    click: AudioBuffer,
    destination: AudioNode,
  ): void {
    this.bufferRegistry.setMetronomeBuffers(accent, click, destination);
    this.audioDestination = this.bufferRegistry.getAudioDestination(); // Sync for backward compat

    // Phase 4: Sync buffers to MetronomeScheduler
    this.metronomeScheduler.setBuffers(accent, click, destination);
  }

  setDrumBuffers(
    kick: AudioBuffer,
    snare: AudioBuffer,
    hihat: AudioBuffer,
    destination: AudioNode,
  ): void {
    this.bufferRegistry.setDrumBuffers(kick, snare, hihat, destination);
    this.audioDestination = this.bufferRegistry.getAudioDestination();

    // Phase 4: Sync buffers to DrumScheduler
    this.drumScheduler.setBuffers(kick, snare, hihat, destination);
  }

  setVoiceCueBuffers(
    samples: Map<string, AudioBuffer>,
    destination: AudioNode,
  ): void {
    this.bufferRegistry.setVoiceCueBuffers(samples, destination);
    this.voiceCueBuffers = samples; // Sync for backward compat (used by scheduling logic)
    this.audioDestination = this.bufferRegistry.getAudioDestination();

    // Phase 4: Sync buffers to VoiceCueScheduler
    this.voiceCueScheduler.setBuffers(samples, destination);
  }

  async setHarmonyBuffers(
    samples: Map<string, AudioBuffer>,
    destination: AudioNode,
    perNoteVelocityRanges?: Record<string, any[]>,
    instrument?: string,
  ): Promise<void> {
    await this.bufferRegistry.setHarmonyBuffers(
      samples,
      destination,
      perNoteVelocityRanges,
      instrument,
    );

    // Sync internal state for backward compatibility (used by scheduling logic)
    this.harmonyBuffers = this.bufferRegistry.getHarmonyBuffers();
    this.harmonyVelocityRanges = this.bufferRegistry.getHarmonyVelocityRanges();
    this.currentHarmonyInstrument =
      this.bufferRegistry.getCurrentHarmonyInstrument();
    this.grandPianoKeyboardMap = this.bufferRegistry.getGrandPianoKeyboardMap();
    this.audioDestination = this.bufferRegistry.getAudioDestination();

    // Phase 4: Sync buffers to HarmonyScheduler
    // HarmonyScheduler will load keyboard map internally if instrument is 'grandpiano'
    await this.harmonyScheduler.setBuffers(
      samples,
      destination,
      perNoteVelocityRanges,
      instrument,
    );
  }

  setBassBuffers(
    samples: Map<string, AudioBuffer>,
    destination: AudioNode,
  ): void {
    this.bufferRegistry.setBassBuffers(samples, destination);
    this.bassBuffers = this.bufferRegistry.getBassBuffers(); // Sync for backward compat
    this.audioDestination = this.bufferRegistry.getAudioDestination();

    // Phase 4: Sync buffers to BassScheduler
    this.bassScheduler.setBuffers(samples, destination);
  }

  /**
   * Ensure Grand Piano keyboard map is loaded
   * (Delegated to BufferRegistry - this is a backward compat wrapper)
   */
  private async loadGrandPianoKeyboardMap(): Promise<void> {
    await this.bufferRegistry.ensureGrandPianoKeyboardMap();
    this.grandPianoKeyboardMap = this.bufferRegistry.getGrandPianoKeyboardMap(); // Sync for backward compat
  }

  /**
   * Inject PluginManager for accessing WAM instruments
   * Used to route control change events (e.g., sustain pedal) to WamKeyboard
   */
  setPluginManager(pluginManager: PluginManager): void {
    this.pluginManager = pluginManager;
    logger.info('✅ PluginManager injected into RegionProcessor', {
      instanceId: this._instanceId,
    });
  }

  /**
   * Get the active WamKeyboard instance from PluginManager
   * Returns null if PluginManager not set or plugin not found
   *
   * CRITICAL: PluginManager stores WamKeyboardPlugin (wrapper), not WamKeyboard directly
   * We need to unwrap it to get the actual WamKeyboard instance
   */
  private getWamKeyboard(): WamKeyboard | null {
    if (!this.pluginManager) {
      logger.warn(
        'PluginManager not set in RegionProcessor - cannot access WamKeyboard',
      );
      return null;
    }

    try {
      // Get the WamKeyboardPlugin wrapper
      const keyboardPlugin =
        this.pluginManager.getPlugin<WamKeyboardPlugin>('wam-keyboard');
      if (!keyboardPlugin) {
        logger.warn('WamKeyboardPlugin not found in PluginManager');
        return null;
      }

      // Unwrap to get the actual WamKeyboard instance
      const wamKeyboard = keyboardPlugin.getWamKeyboard();
      if (!wamKeyboard) {
        logger.warn(
          'WamKeyboard instance not yet initialized in plugin wrapper',
        );
        return null;
      }

      return wamKeyboard;
    } catch (error) {
      logger.warn('Failed to get WamKeyboard from PluginManager', error);
      return null;
    }
  }

  /**
   * Register tracks for processing
   * IMPORTANT: Only ONE track per instrument type is allowed
   * If a track with the same instrument type exists, it will be replaced
   */
  registerTracks(tracks: Track[]): void {
    console.log('🔍 [REGISTER-DEBUG] registerTracks() called with:', {
      trackCount: tracks.length,
      currentTracksInMap: this.tracks.size,
      currentTrackIds: Array.from(this.tracks.keys()),
      incomingTracks: tracks.map((t) => ({
        id: t.id || t.track?.id || t.name || 'unknown',
        instrumentType: t.instrumentType,
        regions: t.regions.length,
      })),
    });

    // 🚨 CRITICAL DIAGNOSTIC: Log harmony track registration with full details
    const harmonyTracks = tracks.filter((t) => t.instrumentType === 'harmony');
    if (harmonyTracks.length > 0) {
      console.log('🚨🚨🚨 HARMONY TRACK DETECTED IN REGISTRATION', {
        count: harmonyTracks.length,
        harmonyTracks: harmonyTracks.map((t) => ({
          id: t.id || t.name,
          regions: t.regions.length,
          regionsData: t.regions.map((r) => ({
            id: r.id,
            eventsCount: r.events?.length || 0,
            firstEvents: (r.events || []).slice(0, 3).map((e) => ({
              type: e.type,
              position: e.position,
              hasData: !!e.data,
            })),
          })),
        })),
      });
    }

    tracks.forEach((track) => {
      const trackId = track.id || track.track?.id || track.name || 'unknown';
      const instrumentType = track.instrumentType;

      console.log('🔍 [REGISTER-DEBUG] Processing track:', {
        trackId,
        instrumentType,
        hasInstrumentType: !!instrumentType,
      });

      // CRITICAL: Remove any existing track with the same instrument type
      // This prevents duplicate tracks (e.g., two metronome tracks)
      if (instrumentType) {
        const existingEntry = Array.from(this.tracks.entries()).find(
          ([, t]) => t.instrumentType === instrumentType,
        );
        const existingTrackId = existingEntry?.[0];
        const existingTrack = existingEntry?.[1];

        console.log('🔍 [REGISTER-DEBUG] Checking for existing track:', {
          instrumentType,
          existingTrackId,
          newTrackId: trackId,
          existingExerciseId: existingTrack?.exerciseId,
          newExerciseId: track.exerciseId,
          shouldReplace: !!existingTrackId,
        });

        // CRITICAL FIX: Replace if ANY existing track found with same instrumentType
        // Track IDs may be identical (e.g., 'harmony-widget-track') but exercise changed
        if (existingTrackId) {
          const exerciseChanged =
            existingTrack?.exerciseId !== track.exerciseId;

          console.log('⚠️ [REGISTER-DEBUG] REPLACEMENT TRIGGERED:', {
            replacing: existingTrackId,
            with: trackId,
            instrumentType,
            exerciseChanged,
            oldExerciseId: existingTrack?.exerciseId,
            newExerciseId: track.exerciseId,
          });

          logger.warn(
            `⚠️ Replacing existing ${instrumentType} track "${existingTrackId}" with "${trackId}"${exerciseChanged ? ' (exercise changed)' : ''}`,
          );

          // CRITICAL FIX: Clear scheduled events for the old track
          // Without this, old instrument's audio sources remain scheduled and play alongside new instrument
          this.clearTrackEvents(existingTrackId);

          // CRITICAL FIX: Clear harmony-specific state when replacing harmony track
          // This ensures old sustain pedal state and active sources don't carry over
          if (instrumentType === 'harmony') {
            this.activeHarmonySources.clear();
            this.currentCC64Timeline.clear();
            console.log('✅ [REGISTER-DEBUG] Cleared harmony state');
            logger.info(
              '✅ Cleared harmony-specific state during track replacement',
            );
          }

          this.tracks.delete(existingTrackId);
          console.log('✅ [REGISTER-DEBUG] Old track deleted from Map');
        }
      }

      this.tracks.set(trackId, track);
      console.log('✅ [REGISTER-DEBUG] New track added to Map:', {
        trackId,
        totalTracksNow: this.tracks.size,
      });

      logger.info(
        `Registered track: ${trackId} with ${track.regions.length} regions`,
      );
      this.debugger.log('RegionProcessor', `registered-track: ${trackId}`, {
        regions: track.regions.length,
        instrumentType: track.instrumentType,
      });
    });

    console.log('🔍 [REGISTER-DEBUG] registerTracks() complete:', {
      totalTracks: this.tracks.size,
      trackIds: Array.from(this.tracks.keys()),
    });

    // CRITICAL FIX: Defensive check for multiple harmony tracks (architectural error detection)
    // There should only ever be ONE harmony track registered at a time
    const registeredHarmonyTracks = Array.from(this.tracks.values()).filter(
      (t) => t.instrumentType === 'harmony',
    );
    if (registeredHarmonyTracks.length > 1) {
      console.error(
        '[ARCHITECTURE-ERROR] Multiple harmony tracks detected:',
        registeredHarmonyTracks.map((t) => ({
          id: t.id,
          exerciseId: t.exerciseId,
          regions: t.regions.length,
        })),
      );
      logger.error(
        'CRITICAL: Multiple harmony tracks registered simultaneously',
        {
          count: registeredHarmonyTracks.length,
          tracks: registeredHarmonyTracks.map((t) => ({
            id: t.id,
            exerciseId: t.exerciseId,
          })),
        },
      );
    } else if (registeredHarmonyTracks.length === 1) {
      console.log('✅ [REGISTER-DEBUG] Single harmony track verified:', {
        id: registeredHarmonyTracks[0].id,
        exerciseId: registeredHarmonyTracks[0].exerciseId,
      });
    }
  }

  /**
   * Start processing regions
   */
  start(): void {
    if (this.isRunning) return;

    // CRITICAL: Capture transport start time to anchor musical timeline to hardware clock
    // Try to get AudioContext from Tone.js if not set explicitly
    if (!this.audioContext && Tone.context) {
      logger.warn(
        '⚠️ AudioContext not set via setAudioContext(), using Tone.context as fallback',
        {
          instanceId: (this as any)._instanceId || 'unknown',
          hasBuffers: !!(
            this.metronomeBuffers.accent && this.metronomeBuffers.click
          ),
          hasDestination: !!this.audioDestination,
        },
      );
      this.audioContext = Tone.context as unknown as AudioContext;
      this.sampleRate = this.audioContext.sampleRate;
    }

    if (this.audioContext) {
      // FAANG SOLUTION: Add startup lookahead to prevent first beat latency
      // Problem: By the time events are scheduled, currentTime has moved forward
      // Solution: Schedule start time slightly in the future with sufficient buffer
      // Increased from 50ms → 100ms → 200ms to handle:
      // - React re-renders between consecutive sessions
      // - Salamander piano initialization (90 samples)
      // - Event collection and batching (~70-80ms with logging)
      // - Buffer silence analysis for first-beat timing compensation
      // User logs showed 100ms left only 28ms actual lookahead after processing
      const startupLookahead = 0.2; // 200ms - ensures first beat has adequate scheduling time
      this.transportStartTime =
        this.audioContext.currentTime + startupLookahead;

      // Phase 2: Sync transport start time to TimingMetricsCollector
      this.timingMetricsCollector.setTransportStartTime(this.transportStartTime);

      // Phase 3: Sync transport start time to CC64TimelineBuilder
      this.cc64TimelineBuilder.setTransportStartTime(this.transportStartTime);

      // Phase 4: Sync audio context with transport start time to HarmonyScheduler
      // Other schedulers don't need transportStartTime (they receive pre-calculated audioTime)
      this.harmonyScheduler.setAudioContext(this.audioContext, this.transportStartTime);

      logger.info(
        '🎯 Transport start anchor captured with FAANG startup lookahead',
        {
          transportStartTime: this.transportStartTime.toFixed(3),
          currentContextTime: this.audioContext.currentTime.toFixed(3),
          startupLookahead: `${startupLookahead * 1000}ms`,
          sampleRate: this.sampleRate,
        },
      );
    } else {
      logger.error(
        '❌ CRITICAL: No AudioContext available! Time domain conversion will fail completely.',
      );
    }

    logger.info('Starting RegionProcessor');
    this.debugger.log('RegionProcessor', 'starting', {
      tracks: this.tracks.size,
      transportState: Tone.Transport.state,
      transportSeconds: Tone.Transport.seconds,
      transportPosition: Tone.Transport.position,
      transportStartTime: this.transportStartTime,
    });

    this.isRunning = true;
    this.lastProcessedPosition = -1;

    // FAANG FIX: Clear old Tone.Transport scheduled events FIRST before clearing tracking
    // This ensures tempo changes while stopped take effect on next play
    // CRITICAL: Must clear Tone events BEFORE clearing scheduledEvents to prevent race condition
    this.scheduledIds.forEach((toneId) => {
      try {
        Tone.Transport.clear(toneId);
      } catch (e) {
        // Ignore errors when clearing
      }
    });
    this.scheduledIds.clear();

    // AUDIO DOUBLING FIX: Clear scheduledEvents AFTER clearing Tone.Transport events
    // This prevents race condition where backup scheduler thinks events aren't scheduled
    this.scheduledEvents.clear();

    // Reset and start timing metrics
    this.resetMetrics();
    this.startMetricsReporting();

    // DIAGNOSTIC: Check what BPM Tone.Transport has RIGHT NOW before scheduling
    const currentToneBpm = Tone.Transport.bpm.value;
    logger.info(
      '🎵 RegionProcessor.start() - Checking Tone.Transport BPM before scheduling',
      {
        toneBpm: currentToneBpm,
        instanceId: this._instanceId,
      },
    );

    // AUDIO DOUBLING FIX: Disable Tone.Transport.loop to prevent event re-triggering
    // Loop can cause already-scheduled events to fire again on 2nd/3rd playback
    if (Tone.Transport.loop) {
      logger.warn(
        '⚠️ Tone.Transport.loop was enabled - disabling to prevent double playback',
        {
          loopStart: Tone.Transport.loopStart,
          loopEnd: Tone.Transport.loopEnd,
          instanceId: this._instanceId,
        },
      );
      Tone.Transport.loop = false;
    }

    // AUDIO DOUBLING FIX: Set guard flag to prevent backup scheduler during initial scheduling
    // This prevents race condition where backup scheduler schedules events that main scheduler is still scheduling
    this.isInitialScheduling = true;

    // Schedule events ahead of time using Tone.js scheduler
    this.scheduleAllRegions();

    // AUDIO DOUBLING FIX: Clear guard flag after initial scheduling completes
    this.isInitialScheduling = false;

    // Also set up a regular check for dynamic scheduling
    this.scheduleInterval = setInterval(() => {
      // DEBUG: Log interval fires to detect race conditions
      logger.debug('⏰ Interval callback fired', {
        isRunning: this.isRunning,
        transportState: Tone.Transport.state,
        isInitialScheduling: this.isInitialScheduling,
        timestamp: Date.now(),
      });

      if (
        this.isRunning &&
        Tone.Transport.state === 'started' &&
        !this.isInitialScheduling
      ) {
        this.processCurrentPosition();
      }
    }, 25); // Check every 25ms
  }

  /**
   * Stop the region processor
   * @param graceful - If true, allow one-shot samples (drums, metronome) to finish naturally.
   *                   If false (manual stop), force-stop ALL audio immediately for instant silence.
   *                   Default: false (manual stop behavior)
   */
  stop(graceful = false): void {
    if (!this.isRunning) return;

    logger.info('Stopping RegionProcessor', { graceful });

    // Stop metrics reporting and log final stats (only if we have events)
    // Phase 2: Get metrics from TimingMetricsCollector before stopping
    const metricsBeforeStop = this.getTimingMetrics();
    this.stopMetricsReporting();
    if (metricsBeforeStop.totalEvents > 0) {
      logger.info('📊 Final Timing Report', metricsBeforeStop);
    }

    // CRITICAL FIX: Clear interval BEFORE setting isRunning = false
    // This prevents race condition where interval callback fires after stop is called
    // but before interval is cleared, scheduling "orphaned" audio sources
    logger.info('🛑 STOP: Clearing interval FIRST to prevent race condition', {
      hasInterval: !!this.scheduleInterval,
      timestamp: Date.now(),
    });

    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
      logger.info('🛑 STOP: Interval cleared successfully');
    }

    // Now safe to set flag - interval cannot fire anymore
    this.isRunning = false;
    logger.info('🛑 STOP: isRunning = false');

    // Clear all scheduled events using the Tone.Transport IDs
    this.scheduledIds.forEach((toneId) => {
      try {
        Tone.Transport.clear(toneId);
      } catch (e) {
        // Ignore errors when clearing
      }
    });
    this.scheduledIds.clear();
    this.scheduledEvents.clear();

    // CRITICAL FIX: Cancel ALL events on Tone.Transport to stop future triggers
    // Tone.Transport.clear(id) only clears specific tracked events
    // Some events may not be tracked in scheduledIds - cancel() ensures complete cleanup
    try {
      Tone.Transport.cancel(0); // Cancel all events from time 0 onwards
      logger.info('🎵 RegionProcessor: Cancelled all Tone.Transport events');
    } catch (e) {
      logger.error(
        '🎵 RegionProcessor: Failed to cancel Tone.Transport events',
        e,
      );
    }

    // Clear CC64 timeline
    this.currentCC64Timeline.clear();

    // Handle audio sources based on stop type
    const now = this.audioContext?.currentTime || 0;
    const fadeOutTime = 0.03; // 30ms - fast stop for manual stop button

    if (!graceful) {
      // MANUAL STOP: Fade out all active harmony notes with fast 30ms fade
      this.activeHarmonySources.forEach((sourceGainPairs, noteName) => {
        sourceGainPairs.forEach(({ source, gain }) => {
          try {
            const currentGain = gain.gain.value;
            // Cancel any scheduled gain changes
            gain.gain.cancelScheduledValues(now);
            // Set current gain value as starting point
            gain.gain.setValueAtTime(currentGain, now);
            // Apply fast 30ms exponential fadeout
            gain.gain.exponentialRampToValueAtTime(0.001, now + fadeOutTime);
          } catch (e) {
            // Ignore if already stopped
          }
        });
      });
    }
    // GRACEFUL STOP: Don't touch active harmony sources - they have pre-scheduled fade-outs

    // Clear harmony sustain state (but sources continue playing with scheduled fade)
    this.activeHarmonySources.clear();

    if (graceful) {
      // GRACEFUL STOP (auto-stop at exercise end):
      // Let one-shot samples (drums, metronome) finish naturally (1-2 seconds)
      // Last harmony notes will ring out naturally via pre-scheduled 2-second extension
      logger.info(
        '🎵 GRACEFUL STOP: Allowing one-shot samples to finish, last harmony notes ring naturally',
      );

      let oneShotCount = 0;

      this.scheduledAudioSources.forEach((info, source) => {
        if (info.type === 'one-shot') {
          // Let drums and metronome clicks finish naturally
          oneShotCount++;
          logger.debug(`🎵 Preserving ${info.type} source to finish naturally`);
          // Don't call source.stop() - let it finish on its own
          // Will auto-disconnect when it ends
        } else {
          // Sustained notes (harmony) - last notes have pre-scheduled ring-out
          logger.debug(
            `🎵 Harmony note - will ring naturally if it's a last note`,
          );
        }
      });

      logger.info('🎵 GRACEFUL STOP: Audio cleanup complete', {
        oneShotsPreserved: oneShotCount,
        harmonyLastNotes: 'pre-scheduled to ring for 2s (1s hold + 1s fade)',
      });
    } else {
      // MANUAL STOP (user clicked stop button):
      // Fast 30ms fade for instant stop feel
      // Last notes had pre-scheduled ring-out, but manual stop overrides it
      logger.info('🛑 MANUAL STOP: Fast 30ms fadeout for all harmony notes');

      // CRITICAL FIX: Stop harmony WAM plugin ONCE before stopping individual sources
      // This prevents calling clearEvents() 129 times (once per note)
      const harmonyTrack = Array.from(this.tracks.values()).find(
        (t) => t.instrumentType === 'harmony',
      );
      if (harmonyTrack?.audioNode?.clearEvents) {
        logger.info('🛑 Stopping harmony WAM plugin via clearEvents()');
        harmonyTrack.audioNode.clearEvents();
      }

      // Stop non-harmony sources (drums, bass, metronome) with fadeout to prevent clicks
      this.scheduledAudioSources.forEach((info, source) => {
        try {
          if (info.type === 'one-shot') {
            // Stop one-shot samples with fadeout to prevent audio spikes
            source.stop(now + fadeOutTime); // 30ms fadeout prevents clicks
            // Don't disconnect immediately - let onended callback handle cleanup
            logger.debug(
              `🛑 Stopped ${info.type} source with ${fadeOutTime * 1000}ms fadeout`,
            );
          } else if (info.hasStopScheduled) {
            // Sustained notes (harmony) - already have fast 30ms fadeout applied
            logger.debug(`🛑 Harmony note - fast fadeout applied`);
          }
        } catch (e) {
          // Ignore errors if source already stopped/ended
          logger.debug(`🛑 Error stopping source: ${e}`);
        }
      });

      logger.info(
        '🛑 MANUAL STOP: Non-harmony sources stopped, harmony with fast 30ms fadeout',
      );
    }

    // CRITICAL FIX: Handle scheduled audio sources based on stop type
    // scheduledAudioSources includes notes that are scheduled to play in the future
    let futureSourcesStopped = 0;

    if (graceful) {
      // GRACEFUL STOP: Only stop sources that haven't started yet (future notes)
      // Let currently playing sources finish with their pre-scheduled ring-out
      this.scheduledAudioSources.forEach((info, source) => {
        try {
          // Check if source has already started playing
          // Web Audio API doesn't expose playbackState, so we track this via type
          if (info.type === 'sustained' && info.hasStopScheduled) {
            // This is a harmony note with pre-scheduled stop time (includes ring-out)
            // Let it continue playing and ring out naturally
            logger.debug(
              `🎵 GRACEFUL: Preserving ${info.type} source with scheduled ring-out`,
            );
          } else {
            // This is a future note that hasn't started, or one-shot without ring-out
            // Stop it to prevent it from starting after stop is called
            source.stop(now + fadeOutTime);
            futureSourcesStopped++;
            logger.debug(`🛑 GRACEFUL: Stopped future ${info.type} source`);
          }
        } catch (e) {
          logger.debug(`🛑 Source already stopped: ${info.type}`);
        }
      });

      logger.info(
        `🎵 GRACEFUL STOP: Stopped ${futureSourcesStopped} future sources, preserved playing sources with ring-out`,
      );

      // DON'T clear scheduledAudioSources immediately in graceful stop
      // Sources will auto-remove via onended callbacks after ring-out completes
      // Schedule cleanup after max ring-out time (3 seconds)
      setTimeout(() => {
        this.scheduledAudioSources.clear();
        logger.info(
          '🎵 GRACEFUL STOP: Cleared scheduled sources after ring-out period',
        );
      }, 3500); // 3s ring-out + 500ms buffer
    } else {
      // MANUAL STOP: Stop ALL sources immediately with fast fadeout
      this.scheduledAudioSources.forEach((info, source) => {
        try {
          source.stop(now + fadeOutTime); // 30ms fadeout prevents clicks
          futureSourcesStopped++;
          logger.debug(
            `🛑 Stopped future ${info.type} source with ${fadeOutTime * 1000}ms fadeout`,
          );
        } catch (e) {
          logger.debug(`🛑 Source already stopped: ${info.type}`);
        }
      });

      logger.info(
        `🛑 MANUAL STOP: Stopped ${futureSourcesStopped} future sources with ${fadeOutTime * 1000}ms fadeout`,
      );

      this.scheduledAudioSources.clear();
      logger.info('🛑 MANUAL STOP: All scheduled audio sources cleared');
    }

    // Note: activeHarmonySources already cleared in manual stop section above (line 794)
    // with proper 3-second fadeout applied. No need to force-stop them here.

    // Stop all active bass notes with fadeout to prevent audio spikes
    this.activeBassSources.forEach((source) => {
      try {
        source.stop(now + fadeOutTime); // 30ms fadeout prevents clicks
        // Don't disconnect - let onended callback handle cleanup
      } catch (e) {
        // Ignore errors if already stopped
      }
    });
    this.activeBassSources.clear();

    // IMPORTANT: DO NOT clear tracks here!
    // Tracks should persist between play/stop cycles
    // Widgets register tracks once when ready, not on every play
    // Clearing here causes harmony track to disappear before scheduling
    // this.tracks.clear(); // REMOVED - was causing harmony track loss

    this.lastProcessedPosition = -1;
  }

  /**
   * Reschedule all pending events when tempo changes during playback
   * This clears the old schedule and creates a new one with updated timing
   *
   * TEMPO CHANGE FIX: FAANG-style instant tempo change implementation
   * - Stops all scheduled audio sources immediately
   * - Recalculates transportStartTime anchor to maintain sync
   * - Reschedules with new tempo timing
   */
  private reschedulePendingEvents(): void {
    if (!this.isRunning) {
      logger.warn('⚠️ RegionProcessor: Cannot reschedule events - not running');
      return;
    }

    // CRITICAL: Check for scheduling lock to prevent race conditions
    if (this.isScheduling) {
      logger.warn(
        '⚠️ RegionProcessor: Cannot reschedule during active scheduling - deferring',
      );
      return;
    }

    const totalScheduledEvents = Array.from(
      this.scheduledEvents.values(),
    ).reduce((sum, set) => sum + set.size, 0);
    logger.info(
      '♻️ RegionProcessor: Rescheduling all events due to tempo change',
      {
        instanceId: this._instanceId,
        currentToneBpm: Tone.Transport.bpm.value,
        scheduledEventCount: totalScheduledEvents,
        scheduledIdCount: this.scheduledIds.size,
        scheduledAudioSources: this.scheduledAudioSources.size,
      },
    );

    // CRITICAL FIX #1: Stop all scheduled AudioBufferSourceNodes
    // This prevents audio event doubling when tempo changes during playback
    logger.info('🛑 Stopping all scheduled audio sources', {
      sourceCount: this.scheduledAudioSources.size,
    });

    this.scheduledAudioSources.forEach((type, source) => {
      try {
        source.stop(0); // Stop immediately
        source.disconnect();
      } catch (e) {
        // Source may have already ended or been stopped - this is OK
        logger.debug('Source already stopped/ended during reschedule', {
          type,
        });
      }
    });
    this.scheduledAudioSources.clear();

    logger.info('✅ All audio sources stopped and cleared');

    // CRITICAL FIX #2: Recalculate transportStartTime anchor
    // This ensures new events are scheduled with correct timing relative to current position
    // Formula: new anchor = current hardware time - elapsed musical time
    if (this.audioContext) {
      const currentTonePosition = Tone.Transport.seconds; // Musical time elapsed
      const currentHardwareTime = this.audioContext.currentTime; // Hardware clock
      const oldAnchor = this.transportStartTime;

      // New anchor: where we are NOW in hardware time minus musical time
      this.transportStartTime = currentHardwareTime - currentTonePosition;

      // Phase 2: Sync updated transport start time to TimingMetricsCollector
      this.timingMetricsCollector.setTransportStartTime(this.transportStartTime);

      // Phase 3: Sync updated transport start time to CC64TimelineBuilder
      this.cc64TimelineBuilder.setTransportStartTime(this.transportStartTime);

      logger.info(
        '🎯 Recalculated transportStartTime anchor for tempo change',
        {
          oldAnchor: oldAnchor.toFixed(6),
          newAnchor: this.transportStartTime.toFixed(6),
          drift: (this.transportStartTime - oldAnchor).toFixed(6),
          tonePosition: currentTonePosition.toFixed(6),
          hardwareTime: currentHardwareTime.toFixed(6),
          newBpm: Tone.Transport.bpm.value,
        },
      );
    }

    // Clear all scheduled Tone.Transport events
    this.scheduledIds.forEach((toneId) => {
      try {
        Tone.Transport.clear(toneId);
      } catch (e) {
        // Ignore errors when clearing
      }
    });
    this.scheduledIds.clear();

    // Clear scheduled event tracking to allow rescheduling
    this.scheduledEvents.clear();

    // Reschedule all regions with new tempo
    // Events will be recalculated using parsePosition() with the new BPM
    // and scheduled with the updated transportStartTime anchor
    this.scheduleAllRegions();

    const newTotalScheduledEvents = Array.from(
      this.scheduledEvents.values(),
    ).reduce((sum, set) => sum + set.size, 0);
    logger.info('✅ RegionProcessor: Events rescheduled successfully', {
      newScheduledEventCount: newTotalScheduledEvents,
      newScheduledIdCount: this.scheduledIds.size,
      newTransportStartTime: this.transportStartTime.toFixed(6),
    });
  }

  /**
   * Calculate total exercise duration and identify the last beat
   * Used to detect which notes should have extended ring-out
   */
  private calculateExerciseDuration(): void {
    const currentBpm = Tone.Transport.bpm.value;
    const secondsPerBeat = 60 / currentBpm;
    let maxEndTime = 0;

    // Find the latest end time across all regions
    this.tracks.forEach((track) => {
      track.regions.forEach((region) => {
        const regionDurationInSeconds = region.duration * secondsPerBeat;
        const regionEndTime = region.startTime + regionDurationInSeconds;
        maxEndTime = Math.max(maxEndTime, regionEndTime);
      });
    });

    // CRITICAL: Add countdown offset to exercise end time (audio time includes offset)
    const countdownOffsetSeconds = this.countdownEnabled
      ? this.countdownOffsetBeats * secondsPerBeat
      : 0;

    this.exerciseEndTime = maxEndTime + countdownOffsetSeconds;

    // Define "last beat" as the final 1 beat before exercise end (time-signature aware)
    const lastBeatDuration = secondsPerBeat; // 1 beat
    this.lastBeatThreshold = Math.max(
      0,
      this.exerciseEndTime - lastBeatDuration,
    );

    // Phase 3: Sync exercise timing to SustainPedalAnalyzer
    this.sustainPedalAnalyzer.setExerciseTiming(
      this.exerciseEndTime,
      this.lastBeatThreshold,
    );

    // Phase 4: Sync exercise timing to HarmonyScheduler (needed for last-note ring-out)
    this.harmonyScheduler.setExerciseTiming(
      this.exerciseEndTime,
      this.lastBeatThreshold,
    );

    console.log(
      `[EXERCISE DURATION] Transport: ${maxEndTime.toFixed(3)}s, Countdown offset: ${countdownOffsetSeconds.toFixed(3)}s, Total (audio time): ${this.exerciseEndTime.toFixed(3)}s, Last beat starts: ${this.lastBeatThreshold.toFixed(3)}s (1 beat = ${lastBeatDuration.toFixed(3)}s @ ${currentBpm} BPM)`,
    );
  }

  /**
   * Schedule all regions using Tone.js Transport
   * TEMPO CHANGE FIX: Protected by scheduling lock to prevent race conditions
   */
  private scheduleAllRegions(): void {
    // TEMPO CHANGE FIX: Prevent concurrent scheduling operations
    if (this.isScheduling) {
      logger.error('🚨 RegionProcessor: Scheduling already in progress!');
      return;
    }

    this.isScheduling = true;

    try {
      this.debugger.log('RegionProcessor', 'scheduling-all-regions', {
        trackCount: this.tracks.size,
      });

      // LAST NOTE RING-OUT: Calculate exercise duration to identify last beat
      this.calculateExerciseDuration();

      // Log track processing order
      const trackOrder = Array.from(this.tracks.keys());
      logger.info(`🔄 Track processing order: ${trackOrder.join(' → ')}`);

      // PERFORMANCE OPTIMIZATION: Check for cached schedule
      // If this exercise has been played before with same BPM/countdown, reuse calculations
      const harmonyTrack = Array.from(this.tracks.values()).find(
        (t) => t.instrumentType === 'harmony',
      );
      const exerciseId = harmonyTrack?.exerciseId;
      const cachedSchedule = exerciseId
        ? this.getCachedSchedule(exerciseId)
        : null;

      // CRITICAL FIX: Batch events by time to prevent sequential callback delays
      // Group all events by their absolute time to schedule them together
      const eventsByTime = new Map<
        number,
        Array<{
          instrumentType: string;
          event: PatternEvent;
          eventKey: string;
          regionId: string;
        }>
      >();

      // First pass: collect all events organized by time
      this.tracks.forEach((track, trackId) => {
        const instrumentType = this.getInstrumentType(track);
        logger.info(`🎵 Processing track: ${trackId} (${instrumentType})`);

        track.regions.forEach((region) => {
          if (!region.pattern?.events) {
            this.debugger.log('RegionProcessor', 'no-pattern-events', {
              trackId,
              region: region.id,
            });
            return;
          }

          this.debugger.log('RegionProcessor', 'scheduling-region', {
            trackId,
            regionId: region.id,
            eventCount: region.pattern.events.length,
            instrumentType,
          });

          // CRITICAL: Sort events so control changes (sustain pedal) are processed BEFORE notes
          // This ensures sustain pedal state is set before notes check it
          const sortedEvents = [...region.pattern.events].sort((a, b) => {
            // CRITICAL FIX: Parse positions into comparable objects
            // Position can be string ("0:0:0") or object ({measure, beat, subdivision, tick})
            const aPos = this.parsePositionToObject(a.position);
            const bPos = this.parsePositionToObject(b.position);

            // Compare positions (measure, beat, subdivision, tick)
            if (aPos.measure !== bPos.measure)
              return aPos.measure - bPos.measure;
            if (aPos.beat !== bPos.beat) return aPos.beat - bPos.beat;
            if (aPos.subdivision !== bPos.subdivision) {
              return aPos.subdivision - bPos.subdivision;
            }
            if (aPos.tick !== bPos.tick) {
              return aPos.tick - bPos.tick;
            }

            // At same time: control changes BEFORE notes
            const aIsCC = a.type === 'harmony-control-change';
            const bIsCC = b.type === 'harmony-control-change';
            if (aIsCC && !bIsCC) return -1; // CC first
            if (!aIsCC && bIsCC) return 1; // Note second

            return 0; // Same priority
          });

          // DIAGNOSTIC: Verify ticks field survives the sort operation
          const firstThreeNotes = sortedEvents
            .filter((e) => e.type === 'harmony-note')
            .slice(0, 3);
          console.log(
            '[REGIONPROCESSOR] First 3 harmony notes after sort:',
            firstThreeNotes.map((e, i) => ({
              index: i + 1,
              type: e.type,
              noteName: (e as any).data?.noteName,
              ticks: (e as any).data?.ticks,
              ticksUndefined: (e as any).data?.ticks === undefined,
              position: e.position,
            })),
          );

          // [CC64 DIAGNOSTIC] Log first 10 events to verify sort order
          console.log(
            `[CC64 DIAGNOSTIC] First 10 events after sorting (region: ${region.id}):`,
          );
          sortedEvents.slice(0, 10).forEach((event, i) => {
            const parsedPos = this.parsePositionToObject(event.position);
            const isCC64 =
              event.type === 'harmony-control-change' &&
              (event as any).data?.cc === 64;
            console.log(
              `  ${i}: ${event.type}${isCC64 ? ' (CC64)' : ''} @ ${parsedPos.measure}:${parsedPos.beat}:${parsedPos.subdivision}:${parsedPos.tick}`,
              isCC64 ? `value=${(event as any).data?.value}` : '',
            );
          });

          // CC64: Build timeline for pre-calculated sustain durations
          // PERFORMANCE OPTIMIZATION: Use cached CC64 timeline if available
          if (cachedSchedule && instrumentType === 'harmony') {
            this.currentCC64Timeline = cachedSchedule.cc64Timeline;
            console.log(
              `[CC64] ♻️ Using CACHED timeline with ${this.currentCC64Timeline.size} pedal events`,
            );
          } else {
            this.currentCC64Timeline = this.buildCC64Timeline(
              sortedEvents,
              region,
            );
            console.log(
              `[CC64] 🔨 Built NEW timeline with ${this.currentCC64Timeline.size} pedal events`,
            );
          }

          // Phase 4: Sync CC64 timeline to HarmonyScheduler
          this.harmonyScheduler.setCurrentCC64Timeline(this.currentCC64Timeline);

          if (this.currentCC64Timeline.size > 0) {
            // Log the timeline for debugging
            const timeline = Array.from(this.currentCC64Timeline.entries())
              .sort((a, b) => a[0] - b[0])
              .map(
                ([time, down]) => `${time.toFixed(3)}s=${down ? 'DOWN' : 'UP'}`,
              )
              .join(', ');
            console.log(`[CC64] Timeline: ${timeline}`);

            // ============================================================================
            // CC64 COMPREHENSIVE DIAGNOSTIC TABLE
            // ============================================================================
            this.logCC64DiagnosticTable(sortedEvents, region);
          }

          // Track harmony notes separately from all events for diagnostic
          let harmonyNoteCount = 0;

          sortedEvents.forEach((event, eventIndex) => {
            const eventKey = `${region.id}_${eventIndex}`;

            // Skip if already scheduled
            const trackEvents = this.scheduledEvents.get(trackId);
            if (trackEvents && trackEvents.has(eventKey)) return;

            // Calculate absolute time for this event
            // 🚨 CRITICAL FIX: Use absolute ticks if available (for consistent timing)
            // 🚨 CRITICAL FIX: Use original MIDI file BPM, not current transport BPM
            // Absolute ticks are always relative to the original recording tempo
            const eventData = (event as any).data;
            const originalBpm =
              eventData?.originalBpm || Tone.Transport.bpm.value; // Fallback to transport BPM if not provided
            let eventTime: number;

            if (eventData?.ticks !== undefined) {
              // Use absolute ticks (new method - consistent with CC64)
              const secondsPerBeat = 60 / originalBpm;
              const ticksPerBeat = 480; // PPQ standard
              const absoluteTicks = eventData.ticks;
              eventTime = (absoluteTicks / ticksPerBeat) * secondsPerBeat;

              // DIAGNOSTIC: Log first 3 harmony notes AND note 9 (using separate harmony note counter)
              if (event.type === 'harmony-note') {
                if (harmonyNoteCount < 3 || harmonyNoteCount === 8) {
                  console.log(
                    `[ABSOLUTE TICK SCHEDULING] Harmony Note ${harmonyNoteCount + 1} (eventIndex ${eventIndex}):`,
                    {
                      absoluteTicks,
                      originalBpm,
                      secondsPerBeat,
                      ticksPerBeat,
                      calculation: `(${absoluteTicks} / ${ticksPerBeat}) * ${secondsPerBeat}`,
                      eventTime,
                      calculatedTime: eventTime.toFixed(6),
                      position: event.position,
                      usingAbsoluteTicks: true,
                      usingOriginalBpm: eventData?.originalBpm !== undefined,
                      noteName: eventData?.noteName,
                    },
                  );
                }
                harmonyNoteCount++;
              }
            } else {
              // Fallback to position parsing (old method)
              eventTime = this.parsePosition(event.position);

              // DIAGNOSTIC: Log if falling back to position parsing
              if (event.type === 'harmony-note') {
                if (harmonyNoteCount < 3 || harmonyNoteCount === 8) {
                  console.log(
                    `[RELATIVE TICK SCHEDULING] Harmony Note ${harmonyNoteCount + 1} (eventIndex ${eventIndex}):`,
                    {
                      position: event.position,
                      calculatedTime: eventTime.toFixed(6),
                      usingAbsoluteTicks: false,
                      noteName: (event as any).data?.noteName,
                      WARNING:
                        'event.data.ticks is undefined - using relative position',
                    },
                  );
                }
                harmonyNoteCount++;
              }
            }

            // COUNTDOWN SOLUTION: Selective audio offset based on skipCountdownOffset flag
            // - Countdown region has skipCountdownOffset: true → NO offset → plays at beat 0-3
            // - Exercise regions have skipCountdownOffset: false → WITH offset → plays at beat 4+
            // - Display layer subtracts 4 beats to show countdown as -1:00:00 and exercise as 1:00:00
            // FAANG FIX: Use parsePosition() which respects current BPM (Tone.Time() doesn't!)
            const offsetTime =
              this.countdownEnabled && !region.skipCountdownOffset
                ? this.parsePosition(`0:${this.countdownOffsetBeats}:0`)
                : 0;

            const absoluteTime = region.startTime + eventTime + offsetTime;

            // DIAGNOSTIC: Log absolute time calculation for first few events
            if (eventIndex < 3) {
              logger.info(`🎯 Absolute time calculation`, {
                'region.startTime': region.startTime,
                eventTime,
                offsetTime,
                absoluteTime,
                position: event.position,
                instrumentType,
              });
            }

            // Round to 3 decimals to group events at the same musical time
            const timeKey = Math.round(absoluteTime * 1000) / 1000;

            if (!eventsByTime.has(timeKey)) {
              eventsByTime.set(timeKey, []);
            }

            eventsByTime.get(timeKey)!.push({
              instrumentType,
              event,
              eventKey,
              regionId: region.id,
            });

            // CRITICAL: Mark as scheduled NOW to prevent duplicates if scheduleAllRegions() is called again
            if (!this.scheduledEvents.has(trackId)) {
              this.scheduledEvents.set(trackId, new Set());
            }
            this.scheduledEvents.get(trackId)!.add(eventKey);

            logger.info(
              `📅 Collected ${instrumentType} event at ${absoluteTime}s: ${event.type}`,
            );
          });
        });
      });

      // Log batching stats
      const batchedEventCount = Array.from(
        this.scheduledEvents.values(),
      ).reduce((sum, set) => sum + set.size, 0);
      logger.info(
        `📦 Batched ${eventsByTime.size} unique time points with ${batchedEventCount} total events`,
      );

      // AUDIO DOUBLING FIX: Schedule audio DIRECTLY here, not inside Tone callbacks
      // Second pass: schedule audio for all events immediately (upfront scheduling)
      // This prevents doubling because audio is scheduled once during initialization, not when callbacks fire
      eventsByTime.forEach((events, timeKey) => {
        // TEMPO CHANGE OPTIMIZATION: Skip events that already played
        // This saves 30-40% processing time when tempo changes mid-exercise
        const currentAudioTime = this.audioContext?.currentTime || 0;
        const absoluteAudioTime = this.transportStartTime + timeKey;

        if (absoluteAudioTime < currentAudioTime) {
          logger.debug(
            `⏭️  Skipping past event batch at ${timeKey}s (already played)`,
            {
              absoluteAudioTime: absoluteAudioTime.toFixed(6),
              currentAudioTime: currentAudioTime.toFixed(6),
              eventCount: events.length,
            },
          );
          return; // Skip this entire batch
        }

        try {
          const batchStartTime = performance.now();

          // Schedule all events at this time point together
          events.forEach(({ instrumentType, event, eventKey }, index) => {
            const eventStartTime = performance.now();

            // CRITICAL: Schedule audio directly NOW, not later in a callback
            this.emitEvent(instrumentType, event, timeKey);

            const eventEndTime = performance.now();

            logger.info(
              `⏱️ Event ${index + 1}/${events.length} in batch: ${instrumentType}`,
              {
                eventProcessingTime: `${(eventEndTime - eventStartTime).toFixed(3)}ms`,
                timeSinceBatchStart: `${(eventStartTime - batchStartTime).toFixed(3)}ms`,
                audioContextTime: this.audioContext?.currentTime.toFixed(6),
                scheduledAt: timeKey.toFixed(6),
              },
            );
          });

          const batchTotalTime = performance.now() - batchStartTime;
          logger.info(
            `✅ Batch completed: ${events.length} events in ${batchTotalTime.toFixed(3)}ms`,
          );
        } catch (error) {
          logger.error(
            `Failed to schedule events at time ${timeKey}: ${error}`,
          );
        }
      });

      const totalScheduledEvents = Array.from(
        this.scheduledEvents.values(),
      ).reduce((sum, set) => sum + set.size, 0);
      logger.info(
        `✅ Scheduled ${totalScheduledEvents} audio events total in ${eventsByTime.size} batches (upfront scheduling)`,
      );

      // PERFORMANCE OPTIMIZATION: Cache CC64 timeline for future use
      // Only cache if we have an exerciseId and we calculated a new timeline (not from cache)
      if (exerciseId && !cachedSchedule && this.currentCC64Timeline.size > 0) {
        const schedule: CachedSchedule = {
          cc64Timeline: new Map(this.currentCC64Timeline), // Clone the Map
          calculatedEvents: [], // Not caching full events yet (future optimization)
          cachedAt: Date.now(),
          bpm: Tone.Transport.bpm.value,
          countdownBeats: this.countdownOffsetBeats,
        };

        this.setCachedSchedule(exerciseId, schedule);
      }
    } finally {
      // TEMPO CHANGE FIX: Always release scheduling lock, even if error occurs
      this.isScheduling = false;
    }
  }

  /**
   * Process current transport position (backup method)
   */
  private processCurrentPosition(): void {
    // CRITICAL: Defense in depth - don't schedule if stopping
    if (!this.isRunning) {
      logger.debug('⏰ Interval fired but isRunning=false, skipping');
      return;
    }

    const currentTime = Tone.Transport.seconds;

    // Process events within lookahead window
    const lookAheadEnd = currentTime + this.lookAheadTime;

    this.tracks.forEach((track, trackId) => {
      const instrumentType = this.getInstrumentType(track);

      track.regions.forEach((region) => {
        if (!region.pattern?.events) return;

        // Check if we're within this region's time range
        // FAANG FIX: region.duration is in BEATS, must convert to seconds using current BPM!
        const currentBpm = Tone.Transport.bpm.value;
        const secondsPerBeat = 60 / currentBpm;
        const regionDurationInSeconds = region.duration * secondsPerBeat;

        if (
          currentTime < region.startTime ||
          currentTime > region.startTime + regionDurationInSeconds
        ) {
          return;
        }

        region.pattern.events.forEach((event, eventIndex) => {
          const eventTime = this.parsePosition(event.position);
          // COUNTDOWN SOLUTION: Same offset logic as main scheduler - convert beats to seconds
          // FAANG FIX: Use parsePosition() which respects current BPM (Tone.Time() doesn't!)
          const offsetTime =
            this.countdownEnabled && !region.skipCountdownOffset
              ? this.parsePosition(`0:${this.countdownOffsetBeats}:0`)
              : 0;
          const absoluteTime = region.startTime + eventTime + offsetTime;

          // Check if this event should be triggered soon
          if (absoluteTime >= currentTime && absoluteTime <= lookAheadEnd) {
            // CRITICAL FIX: Check the MAIN event key to avoid double-scheduling
            // The backup scheduler should NOT reschedule events that are already scheduled
            const mainEventKey = `${region.id}_${eventIndex}`;
            const backupEventKey = `backup_${region.id}_${event.position}_${Math.floor(absoluteTime)}`;

            // Skip if already scheduled by main scheduler OR backup scheduler
            const trackEvents = this.scheduledEvents.get(trackId);
            const hasMainKey = trackEvents && trackEvents.has(mainEventKey);
            const hasBackupKey = trackEvents && trackEvents.has(backupEventKey);

            if (!hasMainKey && !hasBackupKey) {
              // Schedule it immediately - absoluteTime is in seconds
              const toneId = Tone.Transport.schedule((time) => {
                if (!this.isRunning) return;
                // CRITICAL FIX: Use absoluteTime (intended time in seconds) not time (Tone's lookahead time)
                // Must match the main scheduling method to avoid timing drift
                this.emitEvent(instrumentType, event, absoluteTime);
              }, absoluteTime);

              // Mark BOTH keys as scheduled to prevent duplicate scheduling
              if (!this.scheduledEvents.has(trackId)) {
                this.scheduledEvents.set(trackId, new Set());
              }
              this.scheduledEvents.get(trackId)!.add(mainEventKey);
              this.scheduledEvents.get(trackId)!.add(backupEventKey);
              this.scheduledIds.add(toneId);
            }
          }
        });
      });
    });
  }

  /**
   * Parse Tone.js position format to seconds
   * Uses Tone.js to handle tempo and time signature correctly
   */
  /**
   * FAANG SOLUTION: Manual musical time conversion that respects current BPM
   * Tone.Time().toSeconds() does NOT use Tone.Transport.bpm - it uses Tone.context.transport.bpm
   * So we must calculate manually using the ACTUAL current BPM
   *
   * NOW SUPPORTS BOTH:
   * - String format: "bar:beat:sixteenth" or "bar:beat:sixteenth:tick"
   * - Object format: {measure, beat, subdivision, tick} with MIDI tick precision
   */
  private parsePosition(
    position:
      | string
      | { measure: number; beat: number; subdivision: number; tick?: number },
  ): number {
    try {
      // Get current BPM from Tone.Transport (single source of truth)
      const currentBpm = Tone.Transport.bpm.value;
      const secondsPerBeat = 60 / currentBpm;

      let bars: number,
        beats: number,
        ticks = 0;

      // NEW: Handle object format (from exercise.harmonyNotes)
      if (typeof position === 'object' && position !== null) {
        bars = position.measure || 0;
        beats = position.beat || 0;
        // FIX: Use ONLY tick field - subdivision is redundant (derived from tick)
        // The subdivision field causes quantization because it rounds to 16th notes
        ticks = position.tick || 0;
      }
      // Legacy: Handle string format
      else if (typeof position === 'string') {
        if (position.includes(':')) {
          // Parse "bar:beat:sixteenth" or "bar:beat:sixteenth:tick" format
          const parts = position.split(':');
          bars = parseInt(parts[0] || '0', 10);
          beats = parseInt(parts[1] || '0', 10);
          const sixteenths = parseInt(parts[2] || '0', 10);
          const ticksPart = parseInt(parts[3] || '0', 10);

          // FIX: Convert sixteenths to ticks first, then add tick precision
          // This ensures we use tick as single source of truth for sub-beat timing
          const ticksPer16th = 120; // 480 PPQ / 4 = 120 ticks per 16th note
          ticks = sixteenths * ticksPer16th + ticksPart;
        } else {
          // Assume it's a beat number
          const beat = parseFloat(position);
          return beat * secondsPerBeat;
        }
      } else {
        logger.warn(`Invalid position format: ${position}`);
        return 0;
      }

      // Get time signature (assume 4/4 for now, can be made dynamic)
      const beatsPerBar = 4;

      // Calculate total beats WITH TICK PRECISION
      // MIDI standard: 480 PPQ (Pulses Per Quarter note)
      const ticksPerBeat = 480;
      const tickFraction = ticks / ticksPerBeat;

      // FIX: Use ONLY tick precision - don't double-count subdivision
      // The tick field contains the complete sub-beat position (0-479)
      const totalBeats = bars * beatsPerBar + beats + tickFraction; // Single source of truth for sub-beat precision

      // Convert to seconds using CURRENT BPM
      const seconds = totalBeats * secondsPerBeat;

      return seconds;
    } catch (error) {
      logger.warn(`Failed to parse position: ${position}`, error);
      return 0;
    }
  }

  /**
   * Parse position into comparable object structure for sorting
   * Handles both string ("bar:beat:sixteenth") and object ({measure, beat, subdivision, tick}) formats
   */
  private parsePositionToObject(
    position:
      | string
      | { measure: number; beat: number; subdivision?: number; tick?: number },
  ): { measure: number; beat: number; subdivision: number; tick: number } {
    if (typeof position === 'object' && position !== null) {
      return {
        measure: position.measure || 0,
        beat: position.beat || 0,
        subdivision: position.subdivision || 0,
        tick: position.tick || 0,
      };
    }

    // Parse string format: "bar:beat:sixteenth" or "bar:beat:sixteenth:tick"
    if (typeof position === 'string' && position.includes(':')) {
      const parts = position.split(':');
      return {
        measure: parseInt(parts[0] || '0', 10),
        beat: parseInt(parts[1] || '0', 10),
        subdivision: parseInt(parts[2] || '0', 10),
        tick: parseInt(parts[3] || '0', 10),
      };
    }

    // Fallback for unknown formats
    return { measure: 0, beat: 0, subdivision: 0, tick: 0 };
  }

  /**
   * Get instrument type from track
   */
  private getInstrumentType(track: Track): string {
    if (track.instrumentType) return track.instrumentType;

    const name = track.name?.toLowerCase() || '';
    if (name.includes('metronome')) return 'metronome';
    if (name.includes('drum')) return 'drums';
    if (name.includes('bass')) return 'bass';
    if (name.includes('harmony') || name.includes('chord')) return 'harmony';

    return 'unknown';
  }

  /**
   * FAANG SOLUTION: Schedule audio directly in Web Audio graph
   * Bypasses JavaScript callback timing for sample-perfect playback
   */
  private scheduleAudioDirect(
    instrumentType: string,
    event: PatternEvent,
    audioTime: number,
    frame: number,
  ): boolean {
    // Handle metronome
    if (instrumentType === 'metronome') {
      return this.scheduleMetronomeDirect(event, audioTime, frame);
    }

    // Handle drums
    if (instrumentType === 'drums') {
      return this.scheduleDrumDirect(event, audioTime, frame);
    }

    // Handle harmony
    if (instrumentType === 'harmony') {
      return this.scheduleHarmonyDirect(event, audioTime, frame);
    }

    // Handle bass
    if (instrumentType === 'bass') {
      return this.scheduleBassDirect(event, audioTime, frame);
    }

    // Handle voice cues
    if (instrumentType === 'voice-cue') {
      return this.scheduleVoiceCueDirect(event, audioTime, frame);
    }

    // Not supported yet - fall back to event bus
    logger.debug(
      `❌ FAANG: Direct scheduling not yet implemented for: ${instrumentType}`,
    );
    return false;
  }

  /**
   * Schedule metronome audio directly
   * Phase 4: Delegated to MetronomeScheduler
   */
  private scheduleMetronomeDirect(
    event: PatternEvent,
    audioTime: number,
    frame: number,
  ): boolean {
    return this.metronomeScheduler.schedule(event, audioTime, frame);
  }

  /**
   * Schedule drum audio directly
   * Phase 4: Delegated to DrumScheduler
   */
  private scheduleDrumDirect(
    event: PatternEvent,
    audioTime: number,
    frame: number,
  ): boolean {
    return this.drumScheduler.schedule(event, audioTime, frame);
  }

  /**
   * Schedule voice cue audio directly
   * Phase 4: Delegated to VoiceCueScheduler
   */
  private scheduleVoiceCueDirect(
    event: PatternEvent,
    audioTime: number,
    frame: number,
  ): boolean {
    return this.voiceCueScheduler.schedule(event, audioTime, frame);
  }

  /**
   * Schedule harmony audio directly (CC64, MIDI notes, chords)
   * Phase 4: Delegated to HarmonyScheduler
   */
  private scheduleHarmonyDirect(
    event: PatternEvent,
    audioTime: number,
    frame: number,
  ): boolean {
    return this.harmonyScheduler.schedule(event, audioTime, frame);
  }

  // ============================================================================
  // HARMONY VELOCITY LAYER SELECTION
  // ============================================================================

  /**
   * Determine which velocity layer to use for a specific note and velocity
   * Uses per-note velocity ranges from instrument config (e.g., wurlitzer-piano.json)
   * Falls back to generic velocity mapping if per-note ranges aren't available
   */
  private getHarmonyLayerForNoteVelocity(
    noteName: string,
    velocity: number,
  ): string {
    // If we have per-note velocity ranges, use them
    if (this.harmonyVelocityRanges) {
      // Try with sharp notation first (Cs4, Ds4, Fs4, etc.)
      let ranges = this.harmonyVelocityRanges[noteName];

      // If not found, try converting to # notation (C#4, D#4, F#4, etc.)
      // The config might use # notation
      if (!ranges) {
        const noteWithSharp = noteName.replace('s', '#');
        ranges = this.harmonyVelocityRanges[noteWithSharp];
      }

      if (ranges && ranges.length > 0) {
        // Find which layer this velocity falls into for this specific note
        for (const range of ranges) {
          if (velocity >= range.min && velocity <= range.max) {
            return range.layer;
          }
        }
        // If velocity is out of range, use the last layer (highest velocity)
        return ranges[ranges.length - 1].layer;
      }
    }

    // Fallback to instrument-specific velocity mapping if no per-note config
    // Use currentHarmonyInstrument to determine which ranges to use
    const instrument = this.currentHarmonyInstrument || 'wurlitzer';

    if (instrument === 'grandpiano') {
      // Grand Piano velocity ranges (7 layers)
      if (velocity <= 18) return 'v1';
      if (velocity <= 36) return 'v2';
      if (velocity <= 54) return 'v3';
      if (velocity <= 72) return 'v4';
      if (velocity <= 90) return 'v5';
      if (velocity <= 108) return 'v6';
      return 'v7';
    } else if (instrument === 'wurlitzer') {
      // Wurlitzer velocity ranges (5 layers)
      if (velocity <= 25) return 'v1';
      if (velocity <= 51) return 'v2';
      if (velocity <= 76) return 'v3';
      if (velocity <= 102) return 'v4';
      return 'v5';
    } else if (instrument === 'rhodes') {
      // Rhodes velocity ranges (4 layers)
      if (velocity <= 31) return 'v1';
      if (velocity <= 63) return 'v2';
      if (velocity <= 95) return 'v3';
      return 'v4';
    } else {
      // Default to Wurlitzer ranges for unknown instruments
      if (velocity <= 25) return 'v1';
      if (velocity <= 51) return 'v2';
      if (velocity <= 76) return 'v3';
      if (velocity <= 102) return 'v4';
      return 'v5';
    }
  }

  /**
   * Detect if the loaded harmony instrument uses sparse sampling (like Grand Piano)
   * by checking if ANY octave has all 12 chromatic notes
   * @returns true if sparse (Grand Piano), false if full chromatic (Wurlitzer)
   */
  private detectSparseSampling(): boolean {
    if (this.harmonyBuffers.size === 0) return false;

    // Get all available note names across all velocity layers
    const allNoteNames = new Set<string>();
    for (const layerMap of this.harmonyBuffers.values()) {
      for (const noteName of layerMap.keys()) {
        allNoteNames.add(noteName);
      }
    }

    // Group notes by octave
    const notesByOctave = new Map<number, Set<string>>();
    for (const noteName of allNoteNames) {
      const octave = parseInt(noteName.slice(-1), 10);
      if (!notesByOctave.has(octave)) {
        notesByOctave.set(octave, new Set());
      }
      const noteWithoutOctave = noteName.slice(0, -1);
      notesByOctave.get(octave)!.add(noteWithoutOctave);
    }

    // Check if ANY octave has all 12 chromatic notes
    const allChromaticNotes = [
      'C',
      'Cs',
      'D',
      'Ds',
      'E',
      'F',
      'Fs',
      'G',
      'Gs',
      'A',
      'As',
      'B',
    ];
    for (const notesInOctave of notesByOctave.values()) {
      if (allChromaticNotes.every((note) => notesInOctave.has(note))) {
        return false; // Full chromatic (Wurlitzer)
      }
    }

    return true; // Sparse (Grand Piano)
  }

  // ============================================================================
  // CC64 SUSTAIN PEDAL: PRE-CALCULATED DURATION HELPERS
  // ============================================================================

  /**
   * Build CC64 timeline from sorted events
   * Returns Map of audioTime -> pedalDown (true=DOWN, false=UP)
   */
  /**
   * Build CC64 timeline from harmony events
   * Phase 3: Delegated to CC64TimelineBuilder
   */
  private buildCC64Timeline(
    events: any[],
    region: Region,
  ): Map<number, boolean> {
    return this.cc64TimelineBuilder.buildTimeline(events, region);
  }

  /**
   * Check if sustain pedal is down at a specific time
   * Phase 3: Delegated to SustainPedalAnalyzer
   */
  private isPedalDownAtTime(
    time: number,
    cc64Timeline: Map<number, boolean>,
  ): boolean {
    return this.sustainPedalAnalyzer.isPedalDownAtTime(time, cc64Timeline);
  }

  /**
   * Find the next CC64 UP event after a given time
   * Phase 3: Delegated to SustainPedalAnalyzer
   */
  private findNextCC64Up(
    noteStartTime: number,
    cc64Timeline: Map<number, boolean>,
  ): number | null {
    return this.sustainPedalAnalyzer.findNextCC64Up(noteStartTime, cc64Timeline);
  }

  /**
   * Check if MIDI note-off happens at/near exercise end (held by hand)
   * Phase 3: Delegated to SustainPedalAnalyzer
   */
  private isNoteHeldUntilExerciseEnd(midiNoteEndTime: number): boolean {
    return this.sustainPedalAnalyzer.isNoteHeldUntilExerciseEnd(midiNoteEndTime);
  }

  /**
   * Check if CC64 pedal is DOWN when note starts OR goes DOWN during note's MIDI duration
   * Phase 3: Delegated to SustainPedalAnalyzer
   */
  private findCC64DownDuringNote(
    noteStart: number,
    noteEnd: number,
    timeline: Map<number, boolean>,
  ): number | null {
    return this.sustainPedalAnalyzer.findCC64DownDuringNote(
      noteStart,
      noteEnd,
      timeline,
    );
  }

  // ============================================================================


  /**
   * Schedule bass audio directly
   * Phase 4: Delegated to BassScheduler
   */
  private scheduleBassDirect(
    event: PatternEvent,
    audioTime: number,
    frame: number,
  ): boolean {
    return this.bassScheduler.schedule(event, audioTime, frame);
  }

  /**
   * Emit the appropriate event based on instrument type
   *
   * CRITICAL TIME DOMAIN CONVERSION:
   * 'time' parameter is in TRANSPORT TIME (musical beats: 0, 0.5, 1, 1.5...)
   * We must convert to AUDIO CONTEXT TIME (hardware clock) before emitting
   */
  private emitEvent(
    instrumentType: string,
    event: PatternEvent,
    time: number,
  ): void {
    // CRITICAL FIX: Convert transport time → AudioContext time
    // transportTime (beats) + transportStartTime (anchor) = audioContextTime (hardware)
    let audioTime = this.transportStartTime + time;

    // FAANG SOLUTION: Sample-accurate rounding for sub-millisecond precision
    // Round to exact audio frame to eliminate sub-sample jitter
    let frame = 0;
    if (this.audioContext) {
      frame = Math.round(audioTime * this.sampleRate);
      audioTime = frame / this.sampleRate;

      // Track timing accuracy metrics
      this.trackTimingAccuracy(frame, time);
    }

    const timestamp = Date.now();

    // DEBUG: Log harmony-control-change events
    if (event.type === 'harmony-control-change') {
      console.log(
        `[EMIT EVENT] ⚠️ harmony-control-change detected: cc=${(event.data as any)?.cc}, value=${(event.data as any)?.value}, audioTime=${audioTime.toFixed(3)}`,
      );
    }

    // FAANG SOLUTION: Try direct audio scheduling first (sample-perfect)
    if (this.scheduleAudioDirect(instrumentType, event, audioTime, frame)) {
      // Successfully scheduled directly - skip event bus
      logger.debug(`Direct audio scheduling used for ${instrumentType}`);
      return;
    }

    // Fall back to event bus for instruments without direct scheduling
    switch (instrumentType) {
      case 'metronome':
        this.eventBus.emit('metronome-trigger', {
          beat: event.type === 'accent' ? 1 : 2, // Simple beat numbering
          isDownbeat: event.type === 'accent',
          audioTime,
          timestamp,
          velocity: event.velocity || 0.8,
        });
        logger.debug(
          `Emitted metronome-trigger: ${event.type} at ${audioTime.toFixed(3)}`,
        );
        break;

      case 'drums':
        // Map event types to drum names
        const drumMap: Record<string, string> = {
          kick: 'kick',
          snare: 'snare',
          hihat: 'hihat',
          openhat: 'openHihat',
          crash: 'crash',
          ride: 'ride',
          accent: 'kick',
          click: 'hihat',
        };

        const drum = drumMap[event.type] || event.type;
        this.eventBus.emit('drum-trigger', {
          drum,
          audioTime,
          timestamp,
          velocity: event.velocity || 0.8,
        });
        logger.debug(
          `Emitted drum-trigger: ${drum} at ${audioTime.toFixed(3)}`,
        );
        break;

      case 'bass':
        this.eventBus.emit('bass-trigger', {
          note: event.type,
          audioTime,
          timestamp,
          velocity: event.velocity || 0.8,
        });
        break;

      case 'harmony':
        this.eventBus.emit('chord-trigger', {
          chord: event.type,
          notes: [], // Would need to parse from event
          audioTime,
          timestamp,
          velocity: event.velocity || 0.8,
        });
        break;
    }
  }

  /**
   * Clear all scheduled events for a specific track
   * Used when switching exercises to prevent old exercise events from playing
   *
   * @param trackId - ID of the track to clear
   */
  private clearTrackEvents(trackId: string): void {
    logger.info(`🧹 Clearing scheduled events for track: ${trackId}`);

    // Remove track from scheduledEvents Map
    const cleared = this.scheduledEvents.delete(trackId);

    if (cleared) {
      logger.info(`✅ Cleared track events for ${trackId}`);
    } else {
      logger.info(`ℹ️ No events found for track ${trackId}`);
    }

    // Note: We don't clear scheduledIds or scheduledAudioSources here
    // Those are global and will be cleared on stop()
    // This method only clears the event tracking to allow re-scheduling
  }

  /**
   * Get cached schedule for an exercise if available
   * Phase 2: Delegates to ScheduleCache module
   *
   * @param exerciseId - Unique exercise identifier
   * @returns Cached schedule or null
   */
  private getCachedSchedule(exerciseId: string): CachedSchedule | null {
    return this.scheduleCache.get(exerciseId);
  }

  /**
   * Cache schedule for an exercise
   * Phase 2: Delegates to ScheduleCache module
   *
   * @param exerciseId - Unique exercise identifier
   * @param schedule - Schedule data to cache
   */
  private setCachedSchedule(
    exerciseId: string,
    schedule: CachedSchedule,
  ): void {
    this.scheduleCache.set(exerciseId, schedule);
  }

  /**
   * Clear cache for a specific exercise (e.g., when BPM changes)
   * Phase 2: Delegates to ScheduleCache module
   *
   * @param exerciseId - Exercise to clear cache for
   */
  private clearExerciseCache(exerciseId: string): void {
    this.scheduleCache.clear(exerciseId);
  }

  /**
   * Update tracks (for when regions change)
   * CRITICAL: When running, adds tracks WITHOUT stopping/restarting
   * This prevents interrupting countdown and causing abrupt restarts
   */
  updateTracks(
    tracks: Track[],
    exerciseMetadata?: { harmonyInstrument?: string },
  ): void {
    // FAANG FIX: Set harmony instrument type as early as possible
    // This ensures cache lookups work even before buffer injection completes
    if (exerciseMetadata?.harmonyInstrument) {
      this.currentHarmonyInstrument = exerciseMetadata.harmonyInstrument;
      logger.info(
        `🎹 Early harmony instrument detection: ${exerciseMetadata.harmonyInstrument}`,
      );

      // CRITICAL FIX: Load keyboard map immediately for Grand Piano
      // This ensures note mapping works even if playback starts before setHarmonyBuffers() is called
      if (
        exerciseMetadata.harmonyInstrument === 'grandpiano' &&
        !this.grandPianoKeyboardMap
      ) {
        console.log(
          '🗺️ [EARLY-LOAD] Loading keyboard map immediately in updateTracks()...',
        );
        this.loadGrandPianoKeyboardMap()
          .then(() => {
            console.log('🗺️ [EARLY-LOAD] ✅ Keyboard map loaded early', {
              hasKeyboardMap: !!this.grandPianoKeyboardMap,
              mapKeys: this.grandPianoKeyboardMap
                ? Object.keys(this.grandPianoKeyboardMap).length
                : 0,
            });
          })
          .catch((error) => {
            console.error(
              '🗺️ [EARLY-LOAD] ❌ Failed to load keyboard map early:',
              error,
            );
          });
      }
    } else {
      // Try to infer from tracks
      const harmonyTrack = tracks.find((t) => t.instrumentType === 'harmony');
      if (harmonyTrack && (harmonyTrack as any).harmonyInstrument) {
        this.currentHarmonyInstrument = (harmonyTrack as any).harmonyInstrument;
        logger.info(
          `🎹 Inferred harmony instrument from track: ${this.currentHarmonyInstrument}`,
        );

        // CRITICAL FIX: Load keyboard map immediately for Grand Piano
        if (
          this.currentHarmonyInstrument === 'grandpiano' &&
          !this.grandPianoKeyboardMap
        ) {
          console.log(
            '🗺️ [EARLY-LOAD] Loading keyboard map immediately (inferred)...',
          );
          this.loadGrandPianoKeyboardMap()
            .then(() => {
              console.log(
                '🗺️ [EARLY-LOAD] ✅ Keyboard map loaded early (inferred)',
                {
                  hasKeyboardMap: !!this.grandPianoKeyboardMap,
                  mapKeys: this.grandPianoKeyboardMap
                    ? Object.keys(this.grandPianoKeyboardMap).length
                    : 0,
                },
              );
            })
            .catch((error) => {
              console.error(
                '🗺️ [EARLY-LOAD] ❌ Failed to load keyboard map early (inferred):',
                error,
              );
            });
        }
      }
    }

    if (this.isRunning) {
      // FIXED: Add new tracks dynamically without stopping playback
      // This allows harmony to register late without interrupting metronome countdown
      logger.info(
        '⚡ [RegionProcessor] Adding tracks dynamically while running',
        {
          newTracks: tracks.map((t) => t.id),
          existingTracks: Array.from(this.tracks.keys()),
        },
      );

      // CRITICAL FIX: Clear old exercise events before adding new ones
      // This prevents double instrument playback when switching exercises
      tracks.forEach((track) => {
        // Check if this is replacing an existing track
        const existingTrack = this.tracks.get(track.id);
        if (existingTrack) {
          logger.info(`🔄 Replacing existing track: ${track.id}`);

          // Clear scheduled events for this track
          this.clearTrackEvents(track.id);

          // If this is a harmony track, also clear harmony-specific state
          if (track.instrumentType === 'harmony') {
            logger.info('🎹 Clearing harmony-specific state');

            // Clear WamKeyboard events if available
            const harmonyAudioNode = existingTrack as any;
            if (harmonyAudioNode?.audioNode?.clearEvents) {
              harmonyAudioNode.audioNode.clearEvents();
              logger.info('✅ Cleared WamKeyboard events');
            }

            // Clear active harmony sources (sustain pedal state)
            this.activeHarmonySources.clear();
            logger.info('✅ Cleared active harmony sources');

            // Clear CC64 timeline
            this.currentCC64Timeline.clear();
            logger.info('✅ Cleared CC64 timeline');
          }
        }
      });

      // Add new tracks to the registry
      tracks.forEach((track) => {
        this.tracks.set(track.id, track);
        logger.info(
          `📝 [RegionProcessor] Added track dynamically: ${track.id}`,
        );
      });

      // CRITICAL FIX: Actually schedule the new track's events!
      // scheduleAllRegions() already has guard to skip already-scheduled events (line 888-889)
      // This ensures all 129 harmony events get scheduled, not just the 4 in lookahead window
      logger.info(
        '🔄 [RegionProcessor] Scheduling events for newly added tracks',
      );
      this.scheduleAllRegions();

      const totalScheduledEvents = Array.from(
        this.scheduledEvents.values(),
      ).reduce((sum, set) => sum + set.size, 0);
      logger.info('✅ [RegionProcessor] Dynamic track scheduling complete', {
        totalScheduledEvents,
      });
    } else {
      // Not running yet - just register normally
      this.registerTracks(tracks);
    }
  }

  /**
   * Track timing accuracy for each event
   * Phase 2: Delegates to TimingMetricsCollector
   */
  private trackTimingAccuracy(frame: number, transportTime: number): void {
    this.timingMetricsCollector.track(frame, transportTime);
  }

  /**
   * Start periodic metrics reporting
   * Phase 2: Delegates to TimingMetricsCollector
   */
  private startMetricsReporting(): void {
    this.timingMetricsCollector.startReporting();
  }

  /**
   * Stop metrics reporting
   * Phase 2: Delegates to TimingMetricsCollector
   */
  private stopMetricsReporting(): void {
    this.timingMetricsCollector.stopReporting();
  }

  /**
   * Reset timing metrics
   * Phase 2: Delegates to TimingMetricsCollector
   */
  private resetMetrics(): void {
    this.timingMetricsCollector.reset();
  }

  /**
   * Get current timing metrics (public API)
   * Phase 2: Delegates to TimingMetricsCollector
   */
  getTimingMetrics() {
    const metrics = this.timingMetricsCollector.getMetrics();
    return {
      totalEvents: metrics.totalEvents,
      perfectFrames: metrics.perfectFrames,
      accuracy: metrics.accuracy,
      avgJitterMs: metrics.avgJitter,
      maxJitterMs: metrics.maxJitter,
      grade:
        metrics.accuracy >= 99
          ? 'EXCELLENT'
          : metrics.accuracy >= 95
            ? 'GOOD'
            : 'NEEDS_IMPROVEMENT',
      isStable: metrics.accuracy >= 99 && metrics.maxJitter < 0.1,
    };
  }

  /**
   * Convert MIDI note number to note name (e.g., 60 → "C4")
   * Phase 5: Delegated to DiagnosticLogger
   */
  private midiNoteToName(midiNote: number): string {
    return this.diagnosticLogger.midiNoteToName(midiNote);
  }

  /**
   * CC64 COMPREHENSIVE DIAGNOSTIC TABLE
   * Shows exact numbers from database and how CC64 extends each note
   * Phase 5: Delegated to DiagnosticLogger
   */
  private logCC64DiagnosticTable(sortedEvents: any[], region: Region): void {
    // Sync state before logging
    this.diagnosticLogger.setTransportStartTime(this.transportStartTime);
    this.diagnosticLogger.setCountdown(
      this.countdownEnabled,
      this.countdownOffsetBeats,
    );
    this.diagnosticLogger.logCC64DiagnosticTable(sortedEvents, region);
  }
}
