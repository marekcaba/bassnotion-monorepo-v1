/**
 * VelocityLayerSelector - Determines velocity layers for harmony instruments
 *
 * Maps note velocity to sample layers based on:
 * - Per-note velocity ranges (from instrument config)
 * - Instrument-specific fallback ranges
 * - Sparse sampling detection (Grand Piano vs. Wurlitzer/Rhodes)
 */

export class VelocityLayerSelector {
  private instanceId: string;
  private currentInstrument: string | null = null;
  private velocityRanges: Record<string, any[]> | undefined;
  private harmonyBuffers: Map<string, Map<string, AudioBuffer>> | null = null;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  /**
   * Set current harmony instrument
   */
  setInstrument(instrument: string): void {
    this.currentInstrument = instrument;
  }

  /**
   * Set per-note velocity ranges from instrument config
   */
  setVelocityRanges(ranges: Record<string, any[]> | undefined): void {
    this.velocityRanges = ranges;
  }

  /**
   * Set harmony buffers for sparse sampling detection
   */
  setHarmonyBuffers(buffers: Map<string, Map<string, AudioBuffer>>): void {
    this.harmonyBuffers = buffers;
  }

  /**
   * Determine which velocity layer to use for a specific note and velocity
   * Uses per-note velocity ranges from instrument config (e.g., wurlitzer-piano.json)
   * Falls back to generic velocity mapping if per-note ranges aren't available
   */
  getLayerForNoteVelocity(noteName: string, velocity: number): string {
    // If we have per-note velocity ranges, use them
    if (this.velocityRanges) {
      // Try with sharp notation first (Cs4, Ds4, Fs4, etc.)
      let ranges = this.velocityRanges[noteName];

      // If not found, try converting to # notation (C#4, D#4, F#4, etc.)
      // The config might use # notation
      if (!ranges) {
        const noteWithSharp = noteName.replace('s', '#');
        ranges = this.velocityRanges[noteWithSharp];
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
    const instrument = this.currentInstrument || 'wurlitzer';

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
  detectSparseSampling(): boolean {
    if (!this.harmonyBuffers || this.harmonyBuffers.size === 0) return false;

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
}
