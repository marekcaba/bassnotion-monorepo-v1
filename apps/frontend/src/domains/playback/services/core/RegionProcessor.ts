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
import grandPianoKeyboardMap from '../../data/instruments/piano/grandpiano-keyboard-map.json';
import { GlobalSampleCache } from '../../modules/storage/cache/GlobalSampleCache.js';

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

interface TransportPosition {
  bars: number;
  beats: number;
  sixteenths: number;
  seconds: number;
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
  }

  setDrumBuffers(
    kick: AudioBuffer,
    snare: AudioBuffer,
    hihat: AudioBuffer,
    destination: AudioNode,
  ): void {
    this.bufferRegistry.setDrumBuffers(kick, snare, hihat, destination);
    this.audioDestination = this.bufferRegistry.getAudioDestination();
  }

  setVoiceCueBuffers(
    samples: Map<string, AudioBuffer>,
    destination: AudioNode,
  ): void {
    this.bufferRegistry.setVoiceCueBuffers(samples, destination);
    this.voiceCueBuffers = samples; // Sync for backward compat (used by scheduling logic)
    this.audioDestination = this.bufferRegistry.getAudioDestination();
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
  }

  setBassBuffers(
    samples: Map<string, AudioBuffer>,
    destination: AudioNode,
  ): void {
    this.bufferRegistry.setBassBuffers(samples, destination);
    this.bassBuffers = this.bufferRegistry.getBassBuffers(); // Sync for backward compat
    this.audioDestination = this.bufferRegistry.getAudioDestination();
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

  private scheduleMetronomeDirect(
    event: PatternEvent,
    audioTime: number,
    frame: number,
  ): boolean {
    // DEFENSIVE CHECK: Detect if multiple metronome tracks are trying to schedule
    // This should never happen with our safeguards, but log a critical error if it does
    const metronomeTrackCount = Array.from(this.tracks.values()).filter(
      (t) => t.instrumentType === 'metronome',
    ).length;

    if (metronomeTrackCount > 1) {
      logger.error('🚨 CRITICAL: Multiple metronome tracks detected!', {
        trackCount: metronomeTrackCount,
        trackIds: Array.from(this.tracks.entries())
          .filter(([, t]) => t.instrumentType === 'metronome')
          .map(([id]) => id),
        instanceId: this._instanceId,
      });
      // Continue anyway, but this indicates a bug in track registration
    }

    // Check if we have the necessary buffers and destination
    if (
      !this.audioContext ||
      !this.audioDestination ||
      !this.metronomeBuffers.accent ||
      !this.metronomeBuffers.click
    ) {
      logger.warn(
        '❌ FAANG: Cannot use direct scheduling - missing metronome dependencies',
        {
          hasAudioContext: !!this.audioContext,
          hasDestination: !!this.audioDestination,
          hasAccentBuffer: !!this.metronomeBuffers.accent,
          hasClickBuffer: !!this.metronomeBuffers.click,
          instanceId: this._instanceId,
        },
      );
      return false; // Fall back to event bus
    }

    // Select buffer based on event type
    const buffer =
      event.type === 'accent'
        ? this.metronomeBuffers.accent
        : this.metronomeBuffers.click;
    const velocity = event.velocity || 0.8;

    try {
      // Capture scheduling time for accuracy measurement
      const scheduleTime = this.audioContext.currentTime;
      const scheduleFrame = Math.round(scheduleTime * this.sampleRate);

      // DIAGNOSTIC: Analyze buffer for silence at start
      let silentSamplesAtStart = 0;
      let firstAudibleSampleTime = 0;
      if (buffer.getChannelData(0)) {
        const channelData = buffer.getChannelData(0);
        // Metronome clicks have intentional attack envelope (gradual fade-in)
        // Use higher threshold to only skip TRUE digital silence, not quiet audio
        const threshold = 0.01; // Higher threshold for metronome to preserve attack envelope
        for (let i = 0; i < Math.min(1000, channelData.length); i++) {
          if (Math.abs(channelData[i]) > threshold) {
            break;
          }
          silentSamplesAtStart++;
        }
        firstAudibleSampleTime =
          (silentSamplesAtStart / buffer.sampleRate) * 1000; // ms
      }

      // Create audio source node
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      // Create gain for velocity control
      const velocityGain = this.audioContext.createGain();
      const baseVolume = 0.8;
      velocityGain.gain.value = velocity * baseVolume;

      // Connect: source → gain → destination
      source.connect(velocityGain);
      velocityGain.connect(this.audioDestination);

      // CRITICAL: Schedule start at EXACT audio time (sample-perfect)
      // METRONOME FIX: DO NOT skip samples - metronome has intentional attack envelope
      // The quiet samples at start are part of the sound design, not silence to be trimmed
      const offsetSeconds = 0; // Always 0 for metronome to preserve attack envelope
      const sourceStartCallTime = performance.now();
      source.start(audioTime, offsetSeconds);
      const sourceStartCallEnd = performance.now();

      // Store for cleanup - metronome is a one-shot sample
      this.scheduledAudioSources.set(source, {
        type: 'one-shot',
        hasStopScheduled: false,
      });

      // Log scheduling with timing details for debugging
      const frameDelta = frame - scheduleFrame;
      const timeDelta = (frameDelta / this.sampleRate) * 1000; // ms
      logger.info(
        `🎯 FAANG: Direct audio scheduled - metronome ${event.type}`,
        {
          targetFrame: frame,
          targetTime: audioTime.toFixed(6),
          scheduleFrame,
          scheduleTime: scheduleTime.toFixed(6),
          lookAhead: `${timeDelta.toFixed(2)}ms (${frameDelta} frames)`,
          sourceStartCallDuration: `${(sourceStartCallEnd - sourceStartCallTime).toFixed(3)}ms`,
          jsExecutionTime: performance.now(),
          bufferAnalysis: {
            silentSamplesAtStart,
            firstAudibleSampleTime: `${firstAudibleSampleTime.toFixed(2)}ms`,
            bufferDuration: `${(buffer.duration * 1000).toFixed(2)}ms`,
            offsetApplied: `${(offsetSeconds * 1000).toFixed(2)}ms`,
          },
        },
      );

      // Auto-cleanup after playback
      source.onended = () => {
        this.scheduledAudioSources.delete(source);
        velocityGain.disconnect();
      };

      return true; // Successfully scheduled directly
    } catch (error) {
      logger.error('Failed to schedule metronome audio directly', error);
      return false; // Fall back to event bus
    }
  }

  private scheduleDrumDirect(
    event: PatternEvent,
    audioTime: number,
    frame: number,
  ): boolean {
    // DEFENSIVE CHECK: Detect if multiple drum tracks are trying to schedule
    const drumTrackCount = Array.from(this.tracks.values()).filter(
      (t) => t.instrumentType === 'drums',
    ).length;

    if (drumTrackCount > 1) {
      logger.error('🚨 CRITICAL: Multiple drum tracks detected!', {
        trackCount: drumTrackCount,
        trackIds: Array.from(this.tracks.entries())
          .filter(([, t]) => t.instrumentType === 'drums')
          .map(([id]) => id),
        instanceId: this._instanceId,
      });
    }

    // Check if we have the necessary buffers and destination
    if (!this.audioContext || !this.audioDestination) {
      logger.warn(
        '❌ FAANG: Cannot use direct scheduling - missing drum dependencies',
        {
          hasAudioContext: !!this.audioContext,
          hasDestination: !!this.audioDestination,
          instanceId: this._instanceId,
        },
      );
      return false;
    }

    // Map drum type to buffer
    // Check multiple possible locations: type, drum field (DrumPatternEvent), or data.drum
    const drumType = event.type || (event as any).drum || event.data?.drum;

    logger.info(`🥁 Processing drum event`, {
      drumType,
      hasType: !!event.type,
      hasDrumField: !!(event as any).drum,
      hasDataDrum: !!event.data?.drum,
      eventKeys: Object.keys(event),
    });

    let buffer: AudioBuffer | null = null;

    switch (drumType) {
      case 'kick':
        buffer = this.drumBuffers.kick;
        break;
      case 'snare':
        buffer = this.drumBuffers.snare;
        break;
      case 'hihat':
        buffer = this.drumBuffers.hihat;
        break;
      default:
        logger.debug(`❌ FAANG: Unknown drum type: ${drumType}`);
        return false;
    }

    if (!buffer) {
      logger.warn(`❌ FAANG: No buffer for drum type: ${drumType}`, {
        drumType,
        hasKick: !!this.drumBuffers.kick,
        hasSnare: !!this.drumBuffers.snare,
        hasHihat: !!this.drumBuffers.hihat,
      });
      return false;
    }

    const velocity = event.velocity || 0.8;

    try {
      // Capture scheduling time for accuracy measurement
      const scheduleTime = this.audioContext.currentTime;
      const scheduleFrame = Math.round(scheduleTime * this.sampleRate);

      // DIAGNOSTIC: Analyze buffer for silence at start
      let silentSamplesAtStart = 0;
      let firstAudibleSampleTime = 0;
      if (buffer.getChannelData(0)) {
        const channelData = buffer.getChannelData(0);
        const threshold = 0.001; // Consider anything below this as silence
        for (let i = 0; i < Math.min(1000, channelData.length); i++) {
          if (Math.abs(channelData[i]) > threshold) {
            break;
          }
          silentSamplesAtStart++;
        }
        firstAudibleSampleTime =
          (silentSamplesAtStart / buffer.sampleRate) * 1000; // ms
      }

      // Create audio source node
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      // Create gain for velocity control
      const velocityGain = this.audioContext.createGain();
      const baseVolume = 0.7; // Slightly quieter for drums
      velocityGain.gain.value = velocity * baseVolume;

      // Connect: source → gain → destination
      source.connect(velocityGain);
      velocityGain.connect(this.audioDestination);

      // CRITICAL: Schedule start at EXACT audio time (sample-perfect)
      // FAANG FIX: Skip silent samples at the beginning for perfect sync with metronome
      const offsetSeconds = silentSamplesAtStart / buffer.sampleRate;
      const sourceStartCallTime = performance.now();
      source.start(audioTime, offsetSeconds);
      const sourceStartCallEnd = performance.now();

      // Store for cleanup - drums are one-shot samples
      this.scheduledAudioSources.set(source, {
        type: 'one-shot',
        hasStopScheduled: false,
      });

      // Log scheduling with timing details
      const frameDelta = frame - scheduleFrame;
      const timeDelta = (frameDelta / this.sampleRate) * 1000; // ms
      logger.info(`🎯 FAANG: Direct audio scheduled - drum ${drumType}`, {
        targetFrame: frame,
        targetTime: audioTime.toFixed(6),
        scheduleFrame,
        scheduleTime: scheduleTime.toFixed(6),
        lookAhead: `${timeDelta.toFixed(2)}ms (${frameDelta} frames)`,
        sourceStartCallDuration: `${(sourceStartCallEnd - sourceStartCallTime).toFixed(3)}ms`,
        jsExecutionTime: performance.now(),
        bufferAnalysis: {
          silentSamplesAtStart,
          firstAudibleSampleTime: `${firstAudibleSampleTime.toFixed(2)}ms`,
          bufferDuration: `${(buffer.duration * 1000).toFixed(2)}ms`,
          offsetApplied: `${(offsetSeconds * 1000).toFixed(2)}ms`,
        },
      });

      // Auto-cleanup after playback
      source.onended = () => {
        this.scheduledAudioSources.delete(source);
        velocityGain.disconnect();
      };

      return true; // Successfully scheduled directly
    } catch (error) {
      logger.error(
        `Failed to schedule drum audio directly (${drumType})`,
        error,
      );
      return false; // Fall back to event bus
    }
  }

  private scheduleVoiceCueDirect(
    event: PatternEvent,
    audioTime: number,
    frame: number,
  ): boolean {
    // Check if we have the necessary buffers and destination
    if (!this.audioContext || !this.audioDestination) {
      logger.warn(
        '❌ FAANG: Cannot use direct scheduling - missing voice cue dependencies',
        {
          hasAudioContext: !!this.audioContext,
          hasDestination: !!this.audioDestination,
          instanceId: this._instanceId,
        },
      );
      return false;
    }

    // Get the cue name from event data (e.g., "one", "two", "three", "four")
    const cueName = event.data?.cue;

    if (!cueName) {
      logger.warn('❌ FAANG: Voice cue event missing cue name', {
        eventData: event.data,
        eventType: event.type,
      });
      return false;
    }

    // Get the buffer for this cue
    const buffer = this.voiceCueBuffers.get(cueName);

    if (!buffer) {
      logger.warn(`❌ FAANG: No buffer for voice cue: ${cueName}`, {
        cueName,
        availableCues: Array.from(this.voiceCueBuffers.keys()),
      });
      return false;
    }

    const velocity = event.velocity || 1.0;

    try {
      // Capture scheduling time for accuracy measurement
      const scheduleTime = this.audioContext.currentTime;
      const scheduleFrame = Math.round(scheduleTime * this.sampleRate);

      // Analyze buffer for silence at start
      let silentSamplesAtStart = 0;
      let firstAudibleSampleTime = 0;
      if (buffer.getChannelData(0)) {
        const channelData = buffer.getChannelData(0);
        const threshold = 0.001;
        for (let i = 0; i < Math.min(1000, channelData.length); i++) {
          if (Math.abs(channelData[i]) > threshold) {
            break;
          }
          silentSamplesAtStart++;
        }
        firstAudibleSampleTime =
          (silentSamplesAtStart / buffer.sampleRate) * 1000;
      }

      // Create audio source node
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      // Create gain for velocity control
      const velocityGain = this.audioContext.createGain();
      const baseVolume = 0.45; // Voice cues at moderate volume (5dB quieter than metronome)
      velocityGain.gain.value = velocity * baseVolume;

      // Connect: source → gain → destination
      source.connect(velocityGain);
      velocityGain.connect(this.audioDestination);

      // Schedule start at EXACT audio time (sample-perfect)
      // Skip silent samples at the beginning for perfect sync
      const offsetSeconds = silentSamplesAtStart / buffer.sampleRate;
      const sourceStartCallTime = performance.now();
      source.start(audioTime, offsetSeconds);
      const sourceStartCallEnd = performance.now();

      // Store for cleanup - voice cues are one-shot samples
      this.scheduledAudioSources.set(source, {
        type: 'one-shot',
        hasStopScheduled: false,
      });

      // Log scheduling with timing details
      const frameDelta = frame - scheduleFrame;
      const timeDelta = (frameDelta / this.sampleRate) * 1000;
      logger.info(`🎯 FAANG: Direct audio scheduled - voice cue "${cueName}"`, {
        cueName,
        targetFrame: frame,
        targetTime: audioTime.toFixed(6),
        scheduleFrame,
        scheduleTime: scheduleTime.toFixed(6),
        lookAhead: `${timeDelta.toFixed(2)}ms (${frameDelta} frames)`,
        sourceStartCallDuration: `${(sourceStartCallEnd - sourceStartCallTime).toFixed(3)}ms`,
        jsExecutionTime: performance.now(),
        bufferAnalysis: {
          silentSamplesAtStart,
          firstAudibleSampleTime: `${firstAudibleSampleTime.toFixed(2)}ms`,
          bufferDuration: `${(buffer.duration * 1000).toFixed(2)}ms`,
          offsetApplied: `${(offsetSeconds * 1000).toFixed(2)}ms`,
        },
      });

      // Auto-cleanup after playback
      source.onended = () => {
        this.scheduledAudioSources.delete(source);
        velocityGain.disconnect();
      };

      return true; // Successfully scheduled directly
    } catch (error) {
      logger.error(
        `Failed to schedule voice cue audio directly (${cueName})`,
        error,
      );
      return false; // Fall back to event bus
    }
  }

  private scheduleHarmonyDirect(
    event: PatternEvent,
    audioTime: number,
    frame: number,
  ): boolean {
    // 🚨 CRITICAL DIAGNOSTIC: This should ALWAYS log when harmony plays
    console.log(
      '🚨🚨🚨 scheduleHarmonyDirect() ENTRY - HARMONY AUDIO PATH ACTIVATED',
      {
        eventType: event.type,
        hasData: !!event.data,
        dataKeys: event.data ? Object.keys(event.data) : [],
        audioTime: audioTime.toFixed(3),
        frame,
        timestamp: Date.now(),
      },
    );

    // DEFENSIVE CHECK: Detect if multiple harmony tracks are trying to schedule
    const harmonyTrackCount = Array.from(this.tracks.values()).filter(
      (t) => t.instrumentType === 'harmony',
    ).length;

    if (harmonyTrackCount > 1) {
      logger.error('🚨 CRITICAL: Multiple harmony tracks detected!', {
        trackCount: harmonyTrackCount,
        trackIds: Array.from(this.tracks.entries())
          .filter(([, t]) => t.instrumentType === 'harmony')
          .map(([id]) => id),
        instanceId: this._instanceId,
      });
    }

    // NEW: Check event type - control change, MIDI note, or chord symbol
    const eventData = event.data as any;

    console.log(
      `[HARMONY EVENT DEBUG] Received event type: "${event.type}", has cc: ${eventData?.cc !== undefined}, cc value: ${eventData?.cc}`,
    );

    // Handle control change events (sustain pedal, expression, etc.)
    if (
      event.type === 'harmony-control-change' &&
      eventData?.cc !== undefined
    ) {
      console.log(
        `[HARMONY EVENT DEBUG] ✅ Matched harmony-control-change, CC = ${eventData.cc}`,
      );
      if (eventData.cc === 64) {
        // CC64 = Sustain Pedal
        // Using pre-calculated timeline approach - real-time events are logged but not processed
        // Sustain duration is calculated upfront when notes are scheduled (see buildCC64Timeline)
        console.log(
          `[CC64 EVENT] Pedal ${eventData.value >= 64 ? 'DOWN' : 'UP'} @ ${audioTime.toFixed(3)}s (value=${eventData.value}) - Pre-calculated in timeline`,
        );
        return true; // Event acknowledged
      } else {
        logger.debug(`Unsupported CC${eventData.cc} - only CC64 implemented`);
        return false;
      }
    }

    if (eventData?.midiNote !== undefined) {
      console.log(
        '✅ Taking MIDI NOTE path - calling scheduleHarmonyMidiNoteDirect',
        {
          midiNote: eventData.midiNote,
          eventType: event.type,
        },
      );
      // CRITICAL FIX: Schedule MIDI notes directly (like drummer) instead using Tone.js
      // This allows us to call source.stop(0) when stop button is clicked
      // Previous implementation used WamKeyboard + Tone.js which hid the AudioBufferSourceNode handles
      return this.scheduleHarmonyMidiNoteDirect(event, audioTime, frame);
    }

    // Original chord scheduling logic
    console.log('⚠️ Taking OLD CHORD path (not MIDI notes)', {
      eventType: event.type,
      eventData,
    });
    if (!this.audioContext || !this.audioDestination) {
      logger.warn(
        '❌ FAANG: Cannot use direct scheduling - missing harmony dependencies',
        {
          hasAudioContext: !!this.audioContext,
          hasDestination: !!this.audioDestination,
          instanceId: this._instanceId,
        },
      );
      return false;
    }

    // Parse chord into individual notes
    const {
      parseChord,
      mapVelocityToLayer,
      parseDuration,
    } = require('@/domains/playback/utils/chordParser.js');

    const chordData = event.data as any;
    const chordSymbol = event.type || chordData?.chord;

    if (!chordSymbol) {
      logger.warn('❌ FAANG: No chord symbol in harmony event');
      return false;
    }

    const notes = parseChord(chordSymbol, 4); // Base octave 4
    const layer = mapVelocityToLayer(event.velocity || 0.7);
    const duration = parseDuration(event.duration, 120); // TODO: Get BPM from transport

    const sources: AudioBufferSourceNode[] = [];
    let successCount = 0;

    for (const note of notes) {
      const buffer = this.harmonyBuffers.get(layer)?.get(note);

      if (!buffer) {
        logger.debug(`❌ FAANG: Missing buffer for ${layer}/${note}`);
        continue; // Try remaining notes
      }

      try {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;

        const gain = this.audioContext.createGain();
        gain.gain.value = (event.velocity || 0.7) * 0.5;

        source.connect(gain);
        gain.connect(this.audioDestination);

        source.start(audioTime);
        if (duration > 0) {
          source.stop(audioTime + duration);
        }

        sources.push(source);
        successCount++;

        // Auto-cleanup
        source.onended = () => {
          gain.disconnect();
        };
      } catch (error) {
        logger.error(`Failed to schedule harmony note ${note}`, error);
      }
    }

    if (successCount === 0) {
      logger.warn(
        `❌ FAANG: No harmony notes scheduled for chord ${chordSymbol}`,
      );
      return false; // Fall back to event bus
    }

    // Track active sources for cleanup
    const chordId = `chord-${frame}`;
    this.activeHarmonySources.set(chordId, sources);

    const scheduleTime = this.audioContext.currentTime;
    const scheduleFrame = Math.round(scheduleTime * this.sampleRate);
    const frameDelta = frame - scheduleFrame;
    const timeDelta = (frameDelta / this.sampleRate) * 1000;

    logger.info(`🎯 FAANG: Harmony chord scheduled - ${chordSymbol}`, {
      notes: notes.length,
      scheduled: successCount,
      layer,
      duration: `${duration.toFixed(3)}s`,
      targetFrame: frame,
      targetTime: audioTime.toFixed(6),
      scheduleFrame,
      lookAhead: `${timeDelta.toFixed(2)}ms`,
    });

    return true;
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
   * Schedule individual MIDI note for harmony directly using AudioBufferSourceNode
   * CRITICAL FIX: Same architecture as drummer - bypasses Tone.js for instant stop capability
   * This method schedules harmony samples the same way drummer samples are scheduled
   */
  private scheduleHarmonyMidiNoteDirect(
    event: PatternEvent,
    audioTime: number,
    frame: number,
  ): boolean {
    // DIAGNOSTIC: Log every harmony note scheduling to identify dual playback source
    console.log('[PLAYBACK-PATH] RegionProcessor scheduling harmony note:', {
      instrument: this.currentHarmonyInstrument,
      midiNote: (event.data as any)?.midiNote,
      audioTime: audioTime.toFixed(3),
      frame,
    });

    if (!this.audioContext || !this.audioDestination) {
      console.log('❌ EARLY RETURN: missing audio dependencies');
      logger.warn(
        '❌ Cannot schedule harmony MIDI note - missing audio dependencies',
      );
      return false;
    }

    // CRITICAL DIAGNOSTIC: Log instrument state at scheduling time (first note only)
    if (this._noteLogCount === 0) {
      console.log('[HARMONY-SCHEDULE-START] 🎹 Instrument state:', {
        currentInstrument: this.currentHarmonyInstrument,
        hasKeyboardMap: !!this.grandPianoKeyboardMap,
        keyboardMapSize: this.grandPianoKeyboardMap
          ? Object.keys(this.grandPianoKeyboardMap).length
          : 0,
        harmonyBuffersSize: this.harmonyBuffers.size,
        harmonyLayers: Array.from(this.harmonyBuffers.keys()),
        audioContextState: this.audioContext.state,
        instanceId: this._instanceId,
      });
    }

    const eventData = event.data as any;
    // INSTRUMENT-SPECIFIC OCTAVE SHIFT:
    // - Wurlitzer: Lower by 1 octave (12 semitones) to match Logic export
    // - Grand Piano: No octave shift (use MIDI note as-is)
    // FAANG FIX: Use stored instrument type instead of inferring from grandPianoKeyboardMap
    // This prevents race conditions where keyboard map hasn't loaded yet
    const isGrandPiano = this.currentHarmonyInstrument === 'grandpiano';
    const octaveShift = isGrandPiano ? 0 : 12;
    const midiNote = eventData.midiNote - octaveShift;

    if (octaveShift !== 0 && this._noteLogCount < 3) {
      console.log(
        `[INSTRUMENT OCTAVE SHIFT] ${isGrandPiano ? 'Grand Piano' : 'Wurlitzer'}: MIDI ${eventData.midiNote} → ${midiNote} (shift: -${octaveShift}) [instrument=${this.currentHarmonyInstrument}]`,
      );
    }

    const velocity = eventData.velocity || event.velocity * 127;
    const duration = event.duration || 2; // Default 2 seconds

    // DIAGNOSTIC: Log first 3 notes with their audioTime and position
    if (this._noteLogCount < 3) {
      console.log(
        `[NOTE SCHEDULE #${this._noteLogCount}] audioTime=${audioTime.toFixed(3)}s, midiNote=${midiNote}, position=${JSON.stringify(event.position)}`,
      );
      this._noteLogCount++;
    }

    // Convert MIDI note to note name (e.g., 60 -> "C4", 61 -> "Cs4")
    // CRITICAL: Use 's' for sharps (not flats) to match HarmonyPreloadStrategy cache keys
    // Cache keys are formatted as: harmony-v3-Cs4, harmony-v4-Fs5, etc.
    const noteNames = [
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
    const octave = Math.floor(midiNote / 12) - 1;
    const noteIndex = midiNote % 12;
    const noteName = noteNames[noteIndex] + octave;

    const noteEndTime = audioTime + duration;

    // Determine which velocity layer to use for this specific note
    // Uses per-note velocity ranges from instrument config if available
    let layer = this.getHarmonyLayerForNoteVelocity(noteName, velocity);

    // Get buffer from harmony buffers (internal map)
    let buffer = this.harmonyBuffers.get(layer)?.get(noteName);
    let playbackRate = 1.0;

    // FAANG FIX: For Grand Piano, determine the actual sample note FIRST
    // Grand Piano uses sparse sampling (A, C, D#, F#) and maps other notes to these
    // We need to know the physical sample name before cache lookup
    let actualSampleNote = noteName; // Default to requested note
    if (this.currentHarmonyInstrument === 'grandpiano') {
      console.log(
        '🗺️ [NOTE-MAPPING] Grand Piano detected, checking keyboard map...',
        {
          hasKeyboardMap: !!this.grandPianoKeyboardMap,
          requestedNote: noteName,
          mapKeys: this.grandPianoKeyboardMap
            ? Object.keys(this.grandPianoKeyboardMap).length
            : 0,
        },
      );

      if (this.grandPianoKeyboardMap) {
        const mapping = this.grandPianoKeyboardMap[noteName];
        if (mapping) {
          actualSampleNote = mapping.sample; // e.g., "A3" for "Gs3"
          playbackRate = mapping.playbackRate;
          console.log('🗺️ [NOTE-MAPPING] ✅ Mapped note', {
            requested: noteName,
            mapped: actualSampleNote,
            playbackRate,
          });
        } else {
          console.warn('🗺️ [NOTE-MAPPING] ⚠️ No mapping found for note', {
            noteName,
          });
        }
      } else {
        console.error(
          '🗺️ [NOTE-MAPPING] ❌ Keyboard map NOT LOADED - note mapping will fail!',
          {
            requestedNote: noteName,
            currentInstrument: this.currentHarmonyInstrument,
          },
        );
      }
    }

    // FAANG FALLBACK: If buffer not in internal map, try GlobalSampleCache
    // This handles race condition where user clicks play before preloading completes
    // Preloading caches buffers as "{instrument}-{layer}-{note}" (e.g., "grandpiano-v3-A3")
    if (!buffer) {
      // FAANG FIX: Use stored instrument type for reliable cache lookup
      const instrument = this.currentHarmonyInstrument || 'wurlitzer'; // Default to wurlitzer if not set
      // CRITICAL: Use actualSampleNote (mapped) instead of noteName (requested)
      const cacheKey = `${instrument}-${layer}-${actualSampleNote}`;
      buffer = GlobalSampleCache.getCachedBuffer(cacheKey);

      if (buffer) {
        console.log(
          `[CACHE FALLBACK] Found ${cacheKey} in GlobalSampleCache (note=${noteName} → sample=${actualSampleNote})`,
        );
      } else {
        // CRITICAL DIAGNOSTIC: Show what we're looking for vs what exists
        const allCachedKeys = Array.from(
          (GlobalSampleCache.getInstance() as any).samples?.keys() || [],
        );
        const instrumentKeys = allCachedKeys.filter((k) =>
          k.startsWith(`${instrument}-`),
        );

        console.log(`🔍 [CACHE DIAGNOSTIC] Buffer not found for ${cacheKey}`);
        console.log(`   Looking for: ${cacheKey}`);
        console.log(`   Current instrument: ${this.currentHarmonyInstrument}`);
        console.log(
          `   Layer: ${layer}, Requested: ${noteName}, Mapped: ${actualSampleNote}`,
        );
        console.log(
          `   Available keys (${instrumentKeys.length} total):`,
          instrumentKeys.slice(0, 15),
        );
      }
    }

    // ALWAYS check keyboard map for Grand Piano to apply correct playbackRate
    // This is needed because preloading caches samples with mapped names
    // Example: G4 uses Fs4 sample at 1.059 playbackRate (+1 semitone)
    let sampleNote = noteName; // Default to requested note (for non-Grand Piano or notes without mapping)

    if (this.grandPianoKeyboardMap && this.grandPianoKeyboardMap[noteName]) {
      const mapping = this.grandPianoKeyboardMap[noteName];
      playbackRate = mapping.playbackRate; // Apply pitch-shift rate
      sampleNote = mapping.sample; // Update to mapped sample (e.g., "A2" for "As2")

      // If buffer not found directly, look for the mapped sample
      if (!buffer) {
        // Try all available velocity layers for the mapped sample
        // First try the current layer, then all others from highest to lowest velocity
        const allLayers = Array.from(this.harmonyBuffers.keys());
        const layerOrder = [
          layer, // Try current layer first
          ...allLayers
            .filter((l) => l !== layer)
            .sort((a, b) => {
              // Sort by velocity number descending (v10 > v9 > ... > v1)
              const aNum = parseInt(a.substring(1));
              const bNum = parseInt(b.substring(1));
              return bNum - aNum;
            }),
        ];

        for (const fallbackLayer of layerOrder) {
          buffer = this.harmonyBuffers.get(fallbackLayer)?.get(sampleNote);

          // FAANG FALLBACK: Check GlobalSampleCache if not in internal map
          if (!buffer) {
            const cacheKey = `grandpiano-${fallbackLayer}-${sampleNote}`;
            buffer = GlobalSampleCache.getCachedBuffer(cacheKey);
            if (buffer) {
              console.log(
                `[CACHE FALLBACK + MAP] ${noteName} → ${sampleNote} from GlobalSampleCache (${cacheKey})`,
              );
            }
          }

          if (buffer) {
            console.log(
              `[GRAND PIANO MAP] ${noteName} → ${sampleNote} in ${fallbackLayer} (${mapping.semitones > 0 ? '+' : ''}${mapping.semitones} semitones, rate ${playbackRate.toFixed(3)})`,
            );
            layer = fallbackLayer;
            break;
          }
        }
      } else {
        // Buffer found directly, but still log if we're applying pitch-shift
        if (Math.abs(playbackRate - 1.0) > 0.001 && this._noteLogCount < 10) {
          console.log(
            `[GRAND PIANO PITCH] ${noteName}: rate=${playbackRate.toFixed(3)} (${mapping.semitones > 0 ? '+' : ''}${mapping.semitones} semitones) - buffer found directly`,
          );
        }
      }
    }

    // FALLBACK: If still not found, try other velocity layers for exact note
    if (!buffer) {
      // Try all available layers from highest to lowest velocity
      const allLayers = Array.from(this.harmonyBuffers.keys());
      const layerOrder = allLayers
        .filter((l) => l !== layer)
        .sort((a, b) => {
          // Sort by velocity number descending (v10 > v9 > ... > v1)
          const aNum = parseInt(a.substring(1));
          const bNum = parseInt(b.substring(1));
          return bNum - aNum;
        });

      for (const fallbackLayer of layerOrder) {
        buffer = this.harmonyBuffers.get(fallbackLayer)?.get(sampleNote);

        // FAANG FALLBACK: Check GlobalSampleCache if not in internal map
        // CRITICAL: Use sampleNote (mapped sample like "Fs4") not noteName (requested like "F4")
        if (!buffer) {
          const instrument = this.currentHarmonyInstrument || 'wurlitzer';
          const cacheKey = `${instrument}-${fallbackLayer}-${sampleNote}`;
          buffer = GlobalSampleCache.getCachedBuffer(cacheKey);
          if (buffer) {
            console.log(
              `[CACHE FALLBACK + VELOCITY] ${noteName} → ${sampleNote} from GlobalSampleCache (${cacheKey})`,
            );
          }
        }

        if (buffer) {
          console.log(
            `[VELOCITY FALLBACK] ${noteName} → ${sampleNote}: ${layer} → ${fallbackLayer}`,
          );
          layer = fallbackLayer;
          break;
        }
      }
    }

    if (!buffer) {
      // CRITICAL DIAGNOSTIC: Show what we tried to find vs what's actually available
      const instrument = this.currentHarmonyInstrument || 'wurlitzer';
      const allCachedKeys = Array.from(
        (GlobalSampleCache.getInstance() as any).samples?.keys() || [],
      );
      const instrumentKeys = allCachedKeys.filter((k) =>
        k.startsWith(`${instrument}-`),
      );

      // All possible cache keys we tried during lookup
      const attemptedKeys = [
        `${instrument}-${layer}-${noteName}`, // Original note
        `${instrument}-${layer}-${actualSampleNote}`, // After octave shift
        `${instrument}-${layer}-${sampleNote}`, // After keyboard mapping
      ];

      console.log(
        `\n🔍 ========== CACHE DIAGNOSTIC (MISSING BUFFER) ==========`,
      );
      console.log(
        `❌ Could not find buffer for: ${layer}/${noteName} (MIDI ${midiNote})`,
      );
      console.log(`\n📋 Attempted cache keys (in order):`);
      attemptedKeys.forEach((key, i) => console.log(`   ${i + 1}. ${key}`));
      console.log(
        `\n📦 Available cache keys for "${instrument}" (${instrumentKeys.length} total):`,
      );
      instrumentKeys.slice(0, 20).forEach((key) => console.log(`   - ${key}`));
      if (instrumentKeys.length > 20) {
        console.log(`   ... and ${instrumentKeys.length - 20} more`);
      }
      console.log(`\n🔧 State:`);
      console.log(`   Current instrument: ${this.currentHarmonyInstrument}`);
      console.log(
        `   Requested note: ${noteName}, Mapped sample: ${sampleNote}`,
      );
      console.log(`   Layer: ${layer}, Velocity: ${velocity}`);
      console.log(`========================================================\n`);

      // For Grand Piano, also check what the keyboard map says
      const keyboardMapInfo =
        this.grandPianoKeyboardMap && this.grandPianoKeyboardMap[noteName]
          ? {
              mappedSample: this.grandPianoKeyboardMap[noteName].sample,
              playbackRate: this.grandPianoKeyboardMap[noteName].playbackRate,
              semitones: this.grandPianoKeyboardMap[noteName].semitones,
            }
          : null;

      // CRITICAL: Show the CORRECT cache key using mapped sample (actualSampleNote) not requested note
      const expectedCacheKey = `${this.currentHarmonyInstrument || 'unknown'}-${layer}-${actualSampleNote}`;

      console.error(
        `❌ MISSING BUFFER: ${layer}/${noteName} (MIDI ${midiNote})`,
        {
          layer,
          noteName,
          requestedNote: noteName,
          mappedSample: actualSampleNote,
          midiNote,
          originalMidiNote: eventData.midiNote,
          octaveShift,
          isGrandPiano,
          currentInstrument: this.currentHarmonyInstrument,
          expectedCacheKey,
          velocity,
          keyboardMapInfo,
          availableLayers: Array.from(this.harmonyBuffers.keys()),
          availableNotesInLayer: this.harmonyBuffers.get(layer)
            ? Array.from(this.harmonyBuffers.get(layer)!.keys())
            : 'LAYER_NOT_FOUND',
          allAvailableNotes: Array.from(this.harmonyBuffers.entries()).map(
            ([l, notes]) => `${l}: ${Array.from(notes.keys()).join(', ')}`,
          ),
        },
      );
      logger.debug(
        `❌ Missing harmony buffer for ${layer}/${noteName} (MIDI ${midiNote}, original: ${eventData.midiNote}, shift: ${octaveShift})`,
      );
      return false;
    }

    try {
      // ============================================================================
      // SIMPLIFIED HARMONY NOTE ARCHITECTURE
      // ============================================================================
      // 1. Set gain ONCE based on velocity (never touch again)
      // 2. Sustain pedal controls WHEN notes stop (not HOW LOUD they are)
      // 3. All notes get same 50ms exponential fade when they end (any reason)
      // 4. No attack envelope, no volume restoration, no mid-note gain changes
      // ============================================================================

      // Create AudioBufferSourceNode (SAME AS DRUMMER)
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate; // Apply pitch-shift for octave transposition

      // CRITICAL DIAGNOSTIC: Verify pitch shifting is applied correctly for Grand Piano
      if (
        this.currentHarmonyInstrument === 'grandpiano' &&
        Math.abs(playbackRate - 1.0) > 0.001
      ) {
        console.log('[PITCH-SHIFT-APPLIED] 🎹', {
          noteName,
          midiNote,
          sampleNote, // The actual sample being used (e.g., A3 for Gs3)
          playbackRate,
          isGrandPiano: this.currentHarmonyInstrument === 'grandpiano',
          hasKeyboardMap: !!this.grandPianoKeyboardMap,
          layer,
          duration,
        });
      }

      // DIAGNOSTIC: Log playback rate for first few notes
      if (midiNote >= 46 && midiNote <= 48) {
        // Log A#2, B2, C3
        console.log('[PLAYBACK RATE DIAGNOSTIC]', {
          noteName,
          midiNote,
          playbackRate,
          duration,
          audioTime,
          velocity,
        });
      }

      // Create gain node for velocity control
      const gain = this.audioContext.createGain();
      const targetGain = (velocity / 127) * 0.8; // Normalize velocity to 0-0.8

      // CC64 SUSTAIN PRE-CHECK: Determine if this note will be sustained
      // We need to know this NOW to enable looping BEFORE scheduling
      let willBeSustained = false;
      let sustainedDuration = duration;

      if (this.currentCC64Timeline.size > 0) {
        const midiNoteEndTime = audioTime + duration;
        const pedalDownTime = this.findCC64DownDuringNote(
          audioTime,
          midiNoteEndTime,
          this.currentCC64Timeline,
        );

        if (pedalDownTime !== null) {
          const pedalUpTime = this.findNextCC64Up(
            pedalDownTime,
            this.currentCC64Timeline,
          );
          if (pedalUpTime !== null && pedalUpTime > audioTime) {
            sustainedDuration = pedalUpTime - audioTime;
            willBeSustained = sustainedDuration > buffer.duration;
          }
        }
      }

      // CRITICAL FIX: Enable looping for sustained notes
      // This allows notes to ring as long as CC64 pedal is held
      if (willBeSustained) {
        source.loop = true;
        // Loop the last 20% of the sample for natural sustain
        source.loopStart = buffer.duration * 0.8;
        source.loopEnd = buffer.duration;
        console.log(
          `[CC64 LOOP] ${noteName}: Enabling loop (${source.loopStart.toFixed(3)}s-${source.loopEnd.toFixed(3)}s) for ${sustainedDuration.toFixed(3)}s sustain`,
        );
      }

      // STEP 1: Set gain at note start time using automation timeline
      // This ensures compatibility with scheduled fade-out later
      gain.gain.setValueAtTime(targetGain, audioTime);

      // Connect: source → gain → destination
      source.connect(gain);
      gain.connect(this.audioDestination);

      // CC64 SUSTAIN: Calculate actual duration (MIDI or sustained)
      let actualDuration = duration; // Start with MIDI duration

      if (this.currentCC64Timeline.size > 0) {
        console.log(
          `[CC64 SUSTAIN] Checking note ${noteName} @ ${audioTime.toFixed(3)}s (timeline has ${this.currentCC64Timeline.size} events)`,
        );

        // CRITICAL FIX: Check if pedal is DOWN when note starts OR goes DOWN during note
        // This handles syncopated pedaling where pedal goes DOWN after note starts
        const midiNoteEndTime = audioTime + duration;
        const pedalDownTime = this.findCC64DownDuringNote(
          audioTime,
          midiNoteEndTime,
          this.currentCC64Timeline,
        );

        if (pedalDownTime !== null) {
          // Pedal is/was DOWN during this note - find when it goes UP
          const pedalUpTime = this.findNextCC64Up(
            pedalDownTime,
            this.currentCC64Timeline,
          );

          if (pedalUpTime !== null) {
            // CRITICAL FIX: Real piano pedal behavior for legato/overlapping chords
            // - If pedal UP is AFTER MIDI note-off: extends the note (traditional sustain)
            // - If pedal UP is BEFORE MIDI note-off: IGNORE pedal, use MIDI duration (note still held)
            // This allows overlapping chords where new chord is played before releasing old chord

            const sustainDuration = pedalUpTime - audioTime;

            // Safety check: ensure pedal UP is in the future
            if (sustainDuration > 0) {
              // CRITICAL: Pedal can only EXTEND notes, never TRUNCATE notes still being held
              if (pedalUpTime > midiNoteEndTime) {
                // Pedal extends the note beyond MIDI note-off
                actualDuration = sustainDuration;

                if (pedalDownTime > audioTime) {
                  console.log(
                    `[CC64 MID-SUSTAIN] ${noteName}: Pedal went DOWN at ${pedalDownTime.toFixed(3)}s (during note), sustains until ${pedalUpTime.toFixed(3)}s (+${(actualDuration - duration).toFixed(3)}s)`,
                  );
                } else {
                  console.log(
                    `[CC64 EXTEND] ${noteName}: MIDI would end at ${midiNoteEndTime.toFixed(3)}s, extended to pedal UP @ ${pedalUpTime.toFixed(3)}s (+${(actualDuration - duration).toFixed(3)}s sustain)`,
                  );
                }
              } else {
                // Pedal UP happens while note is still held - ignore pedal, use MIDI duration
                // This is legato pedaling: play new chord, then release pedal (old chord stops, new chord continues)
                actualDuration = duration;
                console.log(
                  `[CC64 IGNORED] ${noteName}: Pedal UP @ ${pedalUpTime.toFixed(3)}s while note held until ${midiNoteEndTime.toFixed(3)}s - using MIDI duration (legato pedaling)`,
                );
              }
            } else {
              // Edge case: Note starts after pedal UP
              console.warn(
                `[CC64 WARNING] ${noteName}: Note @ ${audioTime.toFixed(3)}s starts after pedal UP @ ${pedalUpTime.toFixed(3)}s - using MIDI duration`,
              );
              actualDuration = duration;
            }
          } else {
            // No pedal UP found - check if we should cap at exercise end + 3s ring-out
            const noteStartsInLastBeat = audioTime >= this.lastBeatThreshold;

            if (noteStartsInLastBeat && this.exerciseEndTime > 0) {
              // Cap at exercise end + 3s to prevent 8+ second samples ringing forever
              const maxEndTime = this.exerciseEndTime + 3.0;
              const cappedDuration = maxEndTime - audioTime;
              actualDuration = Math.max(
                duration,
                Math.min(cappedDuration, buffer.duration),
              );
              console.log(
                `[CC64] ${noteName}: Extended ${duration.toFixed(3)}s → ${actualDuration.toFixed(3)}s (no pedal UP, capped at exercise end + 3s)`,
              );
            } else {
              // Use full buffer duration for notes not in last beat
              actualDuration = Math.max(duration, buffer.duration);
              console.log(
                `[CC64] ${noteName}: Extended ${duration.toFixed(3)}s → ${actualDuration.toFixed(3)}s (no pedal UP, using buffer)`,
              );
            }
          }
        }
      }

      // ============================================================================
      // LAST NOTE RING-OUT: Extend notes in the last beat for natural decay
      // Detects TWO scenarios:
      // 1. CC64 sustain pedal extends note beyond MIDI note-off
      // 2. MIDI note-off happens at/near exercise end (held by hand)
      // ============================================================================

      // Scenario A: Check if MIDI note-off happens at/near exercise end (held by hand)
      const midiNoteEndTime = audioTime + duration;
      const heldByHandUntilEnd =
        this.isNoteHeldUntilExerciseEnd(midiNoteEndTime);

      // Scenario B: Check if note was extended by CC64 pedal
      const extendedByCC64 = actualDuration > duration;

      // Check if note extends into last beat (existing logic)
      const noteEndTime = audioTime + actualDuration;
      const extendsIntoLastBeat = noteEndTime >= this.lastBeatThreshold;
      const isHeldNote = actualDuration > 0.5; // Exclude short stabs (< half second)

      // CRITICAL: Only apply decay to notes that START before exercise end
      // Notes starting after exercise end should play normally (no special decay treatment)
      const startsBeforeEnd = audioTime < this.exerciseEndTime;

      // COMBINED: Either CC64 sustained OR held by hand triggers ring-out
      // BUT only if note starts before exercise end (prevents negative durations)
      const isLastNote =
        (heldByHandUntilEnd || extendedByCC64) &&
        extendsIntoLastBeat &&
        isHeldNote &&
        startsBeforeEnd;

      // DIAGNOSTIC: Log ALL notes in last beat to see why they might not qualify
      if (extendsIntoLastBeat) {
        console.log(
          `[LAST NOTE CHECK] ${noteName} @ ${audioTime.toFixed(3)}s:`,
          {
            midiNoteEndTime: midiNoteEndTime.toFixed(3),
            exerciseEndTime: this.exerciseEndTime.toFixed(3),
            lastBeatThreshold: this.lastBeatThreshold.toFixed(3),
            heldByHandUntilEnd,
            extendedByCC64,
            extendsIntoLastBeat,
            isHeldNote,
            startsBeforeEnd,
            actualDuration: actualDuration.toFixed(3),
            isLastNote,
          },
        );
      }

      if (isLastNote) {
        const ringOutExtension = 3.0; // 3 seconds total (1s hold + 2s fade)

        // CRITICAL: Override CC64 extension for last notes
        // Force note to end at exercise end + 2s decay, regardless of CC64
        const desiredEndTime = this.exerciseEndTime + ringOutExtension;
        const desiredDuration = desiredEndTime - audioTime;

        const previousDuration = actualDuration;
        actualDuration = desiredDuration;

        const reason = heldByHandUntilEnd ? 'held by hand' : 'CC64 sustained';
        console.log(
          `[LAST NOTE DECAY] ${noteName} @ ${audioTime.toFixed(3)}s: ${previousDuration.toFixed(3)}s → ${actualDuration.toFixed(3)}s`,
        );
        console.log(
          `  Exercise end: ${this.exerciseEndTime.toFixed(3)}s, Desired end: ${desiredEndTime.toFixed(3)}s, Reason: ${reason}`,
        );
      }

      // Calculate note end time using final duration (MIDI, sustained, or with ring-out)
      const finalNoteEndTime = audioTime + actualDuration;

      console.log(`[SAMPLE DURATION] Note ${noteName}:`, {
        midiDuration: duration.toFixed(3),
        actualDuration: actualDuration.toFixed(3),
        sustained: actualDuration > duration,
        bufferDuration: buffer.duration.toFixed(3),
        loopEnabled: willBeSustained,
        noteEndTime: finalNoteEndTime.toFixed(3),
        audioTime: audioTime.toFixed(3),
        isLastNote: isLastNote,
      });

      // Track active harmony sources for sustain pedal logic (store source, gain, targetGain, noteEndTime)
      // We need targetGain for scheduling proper fade-outs during upfront scheduling
      // We need noteEndTime for deferred fade scheduling
      const existingSourcesCount =
        this.activeHarmonySources.get(noteName)?.length || 0;
      if (!this.activeHarmonySources.has(noteName)) {
        this.activeHarmonySources.set(noteName, []);
      }
      this.activeHarmonySources.get(noteName)!.push({
        source,
        gain,
        gainValue: targetGain,
        noteEndTime: finalNoteEndTime,
      });

      // Schedule playback start
      source.start(audioTime);

      // ============================================================================
      // FADEOUT SCHEDULING: Different logic for normal notes vs last notes
      // ============================================================================
      const isSustained = actualDuration > duration;
      let scheduledStopTime: number;

      if (isLastNote) {
        // LAST NOTE: 1s hold at full volume, then 3-stage fade:
        // 0-1s: Quick drop to 50% (1.0 → 0.5)
        // 1-3s: Smooth exponential fade to silence (0.5 → 0.001)
        const ringOutStart = finalNoteEndTime - 3.0; // Start of 3-second ring-out extension
        const fadeStartTime = ringOutStart + 1.0; // Fade starts 1 second into ring-out
        const midFadeTime = fadeStartTime + 1.0; // Midpoint at 2s into ring-out

        // Point 1: Hold gain constant until fade starts (1 second of full volume)
        gain.gain.linearRampToValueAtTime(targetGain, fadeStartTime);

        // Point 2: Quick linear drop to 50% over first second of fade
        gain.gain.linearRampToValueAtTime(targetGain * 0.5, midFadeTime);

        // Point 3: Smooth exponential fade to silence over final 2 seconds
        gain.gain.exponentialRampToValueAtTime(0.001, finalNoteEndTime);

        scheduledStopTime = finalNoteEndTime + 0.01;
        source.stop(scheduledStopTime);

        console.log(
          `[LAST NOTE FADEOUT] ${noteName}: Hold ${fadeStartTime.toFixed(3)}s, quick drop ${fadeStartTime.toFixed(3)}s-${midFadeTime.toFixed(3)}s (to 50%), smooth fade ${midFadeTime.toFixed(3)}s → ${finalNoteEndTime.toFixed(3)}s (1s hold + 1s quick drop + 2s smooth fade)`,
        );
      } else {
        // NORMAL NOTE: Standard 30ms exponential fade at note end
        const fadeOutDuration = 0.03; // 30ms exponential fade (mimics piano damper)
        const fadeStartTime = finalNoteEndTime; // Start fade AT note end

        // Point 1: Hold gain constant until note end
        gain.gain.linearRampToValueAtTime(targetGain, fadeStartTime);

        // Point 2: Exponential fade out over 30ms
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          finalNoteEndTime + fadeOutDuration,
        );

        scheduledStopTime = finalNoteEndTime + fadeOutDuration + 0.01;
        source.stop(scheduledStopTime);

        if (isSustained) {
          console.log(
            `[CC64] ${noteName} @ ${audioTime.toFixed(3)}s sustained until ${finalNoteEndTime.toFixed(3)}s (extended by ${(actualDuration - duration).toFixed(3)}s), exponential fade starts AT pedal UP (${fadeStartTime.toFixed(3)}s) for ${fadeOutDuration * 1000}ms`,
          );
        } else {
          console.log(
            `[CC64] ${noteName} @ ${audioTime.toFixed(3)}s normal duration ${actualDuration.toFixed(3)}s, exponential fade starts at ${fadeStartTime.toFixed(3)}s for ${fadeOutDuration * 1000}ms`,
          );
        }
      }

      // Note: No setTimeout needed - Web Audio API handles timing precisely
      // The noteEndTime already includes CC64 sustain calculation if pedal was DOWN

      // Track in scheduledAudioSources (CRITICAL for stop functionality)
      // Harmony is a sustained note (not one-shot like drums)
      this.scheduledAudioSources.set(source, {
        type: 'sustained',
        hasStopScheduled: true, // Stop scheduled at noteEndTime (includes CC64 sustain if applicable)
      });

      // Auto-cleanup on end
      source.onended = () => {
        // Clean up audio source when playback ends
        this.scheduledAudioSources.delete(source);
        gain.disconnect();

        // Remove from active sources
        const activeSources = this.activeHarmonySources.get(noteName);
        if (activeSources) {
          const index = activeSources.findIndex((s) => s.source === source);
          if (index !== -1) {
            activeSources.splice(index, 1);
          }
          if (activeSources.length === 0) {
            this.activeHarmonySources.delete(noteName);
          }
        }
      };

      logger.debug(`🎯 Harmony MIDI note scheduled directly`, {
        midiNote,
        noteName,
        layer,
        velocity,
        audioTime: audioTime.toFixed(6),
        duration,
      });

      return true;
    } catch (error) {
      logger.error(`Failed to schedule harmony MIDI note ${midiNote}`, error);
      return false;
    }
  }

  private scheduleBassDirect(
    event: PatternEvent,
    audioTime: number,
    frame: number,
  ): boolean {
    // DEFENSIVE CHECK: Detect if multiple bass tracks are trying to schedule
    const bassTrackCount = Array.from(this.tracks.values()).filter(
      (t) => t.instrumentType === 'bass',
    ).length;

    if (bassTrackCount > 1) {
      logger.error('🚨 CRITICAL: Multiple bass tracks detected!', {
        trackCount: bassTrackCount,
        trackIds: Array.from(this.tracks.entries())
          .filter(([, t]) => t.instrumentType === 'bass')
          .map(([id]) => id),
        instanceId: this._instanceId,
      });
    }

    if (!this.audioContext || !this.audioDestination) {
      logger.warn(
        '❌ FAANG: Cannot use direct scheduling - missing bass dependencies',
        {
          hasAudioContext: !!this.audioContext,
          hasDestination: !!this.audioDestination,
          instanceId: this._instanceId,
        },
      );
      return false;
    }

    // Get note and articulation
    const bassData = event.data as any;
    const note = event.type || bassData?.note;
    const articulation = bassData?.technique || 'normal';

    if (!note) {
      logger.warn('❌ FAANG: No note in bass event');
      return false;
    }

    const buffer = this.bassBuffers.get(articulation)?.get(note);

    if (!buffer) {
      logger.debug(`❌ FAANG: No buffer for bass ${articulation}/${note}`);
      return false;
    }

    const {
      parseDuration,
    } = require('@/domains/playback/utils/chordParser.js');
    const duration = parseDuration(event.duration, 120); // TODO: Get BPM from transport

    try {
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      const gain = this.audioContext.createGain();
      gain.gain.value = (event.velocity || 0.8) * 0.7;

      source.connect(gain);
      gain.connect(this.audioDestination);

      source.start(audioTime);
      if (duration > 0) {
        source.stop(audioTime + duration);
      }

      // Track for cleanup
      const noteId = `bass-${frame}`;
      this.activeBassSources.set(noteId, source);

      const scheduleTime = this.audioContext.currentTime;
      const scheduleFrame = Math.round(scheduleTime * this.sampleRate);
      const frameDelta = frame - scheduleFrame;
      const timeDelta = (frameDelta / this.sampleRate) * 1000;

      logger.info(`🎯 FAANG: Bass note scheduled - ${note}`, {
        articulation,
        duration: `${duration.toFixed(3)}s`,
        targetFrame: frame,
        targetTime: audioTime.toFixed(6),
        scheduleFrame,
        lookAhead: `${timeDelta.toFixed(2)}ms`,
      });

      // Auto-cleanup
      source.onended = () => {
        this.activeBassSources.delete(noteId);
        gain.disconnect();
      };

      return true;
    } catch (error) {
      logger.error(`Failed to schedule bass note ${note}`, error);
      return false;
    }
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
   * Convert MIDI note number to note name (e.g., 60 -> "C4")
   */
  private midiNoteToName(midiNote: number): string {
    const noteNames = [
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
    const octave = Math.floor(midiNote / 12) - 1;
    const noteIndex = midiNote % 12;
    return noteNames[noteIndex] + octave;
  }

  /**
   * CC64 COMPREHENSIVE DIAGNOSTIC TABLE
   * Shows exact numbers from database and how CC64 extends each note
   */
  private logCC64DiagnosticTable(sortedEvents: any[], region: Region): void {
    console.log('\n' + '='.repeat(120));
    console.log('CC64 SUSTAIN PEDAL DIAGNOSTIC - SHOWING EXACT CALCULATIONS');
    console.log('='.repeat(120));

    // Extract harmony notes with their MIDI durations
    const harmonyNotes: Array<{
      noteName: string;
      audioTime: number;
      midiDuration: number;
      midiEndTime: number;
    }> = [];

    let noteIndex = 0;
    sortedEvents.forEach((event) => {
      if (event.data?.midiNote !== undefined) {
        // 🚨 CRITICAL FIX: Use absolute ticks for note timing (same as CC64 events)
        let eventTime: number;
        if (event.data?.ticks !== undefined) {
          // Use absolute ticks if available (new method)
          // 🚨 CRITICAL FIX: Use original MIDI file BPM, not current transport BPM
          const originalBpm =
            event.data?.originalBpm || Tone.Transport.bpm.value;
          const secondsPerBeat = 60 / originalBpm;
          const ticksPerBeat = 480; // PPQ standard
          eventTime = (event.data.ticks / ticksPerBeat) * secondsPerBeat;
        } else {
          // Fallback to position parsing (old method)
          eventTime = this.parsePosition(event.position);
        }

        const offsetTime =
          this.countdownEnabled && !region.skipCountdownOffset
            ? this.countdownOffsetBeats * (60 / Tone.Transport.bpm.value)
            : 0;
        const absoluteTime = region.startTime + eventTime + offsetTime;
        const audioTime = this.transportStartTime + absoluteTime;

        // DIAGNOSTIC: Log note 9 calculation in CC64 table
        if (noteIndex === 8) {
          console.log('[CC64 TABLE] Note 9 calculation:', {
            ticks: event.data.ticks,
            eventTime,
            offsetTime,
            'region.startTime': region.startTime,
            absoluteTime,
            'this.transportStartTime': this.transportStartTime,
            audioTime,
            noteName: this.midiNoteToName(event.data.midiNote - 12),
          });
        }
        noteIndex++;

        // Parse MIDI note to note name (apply same -12 octave shift as in playback)
        const midiNote = event.data.midiNote - 12;
        const noteName = this.midiNoteToName(midiNote);

        // Duration is already in seconds (not Tone.js position format)
        const duration =
          typeof event.duration === 'number' ? event.duration : 0.5;

        harmonyNotes.push({
          noteName,
          audioTime,
          midiDuration: duration,
          midiEndTime: audioTime + duration,
        });
      }
    });

    if (harmonyNotes.length === 0) {
      console.log('⚠️  No harmony notes found in region');
      return;
    }

    // CC64 SUSTAIN PEDAL DIAGNOSTIC - SHOWING EXACT CALCULATIONS
    console.log('='.repeat(120));
    console.log(
      `\n📊 Analyzing ${harmonyNotes.length} harmony notes with CC64 timeline\n`,
    );

    // Table header
    console.log(
      '┌─────┬──────────┬───────────┬──────────────┬──────────────┬────────────────┬─────────────────┬──────────────┬──────────────┐',
    );
    console.log(
      '│ #   │ Note     │ Start (s) │ MIDI Dur (s) │ MIDI End (s) │ Pedal Down (s) │ Pedal Up (s)    │ Final Dur(s) │ Extension(s) │',
    );
    console.log(
      '├─────┼──────────┼───────────┼──────────────┼──────────────┼────────────────┼─────────────────┼──────────────┼──────────────┤',
    );

    let extendedCount = 0;
    let totalExtension = 0;

    harmonyNotes.forEach((note, index) => {
      // Apply CC64 logic (same as in scheduleHarmonyMidiNoteDirect)
      let actualDuration = note.midiDuration;
      let pedalDownTime: number | null = null;
      let pedalUpTime: number | null = null;
      let extension = 0;

      if (this.currentCC64Timeline.size > 0) {
        pedalDownTime = this.findCC64DownDuringNote(
          note.audioTime,
          note.midiEndTime,
          this.currentCC64Timeline,
        );

        if (pedalDownTime !== null) {
          pedalUpTime = this.findNextCC64Up(
            pedalDownTime,
            this.currentCC64Timeline,
          );

          if (pedalUpTime !== null && pedalUpTime > note.midiEndTime) {
            // Pedal extends the note
            actualDuration = pedalUpTime - note.audioTime;
            extension = actualDuration - note.midiDuration;
            extendedCount++;
            totalExtension += extension;
          }
        }
      }

      // Format table row
      const num = String(index + 1).padStart(3);
      const noteName = note.noteName.padEnd(8);
      const start = note.audioTime.toFixed(3).padStart(9);
      const midiDur = note.midiDuration.toFixed(3).padStart(12);
      const midiEnd = note.midiEndTime.toFixed(3).padStart(12);
      const pedalDown = (
        pedalDownTime !== null ? pedalDownTime.toFixed(3) : 'N/A'
      ).padStart(14);
      const pedalUp = (
        pedalUpTime !== null ? pedalUpTime.toFixed(3) : 'N/A'
      ).padStart(15);
      const finalDur = actualDuration.toFixed(3).padStart(12);
      const ext = (extension > 0 ? `+${extension.toFixed(3)}` : '-').padStart(
        12,
      );

      console.log(
        `│ ${num} │ ${noteName} │ ${start} │ ${midiDur} │ ${midiEnd} │ ${pedalDown} │ ${pedalUp} │ ${finalDur} │ ${ext} │`,
      );
    });

    console.log(
      '└─────┴──────────┴───────────┴──────────────┴──────────────┴────────────────┴─────────────────┴──────────────┴──────────────┘',
    );

    // Summary statistics
    console.log(
      `\n📈 SUMMARY: ${extendedCount}/${harmonyNotes.length} notes extended by CC64 (${((extendedCount / harmonyNotes.length) * 100).toFixed(1)}%)`,
    );
    if (extendedCount > 0) {
      console.log(
        `   Average extension: ${(totalExtension / extendedCount).toFixed(3)}s | Total added: ${totalExtension.toFixed(3)}s`,
      );
    }
    console.log('\n' + '='.repeat(120) + '\n');
  }
}
