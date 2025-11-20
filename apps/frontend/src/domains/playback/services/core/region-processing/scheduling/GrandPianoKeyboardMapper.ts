/**
 * GrandPianoKeyboardMapper - Handles Grand Piano sparse sampling and pitch-shifting
 *
 * Grand Piano uses sparse sampling (A, C, D#, F# notes only) and maps other notes
 * to these samples with pitch-shift calculations. This module:
 * - Loads keyboard mapping from cache or fallback import
 * - Maps requested notes to physical samples with playbackRate
 * - Detects sparse sampling by checking for < 88 chromatic notes
 */

import { getLogger } from '@/utils/logger.js';
import { GlobalSampleCache } from '@/domains/playback/modules/storage/cache/GlobalSampleCache.js';
import * as grandPianoKeyboardMap from '@/domains/playback/data/instruments/piano/grandpiano-keyboard-map.json';

const logger = getLogger('GrandPianoKeyboardMapper');

export interface NoteMapping {
  sample: string; // Actual sample name (e.g., "A3" for "Gs3")
  playbackRate: number; // Pitch-shift rate (1.059 = +1 semitone)
  semitones: number; // Pitch shift amount (+1, -2, etc.)
}

export class GrandPianoKeyboardMapper {
  private grandPianoKeyboardMap: Record<string, NoteMapping> | null = null;
  private instanceId: string;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  /**
   * Load keyboard map from cache (preferred) or fallback to import
   * Cache is populated by HarmonyPreloadStrategy during preload
   */
  async loadKeyboardMap(): Promise<void> {
    try {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(
        '🗺️ [KEYBOARD-MAP-LOAD] GrandPianoKeyboardMapper attempting to load...',
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
   * Map a note to its physical sample with pitch-shift
   * @param noteName - e.g., "G4", "Gs3"
   * @returns Mapping with sample name and playbackRate, or null if not found
   */
  mapNote(noteName: string): NoteMapping | null {
    if (!this.grandPianoKeyboardMap) {
      return null;
    }
    return this.grandPianoKeyboardMap[noteName] || null;
  }

  /**
   * Check if keyboard map is loaded
   */
  hasKeyboardMap(): boolean {
    return !!this.grandPianoKeyboardMap;
  }

  /**
   * Get the entire keyboard map (for testing/inspection)
   */
  getKeyboardMap(): Record<string, NoteMapping> | null {
    return this.grandPianoKeyboardMap;
  }

  /**
   * Detect if the loaded harmony instrument uses sparse sampling (like Grand Piano)
   * by checking if ANY octave has all 12 chromatic notes
   * @param harmonyBuffers - Harmony buffer map to analyze
   * @returns true if sparse (Grand Piano), false if full chromatic (Wurlitzer/Rhodes)
   */
  detectSparseSampling(
    harmonyBuffers: Map<string, Map<string, AudioBuffer>>,
  ): boolean {
    if (harmonyBuffers.size === 0) return false;

    // Get all available note names across all velocity layers
    const allNoteNames = new Set<string>();
    for (const layerMap of harmonyBuffers.values()) {
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
}
