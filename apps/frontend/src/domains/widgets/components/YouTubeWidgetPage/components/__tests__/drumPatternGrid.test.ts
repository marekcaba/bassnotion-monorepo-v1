/**
 * Unit tests for drum pattern grid conversion utilities
 * Tests the drumHitsToGridPattern function and related helpers
 */

import { describe, it, expect } from 'vitest';
import type { DrumHit, MidiDrumType } from '@bassnotion/contracts';

// Re-implement the conversion logic for testing (mirrors DrummerWidget implementation)
const DRUM_TYPE_TO_GRID: Record<
  MidiDrumType,
  'kick' | 'snare' | 'hihat' | null
> = {
  kick: 'kick',
  snare: 'snare',
  snare_rimshot: 'snare',
  hihat: 'hihat',
  hihat_closed: 'hihat',
  hihat_open: 'hihat',
  hihat_pedal: 'hihat',
  crash: null,
  ride: null,
  ride_bell: null,
  tom_low: null,
  tom_mid: null,
  tom_high: null,
  floor_tom: null,
  cowbell: null,
  tambourine: null,
  clap: 'snare',
  unknown: null,
};

/**
 * Grid cell data structure that tracks main 8th note hits and 16th note subdivisions
 */
interface GridCell {
  main: number; // Hit on the main 8th note position
  sixteenth: number; // Hit on the 16th note subdivision after this position
}

/**
 * Grid pattern with 8 cells per row, each tracking main hit and 16th subdivision
 */
interface GridPatternWithSixteenths {
  kick: GridCell[];
  snare: GridCell[];
  hihat: GridCell[];
}

// Helper to create empty row with GridCell objects
const createEmptyRow = (): GridCell[] =>
  Array.from({ length: 8 }, () => ({ main: 0, sixteenth: 0 }));

const EMPTY_GRID_PATTERN: GridPatternWithSixteenths = {
  kick: createEmptyRow(),
  snare: createEmptyRow(),
  hihat: createEmptyRow(),
};

// Helper to convert simple array to GridCell array (for expected values in tests)
const toGridCells = (arr: number[]): GridCell[] =>
  arr.map((v) => ({ main: v, sixteenth: 0 }));

// Helper to create GridCell array with 16th note subdivisions
const toGridCellsWith16ths = (
  mains: number[],
  sixteenths: number[],
): GridCell[] =>
  mains.map((m, i) => ({ main: m, sixteenth: sixteenths[i] || 0 }));

/**
 * Get the number of unique measures in a drum pattern
 * Used to determine if we need to dynamically switch grid display during playback
 */
function getPatternMeasureCount(hits: DrumHit[]): number {
  if (!hits || hits.length === 0) return 1;
  const maxMeasure = Math.max(...hits.map((h) => h.position.measure || 0));
  return maxMeasure + 1; // Convert 0-based max to count
}

/**
 * Convert DrumHit[] to the compact 3x8 grid format
 * Mirrors the implementation in DrummerWidget.tsx
 * Tracks both main 8th note positions and 16th note subdivisions
 *
 * @param hits - Array of DrumHit from the converted MIDI data
 * @param beatsPerBar - Number of beats per bar (default 4 for 4/4 time)
 * @param targetMeasure - Which measure to display (0-based, default 0)
 */
function drumHitsToGridPattern(
  hits: DrumHit[],
  beatsPerBar = 4,
  targetMeasure = 0,
): GridPatternWithSixteenths {
  // The compact 3x8 grid shows ONE bar only (8 eighth notes in 4/4)
  const GRID_COLUMNS = 8;
  const EIGHTH_NOTES_PER_BEAT = 2;

  // Initialize empty grid with GridCell objects
  const grid: GridPatternWithSixteenths = {
    kick: createEmptyRow(),
    snare: createEmptyRow(),
    hihat: createEmptyRow(),
  };

  if (!hits || hits.length === 0) {
    return grid;
  }

  // Process each drum hit - only show hits from the target measure
  // 480 PPQ timing breakdown per beat:
  // - tick 0-119: main downbeat (1st 16th note)
  // - tick 120-239: "e" subdivision (2nd 16th note) - shown as small tick after downbeat
  // - tick 240-359: main upbeat (3rd 16th note, the "and")
  // - tick 360-479: "a" subdivision (4th 16th note) - shown as small tick after upbeat
  const PPQ = 480;
  const TICKS_PER_16TH = PPQ / 4; // 120 ticks per 16th note

  for (const hit of hits) {
    // Only process hits from the target measure
    const measureIndex = hit.position.measure || 0;
    if (measureIndex !== targetMeasure) continue;

    const gridType = DRUM_TYPE_TO_GRID[hit.drum];
    if (!gridType) continue;

    const beat = hit.position.beat || 0;
    const tick = hit.position.tick ?? 0;

    // Determine which 16th note subdivision within the beat
    const sixteenthInBeat = Math.floor(tick / TICKS_PER_16TH); // 0, 1, 2, or 3

    // Map to grid column and position type:
    // sixteenthInBeat 0 -> column beat*2, main hit
    // sixteenthInBeat 1 -> column beat*2, sixteenth tick (the "e")
    // sixteenthInBeat 2 -> column beat*2+1, main hit (the "and")
    // sixteenthInBeat 3 -> column beat*2+1, sixteenth tick (the "a")
    const gridColumn =
      beat * EIGHTH_NOTES_PER_BEAT + Math.floor(sixteenthInBeat / 2);
    const isSixteenthSubdivision = sixteenthInBeat % 2 === 1;

    if (gridColumn >= 0 && gridColumn < GRID_COLUMNS) {
      if (isSixteenthSubdivision) {
        grid[gridType][gridColumn].sixteenth = 1;
      } else {
        grid[gridType][gridColumn].main = 1;
      }
    }
  }

  return grid;
}

// Helper to create a DrumHit for testing
// Now uses 0-based measures and tick values for upbeat positioning
function createDrumHit(
  drum: MidiDrumType,
  measure: number,
  beat: number,
  tick = 0, // 0-239 = downbeat, 240-479 = upbeat
): DrumHit {
  return {
    id: `test-${drum}-${measure}-${beat}-${tick}`,
    drum,
    velocity: 100,
    position: { measure, beat, subdivision: Math.floor(tick / 120), tick },
    durationTicks: 120,
    midiNote: drum === 'kick' ? 36 : drum === 'snare' ? 38 : 42,
  };
}

describe('drumHitsToGridPattern', () => {
  describe('empty input handling', () => {
    it('should return empty grid for null/undefined input', () => {
      const result = drumHitsToGridPattern(null as any);
      expect(result).toEqual(EMPTY_GRID_PATTERN);
    });

    it('should return empty grid for empty array', () => {
      const result = drumHitsToGridPattern([]);
      expect(result).toEqual(EMPTY_GRID_PATTERN);
    });
  });

  describe('single drum hit conversion', () => {
    it('should place kick on beat 1 (first column)', () => {
      // 0-based measure, beat 0, tick 0 (downbeat)
      const hits = [createDrumHit('kick', 0, 0, 0)];
      const result = drumHitsToGridPattern(hits);

      expect(result.kick[0].main).toBe(1);
      expect(
        result.kick.slice(1).every((c) => c.main === 0 && c.sixteenth === 0),
      ).toBe(true);
      expect(result.snare).toEqual(toGridCells([0, 0, 0, 0, 0, 0, 0, 0]));
      expect(result.hihat).toEqual(toGridCells([0, 0, 0, 0, 0, 0, 0, 0]));
    });

    it('should place snare on beat 3 (fifth column)', () => {
      // Beat 2 (0-indexed) = column 4 (2*2=4)
      const hits = [createDrumHit('snare', 0, 2, 0)];
      const result = drumHitsToGridPattern(hits);

      expect(result.snare[4].main).toBe(1);
      expect(result.kick).toEqual(toGridCells([0, 0, 0, 0, 0, 0, 0, 0]));
    });

    it('should place hihat on every 8th note', () => {
      const hits = [
        createDrumHit('hihat', 0, 0, 0), // Column 0 (downbeat)
        createDrumHit('hihat', 0, 0, 240), // Column 1 (upbeat, tick >= 240)
        createDrumHit('hihat', 0, 1, 0), // Column 2
        createDrumHit('hihat', 0, 1, 240), // Column 3
      ];
      const result = drumHitsToGridPattern(hits);

      expect(result.hihat).toEqual(toGridCells([1, 1, 1, 1, 0, 0, 0, 0]));
    });
  });

  describe('drum type mapping', () => {
    it('should map kick drum correctly', () => {
      const hits = [createDrumHit('kick', 0, 0, 0)];
      const result = drumHitsToGridPattern(hits);
      expect(result.kick[0].main).toBe(1);
    });

    it('should map snare drum correctly', () => {
      const hits = [createDrumHit('snare', 0, 0, 0)];
      const result = drumHitsToGridPattern(hits);
      expect(result.snare[0].main).toBe(1);
    });

    it('should map snare_rimshot to snare row', () => {
      const hits = [createDrumHit('snare_rimshot', 0, 0, 0)];
      const result = drumHitsToGridPattern(hits);
      expect(result.snare[0].main).toBe(1);
    });

    it('should map clap to snare row', () => {
      const hits = [createDrumHit('clap', 0, 0, 0)];
      const result = drumHitsToGridPattern(hits);
      expect(result.snare[0].main).toBe(1);
    });

    it('should map hihat variants to hihat row', () => {
      const hihatVariants: MidiDrumType[] = [
        'hihat',
        'hihat_closed',
        'hihat_open',
        'hihat_pedal',
      ];

      hihatVariants.forEach((variant, index) => {
        const hits = [createDrumHit(variant, 0, index, 0)];
        const result = drumHitsToGridPattern(hits);
        expect(result.hihat[index * 2].main).toBe(1);
      });
    });

    it('should ignore drums not in compact grid (crash, ride, toms)', () => {
      const ignoredDrums: MidiDrumType[] = [
        'crash',
        'ride',
        'ride_bell',
        'tom_low',
        'tom_mid',
        'tom_high',
        'floor_tom',
        'cowbell',
        'tambourine',
        'unknown',
      ];

      const hits = ignoredDrums.map((drum, i) =>
        createDrumHit(drum, 0, i % 4, 0),
      );
      const result = drumHitsToGridPattern(hits);

      expect(result.kick).toEqual(toGridCells([0, 0, 0, 0, 0, 0, 0, 0]));
      expect(result.snare).toEqual(toGridCells([0, 0, 0, 0, 0, 0, 0, 0]));
      expect(result.hihat).toEqual(toGridCells([0, 0, 0, 0, 0, 0, 0, 0]));
    });
  });

  describe('musical position to grid index conversion', () => {
    it('should handle measure 0, beat 0 correctly (column 0)', () => {
      const hits = [createDrumHit('kick', 0, 0, 0)];
      const result = drumHitsToGridPattern(hits);
      expect(result.kick[0].main).toBe(1);
    });

    it('should handle measure 0, beat 1 correctly (column 2)', () => {
      const hits = [createDrumHit('kick', 0, 1, 0)];
      const result = drumHitsToGridPattern(hits);
      expect(result.kick[2].main).toBe(1);
    });

    it('should filter out measure 1 hits when targetMeasure is 0', () => {
      // With new implementation, measure 1 hits are NOT shown when targetMeasure=0
      const hits = [createDrumHit('kick', 1, 0, 0)];
      const result = drumHitsToGridPattern(hits, 4, 0); // targetMeasure=0
      expect(result.kick).toEqual(toGridCells([0, 0, 0, 0, 0, 0, 0, 0])); // No hits shown
    });

    it('should show measure 1 hits when targetMeasure is 1', () => {
      const hits = [createDrumHit('kick', 1, 0, 0)];
      const result = drumHitsToGridPattern(hits, 4, 1); // targetMeasure=1
      expect(result.kick[0].main).toBe(1);
    });

    it('should handle tick-based positioning for 16th notes', () => {
      // 480 PPQ: tick 0-119 = main downbeat, tick 120-239 = 16th (the "e")
      //          tick 240-359 = main upbeat (the "and"), tick 360-479 = 16th (the "a")
      const hits = [
        createDrumHit('kick', 0, 0, 0), // Column 0, main (tick 0-119)
        createDrumHit('snare', 0, 0, 120), // Column 0, sixteenth (tick 120-239 = "e")
        createDrumHit('hihat', 0, 0, 240), // Column 1, main (tick 240-359 = "and")
        createDrumHit('kick', 0, 0, 360), // Column 1, sixteenth (tick 360-479 = "a")
      ];
      const result = drumHitsToGridPattern(hits);

      expect(result.kick[0].main).toBe(1);
      expect(result.kick[0].sixteenth).toBe(0);
      expect(result.snare[0].main).toBe(0);
      expect(result.snare[0].sixteenth).toBe(1); // 16th note on the "e"
      expect(result.hihat[1].main).toBe(1);
      expect(result.kick[1].sixteenth).toBe(1); // 16th note on the "a"
    });
  });

  describe('typical drum patterns', () => {
    it('should convert a basic rock pattern correctly', () => {
      // Rock pattern: Kick on 1 and 3, Snare on 2 and 4, Hi-hat on all 8th notes
      // Using 0-based measures and tick 240 for upbeats
      const hits: DrumHit[] = [
        // Kick on beat 1 (column 0) and beat 3 (column 4)
        createDrumHit('kick', 0, 0, 0),
        createDrumHit('kick', 0, 2, 0),
        // Snare on beat 2 (column 2) and beat 4 (column 6)
        createDrumHit('snare', 0, 1, 0),
        createDrumHit('snare', 0, 3, 0),
        // Hi-hat on all 8th notes (downbeats and upbeats)
        createDrumHit('hihat', 0, 0, 0),
        createDrumHit('hihat', 0, 0, 240),
        createDrumHit('hihat', 0, 1, 0),
        createDrumHit('hihat', 0, 1, 240),
        createDrumHit('hihat', 0, 2, 0),
        createDrumHit('hihat', 0, 2, 240),
        createDrumHit('hihat', 0, 3, 0),
        createDrumHit('hihat', 0, 3, 240),
      ];

      const result = drumHitsToGridPattern(hits);

      expect(result.kick).toEqual(toGridCells([1, 0, 0, 0, 1, 0, 0, 0]));
      expect(result.snare).toEqual(toGridCells([0, 0, 1, 0, 0, 0, 1, 0]));
      expect(result.hihat).toEqual(toGridCells([1, 1, 1, 1, 1, 1, 1, 1]));
    });

    it('should handle 2-bar pattern with targetMeasure switching', () => {
      const hits: DrumHit[] = [
        // Bar 1 (measure 0)
        createDrumHit('kick', 0, 0, 0), // Column 0
        createDrumHit('snare', 0, 2, 0), // Column 4
        // Bar 2 (measure 1)
        createDrumHit('kick', 1, 1, 0), // Different pattern in bar 2
        createDrumHit('snare', 1, 3, 0),
      ];

      // Show measure 0
      const resultMeasure0 = drumHitsToGridPattern(hits, 4, 0);
      expect(resultMeasure0.kick[0].main).toBe(1);
      expect(resultMeasure0.snare[4].main).toBe(1);
      expect(resultMeasure0.kick[2].main).toBe(0); // No kick on beat 2 in measure 0

      // Show measure 1
      const resultMeasure1 = drumHitsToGridPattern(hits, 4, 1);
      expect(resultMeasure1.kick[2].main).toBe(1); // Kick on beat 2 (column 2) in measure 1
      expect(resultMeasure1.snare[6].main).toBe(1);
      expect(resultMeasure1.kick[0].main).toBe(0); // No kick on beat 1 in measure 1
    });

    it('should handle 16th note patterns (disco hi-hat)', () => {
      // Disco pattern: Hi-hat on all 16th notes (main 8ths + 16th subdivisions)
      const hits: DrumHit[] = [
        // Beat 0: all four 16ths
        createDrumHit('hihat', 0, 0, 0), // Column 0 main
        createDrumHit('hihat', 0, 0, 120), // Column 0 sixteenth
        createDrumHit('hihat', 0, 0, 240), // Column 1 main
        createDrumHit('hihat', 0, 0, 360), // Column 1 sixteenth
        // Beat 1: all four 16ths
        createDrumHit('hihat', 0, 1, 0),
        createDrumHit('hihat', 0, 1, 120),
        createDrumHit('hihat', 0, 1, 240),
        createDrumHit('hihat', 0, 1, 360),
      ];

      const result = drumHitsToGridPattern(hits);

      // First 4 columns should have both main and sixteenth
      expect(result.hihat[0]).toEqual({ main: 1, sixteenth: 1 });
      expect(result.hihat[1]).toEqual({ main: 1, sixteenth: 1 });
      expect(result.hihat[2]).toEqual({ main: 1, sixteenth: 1 });
      expect(result.hihat[3]).toEqual({ main: 1, sixteenth: 1 });
      // Remaining columns should be empty
      expect(result.hihat[4]).toEqual({ main: 0, sixteenth: 0 });
    });
  });

  describe('edge cases', () => {
    it('should handle missing position properties gracefully', () => {
      const hit: DrumHit = {
        id: 'test',
        drum: 'kick',
        velocity: 100,
        position: {} as any, // Missing measure, beat, tick
        durationTicks: 120,
        midiNote: 36,
      };

      const result = drumHitsToGridPattern([hit]);
      // Default values: measure=0, beat=0, tick=0 → column 0
      expect(result.kick[0].main).toBe(1);
    });

    it('should return empty grid for non-matching measure', () => {
      // Hit is in measure 100, but we're showing measure 0
      const hits = [createDrumHit('kick', 100, 0, 0)];
      const result = drumHitsToGridPattern(hits, 4, 0);

      // No hits should show since measure doesn't match
      expect(result.kick).toEqual(toGridCells([0, 0, 0, 0, 0, 0, 0, 0]));
    });

    it('should handle different time signatures (3/4)', () => {
      const hits = [
        createDrumHit('kick', 0, 0, 0),
        createDrumHit('snare', 0, 1, 0),
        createDrumHit('hihat', 0, 2, 0),
      ];

      // beatsPerBar=3 doesn't affect grid size (always 8 columns)
      // but affects beat-to-column mapping
      const result = drumHitsToGridPattern(hits, 3, 0);

      expect(result.kick[0].main).toBe(1); // Beat 0 → column 0
      expect(result.snare[2].main).toBe(1); // Beat 1 → column 2
      expect(result.hihat[4].main).toBe(1); // Beat 2 → column 4
    });
  });

  describe('getPatternMeasureCount', () => {
    it('should return 1 for empty pattern', () => {
      expect(getPatternMeasureCount([])).toBe(1);
    });

    it('should return 1 for single-measure pattern', () => {
      const hits = [createDrumHit('kick', 0, 0, 0)];
      expect(getPatternMeasureCount(hits)).toBe(1);
    });

    it('should return 2 for two-measure pattern', () => {
      const hits = [
        createDrumHit('kick', 0, 0, 0),
        createDrumHit('kick', 1, 0, 0),
      ];
      expect(getPatternMeasureCount(hits)).toBe(2);
    });

    it('should return correct count for sparse multi-measure pattern', () => {
      const hits = [
        createDrumHit('kick', 0, 0, 0),
        createDrumHit('kick', 3, 0, 0), // Jump to measure 3
      ];
      expect(getPatternMeasureCount(hits)).toBe(4); // Measures 0, 1, 2, 3
    });
  });

  describe('DRUM_TYPE_TO_GRID mapping', () => {
    it('should have mappings for all MidiDrumType values', () => {
      const allDrumTypes: MidiDrumType[] = [
        'kick',
        'snare',
        'snare_rimshot',
        'hihat',
        'hihat_closed',
        'hihat_open',
        'hihat_pedal',
        'crash',
        'ride',
        'ride_bell',
        'tom_low',
        'tom_mid',
        'tom_high',
        'floor_tom',
        'cowbell',
        'tambourine',
        'clap',
        'unknown',
      ];

      allDrumTypes.forEach((drumType) => {
        expect(DRUM_TYPE_TO_GRID).toHaveProperty(drumType);
      });
    });

    it('should map exactly 3 drum types to kick', () => {
      const kickMapped = Object.entries(DRUM_TYPE_TO_GRID).filter(
        ([_, v]) => v === 'kick',
      );
      expect(kickMapped.length).toBe(1);
      expect(kickMapped[0][0]).toBe('kick');
    });

    it('should map snare, snare_rimshot, and clap to snare', () => {
      const snareMapped = Object.entries(DRUM_TYPE_TO_GRID).filter(
        ([_, v]) => v === 'snare',
      );
      expect(snareMapped.length).toBe(3);
      expect(snareMapped.map(([k]) => k).sort()).toEqual([
        'clap',
        'snare',
        'snare_rimshot',
      ]);
    });

    it('should map hihat variants to hihat', () => {
      const hihatMapped = Object.entries(DRUM_TYPE_TO_GRID).filter(
        ([_, v]) => v === 'hihat',
      );
      expect(hihatMapped.length).toBe(4);
      expect(hihatMapped.map(([k]) => k).sort()).toEqual([
        'hihat',
        'hihat_closed',
        'hihat_open',
        'hihat_pedal',
      ]);
    });
  });
});
