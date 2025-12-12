/**
 * GrandPianoMapper - Keyboard Mapping for Grand Piano Sparse Sampling
 *
 * Extracted from legacy HarmonyScheduler.ts (lines 1326-1476)
 * FAANG Compliance: ~200 lines < 600 line limit
 *
 * Responsibilities:
 * - Load keyboard map from cache or JSON import
 * - Map requested notes to available samples with pitch-shift
 * - Detect sparse sampling (Grand Piano vs full chromatic instruments)
 * - Calculate playback rate for pitch-shifting
 *
 * Grand Piano Sparse Sampling:
 * - 88 piano keys (A0-C8)
 * - Only 25 physical samples (4 per octave: A, C, D#, F#)
 * - Other notes mapped to nearest sample with pitch-shift (±1 semitone max)
 * - Example: G4 → Fs4 with playbackRate 1.059 (+1 semitone)
 *
 * Usage:
 * ```typescript
 * const mapper = new GrandPianoMapper();
 * await mapper.loadKeyboardMap(cache);
 *
 * const mapping = mapper.mapNote('G4');
 * if (mapping) {
 *   source.buffer = getBuffer(mapping.sample); // Use Fs4 buffer
 *   source.playbackRate.value = mapping.playbackRate; // 1.059 (+1 semitone)
 * }
 * ```
 */

import { createStructuredLogger } from '../../../modules/shared/index.js';
import { GlobalSampleCache } from '../../../modules/storage/cache/GlobalSampleCache.js';

const logger = createStructuredLogger('GrandPianoMapper');

/**
 * Note mapping result
 */
export interface NoteMapping {
  /** Actual sample name to use (e.g., 'Fs4' for 'G4') */
  sample: string;

  /** Playback rate for pitch-shifting (1.059 = +1 semitone, 0.944 = -1 semitone) */
  playbackRate: number;

  /** Pitch shift amount in semitones (+1, -1, 0) */
  semitones: number;
}

/**
 * Keyboard map structure (from grandpiano-keyboard-map.json)
 */
export type KeyboardMap = Record<string, NoteMapping>;

/**
 * GrandPianoMapper - Maps notes to samples with pitch-shifting for sparse sampling
 *
 * Grand Piano uses 25 samples to cover 88 keys via pitch-shifting:
 * - 4 samples per octave: A (9), C (0), D# (3), F# (6)
 * - Max pitch-shift: ±1 semitone
 * - Playback rates: 1.059 (+1 semitone), 0.944 (-1 semitone), 1.0 (exact)
 *
 * Singleton Pattern: Use GrandPianoMapper.hasKeyboardMap(), GrandPianoMapper.loadKeyboardMap(), etc.
 */
export class GrandPianoMapper {
  // Singleton instance
  private static instance: GrandPianoMapper | null = null;
  private keyboardMap: KeyboardMap | null = null;

  /**
   * Get singleton instance (creates one if needed)
   */
  public static getInstance(): GrandPianoMapper {
    if (!GrandPianoMapper.instance) {
      GrandPianoMapper.instance = new GrandPianoMapper();
    }
    return GrandPianoMapper.instance;
  }

  // Static proxy methods for singleton access
  public static hasKeyboardMap(): boolean {
    return GrandPianoMapper.getInstance().hasKeyboardMap();
  }

  public static async loadKeyboardMap(cache?: GlobalSampleCache): Promise<void> {
    return GrandPianoMapper.getInstance().loadKeyboardMapInstance(cache);
  }

  public static mapNote(noteName: string): NoteMapping | null {
    return GrandPianoMapper.getInstance().mapNote(noteName);
  }

  public static getKeyboardMap(): KeyboardMap | null {
    return GrandPianoMapper.getInstance().getKeyboardMap();
  }

  public static clear(): void {
    GrandPianoMapper.getInstance().clear();
  }

  public static isSparseInstrument(noteNames: Set<string>): boolean {
    return GrandPianoMapper.getInstance().isSparseInstrument(noteNames);
  }

  /**
   * Load keyboard map from cache (preferred) or fallback to JSON import
   * (Instance method - use static GrandPianoMapper.loadKeyboardMap() for singleton access)
   *
   * Cache is populated by HarmonyPreloadStrategy during preload
   *
   * @param cache - Optional GlobalSampleCache instance (for testing)
   */
  public async loadKeyboardMapInstance(cache?: GlobalSampleCache): Promise<void> {
    try {
      logger.info('Loading Grand Piano keyboard map...');

      // Try cache first (populated by HarmonyPreloadStrategy during preload)
      const cacheInstance = cache || GlobalSampleCache.getInstance();
      const cached = cacheInstance.getCachedMetadata('grandpiano-keyboard-map');

      if (cached) {
        this.keyboardMap = cached as KeyboardMap;
        logger.info('Keyboard map retrieved from cache', {
          totalKeys: Object.keys(cached).length,
        });
        return;
      }

      // Fallback to import (if cache miss)
      logger.info('Cache miss, loading from JSON import...');
      const imported =
        await import('@/domains/playback/data/instruments/piano/grandpiano-keyboard-map.json');

      this.keyboardMap = imported.noteMap as KeyboardMap;

      // Cache for future use
      cacheInstance.cacheMetadata('grandpiano-keyboard-map', this.keyboardMap);

      logger.info('Keyboard map loaded from JSON', {
        totalKeys: Object.keys(this.keyboardMap).length,
      });
    } catch (error) {
      logger.error('Failed to load Grand Piano keyboard map', error);
      throw new Error(
        `Failed to load Grand Piano keyboard map: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Map a note to its physical sample with pitch-shift
   *
   * Example: G4 → { sample: 'Fs4', playbackRate: 1.059, semitones: +1 }
   *
   * @param noteName - Note name (e.g., 'G4', 'Gs3')
   * @returns Mapping with sample name and playbackRate, or null if not found
   */
  public mapNote(noteName: string): NoteMapping | null {
    if (!this.keyboardMap) {
      logger.warn('Cannot map note: keyboard map not loaded', { noteName });
      return null;
    }

    const mapping = this.keyboardMap[noteName];

    if (!mapping) {
      logger.warn('Note not found in keyboard map', { noteName });
      return null;
    }

    return mapping;
  }

  /**
   * Check if keyboard map is loaded
   */
  public hasKeyboardMap(): boolean {
    return this.keyboardMap !== null;
  }

  /**
   * Get the entire keyboard map (for testing/inspection)
   */
  public getKeyboardMap(): KeyboardMap | null {
    return this.keyboardMap;
  }

  /**
   * Clear keyboard map (for cleanup)
   */
  public clear(): void {
    this.keyboardMap = null;
    logger.info('Keyboard map cleared');
  }

  /**
   * Detect if the loaded harmony instrument uses sparse sampling (like Grand Piano)
   * by checking if ANY octave has all 12 chromatic notes
   *
   * Sparse Sampling (Grand Piano):
   * - Only 4 samples per octave (A, C, D#, F#)
   * - No octave has all 12 chromatic notes
   *
   * Full Chromatic (Wurlitzer/Rhodes):
   * - All 12 chromatic notes sampled per octave
   * - At least one octave has: C, Cs, D, Ds, E, F, Fs, G, Gs, A, As, B
   *
   * @param noteNames - Set of available note names (e.g., ['C4', 'Cs4', 'D4', ...])
   * @returns true if sparse (Grand Piano), false if full chromatic (Wurlitzer/Rhodes)
   */
  public static detectSparseSampling(noteNames: Set<string>): boolean {
    if (noteNames.size === 0) {
      logger.warn('Cannot detect sparse sampling: no note names provided');
      return false;
    }

    // Group notes by octave
    const notesByOctave = new Map<number, Set<string>>();

    for (const noteName of noteNames) {
      // Extract octave number from note name (e.g., 'C4' → 4)
      const octave = parseInt(noteName.slice(-1), 10);

      if (isNaN(octave)) {
        logger.warn('Invalid note name (no octave)', { noteName });
        continue;
      }

      if (!notesByOctave.has(octave)) {
        notesByOctave.set(octave, new Set());
      }

      // Extract note without octave (e.g., 'C4' → 'C', 'Cs4' → 'Cs')
      const noteWithoutOctave = noteName.slice(0, -1);
      notesByOctave.get(octave)?.add(noteWithoutOctave);
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

    for (const [octave, notesInOctave] of notesByOctave.entries()) {
      const hasAllChromatic = allChromaticNotes.every((note) =>
        notesInOctave.has(note),
      );

      if (hasAllChromatic) {
        logger.info('Full chromatic sampling detected', {
          octave,
          noteCount: notesInOctave.size,
        });
        return false; // Full chromatic (Wurlitzer/Rhodes)
      }
    }

    logger.info('Sparse sampling detected', {
      octaves: Array.from(notesByOctave.keys()),
      totalNotes: noteNames.size,
    });
    return true; // Sparse (Grand Piano)
  }

  /**
   * Get note names from buffer map (helper for sparse detection)
   *
   * Extracts all note names across all velocity layers
   *
   * @param bufferMap - Map of velocity layers to note buffers
   * @returns Set of all note names
   */
  public static getNoteNamesFromBuffers(
    bufferMap: Map<string, Map<string, AudioBuffer>>,
  ): Set<string> {
    const noteNames = new Set<string>();

    for (const layerMap of bufferMap.values()) {
      for (const noteName of layerMap.keys()) {
        noteNames.add(noteName);
      }
    }

    return noteNames;
  }
}
