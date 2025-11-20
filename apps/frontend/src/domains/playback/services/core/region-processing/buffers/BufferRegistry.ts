/**
 * BufferRegistry - Centralized buffer management for all instrument types
 *
 * Consolidates all setXxxBuffers() methods into a single registry that:
 * - Manages audio buffers for metronome, drums, voice cues, harmony, and bass
 * - Handles buffer organization (flat maps → structured maps)
 * - Loads Grand Piano keyboard mapping when needed
 * - Provides buffer access to schedulers
 * - Validates buffer state before scheduling
 */

import { getLogger } from '@/utils/logger.js';
import { GlobalSampleCache } from '@/domains/playback/modules/storage/cache/GlobalSampleCache.js';
import * as grandPianoKeyboardMap from '@/domains/playback/data/instruments/piano/grandpiano-keyboard-map.json';

const logger = getLogger('BufferRegistry');

export interface NoteMapping {
  sample: string;
  playbackRate: number;
  semitones: number;
}

export class BufferRegistry {
  // Metronome buffers
  private metronomeBuffers: {
    accent: AudioBuffer | null;
    click: AudioBuffer | null;
  } = {
    accent: null,
    click: null,
  };

  // Drum buffers
  private drumBuffers: {
    kick: AudioBuffer | null;
    snare: AudioBuffer | null;
    hihat: AudioBuffer | null;
  } = {
    kick: null,
    snare: null,
    hihat: null,
  };

  // Voice cue buffers
  private voiceCueBuffers = new Map<string, AudioBuffer>();

  // Harmony buffers - organized by velocity layer → note
  private harmonyBuffers = new Map<string, Map<string, AudioBuffer>>();
  private harmonyVelocityRanges: Record<string, any[]> | undefined;
  private currentHarmonyInstrument: string | null = null;
  private grandPianoKeyboardMap: Record<string, NoteMapping> | null = null;

  // Bass buffers - organized by articulation → note
  private bassBuffers = new Map<string, Map<string, AudioBuffer>>();

  // Audio destination node (shared across all instruments)
  private audioDestination: AudioNode | null = null;

  private instanceId: string;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  /**
   * Set metronome buffers (accent and click samples)
   */
  setMetronomeBuffers(
    accent: AudioBuffer,
    click: AudioBuffer,
    destination: AudioNode,
  ): void {
    this.metronomeBuffers = { accent, click };
    this.audioDestination = destination;
    logger.info('✅ Metronome buffers injected', {
      hasAccent: !!accent,
      hasClick: !!click,
      hasDestination: !!destination,
      instanceId: this.instanceId,
    });
  }

  /**
   * Set drum buffers (kick, snare, hihat samples)
   */
  setDrumBuffers(
    kick: AudioBuffer,
    snare: AudioBuffer,
    hihat: AudioBuffer,
    destination: AudioNode,
  ): void {
    this.drumBuffers = { kick, snare, hihat };
    this.audioDestination = destination;
    logger.info('✅ Drum buffers injected', {
      hasKick: !!kick,
      hasSnare: !!snare,
      hasHihat: !!hihat,
      hasDestination: !!destination,
      instanceId: this.instanceId,
    });
  }

  /**
   * Set voice cue buffers (count-in samples)
   */
  setVoiceCueBuffers(
    samples: Map<string, AudioBuffer>,
    destination: AudioNode,
  ): void {
    this.voiceCueBuffers = samples;
    this.audioDestination = destination;
    logger.info('✅ Voice cue buffers injected', {
      sampleCount: samples.size,
      cues: Array.from(samples.keys()),
      hasDestination: !!destination,
      instanceId: this.instanceId,
    });
  }

  /**
   * Set harmony buffers (piano/Rhodes/Wurlitzer samples)
   * Organizes flat map (v10-D4 → buffer) into nested map (layer → note → buffer)
   */
  async setHarmonyBuffers(
    samples: Map<string, AudioBuffer>,
    destination: AudioNode,
    perNoteVelocityRanges?: Record<string, any[]>,
    instrument?: string,
  ): Promise<void> {
    // CRITICAL FIX: Clear old buffers to prevent multiple instruments playing together
    if (this.harmonyBuffers && this.harmonyBuffers.size > 0) {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log('[BUFFER-REGISTRY] 🗑️ Clearing old harmony buffers', {
        oldBufferCount: this.harmonyBuffers.size,
        oldInstrument: this.currentHarmonyInstrument,
        newInstrument: instrument,
        instanceId: this.instanceId,
      });
      this.harmonyBuffers.clear();
    } else {
      this.harmonyBuffers.clear();
    }

    // FAANG FIX: Store current harmony instrument type for reliable detection
    // This prevents race conditions where we try to detect instrument before keyboard map loads
    this.currentHarmonyInstrument = instrument || null;
    logger.info(
      `🎹 Setting harmony instrument type: ${instrument || 'unknown'}`,
    );

    // CRITICAL: Clear Grand Piano keyboard map when loading non-Grand-Piano instruments
    // This ensures octave shift detection works correctly (isGrandPiano = !!this.grandPianoKeyboardMap)
    if (instrument && instrument !== 'grandpiano') {
      this.grandPianoKeyboardMap = null;
      logger.info(
        `🎹 Cleared Grand Piano keyboard map (loading ${instrument})`,
      );
    }

    // Organize flat map into nested structure
    samples.forEach((buffer, key) => {
      // Parse key: 'v10-D4' → layer='v10', note='D4'
      const parts = key.split('-');
      if (parts.length < 2) {
        logger.warn(`Invalid harmony buffer key: ${key}`);
        return;
      }

      const layer = parts[0];
      const note = parts.slice(1).join('-'); // Handle notes like 'D#4' which become 'Ds-4'

      if (!this.harmonyBuffers.has(layer)) {
        this.harmonyBuffers.set(layer, new Map());
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.harmonyBuffers.get(layer)!.set(note, buffer);
    });

    this.audioDestination = destination;
    this.harmonyVelocityRanges = perNoteVelocityRanges;

    // Load Grand Piano keyboard map ONLY for grandpiano
    const isSparseSampled = this.detectSparseSampling();
    if (
      instrument === 'grandpiano' &&
      isSparseSampled &&
      !this.grandPianoKeyboardMap
    ) {
      await this.loadGrandPianoKeyboardMap();
    }

    const totalBuffers = samples.size;
    const layers = Array.from(this.harmonyBuffers.keys());

    logger.info('✅ Harmony buffers injected', {
      instrument: instrument || 'unknown',
      layers,
      totalNotes: totalBuffers,
      hasDestination: !!destination,
      hasVelocityRanges: !!perNoteVelocityRanges,
      hasKeyboardMap: !!this.grandPianoKeyboardMap,
      willApplyOctaveShift: instrument === 'wurlitzer',
      instanceId: this.instanceId,
    });

    // CRITICAL DIAGNOSTIC: Verify final state after buffer injection
    // eslint-disable-next-line no-console, no-restricted-syntax
    console.log('[HARMONY-BUFFERS-SET] 🎹 Final state:', {
      instrument: this.currentHarmonyInstrument,
      bufferMapSize: this.harmonyBuffers.size,
      layers: Array.from(this.harmonyBuffers.keys()),
      totalBuffers: samples.size,
      hasKeyboardMap: !!this.grandPianoKeyboardMap,
      keyboardMapSize: this.grandPianoKeyboardMap
        ? Object.keys(this.grandPianoKeyboardMap).length
        : 0,
      sampleFirstLayer:
        this.harmonyBuffers.size > 0
          ? Array.from(this.harmonyBuffers.values())[0].size
          : 0,
      instanceId: this.instanceId,
    });
  }

  /**
   * Set bass buffers (normal, slap, mute, etc.)
   * Organizes flat map (normal-D2 → buffer) into nested map (articulation → note → buffer)
   */
  setBassBuffers(
    samples: Map<string, AudioBuffer>,
    destination: AudioNode,
  ): void {
    this.bassBuffers.clear();

    samples.forEach((buffer, key) => {
      // Parse key: 'normal-D2' → articulation='normal', note='D2'
      const parts = key.split('-');
      if (parts.length < 2) {
        logger.warn(`Invalid bass buffer key: ${key}`);
        return;
      }

      const articulation = parts[0];
      const note = parts.slice(1).join('-');

      if (!this.bassBuffers.has(articulation)) {
        this.bassBuffers.set(articulation, new Map());
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.bassBuffers.get(articulation)!.set(note, buffer);
    });

    this.audioDestination = destination;

    const totalBuffers = samples.size;
    const articulations = Array.from(this.bassBuffers.keys());

    logger.info('✅ Bass buffers injected', {
      articulations,
      totalNotes: totalBuffers,
      hasDestination: !!destination,
      instanceId: this.instanceId,
    });
  }

  /**
   * Load Grand Piano keyboard note map
   * FAANG FIX: Check GlobalSampleCache first (populated by HarmonyPreloadStrategy)
   * This ensures keyboard map is available immediately for note mapping
   */
  private async loadGrandPianoKeyboardMap(): Promise<void> {
    try {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(
        '🗺️ [KEYBOARD-MAP-LOAD] BufferRegistry attempting to load keyboard map...',
      );

      // Try cache first (populated by HarmonyPreloadStrategy during preload)
      const cached = GlobalSampleCache.getInstance().getCachedMetadata(
        'grandpiano-keyboard-map',
      );
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log('🗺️ [KEYBOARD-MAP-LOAD] Cache lookup result:', {
        found: !!cached,
        hasKeys: cached ? Object.keys(cached).length : 0,
        firstKey: cached ? Object.keys(cached)[0] : 'N/A',
      });

      if (cached) {
        this.grandPianoKeyboardMap = cached;
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log('🗺️ [KEYBOARD-MAP-LOAD] ✅ Retrieved from cache', {
          totalKeys: Object.keys(cached).length,
          hasKeyboardMap: !!this.grandPianoKeyboardMap,
        });
        logger.info(
          '✅ Retrieved Grand Piano keyboard map from cache (88 keys A0-C8)',
          {
            source: 'GlobalSampleCache',
            totalKeys: Object.keys(cached).length,
          },
        );
        return;
      }

      // Fallback to direct import if cache miss (rare - happens if setHarmonyBuffers called before preload)
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log('🗺️ [KEYBOARD-MAP-LOAD] ⚠️ Cache miss - loading from import');
      this.grandPianoKeyboardMap = (grandPianoKeyboardMap as any).noteMap;
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log('🗺️ [KEYBOARD-MAP-LOAD] ✅ Loaded from import', {
        totalKeys: this.grandPianoKeyboardMap
          ? Object.keys(this.grandPianoKeyboardMap).length
          : 0,
        hasKeyboardMap: !!this.grandPianoKeyboardMap,
      });
      logger.info(
        '✅ Loaded Grand Piano keyboard map from import (88 keys A0-C8)',
        {
          source: 'direct-import',
          note: 'Cache miss - this is expected if setHarmonyBuffers called before preload completes',
        },
      );
    } catch (error) {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.error(
        '🗺️ [KEYBOARD-MAP-LOAD] ❌ Error loading keyboard map:',
        error,
      );
      logger.error('Error loading Grand Piano keyboard map:', error);
    }
  }

  /**
   * Detect if the loaded harmony instrument uses sparse sampling (like Grand Piano)
   * by checking if ANY octave has all 12 chromatic notes
   * @returns true if sparse (Grand Piano), false if full chromatic (Wurlitzer/Rhodes)
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
        return false; // Full chromatic (Wurlitzer/Rhodes)
      }
    }

    return true; // Sparse (Grand Piano)
  }

  // === GETTER METHODS ===

  getMetronomeBuffers() {
    return this.metronomeBuffers;
  }

  getDrumBuffers() {
    return this.drumBuffers;
  }

  getVoiceCueBuffers() {
    return this.voiceCueBuffers;
  }

  getHarmonyBuffers() {
    return this.harmonyBuffers;
  }

  getHarmonyVelocityRanges() {
    return this.harmonyVelocityRanges;
  }

  getCurrentHarmonyInstrument() {
    return this.currentHarmonyInstrument;
  }

  getGrandPianoKeyboardMap() {
    return this.grandPianoKeyboardMap;
  }

  getBassBuffers() {
    return this.bassBuffers;
  }

  getAudioDestination() {
    return this.audioDestination;
  }

  /**
   * Public wrapper for loading Grand Piano keyboard map
   * Called by RegionProcessor when instrument type is detected
   * (BufferRegistry already loads this automatically in setHarmonyBuffers for grandpiano)
   */
  async ensureGrandPianoKeyboardMap(): Promise<void> {
    if (!this.grandPianoKeyboardMap) {
      await this.loadGrandPianoKeyboardMap();
    }
  }
}
