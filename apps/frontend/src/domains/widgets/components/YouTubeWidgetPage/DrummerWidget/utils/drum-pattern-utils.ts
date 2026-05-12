/**
 * Drum Pattern Utilities
 *
 * Utility functions for converting and processing drum patterns.
 */

import type { DrumHit } from '@bassnotion/contracts';
import type {
  DrumPattern,
  DrumPatternEvent,
} from '@/domains/playback/types/pattern';
import { getLogger } from '@/utils/logger.js';
import {
  type GridPatternWithSixteenths,
  type GridCell,
  DRUM_TYPE_TO_GRID,
  MIDI_DRUM_MAP,
  DRUM_PATTERNS,
  toPresetGridCells,
} from '../types.js';

const logger = getLogger('drum-pattern-utils');

/**
 * Get the number of unique measures in a drum pattern
 * Used to determine if we need to dynamically switch grid display during playback
 *
 * @param hits - Array of DrumHit from the converted MIDI data
 * @returns Number of measures (1-based count)
 */
export function getPatternMeasureCount(hits: DrumHit[]): number {
  if (!hits || hits.length === 0) return 1;
  const maxMeasure = Math.max(...hits.map((h) => h.position.measure || 0));
  return maxMeasure + 1; // Convert 0-based max to count
}

/**
 * Convert DrumHit[] (from exercise.drumPattern) to the compact 3x8 grid format
 * Maps drum hits to their beat positions in an 8-beat (1 bar) grid
 * Tracks both main 8th note positions and 16th note subdivisions
 *
 * @param hits - Array of DrumHit from the converted MIDI data
 * @param beatsPerBar - Number of beats per bar (default 4 for 4/4 time)
 * @param targetMeasure - Which measure to display (0-based, default 0)
 * @returns Grid pattern with kick[], snare[], hihat[] arrays containing GridCell objects
 */
export function drumHitsToGridPattern(
  hits: DrumHit[],
  beatsPerBar = 4,
  targetMeasure = 0,
): GridPatternWithSixteenths {
  // The compact 3x8 grid shows ONE bar only (8 eighth notes in 4/4)
  // 4 quarter note beats × 2 eighth notes per beat = 8 columns
  const GRID_COLUMNS = 8;
  const EIGHTH_NOTES_PER_BEAT = 2;

  // Initialize empty grid with GridCell objects
  const createEmptyRow = (): GridCell[] =>
    Array.from({ length: GRID_COLUMNS }, () => ({ main: 0, sixteenth: 0 }));

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

    // Map the drum type to one of the 3 grid rows
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

  logger.debug('🥁 Converted drum hits to grid pattern with 16th notes', {
    totalHits: hits.length,
    gridKick: {
      main: grid.kick.filter((c) => c.main === 1).length,
      sixteenth: grid.kick.filter((c) => c.sixteenth === 1).length,
    },
    gridSnare: {
      main: grid.snare.filter((c) => c.main === 1).length,
      sixteenth: grid.snare.filter((c) => c.sixteenth === 1).length,
    },
    gridHihat: {
      main: grid.hihat.filter((c) => c.main === 1).length,
      sixteenth: grid.hihat.filter((c) => c.sixteenth === 1).length,
    },
  });

  return grid;
}

/**
 * Convert parsed MIDI data to DrumPattern format
 */
export function convertMidiToDrumPattern(parsedData: any): DrumPattern {
  const pattern: DrumPattern = {
    id: 'drum-pattern-from-midi',
    events: [],
    loopLength: parsedData.metadata?.totalBars || 2,
  };

  logger.info('🥁 Converting MIDI to drum pattern', {
    totalBars: parsedData.metadata?.totalBars,
    measureCount: parsedData.measures?.length,
    timeSignature: parsedData.metadata?.timeSignature,
  });

  // Process each measure
  parsedData.measures?.forEach((measure: any, measureIndex: number) => {
    measure.notes?.forEach((note: any) => {
      // Map MIDI note to drum type
      const drumType = MIDI_DRUM_MAP[note.pitch];

      if (drumType) {
        // Calculate position within the measure
        const timeInMeasure = note.time - measure.startTime;
        const measureDuration = measure.endTime - measure.startTime;
        const beatsPerMeasure =
          parsedData.metadata?.timeSignature?.numerator || 4;
        const beatDuration = measureDuration / beatsPerMeasure;

        const beat = Math.floor(timeInMeasure / beatDuration);
        const sixteenth = Math.floor(
          ((timeInMeasure % beatDuration) / beatDuration) * 16,
        );

        const event: DrumPatternEvent = {
          position: {
            measure: measureIndex,
            beat: beat,
            subdivision: sixteenth,
            tick: 0, // Drums typically use 16th note precision
          },
          drum: drumType,
          velocity: note.velocity / 127, // Normalize from 0-127 to 0-1
          duration: '16n',
        };

        pattern.events.push(event);
        logger.info(
          `🥁 Added drum event: ${drumType} at ${measureIndex}:${beat}:${sixteenth}`,
          {
            velocity: event.velocity.toFixed(2),
            position: event.position,
          },
        );
      }
    });
  });

  logger.info(`🥁 Drum pattern created with ${pattern.events.length} events`);
  return pattern;
}

/**
 * Create drum pattern from current preset
 * Converts a preset pattern name to a DrumPattern with events
 */
export function createDrumPatternFromPreset(patternName: string): DrumPattern {
  const selectedPattern =
    DRUM_PATTERNS[patternName as keyof typeof DRUM_PATTERNS] ||
    DRUM_PATTERNS['Rock Steady'];

  const drumPattern: DrumPattern = {
    id: 'drum-pattern',
    events: [],
    loopLength: 2, // 2 bars (8 beats)
  };

  // Convert pattern arrays to events
  const drums = ['kick', 'snare', 'hihat'] as const;

  drums.forEach((drumType) => {
    const patternArray = selectedPattern[drumType];
    patternArray.forEach((cell, index) => {
      // Main 8th note hit
      if (cell.main === 1) {
        const bar = Math.floor(index / 4);
        const beat = index % 4;

        const event: DrumPatternEvent = {
          position: {
            measure: bar,
            beat: beat,
            subdivision: 0,
            tick: 0,
          },
          drum: drumType,
          velocity:
            drumType === 'kick' ? 0.9 : drumType === 'snare' ? 0.8 : 0.6,
          duration: '8n',
        };

        drumPattern.events.push(event);
      }

      // 16th note subdivision hit (the "e" or "a")
      if (cell.sixteenth === 1) {
        const bar = Math.floor(index / 4);
        const beat = index % 4;

        const event: DrumPatternEvent = {
          position: {
            measure: bar,
            beat: beat,
            subdivision: 1, // Indicate this is the 16th subdivision
            tick: 120, // 16th note after the 8th (120 ticks in 480 PPQ)
          },
          drum: drumType,
          velocity:
            drumType === 'kick' ? 0.85 : drumType === 'snare' ? 0.75 : 0.55,
          duration: '16n',
        };

        drumPattern.events.push(event);
      }
    });
  });

  return drumPattern;
}

/**
 * Create a fallback pattern based on genre
 * Used when MIDI loading fails
 */
export function createFallbackPatternByGenre(
  genre: string,
): GridPatternWithSixteenths {
  const toGridCells = (arr: number[]): GridCell[] =>
    arr.map((v) => ({ main: v, sixteenth: 0 }));

  const newPattern: GridPatternWithSixteenths = {
    kick: toGridCells([0, 0, 0, 0, 0, 0, 0, 0]),
    snare: toGridCells([0, 0, 0, 0, 0, 0, 0, 0]),
    hihat: toGridCells([0, 0, 0, 0, 0, 0, 0, 0]),
  };

  // Simple pattern generation based on genre
  if (genre === 'rock') {
    newPattern.kick = toGridCells([1, 0, 0, 0, 1, 0, 0, 0]);
    newPattern.snare = toGridCells([0, 0, 1, 0, 0, 0, 1, 0]);
    newPattern.hihat = toGridCells([1, 1, 1, 1, 1, 1, 1, 1]);
  } else if (genre === 'jazz') {
    newPattern.kick = toGridCells([1, 0, 0, 0, 0, 0, 1, 0]);
    newPattern.snare = toGridCells([0, 0, 0, 0, 1, 0, 0, 0]);
    newPattern.hihat = toGridCells([1, 0, 1, 1, 0, 1, 1, 0]);
  } else if (genre === 'funk') {
    newPattern.kick = toGridCells([1, 0, 0, 1, 0, 0, 1, 0]);
    newPattern.snare = toGridCells([0, 1, 0, 1, 0, 0, 1, 0]);
    newPattern.hihat = toGridCells([1, 1, 0, 1, 1, 0, 1, 1]);
  }

  return newPattern;
}
