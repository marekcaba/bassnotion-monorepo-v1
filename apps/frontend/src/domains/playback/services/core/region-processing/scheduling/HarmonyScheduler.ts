/**
 * HarmonyScheduler - Direct audio scheduling for harmony instruments
 *
 * Schedules piano, Rhodes, and Wurlitzer samples with:
 * - Sample-perfect timing using AudioBufferSourceNode
 * - Per-note velocity layer selection (v1-v15)
 * - Instrument-specific octave shifts (Wurlitzer: -12, Grand Piano: 0)
 * - CC64 sustain pedal integration for duration extension
 * - Grand Piano sparse sampling with pitch-shift mapping
 * - Last-note ring-out detection (3s decay at exercise end)
 * - Polyphony management with active source tracking
 * - Sample looping for sustained notes
 */

import { getLogger } from '@/utils/logger.js';
import { GlobalSampleCache } from '@/domains/playback/modules/storage/cache/GlobalSampleCache.js';
import type { PatternEvent } from '../types/region.types.js';
import type { GrandPianoKeyboardMapper } from './GrandPianoKeyboardMapper.js';
import type { CC64TimelineBuilder } from '../sustain/CC64TimelineBuilder.js';
import type { SustainPedalAnalyzer } from '../sustain/SustainPedalAnalyzer.js';

const logger = getLogger('HarmonyScheduler');

export class HarmonyScheduler {
  private harmonyBuffers = new Map<string, Map<string, AudioBuffer>>();
  // Structure: harmonyBuffers.get('v10').get('D4') → AudioBuffer
  private harmonyVelocityRanges: Record<string, any[]> | undefined;
  // Per-note velocity ranges from instrument config (e.g., wurlitzer-piano.json)
  private currentHarmonyInstrument: string | null = null;
  // Current harmony instrument type ('grandpiano', 'wurlitzer', 'rhodes')

  private audioContext: AudioContext | null = null;
  private audioDestination: AudioNode | null = null;
  private sampleRate = 48000;
  private transportStartTime = 0;

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

  // CC64 sustain timeline (injected from outside)
  private currentCC64Timeline = new Map<number, boolean>();

  // Exercise timing for last-note ring-out detection
  private exerciseEndTime = 0;
  private lastBeatThreshold = 0;

  // Diagnostic: Count logged notes
  private _noteLogCount = 0;

  private instanceId: string;
  private tracks: Map<string, any>; // Reference to track registry for validation

  // Injected dependencies
  private keyboardMapper: GrandPianoKeyboardMapper;
  private cc64Builder: CC64TimelineBuilder;
  private sustainAnalyzer: SustainPedalAnalyzer;

  private scheduledAudioSources = new Map<
    AudioBufferSourceNode,
    { type: 'one-shot' | 'sustained'; hasStopScheduled: boolean }
  >();

  constructor(
    instanceId: string,
    tracks: Map<string, any>,
    keyboardMapper: GrandPianoKeyboardMapper,
    cc64Builder: CC64TimelineBuilder,
    sustainAnalyzer: SustainPedalAnalyzer,
  ) {
    this.instanceId = instanceId;
    this.tracks = tracks;
    this.keyboardMapper = keyboardMapper;
    this.cc64Builder = cc64Builder;
    this.sustainAnalyzer = sustainAnalyzer;
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
   * @param instrument - Instrument type ('grandpiano', 'wurlitzer', 'rhodes')
   */
  async setBuffers(
    samples: Map<string, Map<string, AudioBuffer>>,
    destination: AudioNode,
    perNoteVelocityRanges?: Record<string, any[]>,
    instrument?: string,
  ): Promise<void> {
    this.harmonyBuffers = samples;
    this.audioDestination = destination;
    this.harmonyVelocityRanges = perNoteVelocityRanges;
    this.currentHarmonyInstrument = instrument || null;

    // Load Grand Piano keyboard map if instrument is Grand Piano
    if (instrument === 'grandpiano' && !this.keyboardMapper.hasKeyboardMap()) {
      await this.keyboardMapper.loadKeyboardMap();
    }

    logger.info('✅ Harmony buffers injected', {
      layerCount: samples.size,
      layers: Array.from(samples.keys()),
      hasDestination: !!destination,
      hasVelocityRanges: !!perNoteVelocityRanges,
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
  getCurrentInstrument(): string | null {
    return this.currentHarmonyInstrument;
  }

  /**
   * Check if keyboard map is loaded (for testing)
   */
  hasKeyboardMap(): boolean {
    return this.keyboardMapper.hasKeyboardMap();
  }

  /**
   * Schedule harmony event with direct audio
   * @returns true if successfully scheduled, false to fall back to event bus
   */
  schedule(event: PatternEvent, audioTime: number, frame: number): boolean {
    // 🚨 CRITICAL DIAGNOSTIC: This should ALWAYS log when harmony plays
    // eslint-disable-next-line no-console, no-restricted-syntax
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
        instanceId: this.instanceId,
      });
    }

    // NEW: Check event type - control change, MIDI note, or chord symbol
    const eventData = event.data as any;

    // eslint-disable-next-line no-console, no-restricted-syntax
    console.log(
      `[HARMONY EVENT DEBUG] Received event type: "${event.type}", has cc: ${eventData?.cc !== undefined}, cc value: ${eventData?.cc}`,
    );

    // Handle control change events (sustain pedal, expression, etc.)
    if (
      event.type === 'harmony-control-change' &&
      eventData?.cc !== undefined
    ) {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(
        `[HARMONY EVENT DEBUG] ✅ Matched harmony-control-change, CC = ${eventData.cc}`,
      );
      if (eventData.cc === 64) {
        // CC64 = Sustain Pedal
        // Using pre-calculated timeline approach - real-time events are logged but not processed
        // Sustain duration is calculated upfront when notes are scheduled (see buildCC64Timeline)
        // eslint-disable-next-line no-console, no-restricted-syntax
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
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(
        '✅ Taking MIDI NOTE path - calling scheduleHarmonyMidiNoteDirect',
        {
          midiNote: eventData.midiNote,
          eventType: event.type,
        },
      );
      // CRITICAL FIX: Schedule MIDI notes directly (like drummer) instead using Tone.js
      // This allows us to call source.stop(0) when stop button is clicked
      return this.scheduleHarmonyMidiNoteDirect(event, audioTime, frame);
    }

    // Original chord scheduling logic
    // eslint-disable-next-line no-console, no-restricted-syntax
    console.log('⚠️ Taking OLD CHORD path (not MIDI notes)', {
      eventType: event.type,
      eventData,
    });
    return this.scheduleChordDirect(event, audioTime, frame);
  }

  /**
   * Schedule chord symbol (legacy path)
   * @private
   */
  private scheduleChordDirect(
    event: PatternEvent,
    audioTime: number,
    frame: number,
  ): boolean {
    if (!this.audioContext || !this.audioDestination) {
      logger.warn(
        '❌ FAANG: Cannot use direct scheduling - missing harmony dependencies',
        {
          hasAudioContext: !!this.audioContext,
          hasDestination: !!this.audioDestination,
          instanceId: this.instanceId,
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
    this.activeHarmonySources.set(
      chordId,
      sources.map((source) => ({
        source,
        gain: this.audioContext!.createGain(),
        gainValue: event.velocity || 0.7,
        noteEndTime: audioTime + duration,
      })),
    );

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

  /**
   * Schedule individual MIDI note for harmony directly using AudioBufferSourceNode
   * CRITICAL FIX: Same architecture as drummer - bypasses Tone.js for instant stop capability
   * This method schedules harmony samples the same way drummer samples are scheduled
   * @private
   */
  private scheduleHarmonyMidiNoteDirect(
    event: PatternEvent,
    audioTime: number,
    frame: number,
  ): boolean {
    // DIAGNOSTIC: Log every harmony note scheduling to identify dual playback source
    // eslint-disable-next-line no-console, no-restricted-syntax
    console.log('[PLAYBACK-PATH] RegionProcessor scheduling harmony note:', {
      instrument: this.currentHarmonyInstrument,
      midiNote: (event.data as any)?.midiNote,
      audioTime: audioTime.toFixed(3),
      frame,
    });

    if (!this.audioContext || !this.audioDestination) {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log('❌ EARLY RETURN: missing audio dependencies');
      logger.warn(
        '❌ Cannot schedule harmony MIDI note - missing audio dependencies',
      );
      return false;
    }

    // CRITICAL DIAGNOSTIC: Log instrument state at scheduling time (first note only)
    if (this._noteLogCount === 0) {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log('[HARMONY-SCHEDULE-START] 🎹 Instrument state:', {
        currentInstrument: this.currentHarmonyInstrument,
        hasKeyboardMap: this.keyboardMapper.hasKeyboardMap(),
        keyboardMapSize: this.keyboardMapper.getKeyboardMap()
          ? Object.keys(this.keyboardMapper.getKeyboardMap()!).length
          : 0,
        harmonyBuffersSize: this.harmonyBuffers.size,
        harmonyLayers: Array.from(this.harmonyBuffers.keys()),
        audioContextState: this.audioContext.state,
        instanceId: this.instanceId,
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
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(
        `[INSTRUMENT OCTAVE SHIFT] ${isGrandPiano ? 'Grand Piano' : 'Wurlitzer'}: MIDI ${eventData.midiNote} → ${midiNote} (shift: -${octaveShift}) [instrument=${this.currentHarmonyInstrument}]`,
      );
    }

    const velocity = eventData.velocity || event.velocity * 127;
    const duration = event.duration || 2; // Default 2 seconds

    // DIAGNOSTIC: Log first 3 notes with their audioTime and position
    if (this._noteLogCount < 3) {
      // eslint-disable-next-line no-console, no-restricted-syntax
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
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(
        '🗺️ [NOTE-MAPPING] Grand Piano detected, checking keyboard map...',
        {
          hasKeyboardMap: this.keyboardMapper.hasKeyboardMap(),
          requestedNote: noteName,
          mapKeys: this.keyboardMapper.getKeyboardMap()
            ? Object.keys(this.keyboardMapper.getKeyboardMap()!).length
            : 0,
        },
      );

      if (this.keyboardMapper.hasKeyboardMap()) {
        const mapping = this.keyboardMapper.mapNote(noteName);
        if (mapping) {
          actualSampleNote = mapping.sample; // e.g., "A3" for "Gs3"
          playbackRate = mapping.playbackRate;
          // eslint-disable-next-line no-console, no-restricted-syntax
          console.log('🗺️ [NOTE-MAPPING] ✅ Mapped note', {
            requested: noteName,
            mapped: actualSampleNote,
            playbackRate,
          });
        } else {
          // eslint-disable-next-line no-console, no-restricted-syntax
          console.warn('🗺️ [NOTE-MAPPING] ⚠️ No mapping found for note', {
            noteName,
          });
        }
      } else {
        // eslint-disable-next-line no-console, no-restricted-syntax
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
        // eslint-disable-next-line no-console, no-restricted-syntax
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

        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(`🔍 [CACHE DIAGNOSTIC] Buffer not found for ${cacheKey}`);
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(`   Looking for: ${cacheKey}`);
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(`   Current instrument: ${this.currentHarmonyInstrument}`);
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(
          `   Layer: ${layer}, Requested: ${noteName}, Mapped: ${actualSampleNote}`,
        );
        // eslint-disable-next-line no-console, no-restricted-syntax
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

    if (this.keyboardMapper.hasKeyboardMap()) {
      const mapping = this.keyboardMapper.mapNote(noteName);
      if (mapping) {
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
                // eslint-disable-next-line no-console, no-restricted-syntax
                console.log(
                  `[CACHE FALLBACK + MAP] ${noteName} → ${sampleNote} from GlobalSampleCache (${cacheKey})`,
                );
              }
            }

            if (buffer) {
              // eslint-disable-next-line no-console, no-restricted-syntax
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
            // eslint-disable-next-line no-console, no-restricted-syntax
            console.log(
              `[GRAND PIANO PITCH] ${noteName}: rate=${playbackRate.toFixed(3)} (${mapping.semitones > 0 ? '+' : ''}${mapping.semitones} semitones) - buffer found directly`,
            );
          }
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
            // eslint-disable-next-line no-console, no-restricted-syntax
            console.log(
              `[CACHE FALLBACK + VELOCITY] ${noteName} → ${sampleNote} from GlobalSampleCache (${cacheKey})`,
            );
          }
        }

        if (buffer) {
          // eslint-disable-next-line no-console, no-restricted-syntax
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

      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(
        `\n🔍 ========== CACHE DIAGNOSTIC (MISSING BUFFER) ==========`,
      );
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(
        `❌ Could not find buffer for: ${layer}/${noteName} (MIDI ${midiNote})`,
      );
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(`\n📋 Attempted cache keys (in order):`);
      // eslint-disable-next-line no-console, no-restricted-syntax
      attemptedKeys.forEach((key, i) => console.log(`   ${i + 1}. ${key}`));
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(
        `\n📦 Available cache keys for "${instrument}" (${instrumentKeys.length} total):`,
      );
      // eslint-disable-next-line no-console, no-restricted-syntax
      instrumentKeys.slice(0, 20).forEach((key) => console.log(`   - ${key}`));
      if (instrumentKeys.length > 20) {
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(`   ... and ${instrumentKeys.length - 20} more`);
      }
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(`\n🔧 State:`);
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(`   Current instrument: ${this.currentHarmonyInstrument}`);
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(
        `   Requested note: ${noteName}, Mapped sample: ${sampleNote}`,
      );
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(`   Layer: ${layer}, Velocity: ${velocity}`);
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(`========================================================\n`);

      // For Grand Piano, also check what the keyboard map says
      const keyboardMapping = this.keyboardMapper.mapNote(noteName);
      const keyboardMapInfo = keyboardMapping
        ? {
            mappedSample: keyboardMapping.sample,
            playbackRate: keyboardMapping.playbackRate,
            semitones: keyboardMapping.semitones,
          }
        : null;

      // CRITICAL: Show the CORRECT cache key using mapped sample (actualSampleNote) not requested note
      const expectedCacheKey = `${this.currentHarmonyInstrument || 'unknown'}-${layer}-${actualSampleNote}`;

      logger.error(
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
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log('[PITCH-SHIFT-APPLIED] 🎹', {
          noteName,
          midiNote,
          sampleNote, // The actual sample being used (e.g., A3 for Gs3)
          playbackRate,
          isGrandPiano: this.currentHarmonyInstrument === 'grandpiano',
          hasKeyboardMap: this.keyboardMapper.hasKeyboardMap(),
          layer,
          duration,
        });
      }

      // DIAGNOSTIC: Log playback rate for first few notes
      if (midiNote >= 46 && midiNote <= 48) {
        // Log A#2, B2, C3
        // eslint-disable-next-line no-console, no-restricted-syntax
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
          const pedalUpTime = this.sustainAnalyzer.findNextCC64Up(
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
        // eslint-disable-next-line no-console, no-restricted-syntax
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
        // eslint-disable-next-line no-console, no-restricted-syntax
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
          const pedalUpTime = this.sustainAnalyzer.findNextCC64Up(
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
                  // eslint-disable-next-line no-console, no-restricted-syntax
                  console.log(
                    `[CC64 MID-SUSTAIN] ${noteName}: Pedal went DOWN at ${pedalDownTime.toFixed(3)}s (during note), sustains until ${pedalUpTime.toFixed(3)}s (+${(actualDuration - duration).toFixed(3)}s)`,
                  );
                } else {
                  // eslint-disable-next-line no-console, no-restricted-syntax
                  console.log(
                    `[CC64 EXTEND] ${noteName}: MIDI would end at ${midiNoteEndTime.toFixed(3)}s, extended to pedal UP @ ${pedalUpTime.toFixed(3)}s (+${(actualDuration - duration).toFixed(3)}s sustain)`,
                  );
                }
              } else {
                // Pedal UP happens while note is still held - ignore pedal, use MIDI duration
                // This is legato pedaling: play new chord, then release pedal (old chord stops, new chord continues)
                actualDuration = duration;
                // eslint-disable-next-line no-console, no-restricted-syntax
                console.log(
                  `[CC64 IGNORED] ${noteName}: Pedal UP @ ${pedalUpTime.toFixed(3)}s while note held until ${midiNoteEndTime.toFixed(3)}s - using MIDI duration (legato pedaling)`,
                );
              }
            } else {
              // Edge case: Note starts after pedal UP
              // eslint-disable-next-line no-console, no-restricted-syntax
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
              // eslint-disable-next-line no-console, no-restricted-syntax
              console.log(
                `[CC64] ${noteName}: Extended ${duration.toFixed(3)}s → ${actualDuration.toFixed(3)}s (no pedal UP, capped at exercise end + 3s)`,
              );
            } else {
              // Use full buffer duration for notes not in last beat
              actualDuration = Math.max(duration, buffer.duration);
              // eslint-disable-next-line no-console, no-restricted-syntax
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
        this.sustainAnalyzer.isNoteHeldUntilExerciseEnd(midiNoteEndTime);

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
        // eslint-disable-next-line no-console, no-restricted-syntax
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
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(
          `[LAST NOTE DECAY] ${noteName} @ ${audioTime.toFixed(3)}s: ${previousDuration.toFixed(3)}s → ${actualDuration.toFixed(3)}s`,
        );
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(
          `  Exercise end: ${this.exerciseEndTime.toFixed(3)}s, Desired end: ${desiredEndTime.toFixed(3)}s, Reason: ${reason}`,
        );
      }

      // Calculate note end time using final duration (MIDI, sustained, or with ring-out)
      const finalNoteEndTime = audioTime + actualDuration;

      // eslint-disable-next-line no-console, no-restricted-syntax
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

        // eslint-disable-next-line no-console, no-restricted-syntax
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
          // eslint-disable-next-line no-console, no-restricted-syntax
          console.log(
            `[CC64] ${noteName} @ ${audioTime.toFixed(3)}s sustained until ${finalNoteEndTime.toFixed(3)}s (extended by ${(actualDuration - duration).toFixed(3)}s), exponential fade starts AT pedal UP (${fadeStartTime.toFixed(3)}s) for ${fadeOutDuration * 1000}ms`,
          );
        } else {
          // eslint-disable-next-line no-console, no-restricted-syntax
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

  // ============================================================================
  // HARMONY VELOCITY LAYER SELECTION
  // ============================================================================

  /**
   * Determine which velocity layer to use for a specific note and velocity
   * Uses per-note velocity ranges from instrument config (e.g., wurlitzer-piano.json)
   * Falls back to generic velocity mapping if per-note ranges aren't available
   * @private
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
   * Check if CC64 pedal is DOWN when note starts OR goes DOWN during note's MIDI duration
   * This is critical for syncopated pedaling where pedal goes DOWN after note starts
   * Returns the time when pedal went/goes DOWN, or null if pedal stays UP
   * @private
   */
  private findCC64DownDuringNote(
    noteStart: number,
    noteEnd: number,
    timeline: Map<number, boolean>,
  ): number | null {
    const sortedTimes = Array.from(timeline.keys()).sort((a, b) => a - b);

    // 🚨 CRITICAL FIX: Handle complex pedaling with multiple DOWN/UP cycles
    // For overlapping chords with legato pedaling:
    // - Old chord plays with pedal DOWN
    // - Pedal goes UP briefly to separate chords
    // - New chord starts BEFORE pedal goes back DOWN
    // - Pedal goes DOWN again to sustain new chord
    //
    // Strategy: Always use the LATEST pedal DOWN that affects this note
    // This ensures we find the pedal UP that actually releases THIS chord

    let latestPedalDown: number | null = null;

    // Check if pedal is already DOWN before note starts
    const isPedalDownAtStart = this.sustainAnalyzer.isPedalDownAtTime(
      noteStart,
      timeline,
    );
    if (isPedalDownAtStart) {
      latestPedalDown = noteStart; // Pedal already DOWN when note starts
    }

    // Check if pedal goes DOWN during the note's MIDI duration
    // This overrides the pedal-down-at-start if found
    for (const eventTime of sortedTimes) {
      if (eventTime > noteStart && eventTime < noteEnd) {
        if (timeline.get(eventTime) === true) {
          // eslint-disable-next-line no-console, no-restricted-syntax
          console.log(
            `[CC64 MID-NOTE] Pedal goes DOWN at ${eventTime.toFixed(3)}s during note playing ${noteStart.toFixed(3)}s-${noteEnd.toFixed(3)}s`,
          );
          latestPedalDown = eventTime; // Use this pedal DOWN (overrides earlier one)
        }
      }
    }

    return latestPedalDown;
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
}
