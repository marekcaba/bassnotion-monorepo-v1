/**
 * Scheduler.ts - Unified Audio Scheduling System
 *
 * Phase 1, Task 1.1: Consolidated scheduler replacing 23+ modules
 *
 * Handles all instrument scheduling through data-driven configuration:
 * - Metronome, Drums, Bass, Voice Cues (one-shot samples)
 * - Harmony (sustained notes with velocity layers)
 * - Sample-perfect timing using Web Audio API
 * - Velocity-based volume control
 * - Automatic source cleanup (Bug #3 fix preserved)
 * - Tempo change support via cancellation
 */

import { getLogger } from '@/utils/logger.js';
import type { PatternEvent } from './region-processing/types/region.types.js';
import {
  VelocityLayerSelector,
  type HarmonyInstrument,
  type PerNoteVelocityRanges,
} from './scheduling/VelocityLayerSelector.js';

/**
 * Instrument types supported by the scheduler
 */
export type InstrumentType =
  | 'metronome'
  | 'drums'
  | 'harmony'
  | 'bass'
  | 'voiceCue';

/**
 * Audio source tracking type
 */
type SourceType = 'one-shot' | 'sustained';

interface ScheduledSource {
  type: SourceType;
  hasStopScheduled: boolean;
}

/**
 * Instrument configuration for data-driven scheduling
 */
export interface InstrumentConfig {
  /** Logger name for this instrument */
  loggerName: string;

  /** Instrument type */
  type: InstrumentType;

  /** Buffer mapping: event type → buffer key */
  eventTypeToBufferKey?: Record<string, string>;

  /** Whether this instrument uses velocity layers (harmony) */
  hasVelocityLayers?: boolean;

  /** Velocity layer keys (for harmony: ['v2', 'v3', 'v4', 'v5']) */
  velocityLayerKeys?: string[];

  /** Whether to preserve attack envelope (don't trim silent samples) */
  preserveAttackEnvelope?: boolean;

  /** Base volume multiplier (0-1) */
  baseVolume?: number;

  /** Silence detection threshold */
  silenceThreshold?: number;

  /** Harmony instrument type (grandpiano, wurlitzer, rhodes, nicekeysrhodes) */
  harmonyInstrument?: HarmonyInstrument;

  /** Octave shift in semitones (for harmony instruments) */
  octaveShift?: number;
}

/**
 * Pre-configured instrument configurations
 */
export const INSTRUMENT_CONFIGS: Record<InstrumentType, InstrumentConfig> = {
  metronome: {
    loggerName: 'MetronomeScheduler',
    type: 'metronome',
    eventTypeToBufferKey: {
      accent: 'accent',
      click: 'click',
    },
    baseVolume: 0.8,
  },
  drums: {
    loggerName: 'DrumScheduler',
    type: 'drums',
    eventTypeToBufferKey: {
      // Kick drums
      kick: 'kick',
      'kick-accent': 'kick-accent',
      // Snare drums
      snare: 'snare',
      'snare-accent': 'snare-accent',
      'snare-ghost': 'snare-ghost',
      // Hi-hats
      hihat: 'hihat-closed',
      'hihat-open': 'hihat-open',
      'hihat-pedal': 'hihat-pedal',
      // Cymbals
      crash: 'crash',
      ride: 'ride',
      // Toms
      'tom-high': 'tom-high',
      'tom-mid': 'tom-mid',
      'tom-low': 'tom-low',
    },
    baseVolume: 0.8,
  },
  harmony: {
    loggerName: 'HarmonyScheduler',
    type: 'harmony',
    hasVelocityLayers: true,
    velocityLayerKeys: ['v2', 'v3', 'v4', 'v5'],
    baseVolume: 0.8,
    harmonyInstrument: 'wurlitzer', // Default instrument
    octaveShift: 12, // Wurlitzer/Rhodes: -12 semitones, Grand Piano: 0
  },
  bass: {
    loggerName: 'BassScheduler',
    type: 'bass',
    eventTypeToBufferKey: {}, // Bass uses MIDI note mapping
    preserveAttackEnvelope: true,
    baseVolume: 0.8,
  },
  voiceCue: {
    loggerName: 'VoiceCueScheduler',
    type: 'voiceCue',
    eventTypeToBufferKey: {
      one: 'one',
      two: 'two',
      three: 'three',
      four: 'four',
      and: 'and',
    },
    baseVolume: 0.8,
  },
};

/**
 * Unified Scheduler - Handles all instrument scheduling
 */
export class Scheduler {
  private buffers: Map<string, AudioBuffer> = new Map();
  private audioContext: AudioContext | null = null;
  private audioDestination: AudioNode | null = null;
  private sampleRate = 48000;

  // Active audio sources - CRITICAL for cleanup and stop functionality
  private activeSources = new Map<AudioBufferSourceNode, ScheduledSource>();

  // For harmony: track active sources by note name for sustain handling
  private activeHarmonySources = new Map<
    string,
    Array<{ source: AudioBufferSourceNode; gain: GainNode }>
  >();

  private instanceId: string;
  private tracks: Map<string, any>; // Reference to track registry
  private logger: ReturnType<typeof getLogger>;

  // Velocity layer selector for harmony instruments (extracted from legacy)
  private velocityLayerSelector: VelocityLayerSelector;
  private currentHarmonyInstrument: HarmonyInstrument = 'wurlitzer'; // Default

  constructor(instanceId: string, tracks: Map<string, any>) {
    this.instanceId = instanceId;
    this.tracks = tracks;
    this.logger = getLogger('Scheduler');

    // Initialize velocity layer selector with default instrument
    this.velocityLayerSelector = new VelocityLayerSelector(
      this.currentHarmonyInstrument,
    );
  }

  /**
   * Set audio context and sample rate
   */
  setAudioContext(context: AudioContext): void {
    this.audioContext = context;
    this.sampleRate = context.sampleRate;
  }

  /**
   * Set buffers for an instrument
   */
  setBuffers(
    buffers: Record<string, AudioBuffer>,
    destination: AudioNode,
  ): void {
    this.buffers.clear();
    Object.entries(buffers).forEach(([key, buffer]) => {
      this.buffers.set(key, buffer);
    });
    this.audioDestination = destination;

    this.logger.info(`✅ Scheduler buffers injected`, {
      bufferKeys: Object.keys(buffers),
      bufferCount: this.buffers.size,
      hasDestination: !!destination,
      instanceId: this.instanceId,
    });
  }

  /**
   * Get buffer for a specific key
   */
  private getBuffer(bufferKey: string): AudioBuffer | null {
    return this.buffers.get(bufferKey) ?? null;
  }

  /**
   * Set harmony instrument type (wurlitzer, grandpiano, rhodes, nicekeysrhodes)
   * Updates velocity layer selection and octave shift accordingly
   *
   * Octave shifting behavior:
   * - Grand Piano: No octave shift (use MIDI note as-is)
   * - Wurlitzer/Rhodes/NiceKeysRhodes: -12 semitones (1 octave down)
   *
   * This ensures samples align with their recorded pitch:
   * - Grand Piano samples recorded at actual pitch (C4 = MIDI 60)
   * - Wurlitzer/Rhodes samples recorded 1 octave higher (C5 sample plays as C4)
   */
  public setHarmonyInstrument(
    instrument: HarmonyInstrument,
    perNoteRanges?: PerNoteVelocityRanges,
  ): void {
    this.currentHarmonyInstrument = instrument;
    this.velocityLayerSelector.setInstrument(instrument);

    if (perNoteRanges) {
      this.velocityLayerSelector.setPerNoteRanges(perNoteRanges);
    }

    // Update octave shift in harmony config
    const harmonyConfig = INSTRUMENT_CONFIGS.harmony;
    harmonyConfig.harmonyInstrument = instrument;
    harmonyConfig.octaveShift = instrument === 'grandpiano' ? 0 : 12;

    this.logger.info('Harmony instrument updated', {
      instrument,
      octaveShift: harmonyConfig.octaveShift,
      hasPerNoteRanges: !!perNoteRanges,
    });
  }

  /**
   * Schedule a single audio event
   */
  schedule(
    instrumentType: InstrumentType,
    event: PatternEvent,
    audioTime: number,
    options?: {
      duration?: number;
      velocity?: number;
      midiNote?: number;
      noteName?: string;
    },
  ): boolean {
    if (!this.audioContext || !this.audioDestination) {
      this.logger.error(
        'Cannot schedule: audio context or destination not set',
      );
      return false;
    }

    const config = INSTRUMENT_CONFIGS[instrumentType];

    try {
      // Route to appropriate scheduling method based on instrument type
      if (instrumentType === 'harmony') {
        return this.scheduleHarmonyNote(event, audioTime, options);
      } else {
        return this.scheduleOneShot(config, event, audioTime, options);
      }
    } catch (error) {
      this.logger.error(`Failed to schedule ${instrumentType} event`, error);
      return false;
    }
  }

  /**
   * Schedule a one-shot sample (metronome, drums, bass, voice cue)
   */
  private scheduleOneShot(
    config: InstrumentConfig,
    event: PatternEvent,
    audioTime: number,
    options?: { velocity?: number },
  ): boolean {
    if (!this.audioContext || !this.audioDestination) {
      return false;
    }

    // Get buffer key from configuration
    const bufferKey = config.eventTypeToBufferKey?.[event.type];
    if (!bufferKey) {
      this.logger.warn(`No buffer mapping for event type: ${event.type}`);
      return false;
    }

    const buffer = this.getBuffer(bufferKey);
    if (!buffer) {
      this.logger.warn(`Buffer not found: ${bufferKey}`);
      return false;
    }

    // Create audio source
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Create gain node for velocity control
    const velocityGain = this.audioContext.createGain();
    const velocity = options?.velocity ?? 64;
    const velocityMultiplier = Math.pow(velocity / 127, 1.5);
    velocityGain.gain.value = (config.baseVolume ?? 0.8) * velocityMultiplier;

    // Connect: source → gain → destination
    source.connect(velocityGain);
    velocityGain.connect(this.audioDestination);

    // Start playback
    source.start(audioTime);

    // Track source (one-shot, auto-stops)
    this.activeSources.set(source, {
      type: 'one-shot',
      hasStopScheduled: false,
    });

    // CRITICAL: Auto-cleanup after playback (Bug #3 fix preserved)
    // Copied from SimpleInstrumentScheduler.ts:242-245
    source.onended = () => {
      this.activeSources.delete(source);
      try {
        velocityGain.disconnect();
      } catch {
        // Already disconnected, ignore
      }
    };

    return true;
  }

  /**
   * Schedule a harmony note (sustained with velocity layers)
   *
   * Applies instrument-specific octave shifting:
   * - Grand Piano: No shift (MIDI 60 → C4)
   * - Wurlitzer/Rhodes: -12 semitones (MIDI 60 → C3, but uses C4 sample)
   */
  private scheduleHarmonyNote(
    event: PatternEvent,
    audioTime: number,
    options?: {
      duration?: number;
      velocity?: number;
      midiNote?: number;
      noteName?: string;
    },
  ): boolean {
    if (!this.audioContext || !this.audioDestination) {
      return false;
    }

    let { duration = 0.5, velocity = 64, midiNote, noteName } = options ?? {};

    // Apply octave shift for non-Grand Piano instruments
    const harmonyConfig = INSTRUMENT_CONFIGS.harmony;
    const octaveShift = harmonyConfig.octaveShift ?? 0;

    // If MIDI note provided but no noteName, calculate note name after octave shift
    if (midiNote !== undefined && !noteName) {
      const adjustedMidiNote = midiNote - octaveShift;
      noteName = this.midiToNoteName(adjustedMidiNote);
    }

    // Default to C4 if still no note name
    if (!noteName) {
      noteName = 'C4';
    }

    // Select velocity layer using VelocityLayerSelector (supports 4-16 layers per instrument)
    const layer = this.velocityLayerSelector.selectLayer(velocity, noteName);
    const bufferKey = `${noteName}_${layer}`;
    const buffer = this.getBuffer(bufferKey);

    if (!buffer) {
      this.logger.warn(`Harmony buffer not found: ${bufferKey}`, {
        midiNote,
        octaveShift,
        noteName,
        layer,
      });
      return false;
    }

    // Create audio source
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Create gain node for velocity
    const gain = this.audioContext.createGain();
    const velocityMultiplier = Math.pow(velocity / 127, 1.5);
    gain.gain.value = 0.8 * velocityMultiplier;

    // Connect: source → gain → destination
    source.connect(gain);
    gain.connect(this.audioDestination);

    // Schedule start and stop
    const noteEndTime = audioTime + duration;
    source.start(audioTime);
    source.stop(noteEndTime);

    // Track source (sustained, has stop scheduled)
    this.activeSources.set(source, {
      type: 'sustained',
      hasStopScheduled: true,
    });

    // Track for harmony-specific management
    let activeForNote = this.activeHarmonySources.get(noteName);
    if (!activeForNote) {
      activeForNote = [];
      this.activeHarmonySources.set(noteName, activeForNote);
    }
    activeForNote.push({ source, gain });

    // CRITICAL: Auto-cleanup after playback (Bug #3 fix preserved)
    // Copied from HarmonyScheduler.ts:1151-1167
    source.onended = () => {
      // Clean up audio source when playback ends
      this.activeSources.delete(source);
      try {
        gain.disconnect();
      } catch {
        // Already disconnected, ignore
      }

      // Remove from active harmony sources
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

    return true;
  }

  /**
   * Schedule multiple events in a region (batch scheduling)
   */
  scheduleRegion(
    instrumentType: InstrumentType,
    events: PatternEvent[],
    startTime: number,
  ): { scheduled: number; failed: number } {
    let scheduled = 0;
    let failed = 0;

    for (const event of events) {
      const audioTime = startTime + (event.timeOffset ?? 0);
      const success = this.schedule(instrumentType, event, audioTime, {
        velocity: event.velocity,
        midiNote: event.midiNote,
        duration: event.duration,
        noteName: event.noteName,
      });

      if (success) {
        scheduled++;
      } else {
        failed++;
      }
    }

    this.logger.info(`Scheduled region for ${instrumentType}`, {
      scheduled,
      failed,
      total: events.length,
    });

    return { scheduled, failed };
  }

  /**
   * Cancel all scheduled audio sources (for tempo changes)
   */
  cancelAllScheduled(): void {
    let stoppedCount = 0;
    let cleanedCount = 0;

    for (const [source, metadata] of this.activeSources.entries()) {
      try {
        // CRITICAL FIX: ALWAYS stop sources immediately when user clicks stop button
        // Even if they have a scheduled stop time (e.g., sustained notes), we need to
        // stop them NOW to respect the user's action
        source.stop();
        stoppedCount++;
      } catch {
        // Source already stopped or disposed
      }

      try {
        source.disconnect();
        cleanedCount++;
      } catch {
        // Already disconnected
      }
    }

    // Clear all tracking
    this.activeSources.clear();
    this.activeHarmonySources.clear();

    this.logger.info('Cancelled all scheduled sources', {
      stoppedCount,
      cleanedCount,
      instanceId: this.instanceId,
    });
  }

  /**
   * Dispose of scheduler and clean up resources
   */
  dispose(): void {
    this.logger.info('Disposing scheduler', { instanceId: this.instanceId });

    // Cancel all active sources
    this.cancelAllScheduled();

    // Clear buffers
    this.buffers.clear();

    // Clear references
    this.audioContext = null;
    this.audioDestination = null;

    this.logger.info('Scheduler disposed', { instanceId: this.instanceId });
  }

  /**
   * Get statistics for monitoring
   */
  getStats() {
    return {
      activeSourcesCount: this.activeSources.size,
      activeHarmonyNotesCount: this.activeHarmonySources.size,
      bufferCount: this.buffers.size,
      instanceId: this.instanceId,
    };
  }

  /**
   * Convert MIDI note number to note name with 's' for sharps
   * Example: 60 → 'C4', 61 → 'Cs4', 62 → 'D4'
   *
   * Uses 's' for sharps (not '#') to match buffer cache keys
   * Grand Piano keyboard map uses: 'Cs4', 'Ds4', 'Fs4', 'Gs4', 'As4'
   */
  private midiToNoteName(midiNote: number): string {
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
    return `${noteNames[noteIndex]}${octave}`;
  }
}
