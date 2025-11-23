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
import { ConfigurationManager } from './region-processing/configuration/ConfigurationManager.js';
import { BufferManager } from './region-processing/buffers/BufferManager.js';
import { TimePositionConverter } from './region-processing/timing/TimePositionConverter.js';

// Import extracted modules (Phase 2: Caching + Timing)
import { ScheduleCache } from './region-processing/cache/ScheduleCache.js';
import { TimingMetricsCollector } from './region-processing/timing/TimingMetricsCollector.js';

// Import extracted modules (Phase 3: CC64 Sustain System - Phase 2.1: Merged into SustainPedalManager)
import { SustainPedalManager } from './region-processing/sustain/SustainPedalManager.js';

// Import extracted modules (Phase 4: Schedulers - Phase 3: Simplified)
import { SimpleInstrumentScheduler } from './region-processing/scheduling/SimpleInstrumentScheduler.js';
import { HarmonyScheduler } from './region-processing/scheduling/HarmonyScheduler.js';
// Removed (Phase 4.2): GrandPianoKeyboardMapper merged into HarmonyScheduler

// Import extracted modules (Phase 5: Utilities + Routing)
import { DiagnosticLogger } from './region-processing/diagnostics/DiagnosticLogger.js';
import { VelocityLayerSelector } from './region-processing/harmony/VelocityLayerSelector.js';
// Removed (Phase 4.1): ExerciseDurationCalculator merged into RegionScheduler
// Removed (Phase 4.1): BackupScheduler merged into RegionScheduler
import { EventRouter } from './region-processing/event-routing/EventRouter.js';

// Import extracted modules (Phase 6: Region Scheduling Orchestration)
import { RegionScheduler } from './region-processing/scheduling-orchestrator/RegionScheduler.js';
// Removed: import { PositionParser } // from './region-processing/position/PositionParser.js';
import { TrackManager } from './region-processing/track-management/TrackManager.js';

// Import extracted modules (Phase 7: Lifecycle Management)
import { LifecycleCoordinator } from './region-processing/lifecycle/LifecycleCoordinator.js';
// Removed: import { BufferCoordinator } // from './region-processing/buffers/BufferCoordinator.js';
// Removed: import { ConfigurationCoordinator } // from './region-processing/configuration/ConfigurationCoordinator.js';

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

  // Phase 1: Buffer management delegated to BufferManager
  private bufferManager!: BufferManager; // Initialized in constructor

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

  // Phase 3: CC64 sustain system delegated to SustainPedalManager (Phase 2.1: Merged)
  private sustainPedalManager!: SustainPedalManager; // Initialized in constructor

  // Phase 4: Schedulers (Phase 3: Simplified to use SimpleInstrumentScheduler)
  private voiceCueScheduler!: SimpleInstrumentScheduler; // Voice cue scheduler
  private metronomeScheduler!: SimpleInstrumentScheduler; // Metronome scheduler
  private drumScheduler!: SimpleInstrumentScheduler; // Drum scheduler
  private bassScheduler!: SimpleInstrumentScheduler; // Bass scheduler
  private harmonyScheduler!: HarmonyScheduler; // Harmony scheduler (complex, not simplified)
  // Removed (Phase 4.2): grandPianoKeyboardMapper (merged into HarmonyScheduler)

  // Phase 5: Diagnostic logging delegated to DiagnosticLogger
  private diagnosticLogger!: DiagnosticLogger; // Initialized in constructor

  // Phase 5: Velocity layer selection delegated to VelocityLayerSelector
  private velocityLayerSelector!: VelocityLayerSelector; // Initialized in constructor

  // Phase 4.1: Exercise duration calculation + backup scheduling merged into RegionScheduler
  // Removed: exerciseDurationCalculator (merged into regionScheduler)
  // Removed: backupScheduler (merged into regionScheduler)

  // Phase 5: Event routing and audio scheduling delegated to EventRouter
  private eventRouter!: EventRouter; // Initialized in constructor

  // Phase 6: Region scheduling orchestration delegated to RegionScheduler
  private regionScheduler!: RegionScheduler; // Initialized in constructor

  // Phase 6: Position parsing delegated to PositionParser
  // Removed: private positionParser!: PositionParser; // Initialized in constructor

  // Phase 6: Track management delegated to TrackManager
  private trackManager!: TrackManager; // Initialized in constructor

  // Phase 7: Lifecycle management delegated to LifecycleCoordinator
  private lifecycleCoordinator!: LifecycleCoordinator; // Initialized in constructor

  // Phase 7: Buffer coordination delegated to BufferCoordinator
  // Removed: private bufferCoordinator!: BufferCoordinator; // Initialized in constructor

  // Phase 7: Configuration synchronization delegated to ConfigurationCoordinator
  // Removed: private configurationCoordinator!: ConfigurationCoordinator; // Initialized in constructor

  // Diagnostic: Count logged notes
  private _noteLogCount = 0;

  // Instance tracking for debugging
  private _instanceId = Math.random().toString(36).substring(2, 11);

  // Phase 1: Countdown management delegated to ConfigurationManager
  private configurationManager!: ConfigurationManager; // Initialized in constructor
  // Keep countdownOffsetBeats for backward compatibility (synced from ConfigurationManager)
  private countdownOffsetBeats = 0; // Will be set to time signature numerator (e.g., 4 for 4/4)
  private countdownEnabled = false; // Synced from ConfigurationManager

  // Phase 1: Musical time conversion delegated to TimePositionConverter
  private timePositionConverter!: TimePositionConverter; // Initialized in constructor

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

  // ✅ BUG #7 FIX: Store unsubscribe functions for event listener cleanup
  private unsubscribeTempoChange: (() => void) | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;

    // Phase 1: Instantiate foundation modules
    this.configurationManager = new ConfigurationManager(this._instanceId);
    this.bufferManager = new BufferManager(this._instanceId);
    this.timePositionConverter = new TimePositionConverter();

    // Phase 2: Instantiate caching and timing modules
    this.scheduleCache = new ScheduleCache();
    this.timingMetricsCollector = new TimingMetricsCollector();

    // Phase 3: Instantiate CC64 sustain system (Phase 2.1: Merged into SustainPedalManager)
    this.sustainPedalManager = new SustainPedalManager();
    this.sustainPedalManager.setTimeConverter(this.timePositionConverter); // Inject time converter

    // Phase 4: Instantiate scheduler modules (Phase 3: Using SimpleInstrumentScheduler)
    this.voiceCueScheduler = new SimpleInstrumentScheduler(
      this._instanceId,
      this.tracks,
      {
        loggerName: 'VoiceCueScheduler',
        instrumentType: 'voice-cue',
        eventTypeToBufferKey: { 'voice-cue': 'voice-cue' },
        preserveAttackEnvelope: false,
        baseVolume: 0.9,
      },
    );

    this.metronomeScheduler = new SimpleInstrumentScheduler(
      this._instanceId,
      this.tracks,
      {
        loggerName: 'MetronomeScheduler',
        instrumentType: 'metronome',
        eventTypeToBufferKey: { accent: 'accent', click: 'click' },
        preserveAttackEnvelope: true, // Preserve attack envelope for metronome
        baseVolume: 0.8,
      },
    );

    this.drumScheduler = new SimpleInstrumentScheduler(
      this._instanceId,
      this.tracks,
      {
        loggerName: 'DrumScheduler',
        instrumentType: 'drums',
        eventTypeToBufferKey: { kick: 'kick', snare: 'snare', hihat: 'hihat' },
        preserveAttackEnvelope: false,
        baseVolume: 0.8,
      },
    );

    this.bassScheduler = new SimpleInstrumentScheduler(
      this._instanceId,
      this.tracks,
      {
        loggerName: 'BassScheduler',
        instrumentType: 'bass',
        eventTypeToBufferKey: {}, // Bass uses event.data.note for buffer lookup
        preserveAttackEnvelope: false,
        baseVolume: 0.8,
      },
    );

    // Phase 4.2: GrandPianoKeyboardMapper merged into HarmonyScheduler
    this.harmonyScheduler = new HarmonyScheduler(
      this._instanceId,
      this.tracks,
      this.sustainPedalManager,
      this.sustainPedalManager,
    );

    // Phase 5: Instantiate diagnostic logger
    this.diagnosticLogger = new DiagnosticLogger(
      this._instanceId,
      this.currentCC64Timeline,
      this.parsePosition.bind(this),
      this.findCC64DownDuringNote.bind(this),
      this.findNextCC64Up.bind(this),
    );

    // Phase 5: Instantiate velocity layer selector
    this.velocityLayerSelector = new VelocityLayerSelector(this._instanceId);

    // Phase 4.1: Exercise duration + backup scheduling now in RegionScheduler
    // Removed: exerciseDurationCalculator instantiation
    // Removed: backupScheduler instantiation

    // Phase 5: Instantiate event router
    this.eventRouter = new EventRouter(this._instanceId);
    this.eventRouter.initialize(
      null, // Will be set in setAudioContext
      this.sampleRate,
      this.eventBus,
      this.metronomeScheduler,
      this.drumScheduler,
      this.harmonyScheduler,
      this.bassScheduler,
      this.voiceCueScheduler,
      this.trackTimingAccuracy.bind(this),
    );

    // Phase 6: Instantiate region scheduler
    this.regionScheduler = new RegionScheduler(this._instanceId);

    // Phase 6: Position parser merged into TimePositionConverter (Phase 2.2)
    // (Already initialized in Phase 1)

    // Phase 6: Instantiate track manager
    this.trackManager = new TrackManager(this._instanceId);

    // Phase 7: Instantiate lifecycle coordinator
    this.lifecycleCoordinator = new LifecycleCoordinator(this._instanceId);

    // Phase 7: Buffer coordinator merged into BufferManager (Phase 2.3)
    // (Already initialized in Phase 1)

    // Phase 7: Configuration coordinator merged into ConfigurationManager (Phase 2.4)
    // (Already initialized in Phase 1)

    logger.info('🔧 RegionProcessor instance created', {
      instanceId: this._instanceId,
    });
    this.debugger.log('RegionProcessor', 'initialized');

    // Listen for tempo changes and reschedule events
    // TEMPO CHANGE FIX: Debounce rapid tempo changes to prevent UI freezing
    // ✅ BUG #7 FIX: Store unsubscribe function for cleanup
    this.unsubscribeTempoChange = this.eventBus.on(
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
    // Delegate to ConfigurationManager (Phase 2.4)
    const countdownOffsetBeats = this.configurationManager.enableCountdown(
      timeSignature,
      this.scheduleCache,
      this.sustainPedalManager,
    );
    this.countdownOffsetBeats = countdownOffsetBeats;
  }

  /**
   * Disable countdown pre-roll (all events start at beat 0)
   */
  disableCountdown(): void {
    // Delegate to ConfigurationManager (Phase 2.4)
    this.configurationManager.disableCountdown(
      this.scheduleCache,
      this.sustainPedalManager,
    );
    this.countdownOffsetBeats = 0;
  }

  /**
   * FAANG COUNTDOWN: Add countdown click events at beats 0, 1, 2, 3 (before offset)
   * This creates a synthetic metronome region with countdown clicks
   */
  addCountdownRegion(timeSignature: {
    numerator: number;
    denominator: number;
  }): void {
    // Delegate to ConfigurationManager (Phase 2.4)
    this.configurationManager.addCountdownRegion(this.tracks, timeSignature);
  }

  /**
   * VOICE CUE COUNTDOWN: Add voice cue events ("one", "two", "three", "four") during countdown
   * This creates a synthetic voice-cue region that plays alongside metronome countdown
   */
  addVoiceCountdownRegion(timeSignature: {
    numerator: number;
    denominator: number;
  }): void {
    // Delegate to ConfigurationManager (Phase 2.4)
    this.configurationManager.addVoiceCountdownRegion(
      this.tracks,
      timeSignature,
    );
  }

  /**
   * Set AudioContext for sample-accurate timing
   * CRITICAL: Must be called before start() to enable proper time domain conversion
   */
  setAudioContext(context: AudioContext): void {
    // Delegate to BufferManager (Phase 2.3: merged BufferRegistry + BufferCoordinator)
    const sampleRate = this.bufferManager.setAudioContext(
      context,
      {
        voiceCue: this.voiceCueScheduler,
        metronome: this.metronomeScheduler,
        drum: this.drumScheduler,
        bass: this.bassScheduler,
      },
      this.eventRouter,
      this.eventBus,
      this.harmonyScheduler,
      this.trackTimingAccuracy.bind(this),
      this.timingMetricsCollector,
      this.sustainPedalManager,
    );
    // Update local state
    this.audioContext = context;
    this.sampleRate = sampleRate;
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
    // Delegate to BufferManager (Phase 2.3)
    this.bufferManager.setMetronomeBuffers(
      accent,
      click,
      destination,
      this.metronomeScheduler,
    );
    this.audioDestination = destination;
  }

  setDrumBuffers(
    kick: AudioBuffer,
    snare: AudioBuffer,
    hihat: AudioBuffer,
    destination: AudioNode,
  ): void {
    // Delegate to BufferManager (Phase 2.3)
    this.bufferManager.setDrumBuffers(
      kick,
      snare,
      hihat,
      destination,
      this.drumScheduler,
    );
    // Update local state for backward compatibility
    this.audioDestination = destination;
  }

  setVoiceCueBuffers(
    samples: Map<string, AudioBuffer>,
    destination: AudioNode,
  ): void {
    // Delegate to BufferManager (Phase 2.3)
    this.bufferManager.setVoiceCueBuffers(
      samples,
      destination,
      this.voiceCueScheduler,
    );
    // Update local state for backward compatibility
    this.voiceCueBuffers = samples;
    this.audioDestination = destination;
  }

  async setHarmonyBuffers(
    samples: Map<string, AudioBuffer>,
    destination: AudioNode,
    perNoteVelocityRanges?: Record<string, any[]>,
    instrument?: string,
  ): Promise<void> {
    // Delegate to BufferManager (Phase 2.3)
    const result = await this.bufferManager.setHarmonyBuffers(
      samples,
      destination,
      perNoteVelocityRanges,
      instrument,
      this.harmonyScheduler,
      this.velocityLayerSelector,
    );
    // Update local state for backward compatibility
    this.harmonyBuffers = result.harmonyBuffers;
    this.harmonyVelocityRanges = result.harmonyVelocityRanges;
    this.currentHarmonyInstrument = result.currentHarmonyInstrument;
    this.grandPianoKeyboardMap = result.grandPianoKeyboardMap;
    this.audioDestination = destination;
  }

  setBassBuffers(
    samples: Map<string, AudioBuffer>,
    destination: AudioNode,
  ): void {
    // Delegate to BufferManager (Phase 2.3)
    const result = this.bufferManager.setBassBuffers(
      samples,
      destination,
      this.bassScheduler,
    );
    // Update local state for backward compatibility
    this.bassBuffers = result.bassBuffers;
    this.audioDestination = destination;
  }

  /**
   * Ensure Grand Piano keyboard map is loaded
   */
  private async loadGrandPianoKeyboardMap(): Promise<void> {
    // Delegate to BufferManager (Phase 2.3)
    this.grandPianoKeyboardMap =
      await this.bufferManager.ensureGrandPianoKeyboardMap();
  }

  /**
   * Inject PluginManager for accessing WAM instruments
   * Used to route control change events (e.g., sustain pedal) to WamKeyboard
   */
  setPluginManager(pluginManager: PluginManager): void {
    this.pluginManager = pluginManager;
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
   *
   * IMPORTANT: Only ONE track per instrument type is allowed
   * If a track with the same instrument type exists, it will be replaced
   */
  registerTracks(tracks: Track[]): void {
    // Delegate to TrackManager (was Phase 8)
    this.trackManager.registerTracks(
      tracks,
      this.tracks,
      this.scheduledEvents,
      this.clearTrackEvents.bind(this),
      this.clearHarmonyState.bind(this),
      this.debugger.log.bind(this.debugger),
    );

    // Validate harmony track uniqueness (was in TrackRegistrationService)
    this.validateHarmonyTrackUniqueness();
  }

  /**
   * Validate that only ONE harmony track is registered
   * This is an architectural invariant that must be maintained
   */
  private validateHarmonyTrackUniqueness(): void {
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
          instanceId: this._instanceId,
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
      logger.debug('Single harmony track validated', {
        instanceId: this._instanceId,
        trackId: registeredHarmonyTracks[0].id,
      });
    }
  }

  /**
   * Helper: Clear harmony-specific state
   * Phase 6: Used by TrackManager when replacing harmony tracks
   */
  private clearHarmonyState(): void {
    this.activeHarmonySources.clear();
    this.currentCC64Timeline.clear();
  }

  /**
   * Start processing regions
   */
  start(): void {
    // Phase 7: Delegate lifecycle management to LifecycleCoordinator
    const result = this.lifecycleCoordinator.start(
      this.isRunning,
      this.audioContext,
      this.sampleRate,
      this.tracks,
      this.metronomeBuffers,
      this.audioDestination,
      this.scheduledIds,
      this.scheduledEvents,
      this.scheduleInterval,
      this.isInitialScheduling,

      // Dependencies
      (context) => {
        this.audioContext = context;
      },
      (rate) => {
        this.sampleRate = rate;
      },
      (time) => {
        this.transportStartTime = time;
      },
      (time) => {
        // Sync transport start time to all modules
        this.timingMetricsCollector.setTransportStartTime(time);
        this.sustainPedalManager.setTransportStartTime(time);
        this.harmonyScheduler.setAudioContext(this.audioContext!, time);
        this.eventRouter.setTransportStartTime(time);
      },
      () => {
        // Clear scheduled state
        this.scheduledIds.clear();
        this.scheduledEvents.clear();
      },
      () => {
        this.resetMetrics();
      },
      () => {
        this.startMetricsReporting();
      },
      () => {
        this.scheduleAllRegions();
      },
      () => {
        return this.debugger;
      },
      () => {
        this.processCurrentPosition();
      },
    );

    // Update state from result
    this.isRunning = result.isRunning;
    this.transportStartTime = result.transportStartTime;
    this.scheduleInterval = result.scheduleInterval;
    this.isInitialScheduling = result.isInitialScheduling;
    this.lastProcessedPosition = -1;
  }

  /**
   * Stop the region processor
   * @param graceful - If true, allow one-shot samples (drums, metronome) to finish naturally.
   *                   If false (manual stop), force-stop ALL audio immediately for instant silence.
   *                   Default: false (manual stop behavior)
   */
  stop(graceful = false): void {
    // Phase 7: Delegate lifecycle management to LifecycleCoordinator
    const result = this.lifecycleCoordinator.stop(
      graceful,
      this.isRunning,
      this.scheduleInterval,
      this.scheduledIds,
      this.scheduledEvents,
      this.currentCC64Timeline,
      this.activeHarmonySources,
      this.activeBassSources,
      this.scheduledAudioSources,
      this.tracks,
      this.audioContext,

      // Dependencies
      () => {
        return this.getTimingMetrics();
      },
      () => {
        this.stopMetricsReporting();
      },
    );

    // Update state from result
    this.isRunning = result.isRunning;
    this.scheduleInterval = result.scheduleInterval;
    this.lastProcessedPosition = result.lastProcessedPosition;
  }

  /**
   * Reschedule all pending events when tempo changes during playback
   *
   * TEMPO CHANGE FIX: FAANG-style instant tempo change implementation
   * - Stops all scheduled audio sources immediately
   * - Recalculates transportStartTime anchor to maintain sync
   * - Reschedules with new tempo timing
   */
  private reschedulePendingEvents(): void {
    if (!this.isRunning) {
      logger.warn('⚠️ Cannot reschedule events - not running', {
        instanceId: this._instanceId,
      });
      return;
    }

    // STEP 1: Stop all currently scheduled audio sources
    this.scheduledAudioSources.forEach((metadata, source) => {
      if (!metadata.hasStopScheduled && source.context.state === 'running') {
        try {
          source.stop();
        } catch (e) {
          // Already stopped - ignore
        }
      }
    });
    this.scheduledAudioSources.clear();

    // STEP 2: Recalculate transportStartTime anchor
    const currentTransportTime = Tone.Transport.seconds;
    const currentAudioTime = this.audioContext?.currentTime || 0;
    this.transportStartTime = currentAudioTime - currentTransportTime;

    // STEP 3: Clear scheduled events
    this.scheduledEvents.clear();

    // STEP 4: Reschedule with new tempo
    this.scheduleAllRegions();
  }

  /**
   * Calculate total exercise duration and identify the last beat
   * Used to detect which notes should have extended ring-out
   */
  private calculateExerciseDuration(): void {
    // Phase 4.1: Use RegionScheduler's calculateDuration method
    const result = this.regionScheduler.calculateDuration(
      Array.from(this.tracks.values()) as any,
      this.configurationManager.isCountdownEnabled(),
      this.countdownOffsetBeats,
    );

    this.exerciseEndTime = result.exerciseEndTime;
    this.lastBeatThreshold = result.lastBeatThreshold;
  }

  /**
   * Schedule all regions using Tone.js Transport
   * TEMPO CHANGE FIX: Protected by scheduling lock to prevent race conditions
   */
  private scheduleAllRegions(): void {
    // Prevent concurrent scheduling
    if (this.isScheduling) {
      logger.error('🚨 Scheduling already in progress!', {
        instanceId: this._instanceId,
      });
      return;
    }

    try {
      this.isScheduling = true;

      // Delegate to RegionScheduler (was Phase 8)
      const result = this.regionScheduler.scheduleAll(
        this.tracks,
        this.scheduledEvents,
        this.countdownEnabled,
        this.countdownOffsetBeats,
        this.transportStartTime,
        this.audioContext,
        // Dependencies
        this.getInstrumentType.bind(this),
        this.timePositionConverter.parsePositionToObject.bind(
          this.timePositionConverter,
        ),
        this.timePositionConverter.parsePosition.bind(
          this.timePositionConverter,
        ),
        this.sustainPedalManager.buildTimeline.bind(this.sustainPedalManager),
        this.logCC64DiagnosticTable.bind(this),
        this.scheduleCache.get.bind(this.scheduleCache),
        this.scheduleCache.set.bind(this.scheduleCache),
        this.eventRouter.emitEvent.bind(this.eventRouter),
        (timeline: Map<number, boolean>) => {
          this.currentCC64Timeline = timeline;
        },
        this.calculateExerciseDuration.bind(this),
      );

      // Update state
      this.currentCC64Timeline = result.currentCC64Timeline;
    } finally {
      this.isScheduling = false;
    }
  }

  /**
   * Process current transport position (backup method)
   */
  private processCurrentPosition(): void {
    // Phase 4.1: Use RegionScheduler's processPosition method
    this.regionScheduler.processPosition(
      this.isRunning,
      Array.from(this.tracks.values()) as any,
      this.scheduledEvents,
      this.scheduledIds,
      this.configurationManager.isCountdownEnabled(),
      this.countdownOffsetBeats,
      this.parsePosition.bind(this),
      this.getInstrumentType.bind(this) as any,
      this.eventRouter.emitEvent.bind(this.eventRouter),
    );
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
  /**
   * Parse position to absolute time in seconds
   * Phase 6: Delegates to PositionParser
   */
  private parsePosition(
    position:
      | string
      | { measure: number; beat: number; subdivision: number; tick?: number },
  ): number {
    return this.timePositionConverter.parsePosition(position);
  }

  /**
   * Parse position into comparable object structure for sorting
   * Phase 6: Delegates to PositionParser
   */
  private parsePositionToObject(
    position:
      | string
      | { measure: number; beat: number; subdivision?: number; tick?: number },
  ): { measure: number; beat: number; subdivision: number; tick: number } {
    return this.timePositionConverter.parsePositionToObject(position);
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
    return this.velocityLayerSelector.getLayerForNoteVelocity(
      noteName,
      velocity,
    );
  }

  /**
   * Detect if the loaded harmony instrument uses sparse sampling (like Grand Piano)
   * by checking if ANY octave has all 12 chromatic notes
   * @returns true if sparse (Grand Piano), false if full chromatic (Wurlitzer)
   */
  private detectSparseSampling(): boolean {
    return this.velocityLayerSelector.detectSparseSampling();
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
    return this.sustainPedalManager.buildTimeline(events, region);
  }

  /**
   * Check if sustain pedal is down at a specific time
   * Phase 3: Delegated to SustainPedalAnalyzer
   */
  private isPedalDownAtTime(
    time: number,
    cc64Timeline: Map<number, boolean>,
  ): boolean {
    return this.sustainPedalManager.isPedalDownAtTime(time, cc64Timeline);
  }

  /**
   * Find the next CC64 UP event after a given time
   * Phase 3: Delegated to SustainPedalAnalyzer
   */
  private findNextCC64Up(
    noteStartTime: number,
    cc64Timeline: Map<number, boolean>,
  ): number | null {
    return this.sustainPedalManager.findNextCC64Up(noteStartTime, cc64Timeline);
  }

  /**
   * Check if MIDI note-off happens at/near exercise end (held by hand)
   * Phase 3: Delegated to SustainPedalAnalyzer
   */
  private isNoteHeldUntilExerciseEnd(midiNoteEndTime: number): boolean {
    return this.sustainPedalManager.isNoteHeldUntilExerciseEnd(midiNoteEndTime);
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
    return this.sustainPedalManager.findCC64DownDuringNote(
      noteStart,
      noteEnd,
      timeline,
    );
  }

  // ============================================================================

  /**
   * Emit the appropriate event based on instrument type
   * Phase 5: Delegated to EventRouter
   *
   * CRITICAL TIME DOMAIN CONVERSION:
   * 'time' parameter is in TRANSPORT TIME (musical beats: 0, 0.5, 1, 1.5...)
   * EventRouter handles conversion to AUDIO CONTEXT TIME (hardware clock)
   */
  private emitEvent(
    instrumentType: string,
    event: PatternEvent,
    time: number,
  ): void {
    this.eventRouter.emitEvent(instrumentType, event, time);
  }

  /**
   * Clear all scheduled events for a specific track
   * Phase 6: Delegated to TrackManager
   *
   * Used when switching exercises to prevent old exercise events from playing
   *
   * @param trackId - ID of the track to clear
   */
  private clearTrackEvents(trackId: string): void {
    this.trackManager.clearTrackEvents(trackId, this.scheduledEvents);
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
   * Update current CC64 timeline and sync to HarmonyScheduler
   * Phase 6: Helper for RegionScheduler
   */
  private setCurrentCC64Timeline(timeline: Map<number, boolean>): void {
    this.currentCC64Timeline = timeline;
    this.harmonyScheduler.setCurrentCC64Timeline(timeline);
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
   *
   * CRITICAL: When running, adds tracks WITHOUT stopping/restarting
   * This prevents interrupting countdown and causing abrupt restarts
   */
  updateTracks(
    tracks: Track[],
    exerciseMetadata?: { harmonyInstrument?: string },
  ): void {
    // Delegate to TrackManager (was Phase 8)
    this.trackManager.updateTracks(
      tracks,
      exerciseMetadata,
      this.isRunning,
      this.tracks,
      this.scheduledEvents,
      this.clearTrackEvents.bind(this),
      this.clearHarmonyState.bind(this),
      this.registerTracks.bind(this),
      this.scheduleAllRegions.bind(this),
      this.loadGrandPianoKeyboardMap.bind(this),
      () => this.grandPianoKeyboardMap,
      (instrument) => {
        this.currentHarmonyInstrument = instrument;
      },
      this.debugger.log.bind(this.debugger),
    );
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

  // ============================================================================
  // CLEANUP AND DISPOSAL
  // ============================================================================

  /**
   * ✅ BUG #7 FIX: Dispose method to clean up event listeners and prevent memory leaks
   *
   * This method should be called when RegionProcessor is no longer needed.
   * Cleans up:
   * - EventBus subscriptions (tempo-change listener)
   * - Debounce timers
   *
   * Note: Audio sources are cleaned up separately in BUG #3 fix
   */
  dispose(): void {
    logger.info('🧹 RegionProcessor: Disposing instance', {
      instanceId: this._instanceId,
      hadTempoListener: !!this.unsubscribeTempoChange,
      hadDebounceTimer: !!this.tempoChangeDebounce,
    });

    // Unsubscribe from tempo-change events
    if (this.unsubscribeTempoChange) {
      this.unsubscribeTempoChange();
      this.unsubscribeTempoChange = null;
      logger.info('✅ RegionProcessor: Unsubscribed from tempo-change events');
    }

    // Clear any pending debounce timer
    if (this.tempoChangeDebounce) {
      clearTimeout(this.tempoChangeDebounce);
      this.tempoChangeDebounce = null;
      logger.info('✅ RegionProcessor: Cleared tempo debounce timer');
    }

    logger.info('✅ RegionProcessor: Disposal complete', {
      instanceId: this._instanceId,
    });
  }
}
