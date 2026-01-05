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
import { midiToNoteName } from '../../../utils/midiUtils.js';

// Extracted modules
import { VelocityLayerSelector } from './VelocityLayerSelector.js';
import type { PerNoteVelocityRanges } from './VelocityLayerSelector.js';
import { SustainPedalHandler } from './SustainPedalHandler.js';
import { GrandPianoMapper } from './GrandPianoMapper.js';
import { FadeoutManager } from './FadeoutManager.js';
import { BufferFallbackStrategy } from './BufferFallbackStrategy.js';

// EQ for Grand Piano
import {
  ParametricEQ,
  GRAND_PIANO_EQ_PRESET,
} from '../../../modules/audio-engine/processors/ParametricEQ.js';

// Timing diagnostic
import { InstrumentTimingDiagnostic } from '../diagnostics/InstrumentTimingDiagnostic.js';

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

  // Grand Piano EQ - inserted between gain nodes and destination
  private grandPianoEQ: ParametricEQ | null = null;
  private eqOutputNode: AudioNode | null = null; // What sources connect to (EQ input or direct destination)

  // Buffer storage
  private harmonyBuffers = new Map<string, Map<string, AudioBuffer>>();
  // Structure: harmonyBuffers.get('v10').get('D4') → AudioBuffer

  // Current instrument state
  private currentHarmonyInstrument: HarmonyInstrument | null = null;

  // Exercise timing for last-note detection
  private exerciseEndTime = 0;
  private lastBeatThreshold = 0;

  // CC64 sustain timeline is managed by SustainPedalHandler (set via setCurrentCC64Timeline)

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

    // DIAGNOSTIC: Log instance creation for debugging
    console.log('[🏗️ HARMONY-V2 INSTANCE CREATED 🏗️]', {
      instanceId,
      tracksType: tracks?.constructor?.name,
      isMap: tracks instanceof Map,
      tracksSize: tracks instanceof Map ? tracks.size : 'N/A',
      timestamp: Date.now(),
    });

    // Initialize extracted modules
    this.velocityLayerSelector = new VelocityLayerSelector();
    this.sustainPedalHandler = new SustainPedalHandler();

    // 🔍 DIAGNOSTIC: Log sustainPedalHandler instance for debugging
    console.log(`[CC64 DIAGNOSTIC] HarmonySchedulerV2 created sustainPedalHandler`, {
      instanceId,
      sustainPedalHandler: this.sustainPedalHandler,
    });
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
    // CRITICAL FIX: Stop all active sources when switching instruments
    // This prevents audio doubling when changing from one instrument to another
    // (e.g., Wurlitzer → Grand Piano). Without this, old scheduled notes continue
    // playing with the previous instrument's samples while new notes play with
    // the new instrument's samples, causing the "two pianos" effect.
    const isInstrumentChanging =
      instrument !== this.currentHarmonyInstrument &&
      this.currentHarmonyInstrument !== null;
    const hasActiveSources =
      this.scheduledAudioSources.size > 0 ||
      this.activeHarmonySources.size > 0;

    if (isInstrumentChanging) {
      console.log(
        '[HARMONY-SCHEDULER-V2] 🔄 Instrument changed',
        {
          oldInstrument: this.currentHarmonyInstrument,
          newInstrument: instrument,
          scheduledCount: this.scheduledAudioSources.size,
          activeCount: this.activeHarmonySources.size,
          willStopSources: hasActiveSources,
        },
      );

      // Only call stopAll if there are sources to stop
      // This avoids the "Map is EMPTY" error when switching before any notes played
      if (hasActiveSources) {
        // Use graceful=false for quick 50ms fadeout when switching instruments
        // This prevents clicks while stopping audio quickly
        this.stopAll(false);
      }
    }

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

    // Set up EQ for Grand Piano
    this.setupEQ(instrument, destination);

    logger.info('Harmony buffers injected', {
      layerCount: samples.size,
      layers: Array.from(samples.keys()),
      instrument: instrument || 'unknown',
      instanceId: this.instanceId,
      hasEQ: !!this.grandPianoEQ,
    });

    // 🔍 DIAGNOSTIC: Log all buffer keys and durations for F notes
    console.log(`[HARMONY] BUFFER MAP INJECTED for ${instrument}:`);
    samples.forEach((noteMap, layer) => {
      const fNotes = Array.from(noteMap.entries())
        .filter(([note]) => note.startsWith('F') && !note.startsWith('Fs'))
        .map(([note, buf]) => `${note}:${buf.duration.toFixed(2)}s`);
      if (fNotes.length > 0) {
        console.log(`  ${layer}: ${fNotes.join(', ')}`);
      }
    });
  }

  /**
   * Set up EQ for Grand Piano instrument
   * Creates ParametricEQ and inserts it between gain nodes and destination
   */
  private setupEQ(
    instrument: HarmonyInstrument | undefined,
    destination: AudioNode,
  ): void {
    // Dispose previous EQ if exists
    if (this.grandPianoEQ) {
      try {
        this.grandPianoEQ.dispose();
      } catch (e) {
        // Ignore dispose errors
      }
      this.grandPianoEQ = null;
    }

    // Only create EQ for Grand Piano
    if (instrument !== 'grandpiano') {
      this.eqOutputNode = destination;
      console.log(`[HARMONY-EQ] No EQ for instrument: ${instrument}, connecting directly to destination`);
      return;
    }

    if (!this.audioContext) {
      console.warn('[HARMONY-EQ] Cannot set up EQ: AudioContext not available');
      this.eqOutputNode = destination;
      return;
    }

    try {
      // Create Grand Piano EQ with professional preset
      this.grandPianoEQ = ParametricEQ.createWithPreset(
        this.audioContext,
        GRAND_PIANO_EQ_PRESET,
      );

      // Connect EQ output to destination
      this.grandPianoEQ.output.connect(destination);

      // Sources should connect to EQ input
      this.eqOutputNode = this.grandPianoEQ.input;

      console.log('[HARMONY-EQ] ✅ Grand Piano EQ created and connected', {
        bands: this.grandPianoEQ.getBands().length,
        instanceId: this.instanceId,
      });

      logger.info('Grand Piano EQ configured', {
        bands: this.grandPianoEQ.getBands().length,
        instanceId: this.instanceId,
      });
    } catch (error) {
      console.error('[HARMONY-EQ] ❌ Failed to set up EQ:', error);
      logger.warn('Failed to set up Grand Piano EQ', { error });
      this.grandPianoEQ = null;
      this.eqOutputNode = destination;
    }
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
   * Propagates timeline to SustainPedalHandler for analyzeSustain() to use
   */
  setCurrentCC64Timeline(timeline: Map<number, boolean>): void {
    // Propagate timeline directly to SustainPedalHandler so analyzeSustain() can use it
    this.sustainPedalHandler.setCC64Timeline(timeline);
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
    // Debug logging removed for performance - object construction adds ~2ms even when filtered
    const eventData = event.data as any;

    // Handle control change events (sustain pedal, etc.)
    if (
      event.type === 'harmony-control-change' &&
      eventData?.cc !== undefined
    ) {
      if (eventData.cc === 64) {
        // CC64 = Sustain Pedal (acknowledged but not processed - pre-calculated timeline)
        return true;
      } else {
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
    const noteName = midiToNoteName(midiNote);

    // Get measure number for diagnostics (used below if diagnostic enabled)
    const measureNum = eventData.position?.measure || eventData.measureNumber || '?';

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

    // Buffer logging removed for performance - was adding ~5ms per note

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
      // Timeline is already set via setCurrentCC64Timeline() → sustainPedalHandler.setCC64Timeline()
      const sustainResult = this.sustainPedalHandler.analyzeSustain(
        audioTime,
        duration,
        noteName,
        buffer,
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

      // Connect audio graph: source → gain → EQ (if Grand Piano) → destination
      source.connect(gain);
      // Use eqOutputNode if available (routes through EQ for Grand Piano)
      const outputNode = this.eqOutputNode || this.audioDestination;

      // Audio graph logging removed for performance - was adding ~3ms per note

      if (outputNode) {
        gain.connect(outputNode);
      } else {
        console.error('[HARMONY] ❌ NO OUTPUT NODE - audio will NOT play!');
      }

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
      const sourceStartTime = performance.now();
      source.start(audioTime);
      source.stop(fadeout.stopTime);
      const sourceStartEnd = performance.now();

      // 🎯 TIMING DIAGNOSTIC: Record for cross-instrument comparison
      if (InstrumentTimingDiagnostic.isEnabled()) {
        const scheduleFrame = Math.round((this.audioContext?.currentTime || 0) * (this.audioContext?.sampleRate || 48000));
        const targetFrame = Math.round(audioTime * (this.audioContext?.sampleRate || 48000));
        const lookaheadMs = (targetFrame - scheduleFrame) / (this.audioContext?.sampleRate || 48000) * 1000;

        InstrumentTimingDiagnostic.record({
          instrument: 'harmony',
          eventType: eventData.noteName || `midi-${event.data?.midi}`,
          scheduledAudioTime: audioTime,
          jsExecutionTime: sourceStartEnd,
          scheduleFrame,
          targetFrame,
          lookaheadMs,
          beat: ((measureNum - 1) * 4 + 1) % 4 + 1, // Approximate beat from measure
          measure: measureNum,
        });
      }

      // Playback logging removed for performance - was adding ~5ms per note

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

      // Source tracking logging removed for performance

      // CRITICAL: DO NOT auto-cleanup on onended during normal playback!
      // We need to keep ALL sources tracked so stopAll() can cancel future scheduled notes.
      // Only clean up the active harmony sources (for polyphony), not the tracking Map.
      source.onended = () => {
        // Only clean up the activeHarmonySources for polyphony management
        // DO NOT remove from scheduledAudioSources - we need it for stopAll()
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
      };

      // Debug logging removed for performance - object construction adds ~3ms even when filtered

      return true;
    } catch (error) {
      logger.error(`Failed to schedule harmony MIDI note ${midiNote}`, error);
      return false;
    }
  }

  /**
   * Stop all active harmony sources
   *
   * @param graceful - If true, applies a 4-second ring-out (1.5s hold + 2.5s fade) for sustained notes
   *                   If false, immediately cancels ALL sources including future scheduled notes
   */
  stopAll(graceful = false): void {
    const mapSnapshot = Array.from(this.scheduledAudioSources.entries()).map(
      ([source, metadata]) => ({
        sourceState: source.playbackState,
        metadata,
      }),
    );

    console.log('[🛑 HARMONY-SCHEDULER-V2 STOP CALLED 🛑]', {
      instanceId: this.instanceId,
      scheduledCount: this.scheduledAudioSources.size,
      activeCount: this.activeHarmonySources.size,
      graceful,
      mapSnapshot: mapSnapshot.slice(0, 5), // Show first 5 for brevity
      totalSources: mapSnapshot.length,
    });

    // If map is empty but we have active sources, that's a real problem (instance mismatch)
    // If both are empty, it's normal - playback ended naturally or was never started
    if (this.scheduledAudioSources.size === 0 && this.activeHarmonySources.size > 0) {
      console.error('[🚨 STOP PROBLEM 🚨] scheduledAudioSources is EMPTY but activeHarmonySources has content!', {
        instanceId: this.instanceId,
        activeHarmonySources: this.activeHarmonySources.size,
        message: 'Sources were removed from Map before stopAll() was called!',
        possibleCause:
          'Wrong instance being called for stop! Check if there are multiple instances.',
      });
    }

    // Ring-out timing constants
    const RING_OUT_HOLD = 1.5; // 1.5 second hold at current volume
    const RING_OUT_FADE = 2.5; // 2.5 second fadeout
    const currentTime = this.audioContext?.currentTime ?? 0;
    const fadeStartTime = currentTime + RING_OUT_HOLD;
    const stopTime = fadeStartTime + RING_OUT_FADE;

    let stoppedCount = 0;
    let fadedCount = 0;
    let errorCount = 0;

    // For graceful stop, apply fade to active harmony sources via their gain nodes
    if (graceful && this.audioContext) {
      this.activeHarmonySources.forEach((sources, noteName) => {
        sources.forEach(({ gain, gainValue }) => {
          try {
            // Cancel any existing automation
            gain.gain.cancelScheduledValues(currentTime);
            // Hold current gain for 1 second
            gain.gain.setValueAtTime(gainValue, currentTime);
            gain.gain.linearRampToValueAtTime(gainValue, fadeStartTime);
            // Fade to silence over 1 second
            gain.gain.exponentialRampToValueAtTime(0.001, stopTime);
            fadedCount++;
          } catch (e) {
            errorCount++;
          }
        });
      });
      console.log('[HARMONY GRACEFUL] Applied 2s ring-out fade', {
        fadedCount,
        holdUntil: fadeStartTime.toFixed(3),
        fadeEndAt: stopTime.toFixed(3),
      });
    }

    // For manual stop (non-graceful), apply a quick 30ms fadeout to avoid clicks
    const MANUAL_FADEOUT_TIME = 0.03; // 30ms fadeout for manual stop (matches other schedulers)
    const manualStopTime = currentTime + MANUAL_FADEOUT_TIME;

    // Collect sources to disconnect after fadeout
    const sourcesToDisconnect: AudioBufferSourceNode[] = [];

    // Apply fadeout to all active sources for manual stop (before stopping)
    if (!graceful && this.audioContext) {
      this.activeHarmonySources.forEach((sources) => {
        sources.forEach(({ gain, gainValue }) => {
          try {
            gain.gain.cancelScheduledValues(currentTime);
            gain.gain.setValueAtTime(gainValue, currentTime);
            gain.gain.linearRampToValueAtTime(0, manualStopTime);
            fadedCount++;
          } catch (e) {
            // Ignore - gain may already be disconnected
          }
        });
      });
      console.log('[HARMONY MANUAL STOP] Applied 30ms fadeout', {
        fadedCount,
        fadeEndAt: manualStopTime.toFixed(3),
      });
    }

    this.scheduledAudioSources.forEach((metadata, source) => {
      try {
        if (graceful && metadata.hasStopScheduled) {
          // GRACEFUL: Reschedule stop to after the fade completes
          // Cancel existing stop and schedule new one
          source.stop(stopTime + 0.01); // Small buffer after fade
          return;
        }

        // Schedule stop after fadeout (or immediately if no context)
        if (this.audioContext) {
          source.stop(graceful ? stopTime + 0.01 : manualStopTime + 0.001);
        } else {
          source.stop(0);
        }
        // DON'T disconnect immediately - this causes audio spike!
        // Collect for delayed disconnect after fadeout
        sourcesToDisconnect.push(source);
        stoppedCount++;
      } catch (e) {
        // Source may have already stopped/disconnected or never started
        errorCount++;
      }
    });

    // Clear tracking maps (for graceful, sources will auto-cleanup when they end)
    this.scheduledAudioSources.clear();
    this.activeHarmonySources.clear();

    // Disconnect sources AFTER fadeout completes (async cleanup)
    if (sourcesToDisconnect.length > 0 && !graceful) {
      setTimeout(() => {
        sourcesToDisconnect.forEach((source) => {
          try {
            source.disconnect();
          } catch {
            // Already disconnected
          }
        });
      }, MANUAL_FADEOUT_TIME * 1000 + 10); // 10ms buffer after fadeout
    }

    console.log('[HARMONY-SCHEDULER-V2 STOP] Sources stopped', {
      stoppedCount,
      fadedCount,
      errorCount,
      graceful,
    });
  }

  // Phase 4.1: midiToNoteName() extracted to shared utils/midiUtils.ts

  /**
   * Cleanup source after playback ends
   * @private
   */
  private cleanupSource(source: AudioBufferSourceNode, noteName: string): void {
    console.error(
      '[🚨🚨🚨 CLEANUP-SOURCE CALLED 🚨🚨🚨] This should NEVER happen!',
      {
        noteName,
        mapSizeBefore: this.scheduledAudioSources.size,
        stackTrace: new Error().stack,
      },
    );
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
