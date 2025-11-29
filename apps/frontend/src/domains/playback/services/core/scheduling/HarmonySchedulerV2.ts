/**
 * HarmonySchedulerV2 - Modular harmony scheduler using extracted components
 *
 * FAANG Compliance: <600 lines (target ~550)
 *
 * Integrates extracted modules:
 * - VelocityLayerSelector: Dynamic layer selection (4-16 layers)
 * - SustainPedalHandler: CC64 sustain pedal logic
 * - GrandPianoMapper: Keyboard mapping with pitch-shift
 * - FadeoutManager: Musical fadeout automation
 * - BufferFallbackStrategy: Multi-strategy buffer resolution
 *
 * Replaces legacy HarmonyScheduler.ts (1,477 lines) with clean modular architecture
 *
 * Key Features:
 * - Instrument-specific octave shifting (Grand Piano: 0, Wurlitzer/Rhodes: -12)
 * - Sample-perfect timing using AudioBufferSourceNode
 * - CC64 sustain pedal with syncopated pedaling support
 * - Last-note ring-out detection (3-stage fadeout)
 * - Grand Piano sparse sampling (88 keys → 25 samples)
 * - Polyphony management with active source tracking
 *
 * Usage:
 * ```typescript
 * const scheduler = new HarmonySchedulerV2(instanceId, tracks, cc64Builder, sustainAnalyzer);
 * scheduler.setAudioContext(audioContext);
 * await scheduler.setBuffers(samples, destination, perNoteRanges, 'grandpiano');
 * scheduler.setExerciseTiming(endTime, lastBeatThreshold);
 * scheduler.schedule(event, audioTime, frame);
 * ```
 */

import { createStructuredLogger } from '../../../modules/shared/index.js';
import type { PatternEvent } from '../types/region.types.js';
import type { CC64TimelineBuilder } from '../sustain/CC64TimelineBuilder.js';
import type { SustainPedalAnalyzer } from '../sustain/SustainPedalAnalyzer.js';

// Extracted modules
import { VelocityLayerSelector } from './VelocityLayerSelector.js';
import type { PerNoteVelocityRanges } from './VelocityLayerSelector.js';
import { SustainPedalHandler } from './SustainPedalHandler.js';
import { GrandPianoMapper } from './GrandPianoMapper.js';
import { FadeoutManager } from './FadeoutManager.js';
import { BufferFallbackStrategy } from './BufferFallbackStrategy.js';

const logger = createStructuredLogger('HarmonySchedulerV2');

/**
 * Harmony instrument types
 */
export type HarmonyInstrument =
  | 'grandpiano'
  | 'wurlitzer'
  | 'rhodes'
  | 'nicekeysrhodes';

/**
 * Active source tracking for polyphony and cleanup
 */
interface ActiveSource {
  source: AudioBufferSourceNode;
  gain: GainNode;
  gainValue: number;
  noteEndTime: number;
}

/**
 * HarmonySchedulerV2 - Clean modular harmony scheduler
 */
export class HarmonySchedulerV2 {
  // Audio context and destination
  private audioContext: AudioContext | null = null;
  private audioDestination: AudioNode | null = null;
  private sampleRate = 48000;
  private transportStartTime = 0;

  // Buffer storage
  private harmonyBuffers = new Map<string, Map<string, AudioBuffer>>();
  // Structure: harmonyBuffers.get('v10').get('D4') → AudioBuffer

  // Current instrument state
  private currentHarmonyInstrument: HarmonyInstrument | null = null;

  // Exercise timing for last-note detection
  private exerciseEndTime = 0;
  private lastBeatThreshold = 0;

  // CC64 sustain timeline (injected from outside)
  private currentCC64Timeline = new Map<number, boolean>();

  // Active source tracking for polyphony and cleanup
  private activeHarmonySources = new Map<string, ActiveSource[]>();
  private scheduledAudioSources = new Map<
    AudioBufferSourceNode,
    { type: 'one-shot' | 'sustained'; hasStopScheduled: boolean }
  >();

  // Instance tracking
  private instanceId: string;
  private tracks: Map<string, any>; // Reference to track registry

  // Injected dependencies
  private cc64Builder: CC64TimelineBuilder;
  private sustainAnalyzer: SustainPedalAnalyzer;

  // Extracted modules
  private velocityLayerSelector: VelocityLayerSelector;
  private sustainPedalHandler: SustainPedalHandler;

  constructor(
    instanceId: string,
    tracks: Map<string, any>,
    cc64Builder: CC64TimelineBuilder,
    sustainAnalyzer: SustainPedalAnalyzer,
  ) {
    this.instanceId = instanceId;
    this.tracks = tracks;
    this.cc64Builder = cc64Builder;
    this.sustainAnalyzer = sustainAnalyzer;

    // Initialize extracted modules
    this.velocityLayerSelector = new VelocityLayerSelector();
    this.sustainPedalHandler = new SustainPedalHandler();
  }

  /**
   * Set audio context and sample rate
   */
  setAudioContext(context: AudioContext, transportStartTime = 0): void {
    this.audioContext = context;
    this.sampleRate = context.sampleRate;
    this.transportStartTime = transportStartTime;
  }

  /**
   * Set harmony buffers and destination
   * @param samples - Map of velocity layers to note maps
   * @param destination - Audio destination node
   * @param perNoteVelocityRanges - Optional per-note velocity configuration
   * @param instrument - Instrument type ('grandpiano', 'wurlitzer', 'rhodes', 'nicekeysrhodes')
   */
  async setBuffers(
    samples: Map<string, Map<string, AudioBuffer>>,
    destination: AudioNode,
    perNoteVelocityRanges?: PerNoteVelocityRanges,
    instrument?: HarmonyInstrument,
  ): Promise<void> {
    this.harmonyBuffers = samples;
    this.audioDestination = destination;
    this.currentHarmonyInstrument = instrument || null;

    // Configure velocity layer selector
    if (instrument) {
      this.velocityLayerSelector.setInstrument(instrument);
    }
    if (perNoteVelocityRanges) {
      this.velocityLayerSelector.setPerNoteRanges(perNoteVelocityRanges);
    }

    // Load Grand Piano keyboard map if needed
    if (instrument === 'grandpiano' && !GrandPianoMapper.hasKeyboardMap()) {
      await GrandPianoMapper.loadKeyboardMap();
    }

    logger.info('Harmony buffers injected', {
      layerCount: samples.size,
      layers: Array.from(samples.keys()),
      instrument: instrument || 'unknown',
      instanceId: this.instanceId,
    });
  }

  /**
   * Set exercise timing for last-note ring-out detection
   */
  setExerciseTiming(endTime: number, lastBeatThreshold: number): void {
    this.exerciseEndTime = endTime;
    this.lastBeatThreshold = lastBeatThreshold;
    this.sustainAnalyzer.setExerciseTiming(endTime, lastBeatThreshold);
    this.sustainPedalHandler.setExerciseTiming(endTime, lastBeatThreshold);
  }

  /**
   * Set current CC64 timeline (injected from RegionProcessor)
   */
  setCurrentCC64Timeline(timeline: Map<number, boolean>): void {
    this.currentCC64Timeline = timeline;
  }

  /**
   * Get current instrument type
   */
  getCurrentInstrument(): HarmonyInstrument | null {
    return this.currentHarmonyInstrument;
  }

  /**
   * Schedule harmony event with direct audio
   * @returns true if successfully scheduled, false to fall back to event bus
   */
  schedule(event: PatternEvent, audioTime: number, frame: number): boolean {
    logger.debug('HarmonySchedulerV2 schedule entry', {
      eventType: event.type,
      audioTime,
      frame,
    });

    const eventData = event.data as any;

    // Handle control change events (sustain pedal, etc.)
    if (
      event.type === 'harmony-control-change' &&
      eventData?.cc !== undefined
    ) {
      if (eventData.cc === 64) {
        // CC64 = Sustain Pedal (logged but not processed - pre-calculated timeline)
        logger.debug('CC64 event acknowledged', {
          value: eventData.value,
          audioTime,
        });
        return true;
      } else {
        logger.debug(`Unsupported CC${eventData.cc} - only CC64 implemented`);
        return false;
      }
    }

    // Schedule MIDI notes
    if (eventData?.midiNote !== undefined) {
      return this.scheduleHarmonyMidiNoteDirect(event, audioTime, frame);
    }

    // Fallback to chord scheduling (legacy path - may not be used)
    logger.warn('Chord scheduling not implemented in V2', { event });
    return false;
  }

  /**
   * Schedule individual MIDI note for harmony
   * Core integration method that uses all 5 extracted modules
   * @private
   */
  private scheduleHarmonyMidiNoteDirect(
    event: PatternEvent,
    audioTime: number,
    _frame: number,
  ): boolean {
    if (!this.audioContext || !this.audioDestination) {
      logger.warn('Cannot schedule - missing audio dependencies');
      return false;
    }

    const eventData = event.data as any;

    // STEP 1: Apply instrument-specific octave shift
    const octaveShift = this.currentHarmonyInstrument === 'grandpiano' ? 0 : 12;
    const midiNote = eventData.midiNote - octaveShift;
    const velocity = eventData.velocity || event.velocity * 127;
    const duration = event.duration || 2; // Default 2 seconds

    // STEP 2: Convert MIDI note to note name (C4, Cs4, D4, etc.)
    const noteName = this.midiToNoteName(midiNote);

    // STEP 3: Select velocity layer using VelocityLayerSelector
    const layer = this.velocityLayerSelector.selectLayer(velocity, noteName);

    // STEP 4: Apply Grand Piano keyboard mapping if needed
    let sampleNote = noteName; // Default to requested note
    let playbackRate = 1.0;

    if (
      this.currentHarmonyInstrument === 'grandpiano' &&
      GrandPianoMapper.hasKeyboardMap()
    ) {
      const mapping = GrandPianoMapper.mapNote(noteName);
      if (mapping) {
        sampleNote = mapping.sample; // e.g., "A3" for "Gs3"
        playbackRate = mapping.playbackRate; // e.g., 1.059 for +1 semitone
      }
    }

    // STEP 5: Resolve buffer using BufferFallbackStrategy
    const instrument = this.currentHarmonyInstrument || 'wurlitzer';
    const bufferResult = BufferFallbackStrategy.resolveBuffer(
      this.harmonyBuffers,
      instrument,
      layer,
      sampleNote,
    );

    if (!bufferResult.buffer) {
      logger.error('Missing buffer after all fallback strategies', {
        layer,
        noteName,
        sampleNote,
        midiNote,
        instrument,
        source: bufferResult.source,
      });
      return false;
    }

    const buffer = bufferResult.buffer;

    try {
      // STEP 6: Analyze CC64 sustain using SustainPedalHandler
      const sustainResult = this.sustainPedalHandler.analyzeSustain(
        audioTime,
        duration,
        noteName,
        buffer,
        this.currentCC64Timeline,
      );

      const actualDuration = sustainResult.sustainedDuration;
      const willBeSustained = sustainResult.shouldEnableLooping;

      // STEP 7: Create audio source with looping if needed
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;

      // Enable looping for sustained notes
      if (willBeSustained && sustainResult.loopStart && sustainResult.loopEnd) {
        source.loop = true;
        source.loopStart = sustainResult.loopStart;
        source.loopEnd = sustainResult.loopEnd;
        logger.debug('Looping enabled for sustained note', {
          noteName,
          loopStart: sustainResult.loopStart,
          loopEnd: sustainResult.loopEnd,
          sustainedDuration: actualDuration,
        });
      }

      // STEP 8: Create gain node for velocity control
      const gain = this.audioContext.createGain();
      const targetGain = (velocity / 127) * 0.8;
      gain.gain.setValueAtTime(targetGain, audioTime);

      // Connect audio graph
      source.connect(gain);
      gain.connect(this.audioDestination);

      // STEP 9: Determine if this is the last note (for special fadeout)
      const noteEndTime = audioTime + actualDuration;
      const isLastNote = FadeoutManager.isLastNote(
        noteEndTime,
        this.exerciseEndTime,
      );

      // STEP 10: Schedule fadeout using FadeoutManager
      const fadeout = FadeoutManager.scheduleFadeout(
        gain,
        targetGain,
        noteEndTime,
        isLastNote,
      );

      // STEP 11: Start playback and schedule stop
      source.start(audioTime);
      source.stop(fadeout.stopTime);

      // Track active sources for cleanup
      if (!this.activeHarmonySources.has(noteName)) {
        this.activeHarmonySources.set(noteName, []);
      }
      const sources = this.activeHarmonySources.get(noteName);
      if (sources) {
        sources.push({
          source,
          gain,
          gainValue: targetGain,
          noteEndTime,
        });
      }

      this.scheduledAudioSources.set(source, {
        type: 'sustained',
        hasStopScheduled: true,
      });

      // Auto-cleanup on end
      source.onended = () => {
        this.cleanupSource(source, noteName);
      };

      logger.debug('Harmony MIDI note scheduled', {
        midiNote,
        noteName,
        sampleNote,
        layer,
        velocity,
        audioTime,
        duration,
        actualDuration,
        fadeoutType: fadeout.type,
        bufferSource: bufferResult.source,
      });

      return true;
    } catch (error) {
      logger.error(`Failed to schedule harmony MIDI note ${midiNote}`, error);
      return false;
    }
  }

  /**
   * Stop all active harmony sources
   */
  stopAll(): void {
    this.scheduledAudioSources.forEach((metadata, source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Source may have already stopped/disconnected
      }
    });
    this.scheduledAudioSources.clear();
    this.activeHarmonySources.clear();
  }

  /**
   * Convert MIDI note number to note name with 's' for sharps
   * Example: 60 → 'C4', 61 → 'Cs4', 62 → 'D4'
   * @private
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

  /**
   * Cleanup source after playback ends
   * @private
   */
  private cleanupSource(source: AudioBufferSourceNode, noteName: string): void {
    this.scheduledAudioSources.delete(source);

    const activeSources = this.activeHarmonySources.get(noteName);
    if (activeSources) {
      const index = activeSources.findIndex((s) => s.source === source);
      if (index !== -1) {
        activeSources[index].gain.disconnect();
        activeSources.splice(index, 1);
      }
      if (activeSources.length === 0) {
        this.activeHarmonySources.delete(noteName);
      }
    }
  }
}
